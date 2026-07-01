import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { prisma } from '$lib/server/prisma';
import { submitScoreSchema } from '$lib/schema';
import { hashToken, verifyToken } from '$lib/server/crypto';
import { Prisma, type Score } from '../generated/prisma/client';

// Anti-cheat / UX thresholds for reconciling client and server timing.
// These are independent concerns and intentionally kept separate:
const CLIENT_TIME_TOLERANCE_MS = 200; // UX: below this, trust client's displayed time
const NOTICE_THRESHOLD_MS = 400; // UX: below this, no "verified by server" message
const MAX_ALLOWED_TIME_DRIFT_MS = 1000; // Security: above this, flag the session

export const load: PageServerLoad = async () => {
	const game = await prisma.game.findFirst({
		include: {
			targets: {
				select: {
					id: true,
					name: true,
					displayName: true,
					imagePath: true
				},
				orderBy: { id: 'asc' }
			}
		}
	});

	if (!game) {
		throw error(404, 'No game found. Run seed script first');
	}

	return {
		game: {
			id: game.id,
			title: game.title,
			imagePath: game.imagePath
		},
		targets: game.targets
	};
};

export const actions = {
	submitScore: async ({ request }) => {
		const formData = await request.formData();
		const raw = {
			token: formData.get('token'),
			clientDuration: formData.get('clientDuration'),
			playerName: formData.get('playerName')
		};

		const result = submitScoreSchema.safeParse(raw);

		if (!result.success) {
			return fail(400, {
				error: result.error.issues[0].message,
				errorCode: 'VALIDATION',
				playerName: raw.playerName?.toString() ?? ''
			});
		}

		// clientDuration is used only to compute drift for anti-cheat detection
		// and to decide whether to show a verification notice. It is never
		// persisted and never trusted as the official score.
		const { token, clientDuration, playerName } = result.data;

		// Token verification
		const payload = verifyToken(token);

		if (!payload) {
			return fail(401, {
				error: 'Invalid or tampered session token',
				errorCode: 'FLAGGED',
				playerName
			});
		}

		// Session lookup
		const tokenHashValue = hashToken(token);
		const session = await prisma.gameSession.findUnique({
			where: { tokenHash: tokenHashValue },
			include: { game: true, score: true }
		});

		if (!session) {
			return fail(404, {
				error: 'Session not Found',
				errorCode: 'FLAGGED',
				playerName
			});
		}

		if (session.status !== 'ACTIVE') {
			return fail(400, {
				error: 'Score already submitted',
				errorCode: 'FLAGGED',
				playerName
			});
		}

		if (session.score) {
			return fail(400, {
				error: 'Score already submitted',
				errorCode: 'FLAGGED',
				playerName
			});
		}

		// Hit verification - must happen before timing, since a session that
		// hasn't found every target has no valid completedAt to trust.
		const totalTargets = await prisma.target.count({
			where: { gameId: session.game.id }
		});

		const verifiedHits = await prisma.hit.count({
			where: { sessionId: session.id, verified: true }
		});

		if (verifiedHits < totalTargets) {
			return fail(400, {
				error: `Only ${verifiedHits}/${totalTargets} targets verified`,
				errorCode: 'SERVER_ERROR',
				playerName
			});
		}

		if (!session.completedAt) {
			return fail(400, {
				error: 'Score could not be verified',
				errorCode: 'SERVER_ERROR',
				playerName
			});
		}

		// clientDuration is never trusted as the official score. It is only
		// compared against serverDuration to:
		// 1. detect suspicious drift (anti-cheat),
		// 2. determine displayDuration (what the UI should show),
		// 3. determine whether to show a verification notice.
		const serverDuration = session.completedAt.getTime() - payload.startedAt;
		const drift = Math.abs(clientDuration - serverDuration);

		if (
			serverDuration < session.game.minTimeMs ||
			drift >= MAX_ALLOWED_TIME_DRIFT_MS
		) {
			await prisma.gameSession.update({
				where: { id: session.id },
				data: { status: 'FLAGGED' }
			});

			return fail(400, {
				error: 'Score could not be verified',
				errorCode: 'FLAGGED',
				playerName
			});
		}

		const displayDuration =
			drift <= CLIENT_TIME_TOLERANCE_MS ? clientDuration : serverDuration;
		const showOfficialDuration = drift > CLIENT_TIME_TOLERANCE_MS;
		const showVerificationNotice = drift >= NOTICE_THRESHOLD_MS;

		// Write Score — always the server-computed duration, regardless of
		// what is shown to the player in this response. A concurrent duplicate
		// submission for this session can slip past the session.score check
		// above and race us here — the unique constraint on Score.sessionId is
		// the real guard.
		let score: Score;

		try {
			[score] = await prisma.$transaction([
				prisma.score.create({
					data: { sessionId: session.id, playerName, timeMs: serverDuration }
				}),
				prisma.gameSession.update({
					where: { id: session.id },
					data: { status: 'COMPLETED' }
				})
			]);
		} catch (err) {
			if (
				err instanceof Prisma.PrismaClientKnownRequestError &&
				err.code === 'P2002'
			) {
				return fail(400, {
					error: 'Score already submitted',
					errorCode: 'FLAGGED',
					playerName
				});
			}

			throw err;
		}

		// Count trusted scores that sort strictly before this one under the same
		// ordering the leaderboard uses (timeMs asc, createdAt asc as tiebreak),
		// so ties don't collapse onto the same rank number.
		const rank = await prisma.score.count({
			where: {
				trustStatus: 'TRUSTED',
				OR: [
					{ timeMs: { lt: score.timeMs } },
					{ timeMs: score.timeMs, createdAt: { lt: score.createdAt } }
				]
			}
		});

		return {
			success: true,
			scoreId: score.id,
			officialDuration: serverDuration,
			displayDuration,
			showOfficialDuration,
			showVerificationNotice,
			rank: rank + 1
		};
	}
} satisfies Actions;

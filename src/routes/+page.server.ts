import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { submitScoreSchema } from '$lib/schema';
import { hashToken, verifyToken } from '$lib/server/crypto';
import { prisma } from '$lib/server/prisma';

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
			durationMs: formData.get('durationMs'),
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

		const { token, durationMs, playerName } = result.data;

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

		// Timing validation
		const serverElapsedMs = Date.now() - payload.startedAt;
		const timingInvalid =
			durationMs < session.game.minTimeMs || durationMs > serverElapsedMs;

		if (timingInvalid) {
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

		// Hit verification
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

		// Write Score
		const [score] = await prisma.$transaction([
			prisma.score.create({
				data: { sessionId: session.id, playerName, timeMs: durationMs }
			}),
			prisma.gameSession.update({
				where: { id: session.id },
				data: { status: 'COMPLETED', completedAt: new Date() }
			})
		]);

		const rank = await prisma.score.count({
			where: { timeMs: { lt: score.timeMs } }
		});

		redirect(303, `/leaderboard?rank=${rank + 1}&time=${score.timeMs}`);
	}
} satisfies Actions;

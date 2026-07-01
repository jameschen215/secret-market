import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { prisma } from '$lib/server/prisma';
import { checkHit } from '$lib/hit-detection';
import { verifyHitSchema } from '$lib/schema';
import { hashToken, verifyToken } from '$lib/server/crypto';
import type { BoundingBox, PolygonPoint } from '$lib/types';
import { Prisma } from '../../../generated/prisma/client';

const RATE_LIMIT_WINDOW_MS = 10_000;
const MAX_VERIFY_ATTEMPTS_PER_WINDOW = 12;
// How often to sweep stale sessions out of verifyAttempts. Piggybacks on
// real request traffic rather than a background timer, so entries for
// sessions that stop sending requests don't accumulate forever.
const SWEEP_INTERVAL_MS = 60_000;

const verifyAttempts = new Map<string, number[]>();
let lastSweep = Date.now();

function sweepStaleEntries(now: number) {
	if (now - lastSweep < SWEEP_INTERVAL_MS) return;

	lastSweep = now;
	const windowStart = now - RATE_LIMIT_WINDOW_MS;

	for (const [sessionId, timestamps] of verifyAttempts) {
		if (timestamps.every((timestamp) => timestamp <= windowStart)) {
			verifyAttempts.delete(sessionId);
		}
	}
}

function assertWithinRateLimit(sessionId: string) {
	const now = Date.now();
	const windowStart = now - RATE_LIMIT_WINDOW_MS;

	sweepStaleEntries(now);

	const attempts = (verifyAttempts.get(sessionId) ?? []).filter(
		(timestamp) => timestamp > windowStart
	);

	if (attempts.length >= MAX_VERIFY_ATTEMPTS_PER_WINDOW) {
		verifyAttempts.set(sessionId, attempts);
		throw error(429, 'Too many verification attempts');
	}

	attempts.push(now);
	verifyAttempts.set(sessionId, attempts);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	const result = verifyHitSchema.safeParse(body);

	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { token, targetId, clickX, clickY } = result.data;
	const payload = verifyToken(token);

	if (!payload) {
		throw error(401, 'Invalid or tampered session token');
	}

	const tokenHashValue = hashToken(token);
	const session = await prisma.gameSession.findUnique({
		where: { tokenHash: tokenHashValue }
	});

	if (!session) {
		throw error(404, 'Session not Found');
	}

	if (session.id !== payload.sessionId || session.gameId !== payload.gameId) {
		throw error(401, 'Session token does not match this session');
	}

	if (session.status !== 'ACTIVE') {
		throw error(400, `Session is ${session.status.toLowerCase()}, not active`);
	}

	assertWithinRateLimit(session.id);

	// Check if this target was already found in this session
	const existingHit = await prisma.hit.findUnique({
		where: { sessionId_targetId: { sessionId: session.id, targetId } }
	});

	if (existingHit) {
		throw error(400, 'Target already found in this session');
	}

	// Load real polygon data from DB
	const target = await prisma.target.findFirst({
		where: { id: targetId, gameId: session.gameId }
	});

	if (!target) {
		throw error(404, 'Target not Found for this game');
	}

	// Server-side ray casting with real (unencrypted) data
	const polygon = target.polygonPoints as unknown as PolygonPoint[];
	const boundingBox = target.boundingBox as unknown as BoundingBox;
	const isHit = checkHit(clickX, clickY, polygon, boundingBox);

	// Record the hit attempt regardless of result. A concurrent request for
	// the same target can slip past the existingHit check above and race us
	// here — the unique constraint on (sessionId, targetId) is the real guard.
	try {
		await prisma.hit.create({
			data: {
				sessionId: session.id,
				targetId,
				clickX,
				clickY,
				verified: isHit
			}
		});
	} catch (err) {
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === 'P2002'
		) {
			throw error(400, 'Target already found in this session');
		}

		throw err;
	}

	if (!isHit) {
		return json({
			hit: false,
			message: 'Server verification failed'
		});
	}

	// Check if all targets for this game are now found
	const totalTargets = await prisma.target.count({
		where: { gameId: session.gameId }
	});
	const verifiedHits = await prisma.hit.count({
		where: { sessionId: session.id, verified: true }
	});

	const allFound = verifiedHits >= totalTargets;

	// Stamp the exact moment of completion server-side. This becomes the
	// authoritative end-of-game timestamp used to compute serverDuration —
	// it must be recorded here, not at score-submission time, so that
	// time spent typing a player name is never counted against the score.
	if (allFound) {
		await prisma.gameSession.update({
			where: { id: session.id },
			data: { completedAt: new Date() }
		});
	}

	return json({
		hit: true,
		targetId,
		allFound,
		found: verifiedHits,
		total: totalTargets
	});
};

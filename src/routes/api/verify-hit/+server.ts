import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { prisma } from '$lib/server/prisma';
import { checkHit } from '$lib/hit-detection';
import { verifyHitSchema } from '$lib/schema';
import type { BoundingBox, PolygonPoint } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	const result = verifyHitSchema.safeParse(body);

	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { sessionId, targetId, clickX, clickY } = result.data;

	// Load session and verify it's active
	const session = await prisma.gameSession.findUnique({
		where: { id: sessionId }
	});

	if (!session) {
		throw error(404, 'Session not Found');
	}

	if (session.status !== 'ACTIVE') {
		throw error(400, `Session is ${session.status.toLowerCase()}, not active`);
	}

	// Check if this target was already found in this session
	const existingHit = await prisma.hit.findUnique({
		where: { sessionId_targetId: { sessionId, targetId } }
	});

	if (existingHit) {
		throw error(400, 'Target already found in this session');
	}

	// Load real polygon data from DB
	const target = await prisma.target.findUnique({
		where: { id: targetId }
	});

	if (!target) {
		throw error(404, 'Target not Found');
	}

	// Server-side ray casting with real (unencrypted) data
	const polygon = target.polygonPoints as unknown as PolygonPoint[];
	const boundingBox = target.boundingBox as unknown as BoundingBox;
	const isHit = checkHit(clickX, clickY, polygon, boundingBox);

	// Record the hit attempt regardless of result
	await prisma.hit.create({
		data: {
			sessionId,
			targetId,
			clickX,
			clickY,
			verified: isHit
		}
	});

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
		where: { sessionId, verified: true }
	});

	const allFound = verifiedHits >= totalTargets;

	return json({
		hit: true,
		targetId,
		allFound,
		found: verifiedHits,
		total: totalTargets
	});
};

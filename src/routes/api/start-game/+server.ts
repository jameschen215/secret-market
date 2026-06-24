import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { init as initCuid } from '@paralleldrive/cuid2';

import { startGameSchema } from '$lib/schema';
import { prisma } from '$lib/server/prisma';
import type {
	BoundingBox,
	EncryptedTarget,
	PolygonPoint,
	TokenPayload
} from '$lib/types';
import {
	deriveSessionParams,
	encryptBoundingBox,
	encryptPolygon,
	hashToken,
	signToken
} from '$lib/server/crypto';

const createId = initCuid();

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	const result = startGameSchema.safeParse(body);

	if (!result.success) {
		throw error(400, result.error.issues[0].message);
	}

	const { gameId } = result.data;

	// Load game with targets
	const game = await prisma.game.findUnique({
		where: { id: gameId },
		include: { targets: true }
	});

	if (!game) {
		throw error(404, 'Game not Found');
	}

	// Generate session ID upfront so we can sign the token
	// and create the session in a single DB write
	const sessionId = createId();
	const cryptoParams = deriveSessionParams(sessionId);

	// Sign token before DB write so tokenHash is ready
	const startedAt = Date.now();
	const tokenPayload: TokenPayload = {
		sessionId,
		gameId,
		startedAt
	};

	const token = signToken(tokenPayload);
	const tokenHashValue = hashToken(token);

	await prisma.gameSession.create({
		data: {
			id: sessionId,
			gameId,
			tokenHash: tokenHashValue,
			status: 'ACTIVE'
		}
	});

	// Encrypt all target's polygons using this session's parameters
	const encryptedTargets: EncryptedTarget[] = game.targets.map((t) => {
		const polygon = t.polygonPoints as unknown as PolygonPoint[];
		const boundingBox = t.boundingBox as unknown as BoundingBox;

		return {
			id: t.id,
			name: t.name,
			displayName: t.displayName,
			imagePath: t.imagePath,
			encryptedPolygon: encryptPolygon(polygon, cryptoParams),
			encryptedBoundingBox: encryptBoundingBox(boundingBox, cryptoParams)
		};
	});

	return json({
		sessionId,
		token,
		encryptedTargets,
		decryptionParams: cryptoParams,
		startedAt
	});
};

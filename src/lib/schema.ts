import * as z from 'zod';

export const startGameSchema = z.object({
	gameId: z.number({ error: 'Game ID is required' }).int().positive()
});

export const verifyHitSchema = z.object({
	sessionId: z
		.string({ error: 'Session ID is required' })
		.min(1, 'Session ID cannot be empty'),
	targetId: z.number({ error: 'Target ID is required' }).int().positive(),
	clickX: z
		.number({ error: 'clickX is required' })
		.min(0, 'clickX must be >= 0')
		.max(1, 'clickX must be <= 1'),
	clickY: z
		.number({ error: 'clickY is required' })
		.min(0, 'clickY must be >= 0')
		.max(1, 'clickY must be <= 1')
});

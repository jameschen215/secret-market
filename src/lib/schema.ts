import * as z from 'zod';

export const startGameSchema = z.object({
	gameId: z.number({ error: 'Game ID is required' }).int().positive()
});

export const verifyHitSchema = z.object({
	token: z
		.string({ error: 'token is required' })
		.min(1, 'token cannot be empty'),
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

export const submitScoreSchema = z.object({
	token: z
		.string({ error: 'token is required' })
		.min(1, 'token cannot be empty'),
	clientDuration: z.coerce
		.number({ error: 'clientDuration is required' })
		.int()
		.positive('clientDuration must be positive'),
	playerName: z
		.string({ error: 'playerName is required' })
		.trim()
		.min(1, 'playerName cannot be empty')
		.max(20, 'playerName must be 20 characters or fewer')
});

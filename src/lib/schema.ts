import * as z from 'zod';

export const startGameSchema = z.object({
	gameId: z.number({ error: 'Game ID is required' }).int().positive()
});

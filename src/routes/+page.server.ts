import { prisma } from '$lib/server/prisma';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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

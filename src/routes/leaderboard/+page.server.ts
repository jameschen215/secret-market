import { prisma } from '$lib/server/prisma';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 10;

function getIntParam(url: URL, key: string): number | null {
	const val = url.searchParams.get(key);

	return val ? parseInt(val, 10) : null;
}

export const load: PageServerLoad = async ({ url }) => {
	const highlightRank = getIntParam(url, 'rank');
	const highlightTime = getIntParam(url, 'time');
	const page = Math.max(1, getIntParam(url, 'page') ?? 1);

	const [scores, totalCount, game] = await Promise.all([
		prisma.score.findMany({
			orderBy: { timeMs: 'asc' },
			take: PAGE_SIZE,
			skip: (page - 1) * PAGE_SIZE,
			select: {
				id: true,
				playerName: true,
				timeMs: true,
				createdAt: true
			}
		}),
		prisma.score.count(),
		prisma.game.findFirst({ select: { id: true } })
	]);

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);

	// If the player's rank is outside the top 10, fetch their scores separately
	const playerScoreOnCurrentPage =
		highlightRank !== null &&
		highlightRank >= (page - 1) * PAGE_SIZE + 1 &&
		highlightRank <= page * PAGE_SIZE;

	const playerScoreNotOnCurrentPage =
		highlightRank !== null &&
		highlightTime !== null &&
		!playerScoreOnCurrentPage;

	const playerScore = playerScoreNotOnCurrentPage
		? await prisma.score.findFirst({
				where: { timeMs: highlightTime },
				select: { id: true, playerName: true, timeMs: true, createdAt: true }
			})
		: null;

	return {
		scores,
		playerScore,
		highlightRank,
		highlightTime,
		page,
		totalPages,
		totalCount,
		gameId: game?.id ?? null
	};
};

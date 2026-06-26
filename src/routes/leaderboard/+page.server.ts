import { prisma } from '$lib/server/prisma';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 10;

export const load: PageServerLoad = async ({ url }) => {
	const highlightRank = url.searchParams.get('rank')
		? parseInt(url.searchParams.get('rank')!)
		: null;

	const highlightTime = url.searchParams.get('time')
		? parseInt(url.searchParams.get('time')!)
		: null;

	const page = Math.max(
		1,
		url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 1
	);

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

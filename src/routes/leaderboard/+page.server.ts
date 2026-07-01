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
	const highlightId = getIntParam(url, 'id');
	const page = Math.max(1, getIntParam(url, 'page') ?? 1);

	const [scores, totalCount] = await Promise.all([
		prisma.score.findMany({
			orderBy: [
				{ trustStatus: 'asc' },
				{ timeMs: 'asc' },
				{ createdAt: 'asc' }
			],
			take: PAGE_SIZE,
			skip: (page - 1) * PAGE_SIZE,
			select: {
				id: true,
				playerName: true,
				timeMs: true,
				trustStatus: true,
				trustReason: true,
				createdAt: true
			}
		}),
		prisma.score.count()
	]);

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);

	// If the player's score isn't in this page's results, fetch it separately
	// by its exact id — matching by timeMs/rank alone is ambiguous whenever
	// two scores tie.
	const playerScoreOnCurrentPage =
		highlightId !== null && scores.some((score) => score.id === highlightId);

	const playerScoreNotOnCurrentPage =
		highlightId !== null && !playerScoreOnCurrentPage;

	const playerScore = playerScoreNotOnCurrentPage
		? await prisma.score.findUnique({
				where: { id: highlightId },
				select: {
					id: true,
					playerName: true,
					timeMs: true,
					trustStatus: true,
					trustReason: true,
					createdAt: true
				}
			})
		: null;

	return {
		scores,
		playerScore,
		highlightRank,
		highlightTime,
		highlightId,
		page,
		totalPages,
		totalCount
	};
};

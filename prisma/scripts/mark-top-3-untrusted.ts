import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DIRECT_URL or DATABASE_URL is required');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
	const topScores = await prisma.score.findMany({
		orderBy: [{ timeMs: 'asc' }, { createdAt: 'asc' }],
		take: 3,
		select: {
			id: true,
			playerName: true,
			timeMs: true,
			trustStatus: true
		}
	});

	if (topScores.length === 0) {
		console.log('No scores found.');
		return;
	}

	const reviewedAt = new Date();
	const updated = await prisma.score.updateMany({
		where: { id: { in: topScores.map((score) => score.id) } },
		data: {
			trustStatus: 'UNTRUSTED',
			trustReason: 'Suspicious completion time before anti-cheat hardening',
			reviewedAt
		}
	});

	console.log(
		`Marked ${updated.count} score(s) as untrusted at ${reviewedAt.toISOString()}`
	);
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (error) => {
		console.error('Moderation script failed:', error);
		await prisma.$disconnect();
		process.exit(1);
	});

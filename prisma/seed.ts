import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const prisma = new PrismaClient({ adapter });

type PolygonPoint = { x: number; y: number };

function computeBoundingBox(points: PolygonPoint[]) {
	let minX = Infinity,
		minY = Infinity;
	let maxX = -Infinity,
		maxY = -Infinity;

	for (const { x, y } of points) {
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}

	return { minX, minY, maxX, maxY };
}

const finnPolygon: PolygonPoint[] = [
	{ x: 0.2273, y: 0.4848 },
	{ x: 0.2153, y: 0.6092 },
	{ x: 0.2343, y: 0.5825 },
	{ x: 0.2502, y: 0.5967 },
	{ x: 0.2582, y: 0.5665 },
	{ x: 0.2532, y: 0.5381 },
	{ x: 0.2582, y: 0.4955 },
	{ x: 0.2433, y: 0.4742 }
];

const rubyPolygon: PolygonPoint[] = [
	{ x: 0.8022, y: 0.7441 },
	{ x: 0.7812, y: 0.7637 },
	{ x: 0.7742, y: 0.7885 },
	{ x: 0.7752, y: 0.8152 },
	{ x: 0.7622, y: 0.8223 },
	{ x: 0.7423, y: 0.8969 },
	{ x: 0.7283, y: 0.9608 },
	{ x: 0.7722, y: 0.9963 },
	{ x: 0.8581, y: 0.9946 },
	{ x: 0.8531, y: 0.9075 },
	{ x: 0.8392, y: 0.8933 },
	{ x: 0.8212, y: 0.8844 },
	{ x: 0.8092, y: 0.8418 },
	{ x: 0.8292, y: 0.8028 },
	{ x: 0.8252, y: 0.785 },
	{ x: 0.8227, y: 0.7619 },
	{ x: 0.8047, y: 0.8844 },
	{ x: 0.7937, y: 0.904 },
	{ x: 0.8087, y: 0.9111 },
	{ x: 0.8157, y: 0.9075 }
];

const sagePolygon: PolygonPoint[] = [
	{ x: 0.7073, y: 0.4884 },
	{ x: 0.7213, y: 0.4742 },
	{ x: 0.7313, y: 0.492 },
	{ x: 0.7263, y: 0.5417 },
	{ x: 0.7423, y: 0.5879 },
	{ x: 0.7502, y: 0.737 },
	{ x: 0.7473, y: 0.7512 },
	{ x: 0.7542, y: 0.7974 },
	{ x: 0.7303, y: 0.8294 },
	{ x: 0.6873, y: 0.8258 },
	{ x: 0.6743, y: 0.8116 },
	{ x: 0.6693, y: 0.5594 },
	{ x: 0.6813, y: 0.563 },
	{ x: 0.6773, y: 0.6447 },
	{ x: 0.6863, y: 0.6553 },
	{ x: 0.6968, y: 0.5896 },
	{ x: 0.6828, y: 0.5736 },
	{ x: 0.7028, y: 0.5541 },
	{ x: 0.7188, y: 0.4991 },
	{ x: 0.7168, y: 0.4831 }
];

const gameImageData = [
	{
		slug: 'village-square',
		title: 'Village Square',
		imagePath: '/images/game/main.png',
		minTimeMs: 3000,
		targets: {
			create: [
				{
					name: 'finn',
					displayName: 'Finn',
					imagePath: '/images/characters/finn.png',
					polygonPoints: finnPolygon,
					boundingBox: computeBoundingBox(finnPolygon)
				},
				{
					name: 'ruby',
					displayName: 'Ruby',
					imagePath: '/images/characters/ruby.png',
					polygonPoints: rubyPolygon,
					boundingBox: computeBoundingBox(rubyPolygon)
				},
				{
					name: 'sage',
					displayName: 'Sage',
					imagePath: '/images/characters/sage.png',
					polygonPoints: sagePolygon,
					boundingBox: computeBoundingBox(sagePolygon)
				}
			]
		}
	}
];

async function main() {
	await prisma.score.deleteMany();
	await prisma.hit.deleteMany();
	await prisma.gameSession.deleteMany();
	await prisma.target.deleteMany();
	await prisma.game.deleteMany();

	for (const data of gameImageData) {
		await prisma.game.create({ data });
	}
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error('Seed failed: ', e);

		await prisma.$disconnect();
		process.exit(1);
	});

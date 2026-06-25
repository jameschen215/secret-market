import type { BoundingBox, PolygonPoint } from './types';

/**
 * Decrypts polygon points received from the server.
 *
 * Reverse formula: x = (x' - OFFSET_X) / KEY
 *                  y = (y' - OFFSET_Y) / KEY
 *
 * @param encoded - Base64 encoded encrypted polygon string
 * @param a - Scale factor (KEY)
 * @param bx - X offset (OFFSET_X)
 * @param by - Y offset (OFFSET_Y)
 */
export function decryptPolygon(
	encoded: string,
	a: number,
	bx: number,
	by: number
): PolygonPoint[] {
	try {
		const raw = JSON.parse(atob(encoded)) as { x: number; y: number }[];

		return raw.map(({ x, y }) => ({
			x: (x - bx) / a,
			y: (y - by) / a
		}));
	} catch {
		return [];
	}
}

/**
 * Decrypts a bounding box received from the server.
 */
export function decryptBoundingBox(
	encoded: string,
	a: number,
	bx: number,
	by: number
): BoundingBox {
	try {
		const raw = JSON.parse(atob(encoded)) as BoundingBox;

		return {
			minX: (raw.minX - bx) / a,
			minY: (raw.minY - by) / a,
			maxX: (raw.maxX - bx) / a,
			maxY: (raw.maxY - by) / a
		};
	} catch {
		return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
	}
}

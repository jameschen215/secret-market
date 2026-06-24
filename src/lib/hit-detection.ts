import type { BoundingBox, PolygonPoint } from './types';

/**
 * O(1) fast-reject check.
 * If the check is outside the bounding box, skip the expensive ray cast.
 */
export function inBoundingBox(
	clickX: number,
	clickY: number,
	box: BoundingBox
): boolean {
	return (
		clickX >= box.minX &&
		clickX <= box.maxX &&
		clickY >= box.minY &&
		clickY <= box.maxY
	);
}

/**
 * Ray Casting algorithm (PNPOLY).
 *
 * Casts a horizontal ray from the click point to the right.
 * Counts how many polygon edges the ray crosses:
 *   - Odd intersections → point is inside
 *   - Even intersections → point is outside
 *
 * Works with any simple polygon (convex or concave, no self-intersections).
 */
export function isPointInPolygon(
	clickX: number,
	clickY: number,
	polygon: PolygonPoint[]
): boolean {
	let inside = false;

	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i].x;
		const yi = polygon[i].y;
		const xj = polygon[j].x;
		const yj = polygon[j].y;

		// Check if the ray crosses this edge
		const intersects =
			yi > clickY !== yj > clickY &&
			clickX < ((xj - xi) * (clickY - yi)) / (yj - yi) + xi;

		if (intersects) inside = !inside;
	}

	return inside;
}

/**
 * Full hit detection pipeline.
 * Bounding box pre-check -> Ray Cast.
 */
export function checkHit(
	clickX: number,
	clickY: number,
	polygon: PolygonPoint[],
	boundingBox: BoundingBox
): boolean {
	if (!inBoundingBox(clickX, clickY, boundingBox)) return false;

	return isPointInPolygon(clickX, clickY, polygon);
}

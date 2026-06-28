import { SESSION_SECRET } from '$env/static/private';
import type { BoundingBox, PolygonPoint, TokenPayload } from '$lib/types';
import { createHash, createHmac } from 'crypto';

export interface SessionCryptoParams {
	a: number;
	bx: number;
	by: number;
}

/**
 * Derive a unique affine transform (a, bx, by) per session
 *
 * Seed from sessionId + SESSION_SECRET, so
 *  - Every session gets different encryption parameters
 *  - Params are never stored or transmitted as raw static values
 *  - A leaked param set is useless for any other session
 */
export function deriveSessionParams(sessionId: string): SessionCryptoParams {
	const hash = createHash('sha256')
		.update(`${sessionId}:${SESSION_SECRET}`)
		.digest('hex');

	const a = 2 + (parseInt(hash.slice(0, 8), 16) % 1000) / 100; // 2.00-11.99
	const bx = (parseInt(hash.slice(8, 16), 16) % 10000) / 100; // 0.00-99.99
	const by = (parseInt(hash.slice(16, 24), 16) % 10000) / 100; // 0.00-99.99

	return { a, bx, by };
}

/**
 * Encrypts polygon points using a session-specific affine transformation.
 * Server-side only - called before sending target data to the client.
 *
 * Formula: x' = (x * a) + bx
 *          y' = (y * a) + by
 */
export function encryptPolygon(
	points: PolygonPoint[],
	params: SessionCryptoParams
): string {
	const { a, bx, by } = params;

	const transformed = points.map(({ x, y }) => ({
		x: parseFloat((x * a + bx).toFixed(6)),
		y: parseFloat((y * a + by).toFixed(6))
	}));

	return btoa(JSON.stringify(transformed));
}

/**
 * Encrypt a bounding box using the same session-specific transformation.
 */
export function encryptBoundingBox(
	box: BoundingBox,
	params: SessionCryptoParams
): string {
	const { a, bx, by } = params;

	const transformed = {
		minX: parseFloat((box.minX * a + bx).toFixed(6)),
		minY: parseFloat((box.minY * a + by).toFixed(6)),
		maxX: parseFloat((box.maxX * a + bx).toFixed(6)),
		maxY: parseFloat((box.maxY * a + by).toFixed(6))
	};

	return btoa(JSON.stringify(transformed));
}

// Session Token Signing
/**
 * Create an HMAC-SHA256 signed token from a session payload.
 * The token is: base64(payload).signature
 */
export function signToken(payload: TokenPayload): string {
	const data = btoa(JSON.stringify(payload));
	const signature = createHmac('sha256', SESSION_SECRET)
		.update(data)
		.digest('hex');

	return `${data}.${signature}`;
}

/**
 * Verifies and decodes a signed token.
 * Returns the payload if valid, null if tampered.
 */
export function verifyToken(token: string): TokenPayload | null {
	const parts = token.split('.');

	if (parts.length !== 2) return null;

	const [data, signature] = parts;

	const expectedSignature = createHmac('sha256', SESSION_SECRET)
		.update(data)
		.digest('hex');

	// Timing-safe comparison to prevent timing attacks
	if (signature.length !== expectedSignature.length) return null;

	let mismatch = 0;

	for (let i = 0; i < signature.length; i++) {
		mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
	}

	if (mismatch !== 0) return null;

	try {
		return JSON.parse(atob(data)) as TokenPayload;
	} catch {
		return null;
	}
}

/**
 * Generates the tokenHash stored in the database.
 * This links the DB session to the signed token without storing the full token.
 */
export function hashToken(token: string): string {
	return createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
}

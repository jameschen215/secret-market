// Geometry types - used by both client and server
export interface PolygonPoint {
	x: number;
	y: number;
}

export interface BoundingBox {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

// Target sent to the client - polygon data is encrypted
export interface EncryptedTarget {
	id: number;
	name: string;
	displayName: string;
	imagePath: string;
	encryptedPolygon: string;
	encryptedBoundingBox: string;
}

// Session token payload - signed by server, verified on submission
export interface TokenPayload {
	sessionId: string;
	gameId: number;
	startedAt: number; // Unix timestamp in ms
}

export interface TargetInfo {
	id: number;
	name: string;
	displayName: string;
	imagePath: string;
}

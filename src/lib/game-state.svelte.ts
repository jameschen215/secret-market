import { SvelteSet } from 'svelte/reactivity';
import type { EncryptedTarget } from './types';
import { decryptBoundingBox, decryptPolygon } from './decrypt';
import { checkHit } from './hit-detection';

type GamePhase = 'idle' | 'playing' | 'completed';

interface DecryptionParams {
	a: number;
	bx: number;
	by: number;
}

interface ClickFeedback {
	locationX: number;
	locationY: number;
	type: 'hit' | 'miss';
	targetName?: string;
}

interface SessionData {
	sessionId: string;
	token: string;
	encryptedTargets: EncryptedTarget[];
	decryptionParams: DecryptionParams;
	startedAt: number;
}

const FEEDBACK_DURATION = 1200;

// CORE STATE

let phase = $state<GamePhase>('idle');
let sessionId = $state<string | null>(null);
let token = $state<string | null>(null);
let encryptedTargets = $state<EncryptedTarget[]>([]);
let decryptionParams = $state<DecryptionParams | null>(null);
let foundTargetIds = new SvelteSet<number>();
let feedback = $state<ClickFeedback | null>(null);

let preloading = $state(false);

// Verify-hit requests are fired without blocking the UI (see verifyHitOnServer),
// but score submission must not race ahead of the final target's verification
// landing server-side. Track in-flight requests so submission can wait on them.
const pendingVerifications = new Set<Promise<void>>();

// Timer State
let timerStart = $state(0);
let timerElapsed = $state(0);
let timerRunning = $state(false);
let timerFrame = 0;

function tickTimer() {
	if (!timerRunning) return;

	timerElapsed = performance.now() - timerStart;
	timerFrame = requestAnimationFrame(tickTimer);
}

function showFeedback(
	locationX: number,
	locationY: number,
	type: 'hit' | 'miss',
	targetName?: string
) {
	feedback = { locationX, locationY, type, targetName };

	setTimeout(() => {
		feedback = null;
	}, FEEDBACK_DURATION);
}

function applySession(data: SessionData) {
	sessionId = data.sessionId;
	token = data.token;
	encryptedTargets = data.encryptedTargets;
	decryptionParams = data.decryptionParams;
	foundTargetIds = new SvelteSet();
	feedback = null;

	timerStart = performance.now();
	timerElapsed = 0;
	timerRunning = true;
	phase = 'playing';
	tickTimer();
}

async function fetchAndStartGame(gameId: number) {
	preloading = true;

	try {
		const res = await fetch('/api/start-game', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId })
		});

		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.message ?? 'Failed to start game');
		}

		applySession(await res.json());
	} finally {
		preloading = false;
	}
}

function verifyHitOnServer(
	targetId: number,
	clickX: number,
	clickY: number
): Promise<void> {
	if (!token) return Promise.resolve();

	const request = fetch('/api/verify-hit', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token, targetId, clickX, clickY })
	})
		.then(() => {})
		.catch((err) => {
			console.error('Server verification failed: ', err);
		});

	pendingVerifications.add(request);
	request.finally(() => pendingVerifications.delete(request));

	return request;
}

// PUBLIC API
export function getPhase() {
	return phase;
}

export function getToken() {
	return token;
}

export function getElapsed() {
	return timerElapsed;
}

export function getEncryptedTargets() {
	return encryptedTargets;
}

export function getFeedback() {
	return feedback;
}

export function isTimerRunning() {
	return timerRunning;
}

export function isTargetFound(targetId: number) {
	return foundTargetIds.has(targetId);
}

export function isPreloading() {
	return preloading;
}

// Score submission must wait for every fire-and-forget verify-hit request
// (in particular the one for the final target) to reach the server first,
// otherwise a fast submission can be rejected as under-verified.
export async function awaitPendingVerifications() {
	await Promise.allSettled(pendingVerifications);
}

// Session creation must happen only when the player actually starts.
export function preloadSession(_gameId: number) {
	// Intentionally disabled: creating a session before the player clicks Start
	// starts the authoritative server timer early and flags honest submissions.
}

export function startGame(gameId: number): Promise<void> | void {
	return fetchAndStartGame(gameId);
}

export function resetGame() {
	phase = 'idle';
	sessionId = null;
	token = null;
	encryptedTargets = [];
	decryptionParams = null;
	feedback = null;
	foundTargetIds.clear();

	timerStart = 0;
	timerElapsed = 0;
	timerRunning = false;
	cancelAnimationFrame(timerFrame);
}

export function handleClick(
	clickX: number,
	clickY: number,
	targetId: number,
	feedbackX: number,
	feedbackY: number
): { hit: boolean; targetName: string } {
	if (phase !== 'playing' || !decryptionParams) {
		return { hit: false, targetName: '' };
	}

	const target = encryptedTargets.find((t) => t.id === targetId);

	if (!target || foundTargetIds.has(target.id)) {
		return { hit: false, targetName: '' };
	}

	// Check hit or not
	const { a, bx, by } = decryptionParams;
	const polygon = decryptPolygon(target.encryptedPolygon, a, bx, by);
	const boundingBox = decryptBoundingBox(
		target.encryptedBoundingBox,
		a,
		bx,
		by
	);

	const hit = checkHit(clickX, clickY, polygon, boundingBox);

	if (hit) {
		// Optimistic UI update - immediately
		foundTargetIds.add(target.id);
		showFeedback(feedbackX, feedbackY, 'hit', target.displayName);

		// Async server verification - don't block UI
		verifyHitOnServer(targetId, clickX, clickY);

		// Check if all targets found
		if (foundTargetIds.size >= encryptedTargets.length) {
			timerRunning = false;
			cancelAnimationFrame(timerFrame);
			phase = 'completed';
		}
	} else {
		showFeedback(feedbackX, feedbackY, 'miss');
	}

	return { hit, targetName: target.displayName };
}

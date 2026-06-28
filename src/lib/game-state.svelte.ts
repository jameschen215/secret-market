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

// Preloaded session - ready before player clicks start
let preloading = $state(false);
let preloadedSession = $state<SessionData | null>(null);

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

async function fetchAndPreload(gameId: number) {
	preloading = true;

	try {
		const res = await fetch('/api/start-game', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ gameId })
		});

		if (!res.ok) return;

		preloadedSession = await res.json();
	} catch {
		// Silent failure
	} finally {
		preloading = false;
	}
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

function waitForPreload(): Promise<void> {
	return new Promise((resolve) => {
		const interval = setInterval(() => {
			if (!preloading) {
				clearInterval(interval);
				resolve();
			}
		}, 50);
	});
}

async function fetchAndStartGame(gameId: number) {
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
}

async function verifyHitOnServer(
	targetId: number,
	clickX: number,
	clickY: number
) {
	try {
		await fetch('/api/verify-hit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionId, targetId, clickX, clickY })
		});
	} catch (err) {
		console.error('Server verification failed: ', err);
	}
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

// Preload game session
export async function preloadSession(gameId: number) {
	if (preloadedSession || phase === 'playing') return;

	await fetchAndPreload(gameId);
}

export function startGame(gameId: number): Promise<void> | void {
	if (preloadedSession) {
		const session = preloadedSession;
		preloadedSession = null;
		applySession(session); // synchronous - no wait

		fetchAndPreload(gameId);
		return;
	}

	if (preloading) {
		// Preloading is in flight - wait for it then apply
		return waitForPreload().then(() => {
			if (preloadedSession) {
				const session = preloadedSession;
				preloadedSession = null;
				applySession(session);
				fetchAndPreload(gameId);
			}
		});
	}

	// Fallback: preload didn't finish in time, fetch now, return a promise
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

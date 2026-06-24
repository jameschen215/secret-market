<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import GameBoard from './_components/GameBoard.svelte';
	import ScoreModal from './_components/ScoreModal.svelte';
	import TargetPanel from './_components/TargetPanel.svelte';
	import Timer from './_components/Timer.svelte';

	let phase = $state<'idle' | 'playing' | 'completed'>('idle');
	let starting = $state(false);
	let errorMsg = $state('');

	const targets = [
		{
			id: 1,
			name: 'finn',
			displayName: 'Finn',
			imagePath: '/images/characters/finn.png'
		},
		{
			id: 2,
			name: 'sage',
			displayName: 'Sage',
			imagePath: '/images/characters/sage.png'
		},
		{
			id: 3,
			name: 'ruby',
			displayName: 'Ruby',
			imagePath: '/images/characters/ruby.png'
		}
	];

	function onStart() {
		starting = true;
		phase = 'playing';

		console.log('Game starting...');
	}
	function resetGame() {
		starting = false;
		phase = 'idle';

		console.log('Resetting game...');
	}
</script>

<div class="page">
	<!-- Header - title & leaderboard button (mobile only)-->
	<header class="header">
		<div class="header-left">
			<h1 class="title">Secret Market</h1>
			<p class="subtitle">Find all the hidden characters</p>
		</div>

		<div class="header-right">
			<button
				type="button"
				class="leaderboard-btn-mobile"
				aria-label="Leaderboard"
				title="Leaderboard"
				disabled={phase === 'playing'}
				onclick={() => goto(resolve('/leaderboard'))}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 6V2h-1" />
					<path
						d="M9 15a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1"
					/>
					<path d="M9 21V11a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10" />
				</svg>
			</button>
		</div>
	</header>

	<!-- Main Layout - game board + sidebar -->
	<div class="layout">
		<!-- Game Board -->

		<div class="game-board">
			<GameBoard {phase} />

			<!-- Overlay - mobile only, tappable to start -->
			{#if phase === 'idle'}
				<button
					type="button"
					class="board-overlay-mobile"
					aria-label="Start Game"
					disabled={starting}
					onclick={onStart}
				>
					<span class="overlay-text-mobile">
						{starting ? 'Loading...' : 'Tap to Start'}
					</span>
				</button>

				<div class="board-overlay-desktop">
					<p class="overlay-text-desktop">
						Press <strong>Start Game</strong> to begin
					</p>
				</div>
			{/if}
		</div>

		<!-- Sidebar - desktop -->

		<aside class="sidebar">
			<Timer />

			<!-- Target cards -->
			<TargetPanel {phase} {targets} />

			<!-- Control Area -->
			<div class="control-wrap">
				{#if phase === 'idle'}
					<button
						type="button"
						class="start-btn-desktop"
						aria-label="Start Game"
						disabled={starting}
						onclick={onStart}
					>
						{starting ? 'Loading...' : 'Start Game'}
					</button>
				{/if}

				{#if phase === 'playing'}
					<button
						type="button"
						class="stop-btn"
						aria-label="Stop Game"
						disabled={!starting}
						onclick={resetGame}
					>
						Stop Game
					</button>
				{/if}

				{#if errorMsg}
					<p class="error-msg">{errorMsg}</p>
				{/if}

				<!-- Leaderboard button -desktop only -->
				<button
					type="button"
					class="leaderboard-btn-desktop"
					aria-label="Leaderboard"
					disabled={phase === 'playing'}
					onclick={() => goto(resolve('/leaderboard'))}
				>
					Leaderboard
				</button>
			</div>
		</aside>
	</div>

	<footer class="footer">
		<p>
			2025 &copy; Odin Project Assignment by
			<a
				href="https://github.com/jameschen215"
				target="_blank"
				aria-label="Go to author's Github repository"
				class=""
			>
				James Chen.
				<span class="sr-only">Open in new tab</span>
			</a>
		</p>
		<p>All rights reserved.</p>
	</footer>

	<!-- Score Modal -->

	{#if phase === 'completed'}
		<ScoreModal />
	{/if}
</div>

<style>
	.page {
		min-height: 100dvh;
		max-width: 1280px;
		margin: 0 auto;
		padding: 2.4rem 1rem 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 1rem;
	}

	/* Header */
	.header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.15rem;
	}

	.header-right {
		display: none;
	}

	.title {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 900;
		color: var(--color-gold);
		letter-spacing: 0.02rem;
		line-height: 1.2;
	}

	.subtitle {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		font-weight: 600;
	}

	/* Layout */
	.layout {
		display: grid;
		grid-template-columns: 1fr 220px;
		gap: 1.25rem;
		align-items: start;
	}

	/* Game Board */
	.game-board {
		position: relative;
	}

	.board-overlay-mobile {
		display: none;
	}

	.board-overlay-desktop {
		position: absolute;
		inset: 0;

		display: flex;
		align-items: center;
		justify-content: center;

		border-radius: var(--radius-lg);
		background: rgba(26, 21, 32, 0.6);
		backdrop-filter: blur(2px);
		pointer-events: none;
	}

	.overlay-text-desktop {
		font-size: 1.1rem;
		color: var(--color-text-muted);
		font-weight: 600;
	}

	.overlay-text-desktop strong {
		color: var(--color-gold);
	}

	/* -- Sidebar -- */
	.sidebar {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: space-between;
		gap: 1rem;
	}

	.control-wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.start-btn-desktop,
	.stop-btn {
		width: 100%;
		max-width: 296px;
		padding: 0.7rem;
		color: #1a1520;
		background: var(--color-gold);
		border-radius: var(--radius-md);

		font-size: 1rem;
		font-weight: 800;
		letter-spacing: 0.02rem;

		transition: all 200ms ease;
	}

	.start-btn-desktop:hover:not(:disabled),
	.stop-btn:hover:not(:disabled) {
		background: #f0c65e;
		box-shadow: 0 4px 16px var(--color-glow-gold);
		transform: translateY(-1px);
	}

	.start-btn-desktop:active:not(:disabled),
	.stop-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.leaderboard-btn-desktop {
		width: 100%;
		max-width: 296px;
		padding: 0.7rem;
		color: var(--color-text-muted);
		background: none;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);

		font-size: 1rem;
		font-weight: 800;
		letter-spacing: 0.02rem;

		transition: all 200ms ease;
	}

	.leaderboard-btn-desktop:hover:not(:disabled) {
		color: var(--color-gold);
		border-color: var(--color-gold-dim);
		box-shadow: 0 0 8px var(--color-glow-gold);
		transform: translateY(-1px);
	}

	.leaderboard-btn-desktop:active:not(:disabled) {
		transform: translateY(0);
	}

	.leaderboard-btn-desktop:disabled,
	.start-btn-desktop:disabled,
	.stop-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-msg {
		font-size: 0.78rem;
		color: var(--color-accent-red);
		font-weight: 600;
		text-align: center;
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		color: var(--color-text-muted);
		font-size: 0.8rem;
		padding: 0.25rem;
	}

	.footer a {
		color: inherit;
		font-weight: 600;
		text-decoration: none;
		transition: all 200ms ease;
	}

	.footer a:hover,
	.footer a:active {
		color: var(--color-text);
		text-decoration: underline;
		opacity: 0.75;
	}

	/* -- Animation -- */
	@keyframes overlayPulse {
		0%,
		100% {
			opacity: 1;
			box-shadow: 0 0 20px var(--color-glow-gold);
		}
		50% {
			opacity: 0.8;
			box-shadow: 0 0 35px var(--color-glow-gold);
		}
	}

	/* -- Mobile -- */
	@media (max-width: 1024px) {
		.page {
			gap: 0.75rem;
		}

		.title {
			font-size: 1.35rem;
		}

		.header-right {
			display: block;
		}

		.header-right .leaderboard-btn-mobile {
			border: 1px solid var(--color-border);
			border-radius: var(--radius-sm);
			padding: 0.25rem;
			display: flex;
			justify-content: center;
			align-items: center;
			color: var(--color-text-muted);
			transition: all 200ms ease;
		}

		.header-right .leaderboard-btn-mobile:hover:not(:disabled) {
			color: var(--color-gold);
			border-color: var(--color-gold-dim);
			transform: translateY(-1px);
		}

		.header-right .leaderboard-btn-mobile:active:not(:disabled) {
			transform: translateY(0);
		}

		.header-right .leaderboard-btn-mobile:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}

		/* -- Stack to single column on mobile -- */
		.layout {
			grid-template-columns: 1fr;
			gap: 0.75rem;
		}

		.board-overlay-desktop {
			display: none;
		}

		.board-overlay-mobile {
			position: absolute;
			inset: 0;
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: center;

			border: none;
			border-radius: var(--radius-lg);
			background: rgba(26, 21, 32, 0.55);
			backdrop-filter: blur(2px);
			cursor: pointer;

			transition: background 200ms ease;
		}

		.board-overlay-mobile:hover:not(:disabled) {
			background: rgba(26, 21, 32, 0.45);
		}

		.overlay-text-mobile {
			color: var(--color-gold);
			font-family: var(--font-display);
			font-size: 0.85rem;
			font-weight: 800;
			letter-spacing: 0.05rem;

			padding: 0.4rem 1rem;
			border: 1.5px solid var(--color-gold-dim);
			border-radius: var(--radius-md);
			box-shadow: 0 0 20px var(--color-glow-gold);

			animation: overlayPulse 2000ms ease-in-out infinite;
		}

		/* -- Sidebar moves above game board on mobile */
		.sidebar {
			gap: 0.75rem;
			order: -1;
		}

		.start-btn-desktop,
		.leaderboard-btn-desktop {
			display: none;
		}

		.footer {
			flex-direction: column;
			gap: 0;
		}
	}
</style>

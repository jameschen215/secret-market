<script lang="ts">
	import { formatTime } from '$lib/utils/formatter';

	const elapsed = 1350;
	let phase = $state<'idle' | 'playing' | 'completed'>('idle');
	let timerRunning = $state(false);
</script>

<div
	class="timer"
	class:running={timerRunning}
	class:completed={phase === 'completed'}
>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		class="timer-icon"
	>
		<circle cx="12" cy="13" r="8" />
		<path d="M12 9v4l2 2" />
		<path d="M9 2h6" />
		<path d="M12 2v2" />
	</svg>

	<span class="timer-value">{formatTime(elapsed)}</span>
</div>

<style>
	.timer {
		display: flex;
		align-items: center;
		gap: 0.5rem;

		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-muted, #94a3b8);
		letter-spacing: 0.05rem;
		transition: color 300ms ease;
	}

	.timer.running {
		color: var(--color-text, #f1f5f9);
	}

	.timer.completed {
		color: var(--color-accent-green, #4ade80);
	}

	.timer-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.timer-value {
		min-width: 7ch;
		text-align: right;
	}

	@media (max-width: 1024px) {
		.timer {
			justify-content: center;
		}
	}
</style>

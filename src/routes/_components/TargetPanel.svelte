<script lang="ts">
	type TargetInfo = {
		id: number;
		name: string;
		displayName: string;
		imagePath: string;
	};

	let {
		phase,
		targets
	}: { phase: 'idle' | 'playing' | 'completed'; targets: TargetInfo[] } =
		$props();
</script>

<div class="target-panel">
	<h2 class="panel-title">Find Them</h2>

	<div class="targets">
		{#each targets as target (target.id)}
			{@const found = false}

			<div class="target-card" class:found data-accent={target.name}>
				<div class="avatar-wrap">
					<img src={target.imagePath} alt={target.displayName} class="avatar" />

					{#if found}
						<div class="found-badge">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
					{/if}
				</div>

				<div class="target-info">
					<span class="target-name">{target.displayName}</span>

					<span class="target-status">
						{phase === 'idle' ? 'Hiding' : found ? 'Found!' : 'Searching...'}
					</span>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.target-panel {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.panel-title {
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.15rem;
		color: var(--color-text-muted);
	}

	/* -- Desktop - vertical stack -- */
	.targets {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.target-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-elevated);
		transition: all 400ms var(--ease-out-expo);
	}

	.target-card.found {
		border-color: var(--color-accent-green);
		background: rgba(93 217 122 /0.08);
	}

	.target-card[data-accent='finn'] {
		--card-accent: var(--color-finn);
	}

	.target-card[data-accent='ruby'] {
		--card-accent: var(--color-ruby);
	}

	.target-card[data-accent='sage'] {
		--card-accent: var(--color-sage);
	}

	.avatar-wrap {
		position: relative;
		width: 64px;
		height: 64px;
		flex-shrink: 0;
	}

	.avatar {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 2px solid var(--card-accent, var(--color-border));
		object-fit: cover;
		transition: all 400ms var(--ease-out-expo);
	}

	.target-card.found .avatar {
		border-color: var(--color-accent-green);
		filter: brightness(0.6);
	}

	.found-badge {
		position: absolute;
		inset: 0;

		display: flex;
		align-items: center;
		justify-content: center;

		animation: badgePop 400ms var(--ease-spring);
	}

	.found-badge svg {
		width: 30px;
		height: 30px;
		color: var(--color-accent-green);
		filter: drop-shadow(0 0 6px rgba(93 217 122 /0.5));
	}

	.target-info {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		min-width: 0;
	}

	.target-name {
		font-weight: 700;
		font-size: 0.88rem;
		color: var(--color-text);
	}

	.target-card.found .target-name {
		color: var(--color-accent-green);
	}

	.target-status {
		font-size: 0.7rem;
		color: var(--color-text-dim);
	}

	.target-card.found .target-status {
		color: var(--color-accent-green);
		opacity: 0.7;
	}

	/* -- Animation -- */
	@keyframes badgePop {
		from {
			opacity: 0;
			transform: scale(0);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* -- Mobile -- */
	@media (max-width: 1024px) {
		.target-panel {
			align-items: center;
		}

		.targets {
			flex-direction: row;
			gap: 0.8rem;
		}

		.target-card {
			flex-direction: column;
			align-items: center;
			flex: 0 0 auto;
			width: 90px;
			padding: 0.6rem 0.5rem;
			gap: 0.35rem;
		}

		.avatar-wrap {
			width: 48px;
			height: 48px;
		}

		.target-info {
			flex-direction: column;
			align-items: center;
			gap: 0.15rem;
		}

		.target-name {
			font-size: 0.78rem;
		}
	}
</style>

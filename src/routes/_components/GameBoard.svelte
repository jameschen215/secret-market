<script lang="ts">
	import {
		getFeedback,
		getPhase,
		handleClick,
		isTargetFound
	} from '$lib/game-state.svelte';
	import { tick } from 'svelte';

	const MENU_WIDTH = 150;
	const MENU_HEIGHT = 130;
	const RING_OFFSET = 30;
	const FEEDBACK_MARGIN = 42;

	type TargetInfo = {
		id: number;
		name: string;
		displayName: string;
		imagePath: string;
	};

	interface Props {
		imagePath: string;
		targets: TargetInfo[];
	}

	const { imagePath, targets }: Props = $props();

	// Selector popup state
	let selectorOpen = $state(false);

	// Actual click position - never overridden
	let clickX = $state(0);
	let clickY = $state(0);

	// Menu position - may be adjusted for small screens
	let selectorX = $state(0);
	let selectorY = $state(0);

	let clickPercentX = $state(0);
	let clickPercentY = $state(0);

	let menuPlacementX = $state<'left' | 'right'>('right');
	let menuPlacementY = $state<'above' | 'middle' | 'below'>('middle');

	let boardEl: HTMLDivElement | undefined = $state();

	async function onImageClick(e: MouseEvent) {
		if (!boardEl) return;

		if (getPhase() !== 'playing') return;

		const imgEl = e.currentTarget as HTMLDivElement;
		const rect = imgEl.getBoundingClientRect();

		clickPercentX = (e.clientX - rect.left) / rect.width;
		clickPercentY = (e.clientY - rect.top) / rect.height;

		const boardRect = boardEl.getBoundingClientRect();

		clickX = e.clientX - boardRect.left;
		clickY = e.clientY - boardRect.top;
		selectorX = clickX;
		selectorY = clickY;

		// X: flip left if not enough space on the right
		menuPlacementX =
			boardRect.width - selectorX >= MENU_WIDTH + RING_OFFSET
				? 'right'
				: 'left';
		// Y: on small screens center the menu on the board to avoid overflow
		if (boardRect.height < MENU_HEIGHT * 2) {
			selectorY = boardRect.height / 2;
			menuPlacementY = 'middle';
		} else if (boardRect.height - selectorY < MENU_HEIGHT / 2 + RING_OFFSET) {
			menuPlacementY = 'above';
		} else if (selectorY < MENU_HEIGHT / 2 + RING_OFFSET) {
			menuPlacementY = 'below';
		} else {
			menuPlacementY = 'middle';
		}

		if (selectorOpen) {
			selectorOpen = false;

			// Defer to next microtask so Svelte flushes the false state first
			await tick();
		}

		selectorOpen = true;
	}

	function onSelectTarget(targetId: number) {
		selectorOpen = false;

		if (!boardEl) return;

		const boardRect = boardEl.getBoundingClientRect();

		handleClick(
			clickPercentX,
			clickPercentY,
			targetId,
			clickX + boardRect.left,
			clickY + boardRect.top
		);
	}

	function closeSelector() {
		selectorOpen = false;
	}

	function getUnFoundTargets() {
		return targets.filter((t) => !isTargetFound(t.id));
	}
</script>

<svelte:window
	onclick={(e) => {
		if (selectorOpen && boardEl && !boardEl.contains(e.target as Node)) {
			closeSelector();
		}
	}}
/>

<div class="game-board" bind:this={boardEl}>
	<div
		class="image-wrap"
		class:active={getPhase() === 'playing'}
		role="button"
		tabindex="0"
		onclick={onImageClick}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeSelector();
		}}
	>
		<img
			src={imagePath}
			alt="Find characters"
			class="game-image"
			draggable="false"
		/>
	</div>

	<!-- Target selector popup menu -->

	{#if selectorOpen}
		<!-- Ring always at true click position -->
		<div class="click-ring-anchor" style="left: {clickX}px; top: {clickY}px">
			<div class="click-ring"></div>
		</div>

		<!-- Menu at adjusted position -->
		<div class="selector" style="left: {selectorX}px; top: {selectorY}px">
			<div
				class="selector-menu"
				class:place-left={menuPlacementX === 'left'}
				class:place-above={menuPlacementY === 'above'}
				class:place-below={menuPlacementY === 'below'}
			>
				<span class="selector-label">Who is this?</span>

				{#each getUnFoundTargets() as target (target.id)}
					<button
						class="selector-option"
						data-accent={target.name}
						onclick={() => onSelectTarget(target.id)}
					>
						<img
							src={target.imagePath}
							alt={target.displayName}
							class="option-thumb"
						/>
						<span>{target.displayName}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Hit/Miss feedback -->
	{#if getFeedback()}
		{@const fb = getFeedback()!}
		{@const boardRect = boardEl.getBoundingClientRect()}
		{@const clampedX = Math.min(
			Math.max(fb.locationX - boardRect.left, FEEDBACK_MARGIN),
			boardRect.width - FEEDBACK_MARGIN
		)}

		{@const clampedY = Math.min(
			Math.max(fb.locationY - boardRect.top, FEEDBACK_MARGIN),
			boardRect.height - FEEDBACK_MARGIN
		)}

		{#if boardRect}
			<div
				class="feedback"
				class:hit={fb.type === 'hit'}
				class:miss={fb.type === 'miss'}
				style="left: {clampedX}px; top: {clampedY}px"
			>
				<span class="feedback-text">
					{fb.type === 'hit' ? `Found ${fb.targetName}!` : 'Not here!'}
				</span>
			</div>
		{/if}
	{/if}
</div>

<style>
	.game-board {
		position: relative;
		width: 100%;
		border-radius: var(--radius-lg);
		border: 2px solid var(--color-border);
		background: var(--color-bg-surface);
		overflow: hidden;
	}

	.image-wrap {
		position: relative;
		outline: none;
		user-select: none;
		line-height: 0;
	}

	.image-wrap.active {
		cursor: crosshair;
	}

	.game-image {
		width: 100%;
		height: 100%;
	}

	/* -- Selector -- */
	.selector {
		position: absolute;
		z-index: 20;
		pointer-events: none;
		transform: translate(-50%, -50%);
	}

	.click-ring-anchor {
		position: absolute;
		z-index: 20;
		pointer-events: none;
		transform: translate(-50%, -50%);
	}

	.click-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 30px;
		height: 30px;
		transform: translate(-50%, -50%);
		border: 2px solid var(--color-gold);
		border-radius: 50%;
		box-shadow: 0 0 12px var(--color-glow-gold);
		animation: ringPulse 1200ms ease-in-out infinite;
	}

	.selector-menu {
		position: absolute;
		min-width: 135px;
		top: 50%;
		left: calc(50% + 30px);
		transform: translateY(-50%);

		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0.35rem;
		pointer-events: auto;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		animation: menuSlide 200ms var(--ease-out-expo);
	}

	/* Flip horizontally - left of click */
	.selector-menu.place-left {
		left: auto;
		right: calc(50% + 24px);
	}

	/* Anchor below click point */
	.selector-menu.place-below {
		top: calc(50% + 24px);
	}

	/* Anchor above click point */
	.selector-menu.place-above {
		top: auto;
		bottom: calc(50% + 24px);
	}

	/* Anchor below click point */
	.selector-menu.place-below,
	.selector-menu.place-above {
		transform: translateY(0);
	}

	.selector-menu.place-left {
		--menu-translate-x-from: 8px; /* slide from the other direction */
	}

	/* Combined: left + below */
	/* .selector-menu.place-left.place-below {
		left: auto;
		right: calc(50% + 24px);
		top: calc(50% + 24px);
		transform: translateY(0);
	} */

	/* Combined: left + above */
	/* .selector-menu.place-left.place-above {
		top: auto;
		left: auto;
		right: calc(50% + 24px);
		bottom: calc(50% + 24px);
		transform: translateY(0);
	} */

	.selector-label {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1rem;
		padding: 0.25rem 0.5rem;
		color: var(--color-text-muted);
		border-bottom: 1px solid var(--color-border);
	}

	.selector-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;

		padding: 0.4rem 0.5rem;
		border-radius: var(--radius-sm);
		border: none;

		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text);

		transition: background 150ms ease;
	}

	.selector-option:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.selector-option[data-accent='finn']:hover {
		background: rgba(232, 136, 74, 0.15);
	}

	.selector-option[data-accent='ruby']:hover {
		background: rgba(217, 93, 122, 0.15);
	}

	.selector-option[data-accent='sage']:hover {
		background: rgba(93, 164, 217, 0.15);
	}

	.option-thumb {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: 1px solid var(--color-border);
		object-fit: cover;
	}

	/* -- Feedback -- */
	.feedback {
		position: absolute;
		z-index: 30;
		transform: translate(-50%, -120%);
		pointer-events: none;
		animation: feedbackPop 300ms var(--ease-spring);
	}

	.feedback-text {
		display: block;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-md);
		font-size: 0.8rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.feedback.hit .feedback-text {
		color: #0a2015;
		background: var(--color-accent-green);
		box-shadow: 0 4px 16px rgba(93 217 122 / 0.4);
	}

	.feedback.miss .feedback-text {
		color: #fff;
		background: var(--color-accent-red);
		box-shadow: 0 4px 16px rgba(293 95 95 / 0.4);
	}

	/* -- Animation -- */
	@keyframes ringPulse {
		from {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
		to {
			transform: translate(-50%, -50%) scale(1.8);
			opacity: 0;
		}
	}

	@keyframes menuSlide {
		from {
			opacity: 0;
			translate: -8px 0;
		}
		to {
			translate: 0 0;
			opacity: 1;
		}
	}

	@keyframes feedbackPop {
		from {
			opacity: 0;
			transform: translate(-50%, -100%) scale(0.6);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -120%) scale(1);
		}
	}
</style>

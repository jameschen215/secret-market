<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatTime } from '$lib/utils/formatter';
	import type { SubmitFunction } from '@sveltejs/kit';

	let submitting = $state(false);

	let isFlagged = $state(false);
	let isRetryable = $state(false);

	let inputEl = $state<HTMLInputElement | undefined>(undefined);

	$effect(() => {
		inputEl?.focus();
	});

	const onSubmit: SubmitFunction = () => {
		submitting = true;

		return async ({ update }) => {
			submitting = false;

			await update();
		};
	};
</script>

<div class="overlay">
	<form
		action="?/submitScore"
		method="post"
		class="modal"
		use:enhance={onSubmit}
	>
		<!-- Hidden fields for server  -->
		<input type="hidden" name="token" value="" />
		<input type="hidden" name="durationMs" value="" />

		<!-- Icon - trophy for success state, warning for error state -->
		<div class="icon-wrap" class:error-icon={isFlagged || isRetryable}>
			{#if isFlagged || isRetryable}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
					/>
				</svg>
			{:else}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						d="M8 21h8m-4-4v4m-5-8a5 5 0 0 1-3-1 3 3 0 0 1 0-6h1V3h14v3h1a3 3 0 0 1 0 6 5 5 0 0 1-3 1"
					/>
					<path d="M7 3v6a5 5 0 0 0 10 0V3" />
				</svg>
			{/if}
		</div>

		<h2 class="modal-title" class:error-title={isFlagged || isRetryable}>
			{isFlagged
				? 'Score Not Verified'
				: isRetryable
					? 'Submission Failed'
					: 'All Found!'}
		</h2>

		<div class="time-display">
			<span class="time-label">Your Time</span>
			<span class="time-value">{formatTime(2345)}</span>
		</div>

		<!-- Flagged - no retry, just close -->
		{#if isFlagged}
			<p class="flagged-msg">
				Your score could not be verified. This can happen if the session was
				modified or expired.
			</p>

			<button
				type="button"
				class="close-btn"
				onclick={() => console.log('Reset Game')}
			>
				Close
			</button>
		{:else if isRetryable}
			<p class="server-error-msg">form result error</p>

			<div class="error-actions">
				<button type="button" class="submit-btn retry" disabled={submitting}>
					{submitting ? 'Retrying...' : 'Try Again'}
				</button>

				<button
					type="button"
					class="close-btn secondary"
					onclick={() => console.log('Reset Game')}
				>
					Close
				</button>
			</div>
		{:else}
			<div class="input-group">
				<label for="player-name" class="input-label">Enter your name</label>
				<input
					type="text"
					id="player-name"
					class="name-input"
					placeholder="Adventurer"
					maxlength="20"
					disabled={submitting}
					bind:this={inputEl}
					value=""
				/>

				<!-- form error -->

				<button type="submit" class="submit-btn" disabled={submitting}>
					{submitting ? 'Submitting' : 'Submit Score'}
				</button>
			</div>
		{/if}
	</form>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;

		display: flex;
		align-items: center;
		justify-content: center;

		padding: 1rem;
		background: var(--color-bg-overlay);
		backdrop-filter: blur(8px);

		animation: overlayFadeIn 300ms ease;
	}

	.modal {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;

		width: 100%;
		max-width: 380px;

		padding: 2.5rem 2rem 2rem;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: 0 24px 64px rgba(0 0 0 / 0.5);

		animation: modalSlideUp 400ms var(--ease-out-expo);
	}

	.icon-wrap {
		width: 56px;
		height: 56px;

		display: flex;
		align-items: center;
		justify-content: center;

		color: var(--color-gold);
		background: rgba(232 185 74 / 0.12);
		border-radius: 50%;
	}

	.icon-wrap svg {
		width: 32px;
		height: 32px;
	}

	.icon-wrap.error-icon {
		color: var(--color-accent-red);
		background: rgba(239 95 95 / 0.12);
	}

	.modal-title {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--color-gold);
		letter-spacing: 0.02rem;
	}

	.modal-title.error-title {
		color: var(--color-accent-red);
	}

	.flagged-msg,
	.server-error-msg {
		font-size: 0.85rem;
		text-align: center;
		line-height: 1.5;
		color: var(--color-text-muted);
		width: 280px;
	}

	.error-actions {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.close-btn {
		width: 100%;
		padding: 0.75rem;
		color: var(--color-text-muted);
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);

		font-size: 0.9rem;
		font-weight: 700;
		transition: all 200ms ease;
	}

	.close-btn:hover {
		color: var(--color-text);
		border-color: var(--color-text-muted);
	}

	.close-btn.secondary {
		padding: 0.6rem;
		font-size: 0.82rem;
		background: transparent;
	}

	.time-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}

	.time-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.15rem;
		color: var(--color-text-dim);
	}

	.time-value {
		font-family: var(--font-mono);
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-accent-green);
		letter-spacing: 0.05rem;
	}

	.input-group {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.input-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1rem;
		color: var(--color-text-muted);
	}

	.name-input {
		width: 100%;
		padding: 0.7rem 0.85rem;
		color: var(--color-text);
		background: var(--color-bg);

		outline: none;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);

		font-family: var(--font-body);
		font-size: 1rem;
		font-weight: 600;

		transition: border-color 200ms ease;
	}

	.name-input::placeholder {
		color: var(--color-text-dim);
	}

	.name-input:focus {
		border-color: var(--color-gold);
		box-shadow: 0 0 0 3px var(--color-glow-gold);
	}

	.name-input:disabled {
		opacity: 0.5;
	}

	/* .error {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--color-accent-red);
	} */

	.submit-btn {
		width: 100%;
		padding: 0.75rem;
		color: #1a1520;
		background: var(--color-gold);
		border-radius: var(--radius-md);

		font-size: 0.95rem;
		font-weight: 800;

		transition: all 200ms ease;
	}

	.submit-btn:hover:not(:disabled) {
		background: #f0c65e;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px var(--color-glow-gold);
	}

	.submit-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* -- Animation -- */
	@keyframes overlayFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes modalSlideUp {
		from {
			opacity: 0;
			transform: translateY(24px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>

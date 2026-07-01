<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDate, formatTime, getRankEmoji } from '$lib/utils/formatter';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	let { data } = $props();

	// Builds query string for pagination links preserving rank/time highligh params
	function pageParams(page: number): string {
		const params = new SvelteURLSearchParams();
		params.set('page', String(page));

		if (data.highlightRank) {
			params.set('rank', String(data.highlightRank));
		}

		if (data.highlightTime) {
			params.set('time', String(data.highlightTime));
		}

		if (data.highlightId) {
			params.set('id', String(data.highlightId));
		}

		return params.toString();
	}
</script>

<div class="page">
	<header class="header">
		<div>
			<h1 class="title">Leaderboard</h1>
			<p class="subtitle">Fastest adventurers</p>
		</div>

		<a
			href={resolve('/')}
			class="play-btn"
			aria-label={data.highlightRank ? 'Play Again' : 'Start Game'}
		>
			{data.highlightRank ? 'Play Again' : 'Start Game'}
		</a>
	</header>

	{#if data.highlightRank}
		<div class="rank-callout">
			You placed <strong>#{data.highlightRank}</strong> with a time of
			<strong>{formatTime(data.highlightTime ?? 0)}</strong>
		</div>
	{/if}

	{#if data.scores.length === 0}
		<div class="empty">
			<p>No scores yet.</p>
			<p>Click <strong>Start Game</strong> to be the first!</p>
		</div>
	{:else}
		<div class="table-wrap">
			<table class="leaderboard">
				<thead>
					<tr>
						<th class="col-rank">Rank</th>
						<th class="col-name">Name</th>
						<th class="col-time">Time</th>
						<th class="col-credible">Credible</th>
						<th class="col-date">Date</th>
					</tr>
				</thead>

				<tbody>
					{#each data.scores as score, i (score.id)}
						{@const rank = (data.page - 1) * 10 + i + 1}
						{@const isUntrusted = score.trustStatus === 'UNTRUSTED'}
						{@const highlight =
							data.highlightId !== null && score.id === data.highlightId}

						<tr
							class="row"
							class:highlight
							class:untrusted={isUntrusted}
							class:top3={rank <= 3 && !isUntrusted}
						>
							<td class="col-rank">
								<span class="rank-num">{rank}</span>
								{#if isUntrusted}
									<span class="rank-emoji">!</span>
								{:else}
									<span class="rank-emoji">{getRankEmoji(rank)}</span>
								{/if}
							</td>
							<td class="col-name">
								<span class="player-name">{score.playerName}</span>
							</td>

							<td class="col-time">{formatTime(score.timeMs)}</td>
							<td class="col-credible">
								{#if isUntrusted}
									<span
										class="trust-mark untrusted-mark"
										title={score.trustReason ?? 'Untrusted score'}
										aria-label="Not credible"
									>
										x
									</span>
								{:else}
									<span class="trust-mark trusted-mark" aria-label="Credible">
										check
									</span>
								{/if}
							</td>
							<td class="col-date">{formatDate(score.createdAt)}</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- Player score outside top 10 -->
			{#if data.playerScore && data.highlightRank}
				{@const isUntrusted = data.playerScore.trustStatus === 'UNTRUSTED'}
				<div class="outside-top">
					<span class="outside-divider">· · ·</span>

					<table class="leaderboard">
						<tbody>
							<tr class="row highlight" class:untrusted={isUntrusted}>
								<td class="col-rank">
									<span class="rank-num">{data.highlightRank}</span>
								</td>
								<td class="col-name">
									<span class="player-name">{data.playerScore.playerName}</span>
								</td>
								<td class="col-time">
									{formatTime(data.playerScore.timeMs)}
								</td>
								<td class="col-credible">
									{#if isUntrusted}
										<span
											class="trust-mark untrusted-mark"
											title={data.playerScore.trustReason ?? 'Untrusted score'}
											aria-label="Not credible"
										>
											x
										</span>
									{:else}
										<span class="trust-mark trusted-mark" aria-label="Credible">
											check
										</span>
									{/if}
								</td>
								<td class="col-date">
									{formatDate(data.playerScore.createdAt)}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<div class="pagination">
				<a
					href="{resolve('/leaderboard')}?{pageParams(data.page - 1)}"
					class="page-btn"
					class:disabled={data.page <= 1}
					aria-disabled={data.page <= 1}
					aria-label="Previous Page"
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
						><path d="m15 18-6-6 6-6" />
					</svg>
				</a>

				<span class="page-info">
					{data.page} / {data.totalPages}
				</span>

				<a
					href="{resolve('/leaderboard')}?{pageParams(data.page + 1)}"
					class="page-btn"
					class:disabled={data.page >= data.totalPages}
					aria-disabled={data.page >= data.totalPages}
					aria-label="Next Page"
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
						><path d="m9 18 6-6-6-6" />
					</svg>
				</a>
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		flex: 1;
		max-width: 680px;
		width: 100%;
		margin: 0 auto;
		padding: 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin: 2rem 0;
	}

	.title {
		font-family: var(--font-display);
		font-size: 1.75rem;
		font-weight: 900;
		color: var(--color-gold);
		line-height: 1.2;
	}

	.subtitle {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.play-btn {
		flex-shrink: 0;
		padding: 0.6rem 1.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		background: var(--color-bg-elevated);

		font-size: 0.85rem;
		font-weight: 700;
		text-decoration: none;

		transition: all 200ms ease;
	}

	.play-btn:hover {
		color: var(--color-gold);
		border-color: var(--color-gold-dim);
	}

	.rank-callout {
		padding: 0.85rem 1.25rem;
		border-radius: var(--radius-md);
		border: 1px solid rgba(232 185 74 / 0.2);

		color: var(--color-text-muted);
		background: rgba(232 185 74 / 0.08);

		font-size: 0.9rem;
		text-align: center;

		animation: calloutFade 500ms var(--ease-out-expo);
	}

	.rank-callout strong {
		color: var(--color-gold);
		font-weight: 800;
	}

	.empty {
		font-size: 1rem;
		padding: 3rem 1rem;
		color: var(--color-text-muted);
		text-align: center;
	}

	.empty strong {
		font-weight: 700;
		color: var(--color-gold);
	}

	/* TABLE */
	.table-wrap {
		min-height: 519px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--color-bg-surface);
	}

	.leaderboard {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: var(--color-bg-elevated);
	}

	th {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.15rem;
		text-align: left;
		color: var(--color-text-dim);
		padding: 0.75rem 1rem;
	}

	td {
		font-size: 0.9rem;
		padding: 0.7rem 1rem;
		border-top: 1px solid var(--color-border-subtle);
	}

	.row {
		transition: background 150ms ease;
	}

	.row:hover {
		background: rgba(255 255 255 / 0.02);
	}

	.row.highlight {
		background: rgba(232 185 74 / 0.06);
	}

	.row.highlight td {
		font-weight: 700;
		color: var(--color-gold);
	}

	.row.untrusted {
		background: rgba(239 95 95 / 0.06);
	}

	.row.untrusted td {
		color: var(--color-text-muted);
	}

	.row.untrusted .col-time {
		color: var(--color-accent-red);
		text-decoration: line-through;
		text-decoration-thickness: 1px;
		text-decoration-color: rgba(239 95 95 / 0.8);
	}

	.col-rank {
		width: 80px;
	}

	.rank-num {
		font-weight: 700;
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}

	.row.top3 .rank-num {
		color: var(--color-gold);
	}

	.rank-emoji {
		margin-left: 0.35rem;
	}

	.col-name {
		font-weight: 600;
		width: 100%; /* take all remaining space after fixed columns */
		min-width: 0; /* allow shrinking below content size */
		max-width: 0; /* force overflow onto the ellipsis */
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.player-name {
		display: inline-block;
	}

	.col-credible {
		width: 92px;
		text-align: center;
	}

	.trust-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: 50%;
		font-size: 0;
		font-weight: 900;
	}

	.trust-mark::before {
		font-size: 0.9rem;
		line-height: 1;
	}

	.trusted-mark {
		color: var(--color-accent-green);
		background: rgba(93 217 122 / 0.1);
	}

	.trusted-mark::before {
		content: '✓';
	}

	.untrusted-mark {
		color: var(--color-accent-red);
		background: rgba(239 95 95 / 0.1);
	}

	.untrusted-mark::before {
		content: '×';
	}

	.col-time {
		width: 112px;
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.row.top3 .col-time {
		color: var(--color-accent-green);
	}

	.col-date {
		width: 80px;
		font-size: 0.8rem;
		color: var(--color-text-dim);
	}

	.outside-top {
		border-top: 1px dashed var(--color-border);
	}

	.outside-divider {
		display: block;
		text-align: center;
		padding: 0.5rem;
		color: var(--color-text-dim);
		font-size: 0.75rem;
		letter-spacing: 0.2rem;
	}

	/* -- PAGINATION -- */
	.pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0;
	}

	.page-btn {
		display: flex;
		align-items: center;
		justify-content: center;

		padding: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);

		color: var(--color-text);
		background: var(--color-bg-elevated);

		transition: all 200ms ease;
	}

	.page-btn svg {
		width: 20px;
		height: 20px;
	}

	.page-btn:hover:not(:disabled) {
		color: var(--color-gold);
		border-color: var(--color-gold-dim);
	}

	.page-btn.disabled {
		opacity: 0.35;
		pointer-events: none;
	}

	.page-info {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	@media (max-width: 640px) {
		.col-name {
			max-width: 96px;
		}

		.col-credible {
			display: none;
		}
	}
</style>

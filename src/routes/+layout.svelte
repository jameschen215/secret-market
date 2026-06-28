<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<main class="main">
	{@render children()}

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
</main>

<style>
	.main {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	.footer {
		margin-top: auto;
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

	@media (max-width: 1024px) {
		.footer {
			flex-direction: column;
			gap: 0;
		}
	}
</style>

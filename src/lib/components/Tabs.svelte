<script lang="ts">
	import { page } from '$app/state';

	/** Linguette fatte di collegamenti: ognuna è un indirizzo, così funzionano senza JavaScript e dopo l'invio di un modulo. */
	let { label, links }: { label: string; links: { href: string; text: string; current: boolean }[] } = $props();

	// Sul telefono le linguette scorrono in orizzontale: quella aperta resta in vista.
	let list = $state<HTMLUListElement>();
	$effect(() => {
		page.url.href;
		const a = list?.querySelector<HTMLElement>('[aria-current]');
		if (list && a) list.scrollLeft = a.offsetLeft - (list.clientWidth - a.offsetWidth) / 2;
	});
</script>

<nav aria-label={label} class="subnav">
	<ul class="list-plain" bind:this={list}>
		{#each links as l (l.href)}
			<li><a href={l.href} aria-current={l.current ? 'page' : undefined}>{l.text}</a></li>
		{/each}
	</ul>
</nav>

<style>
	.subnav ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		border-bottom: 1px solid var(--c-border);
		margin-bottom: 1.5rem;
	}
	.subnav a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 0.75rem;
		text-decoration: none;
		color: var(--c-text);
		border-bottom: 3px solid transparent;
	}
	.subnav a:hover {
		background: var(--c-surface2);
	}
	.subnav a[aria-current='page'] {
		border-bottom-color: var(--c-primary);
		font-weight: 700;
	}
	/* Sul telefono una riga sola, da un bordo all'altro dello schermo. */
	@media (max-width: 48rem) {
		.subnav {
			margin-inline: calc(-1 * var(--space));
		}
		.subnav ul {
			position: relative;
			flex-wrap: nowrap;
			gap: 0;
			overflow-x: auto;
			scrollbar-width: none;
			padding-inline: calc(var(--space) - 0.75rem);
			margin-bottom: 1rem;
		}
		.subnav li {
			flex: none;
		}
	}
</style>

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
	/* Nel popup (Profilo, Campagna, Amministrazione) le linguette sono una barra a sinistra, alta quanto la finestra:
	   resta ferma mentre la pagina scorre. La pagina si sposta a destra per farle posto. */
	@media (min-width: 48.0625rem) {
		:global(.shell.framed) {
			--tabs-bar: 13rem;
		}
		:global(.shell.framed:has(.subnav)) {
			padding-left: calc(var(--tabs-bar) + var(--space));
		}
		:global(.shell.framed) .subnav {
			position: fixed;
			inset: 0 auto 0 0;
			z-index: 5;
			width: var(--tabs-bar);
			overflow-y: auto;
			padding: 1rem 0.75rem;
			background: var(--c-surface2);
			border-right: 1px solid var(--c-border);
		}
		:global(.shell.framed) .subnav ul {
			flex-direction: column;
			flex-wrap: nowrap;
			gap: 0.125rem;
			margin: 0;
			border: 0;
		}
		:global(.shell.framed) .subnav a {
			display: flex;
			min-height: 2.5rem;
			padding: 0.4rem 0.75rem;
			border: 0;
			border-radius: var(--radius);
			line-height: 1.3;
		}
		:global(.shell.framed) .subnav a:hover {
			background: color-mix(in srgb, var(--c-text) 7%, var(--c-surface2));
		}
		/* Quella aperta: in grassetto, col fondo tinto e il filo a sinistra (non solo il colore). */
		:global(.shell.framed) .subnav a[aria-current='page'] {
			background: color-mix(in srgb, var(--c-primary) 12%, var(--c-surface2));
			box-shadow: inset 3px 0 0 var(--c-primary);
		}
	}
	@media (min-width: 48.0625rem) and (forced-colors: active) {
		:global(.shell.framed) .subnav a[aria-current='page'] {
			outline: 2px solid CanvasText;
		}
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

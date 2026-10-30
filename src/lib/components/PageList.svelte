<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import TagBadge from './TagBadge.svelte';
	import RelTime from './RelTime.svelte';

	interface Row {
		slug: string;
		title: string;
		kind?: string;
		visibility: string;
		updatedAt: number;
		category: string | null;
		categorySlug: string | null;
		tags: { name: string; slug: string; color: string }[];
	}
	/** lead: la prima pagina in evidenza (la home). */
	let { rows, lead = false }: { rows: Row[]; lead?: boolean } = $props();
	const t = getT();
	const locale = $derived(page.data.locale as string);
</script>

<ul class="list-plain page-list" class:lead>
	{#each rows as r, i (r.slug)}
		<li class="card" class:first={lead && i === 0}>
			<h3><a class="card-link" href="/wiki/{r.slug}">{r.title}</a></h3>
			<p class="muted row-meta">
				{#if r.category}
					<a href="/wiki?category={encodeURIComponent(r.categorySlug ?? '')}">{r.category}</a> ·
				{/if}
				{#if r.kind && r.kind !== 'page'}<span class="badge">{t('kinds.' + r.kind)}</span>{/if}
				{#if r.visibility !== 'players'}<span class="badge">{t('visibility.' + r.visibility)}</span>{/if}
				<span>{t('page.updated')} <RelTime ts={r.updatedAt} {locale} /></span>
			</p>
			{#if r.tags.length}
				<ul class="list-plain tags" aria-label={t('page.tags')}>
					{#each r.tags as tag (tag.slug)}<li><TagBadge {tag} /></li>{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.page-list {
		display: grid;
		gap: 0.75rem;
	}
	h3 {
		margin: 0 0 0.2rem;
		font-size: var(--fs-md);
	}
	/* Tutta la scheda porta alla pagina; il titolo non è testo corrente, quindi niente sottolineatura fissa. */
	.card {
		position: relative;
	}
	.card:hover {
		border-color: var(--c-control);
	}
	.card-link {
		color: var(--c-text);
		text-decoration: none;
	}
	.card-link::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}
	.card:hover .card-link {
		text-decoration: underline;
	}
	.card-link:focus-visible {
		outline: none;
	}
	.card:has(.card-link:focus-visible) {
		outline: 3px solid var(--c-focus);
		outline-offset: 2px;
	}
	/* I collegamenti dentro la scheda restano cliccabili sopra il collegamento grande. */
	.row-meta :global(a),
	.tags {
		position: relative;
		z-index: 1;
	}
	.first {
		border-top: 4px solid var(--c-primary);
		padding-block: 1.25rem;
	}
	.first h3 {
		font-size: var(--fs-lg);
	}
	.row-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin: 0;
		font-size: var(--fs-sm);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.5rem;
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import TagBadge from './TagBadge.svelte';
	import RelTime from './RelTime.svelte';

	interface Row {
		slug: string;
		title: string;
		visibility: string;
		updatedAt: number;
		category: string | null;
		categorySlug: string | null;
		tags: { name: string; slug: string; color: string }[];
	}
	let { rows }: { rows: Row[] } = $props();
	const t = getT();
	const locale = $derived(page.data.locale as string);
</script>

<ul class="list-plain page-list">
	{#each rows as r (r.slug)}
		<li class="card">
			<h3><a href="/wiki/{r.slug}">{r.title}</a></h3>
			<p class="muted row-meta">
				{#if r.category}
					<a href="/wiki?category={encodeURIComponent(r.categorySlug ?? '')}">{r.category}</a> ·
				{/if}
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
		font-size: 1.2rem;
	}
	.row-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin: 0;
		font-size: 0.95rem;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.5rem;
	}
</style>

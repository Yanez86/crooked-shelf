<script lang="ts">
	import { page as appPage } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import TagBadge from '#lib/components/TagBadge.svelte';
	import RelTime from '#lib/components/RelTime.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const locale = $derived(appPage.data.locale as string);
</script>

<svelte:head><title>{data.page.title} · {appPage.data.siteName}</title></svelte:head>

<article class="wiki-page">
	{#if data.category.length}
		<nav aria-label={t('page.breadcrumb')}>
			<ol class="crumbs">
				{#each data.category as c (c.slug)}
					<li><a href="/wiki?category={encodeURIComponent(c.slug)}">{c.name}</a></li>
				{/each}
			</ol>
		</nav>
	{/if}

	<header class="page-head">
		<h1>{data.page.title}</h1>
		{#if data.canEdit}
			<a class="btn" href="/wiki/{data.page.slug}/edit">✎ {t('page.edit')}<span class="visually-hidden">: {data.page.title}</span></a>
		{/if}
	</header>

	<p class="meta muted">
		<span class="badge">{t('visibility.' + data.page.visibility)}</span>
		{#if data.page.hasSecret}<span class="badge">🔒 {t('page.hasSecret')}</span>{/if}
		{#if data.editor}
			<span>{t('page.lastEdit', { name: data.editor })} <RelTime ts={data.page.updatedAt} {locale} /></span>
		{/if}
	</p>

	{#if data.tags.length}
		<ul class="list-plain tags" aria-label={t('page.tags')}>
			{#each data.tags as tag (tag.slug)}<li><TagBadge {tag} /></li>{/each}
		</ul>
	{/if}

	<div class="prose content">
		{#if data.html}
			{@html data.html}
		{:else}
			<p class="muted">{t('page.empty')}</p>
		{/if}
	</div>

	<section class="backlinks" aria-labelledby="backlinks-title">
		<h2 id="backlinks-title">{t('page.backlinks')}</h2>
		{#if data.backlinks.length}
			<ul>
				{#each data.backlinks as b (b.slug)}<li><a href="/wiki/{b.slug}">{b.title}</a></li>{/each}
			</ul>
		{:else}
			<p class="muted">{t('page.noBacklinks')}</p>
		{/if}
	</section>
</article>

<style>
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: 0.95rem;
	}
	.crumbs li + li::before {
		content: '›';
		padding: 0 0.5rem;
		color: var(--c-muted);
	}
	.page-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}
	.page-head h1 {
		margin-bottom: 0.25rem;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		font-size: 0.95rem;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	.content {
		margin: 1.5rem 0 2.5rem;
	}
	.backlinks {
		border-top: 1px solid var(--c-border);
		max-width: var(--measure);
	}
	.backlinks h2 {
		font-size: 1.15rem;
		margin-top: 1rem;
	}
</style>

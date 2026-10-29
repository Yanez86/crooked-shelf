<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{data.name} · {page.data.siteName}</title></svelte:head>

<nav aria-label={t('page.breadcrumb')}>
	<ol class="crumbs">
		<li><a href="/rules">{t('nav.rules')}</a></li>
		<li><a href="/rules?kind={data.kind}">{t('rules.kinds.' + data.kind)}</a></li>
	</ol>
</nav>

<h1>{data.name}</h1>
<p class="muted"><em>{data.summary}</em></p>

<div class="prose rule-text">{@html data.html}</div>

<section aria-labelledby="cited">
	<h2 id="cited">{t('rules.citedBy')}</h2>
	{#if data.pages.length}
		<ul>{#each data.pages as p (p.slug)}<li><a href="/wiki/{p.slug}">{p.title}</a></li>{/each}</ul>
	{:else}
		<p class="muted">{t('rules.notCited')}</p>
	{/if}
	<p>{t('rules.cite')} <code>{data.syntax}</code></p>
</section>

<p><a class="btn" href={data.ddb} target="_blank" rel="noopener noreferrer nofollow">{t('rules.openDdb')}<span class="visually-hidden"> {t('rules.external')}</span></a></p>
<p class="attr muted">{t('rules.attribution')}</p>

<style>
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.crumbs li + li::before {
		content: '›';
		padding: 0 0.5rem;
		color: var(--c-muted);
	}
	.rule-text {
		margin: 1rem 0 2rem;
	}
	.attr {
		font-size: 0.85rem;
		margin-top: 2rem;
	}
</style>

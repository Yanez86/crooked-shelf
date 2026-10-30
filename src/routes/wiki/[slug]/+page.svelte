<script lang="ts">
	import { page as appPage } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import TagBadge from '#lib/components/TagBadge.svelte';
	import RelTime from '#lib/components/RelTime.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import PageBody from '#lib/components/PageBody.svelte';
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
			<a class="edit-pencil" href="/wiki/{data.page.slug}/edit" title={t('page.edit')}><span aria-hidden="true">✎</span><span class="visually-hidden">{t('page.edit')}: {data.page.title}</span></a>
		{/if}
	</header>

	<FormOk message={appPage.url.searchParams.has('restored') ? 'history.restored' : null} />

	<p class="meta muted">
		<span class="badge">{t('visibility.' + data.page.visibility)}</span>
		{#if data.page.hasSecret}<span class="badge">🔒 {t('page.hasSecret')}</span>{/if}
		<a href="/wiki/{data.page.slug}/history">{t('history.link')}</a>
	</p>

	{#if data.tags.length}
		<ul class="list-plain tags" aria-label={t('page.tags')}>
			{#each data.tags as tag (tag.slug)}<li><TagBadge {tag} /></li>{/each}
		</ul>
	{/if}

	<PageBody title={data.page.title} html={data.html} fields={data.fields} session={data.session} {locale} />

	{#if data.maps.length || data.events.length}
		<section class="related" aria-labelledby="related-title">
			<h2 id="related-title">{t('page.related')}</h2>
			{#if data.maps.length}
				<h3>{t('nav.maps')}</h3>
				<ul>
					{#each data.maps as m (m.slug)}<li><a href="/maps/{m.slug}">{m.title}</a></li>{/each}
				</ul>
			{/if}
			{#if data.events.length}
				<h3>{t('nav.timeline')}</h3>
				<ul>
					{#each data.events as e (e.id)}
						<li>
							<a href="/timeline/{e.timeline}#event-{e.id}">{e.title}</a>
							<span class="muted">— {e.when || e.realDate} ({t('timeline.' + e.timeline)})</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

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

	{#if data.author || data.editor}
		<footer class="page-foot">
			<p class="muted">
				{#if data.author}<span>{t('page.createdBy', { name: data.author })}</span>{/if}
				{#if data.editor}<span>{t('page.lastEdit', { name: data.editor })} <RelTime ts={data.page.updatedAt} {locale} /></span>{/if}
			</p>
		</footer>
	{/if}
</article>

<style>
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: var(--fs-sm);
	}
	.crumbs li + li::before {
		content: '›';
		padding: 0 0.5rem;
		color: var(--c-muted);
	}
	.page-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}
	.page-head h1 {
		margin-bottom: 0.25rem;
	}
	.edit-pencil {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius);
		color: var(--c-muted);
		text-decoration: none;
		font-size: 1.1rem;
		opacity: 0.6;
		flex-shrink: 0;
	}
	.edit-pencil:hover,
	.edit-pencil:focus-visible {
		opacity: 1;
		color: var(--c-primary);
		background: var(--c-surface);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		font-size: var(--fs-sm);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}
	.related {
		border-top: 1px solid var(--c-border);
		max-width: var(--measure);
	}
	.related h2 {
		font-size: var(--fs-md);
		margin-top: 1rem;
	}
	.related h3 {
		font-size: 1rem;
		margin: 0.75rem 0 0.25rem;
	}
	.backlinks {
		border-top: 1px solid var(--c-border);
		max-width: var(--measure);
	}
	.backlinks h2 {
		font-size: var(--fs-md);
		margin-top: 1rem;
	}
	/* In fondo: chi ha creato la pagina e chi l'ha modificata per ultimo. */
	.page-foot {
		margin-top: 2rem;
		border-top: 1px solid var(--c-border);
		max-width: var(--measure);
	}
	.page-foot p {
		display: flex;
		flex-wrap: wrap;
		margin: 0.75rem 0 0;
		font-size: var(--fs-sm);
	}
	/* Il punto resta in fondo alla prima riga quando sul telefono le due parti vanno a capo. */
	.page-foot span:not(:last-child)::after {
		content: '·';
		padding: 0 0.5rem;
	}
</style>

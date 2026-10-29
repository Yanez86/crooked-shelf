<script lang="ts">
	import { page as appPage } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import TagBadge from '#lib/components/TagBadge.svelte';
	import RelTime from '#lib/components/RelTime.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import PageImage from '#lib/components/PageImage.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
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

	<FormOk message={appPage.url.searchParams.has('restored') ? 'history.restored' : null} />

	<p class="meta muted">
		<span class="badge">{t('visibility.' + data.page.visibility)}</span>
		{#if data.page.hasSecret}<span class="badge">🔒 {t('page.hasSecret')}</span>{/if}
		{#if data.editor}
			<span>{t('page.lastEdit', { name: data.editor })} <RelTime ts={data.page.updatedAt} {locale} /></span>
		{/if}
		<a href="/wiki/{data.page.slug}/history">{t('history.link')}</a>
	</p>

	{#if data.tags.length}
		<ul class="list-plain tags" aria-label={t('page.tags')}>
			{#each data.tags as tag (tag.slug)}<li><TagBadge {tag} /></li>{/each}
		</ul>
	{/if}

	<div class="body">
		<div class="side">
			<PageImage image={data.image} title={data.page.title} canEdit={data.canEdit} error={form?.imageError} ok={form?.imageOk} />
			{#if data.fields.length || data.session}
				<aside class="infobox" aria-label={t('fields.title')}>
					<dl>
						{#if data.session}
							{#if data.session.number}<dt>{t('session.number')}</dt><dd>{data.session.number}</dd>{/if}
							{#if data.session.realDate}
								<dt>{t('session.realDate')}</dt>
								<dd><time datetime={data.session.realDate}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(data.session.realDate + 'T12:00:00'))}</time></dd>
							{/if}
							{#if data.session.world}<dt>{t('session.worldDate')}</dt><dd>{data.session.world}</dd>{/if}
						{/if}
						{#each data.fields as f, i (i)}
							<dt>{f.label}</dt>
							<dd>{@html f.html || '—'}</dd>
						{/each}
					</dl>
				</aside>
			{/if}
		</div>

		<div class="prose content">
			{#if data.html}
				{@html data.html}
			{:else}
				<p class="muted">{t('page.empty')}</p>
			{/if}
		</div>
	</div>

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
	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
		gap: 1.5rem 2rem;
		margin: 1.5rem 0 2.5rem;
	}
	.content {
		grid-column: 1;
		grid-row: 1;
		min-width: 0;
	}
	/* Immagine e scheda in alto a destra. */
	.side {
		grid-column: 2;
		grid-row: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 100%;
	}
	/* Senza immagine né scheda resta solo il pulsante: la colonna non ruba spazio al testo. */
	.side:has(:global(.page-image:not(.bare)), .infobox) {
		width: 20rem;
	}
	.infobox {
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
		padding: 0.5rem 1rem;
	}
	/* Nello spazio stretto (telefono) immagine e scheda vanno in cima, prima del testo. */
	@container (max-width: 44rem) {
		.body {
			grid-template-columns: minmax(0, 1fr);
		}
		.side,
		.side:has(:global(.page-image:not(.bare)), .infobox) {
			grid-column: 1;
			width: auto;
		}
		.side > :global(.page-image) {
			max-width: 22rem;
		}
		.content {
			grid-row: 2;
		}
	}
	.infobox dl {
		margin: 0;
		display: grid;
		grid-template-columns: minmax(6rem, auto) 1fr;
		gap: 0.4rem 0.75rem;
	}
	.infobox dt {
		font-weight: 700;
	}
	.infobox dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.related {
		border-top: 1px solid var(--c-border);
		max-width: var(--measure);
	}
	.related h2 {
		font-size: 1.15rem;
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
		font-size: 1.15rem;
		margin-top: 1rem;
	}
</style>

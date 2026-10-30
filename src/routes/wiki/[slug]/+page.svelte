<script lang="ts">
	import { page as appPage } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import TagBadge from '#lib/components/TagBadge.svelte';
	import RelTime from '#lib/components/RelTime.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import PageBody from '#lib/components/PageBody.svelte';
	import MapBoard from '#lib/components/MapBoard.svelte';
	import TimelineBoard from '#lib/components/TimelineBoard.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const locale = $derived(appPage.data.locale as string);
	// Esito dei moduli di pin, livelli ed eventi (azioni di questa pagina).
	const result = $derived(form as { ok?: string | null; error?: string | null; values?: Record<string, unknown> | null } | null);
	// Nelle mappe e nelle cronologie il testo è facoltativo: se non c'è, niente «pagina vuota».
	const showBody = $derived(data.page.kind === 'page' || data.page.kind === 'template' || !data.blank || data.fields.length > 0);
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

	<!-- Anche l'esito dei moduli della mappa e della cronologia (pin, livelli, eventi). -->
	<FormOk message={appPage.url.searchParams.has('restored') ? 'history.restored' : (result?.ok ?? null)} />

	<p class="meta muted">
		{#if data.page.kind !== 'page'}<span class="badge kind">{t('kinds.' + data.page.kind)}</span>{/if}
		<span class="badge">{t('visibility.' + data.page.visibility)}</span>
		{#if data.page.hasSecret}<span class="badge">🔒 {t('page.hasSecret')}</span>{/if}
		<a href="/wiki/{data.page.slug}/history">{t('history.link')}</a>
	</p>

	{#if data.tags.length}
		<ul class="list-plain tags" aria-label={t('page.tags')}>
			{#each data.tags as tag (tag.slug)}<li><TagBadge {tag} /></li>{/each}
		</ul>
	{/if}

	{#if data.page.kind === 'template'}
		<!-- Un template si fotocopia: la nuova pagina parte con i suoi blocchi, la sua colonna e la sua icona. -->
		<div class="template-note card">
			<p>{t('kinds.templateNote')}</p>
			{#if data.canCopy}<a class="btn btn-primary" href="/wiki/new?template={encodeURIComponent(data.page.slug)}">{t('kinds.useTemplate')}</a>{/if}
		</div>
	{/if}

	{#if showBody}
		<PageBody title={data.page.title} html={data.html} fields={data.fields} session={data.page.kind === 'template' ? null : data.session} {locale} />
	{/if}

	{#if data.mapData}
		<section class="board" aria-label={t('kinds.map')}>
			<MapBoard data={data.mapData} title={data.page.title} form={result} />
		</section>
	{:else if data.timelineData}
		<section class="board" aria-label={t('kinds.timeline')}>
			<TimelineBoard data={data.timelineData} slug={data.page.slug} form={result} />
		</section>
	{/if}

	{#if data.maps.length || data.events.length}
		<section class="related" aria-labelledby="related-title">
			<h2 id="related-title">{t('page.related')}</h2>
			{#if data.maps.length}
				<h3>{t('kinds.folder.map')}</h3>
				<ul>
					{#each data.maps as m (m.slug)}<li><a href="/wiki/{m.slug}">{m.title}</a></li>{/each}
				</ul>
			{/if}
			{#if data.events.length}
				<h3>{t('kinds.folder.timeline')}</h3>
				<ul>
					{#each data.events as e (e.id)}
						<li>
							<a href="/wiki/{e.timeline.slug}#event-{e.id}">{e.title}</a>
							<span class="muted">— {e.when || e.realDate} ({e.timeline.title})</span>
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
	.template-note {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		margin: 0 0 1.25rem;
		max-width: var(--measure);
	}
	.template-note p {
		margin: 0;
	}
	.board {
		margin: 1.5rem 0 2rem;
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

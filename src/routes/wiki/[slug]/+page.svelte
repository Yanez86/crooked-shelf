<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { page as appPage } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import TagBadge from '#lib/components/TagBadge.svelte';
	import RelTime from '#lib/components/RelTime.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import PageBody from '#lib/components/PageBody.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import MapBoard from '#lib/components/MapBoard.svelte';
	import TimelineBoard from '#lib/components/TimelineBoard.svelte';
	import BoardView from '#lib/components/BoardView.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const locale = $derived(appPage.data.locale as string);
	// Esito dei moduli di pin, livelli ed eventi (azioni di questa pagina).
	const result = $derived(form as { ok?: string | null; error?: string | null; values?: Record<string, unknown> | null } | null);
	// Nelle mappe, nelle cronologie e nelle bacheche il testo è facoltativo: se non c'è, niente «pagina vuota».
	const showBody = $derived(data.page.kind === 'page' || data.page.kind === 'template' || !data.blank || data.fields.length > 0);
</script>

<svelte:head><title>{data.page.title} · {appPage.data.siteName}</title></svelte:head>

{#snippet top()}
	{#if data.category.length}
		<nav aria-label={t('page.breadcrumb')}>
			<ol class="crumbs">
				{#each data.category as c (c.slug)}
					<li><a href="/wiki?category={encodeURIComponent(c.slug)}">{c.name}</a></li>
				{/each}
			</ol>
		</nav>
	{/if}

	<PageHead page={data.page} canEdit={data.canEdit} />

	<!-- Anche l'esito dei moduli della mappa, della cronologia e della bacheca (pin, livelli, eventi, schede). -->
	<FormOk message={appPage.url.searchParams.has('restored') ? 'history.restored' : (result?.ok ?? null)} />

	<p class="meta muted">
		{#if data.page.kind !== 'page'}<span class="badge kind">{t('kinds.' + data.page.kind)}</span>{/if}
		<span class="badge">{t('visibility.' + data.page.visibility)}</span>
		{#if data.page.hasSecret}<span class="badge"><Icon name="lock" />{t('page.hasSecret')}</span>{/if}
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
{/snippet}

{#snippet below()}
	{#if data.mapData}
		<section class="board" aria-label={t('kinds.map')}>
			<MapBoard data={data.mapData} title={data.page.title} form={result} />
		</section>
	{:else if data.timelineData}
		<section class="board" aria-label={t('kinds.timeline')}>
			<TimelineBoard data={data.timelineData} slug={data.page.slug} form={result} />
		</section>
	{:else if data.boardData}
		<section class="board" aria-label={t('kinds.board')}>
			<BoardView data={data.boardData} slug={data.page.slug} form={result} />
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

	<footer class="page-foot">
		<p class="muted">
			{#if data.author}<span>{t('page.createdBy', { name: data.author })}</span>{/if}
			{#if data.editor}<span>{t('page.lastEdit', { name: data.editor })} <RelTime ts={data.page.updatedAt} {locale} /></span>{/if}
			<a href="/wiki/{data.page.slug}/history" title={t('history.link')} aria-label={t('history.link')}><Icon name="clock" /></a>
		</p>
	</footer>
{/snippet}

<article class="wiki-page">
	{#if showBody}
		<PageBody title={data.page.title} html={data.html} fields={data.fields} session={data.page.kind === 'template' ? null : data.session} {locale} head={top} foot={below} boxed={!!data.mapData && !data.blank} />
	{:else}
		{@render top()}
		{@render below()}
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
		font-size: var(--fs-base);
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
	/* In fondo: chi ha creato la pagina, chi l'ha modificata per ultimo e la cronologia delle modifiche. */
	.page-foot {
		margin-top: 2rem;
		border-top: 1px solid var(--c-border);
		max-width: var(--measure);
	}
	.page-foot p {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 0.5rem;
		margin: 0.75rem 0 0;
		font-size: var(--fs-sm);
	}
	.page-foot a {
		display: inline-flex;
		padding: 0.25rem;
		color: inherit;
	}
	.page-foot a:hover {
		color: var(--c-link);
	}
	/* Il punto resta in fondo alla prima riga quando sul telefono le due parti vanno a capo. */
	.page-foot span:not(:last-of-type)::after {
		content: '·';
		padding-left: 0.5rem;
	}
</style>

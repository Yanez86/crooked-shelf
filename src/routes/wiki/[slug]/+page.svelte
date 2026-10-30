<script lang="ts">
	import { page as appPage } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import TagBadge from '#lib/components/TagBadge.svelte';
	import RelTime from '#lib/components/RelTime.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const locale = $derived(appPage.data.locale as string);

	// Colonna a lato: le immagini da sole, i testi di seguito nella stessa scheda (con i dati della sessione in cima).
	type Field = PageProps['data']['fields'][number];
	const groups = $derived(
		data.fields.reduce<(Field | Field[])[]>(
			(out, f) => {
				const last = out.at(-1);
				if (f.image) out.push(f);
				else if (Array.isArray(last)) last.push(f);
				else out.push([f]);
				return out;
			},
			data.session ? [[]] : []
		)
	);
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

	<!-- Senza riquadri la colonna non c'è: si aggiunge modificando la pagina. -->
	<div class="body" class:with-side={groups.length > 0}>
		{#if groups.length}
			<aside class="side" aria-label={t('fields.title')}>
				{#each groups as g, i (i)}
					{#if Array.isArray(g)}
						<dl>
							{#if i === 0 && data.session}
								{#if data.session.number}<dt>{t('session.number')}</dt><dd>{data.session.number}</dd>{/if}
								{#if data.session.realDate}
									<dt>{t('session.realDate')}</dt>
									<dd><time datetime={data.session.realDate}>{new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(data.session.realDate + 'T12:00:00'))}</time></dd>
								{/if}
								{#if data.session.world}<dt>{t('session.worldDate')}</dt><dd>{data.session.world}</dd>{/if}
							{/if}
							{#each g as f, j (j)}
								<dt>{f.label}</dt>
								<dd>{@html f.html || '—'}</dd>
							{/each}
						</dl>
					{:else if g.image}
						<figure>
							<img src={g.image.url} alt={g.label || data.page.title} width={g.image.width} height={g.image.height} />
							{#if g.label}<figcaption>{g.label}</figcaption>{/if}
						</figure>
					{/if}
				{/each}
			</aside>
		{/if}

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
	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-items: start;
		gap: 1.5rem 2rem;
		margin: 1.5rem 0 2.5rem;
	}
	.body.with-side {
		grid-template-columns: minmax(0, 1fr) auto;
	}
	.content {
		grid-column: 1;
		grid-row: 1;
		min-width: 0;
	}
	/* La colonna in alto a destra: un riquadro a sé, staccato dal testo. */
	.side {
		grid-column: 2;
		grid-row: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 20rem;
		max-width: 100%;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
		padding: 1rem;
	}
	.side > * + * {
		border-top: 1px solid var(--c-border);
		padding-top: 1rem;
	}
	figure {
		margin: 0;
	}
	figure img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 28rem;
		object-fit: contain;
		background: var(--c-surface2);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
	}
	figcaption {
		margin-top: 0.4rem;
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	/* Nello spazio stretto (telefono) la colonna va in cima, prima del testo. */
	@container (max-width: 44rem) {
		.body.with-side {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			grid-column: 1;
			width: auto;
		}
		figure img {
			max-width: 22rem;
		}
		.content {
			grid-row: 2;
		}
	}
	.side dl {
		margin: 0;
		display: grid;
		grid-template-columns: minmax(6rem, auto) 1fr;
		gap: 0.4rem 0.75rem;
	}
	.side dt {
		font-weight: 700;
	}
	.side dd {
		margin: 0;
		overflow-wrap: anywhere;
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
</style>

<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import RelTime from '#lib/components/RelTime.svelte';
	import PageBody from '#lib/components/PageBody.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import { pageIcon } from '#lib/tree.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const user = $derived(page.data.user);
</script>

<svelte:head><title>{page.data.siteName}</title></svelte:head>

{#snippet head()}
	<PageHead page={data.home?.page ?? { slug: '', title: page.data.siteName, icon: null, cover: null }} canEdit={data.home?.canEdit ?? false} />
	{#if user}<p class="muted welcome">{t('home.welcome', { name: user.displayName })}</p>{/if}
{/snippet}

{#snippet lists()}
	<div class="lists side-panel panel">
		{@render recent('recent', data.recent, 'updatedAt')}
		{@render recent('added', data.added, 'createdAt')}
		<p class="all"><a href="/wiki">{t('home.allPages', { n: data.total })}</a></p>
	</div>
{/snippet}

{#snippet recent(id: 'recent' | 'added', rows: typeof data.recent, when: 'updatedAt' | 'createdAt')}
	<section aria-labelledby="{id}-title">
		<h2 id="{id}-title">{t('home.' + id)}</h2>
		<ul class="list-plain">
			{#each rows as r (r.slug)}
				<li>
					<a href="/wiki/{r.slug}">
						<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d={pageIcon(r)} /></svg>
						<span>
							<span class="title">{r.title}</span>
							<span class="when muted"><RelTime ts={r[when]} locale={page.data.locale} /></span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/snippet}

<div class="home">
	<PageBody title={data.home?.page.title ?? ''} html={data.home?.html ?? ''} fields={data.home?.fields ?? []} session={data.home?.session ?? null} locale={page.data.locale} {head} more={data.empty ? undefined : lists} />

	{#if data.empty}
		<section class="card empty">
			<h2>{t('home.emptyTitle')}</h2>
			<p>{t('home.emptyText')}</p>
			{#if user}<a class="btn btn-primary" href="/wiki/new"><Icon name="plus" />{t('home.firstPage')}</a>{/if}
		</section>
		{#if data.world.length}
			<h2>{t('home.world')}</h2>
			<ul class="cats">
				{#each data.world as w (w.slug)}
					<li><a href="/wiki/{w.slug}">{w.title}</a> <span class="muted">({t('kinds.' + w.kind)})</span></li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	/* La colonna della pagina arriva in fondo, così il riquadro resta fermo. */
	.home :global(.body.with-side) {
		align-items: stretch;
	}
	/* Nello spazio stretto (telefono) le ultime pagine vanno sotto la presentazione. */
	@container (max-width: 44rem) {
		.home :global(.body.headed .side-col) {
			grid-row: 3;
		}
		.home :global(.body.headed .prose) {
			grid-row: 2;
		}
		.lists {
			position: static;
			max-height: none;
		}
	}
	.welcome {
		margin: 0;
	}
	.empty h2 {
		margin-top: 0;
	}
	/* Elenchi di navigazione: niente puntini, una riga per voce. */
	.cats {
		list-style: none;
		padding: 0;
		margin: 0 0 0.75rem;
	}
	.cats li {
		border-bottom: 1px solid var(--c-border);
	}
	.cats a {
		display: inline-flex;
		align-items: center;
		min-height: 2.5rem;
		text-decoration: none;
	}
	.cats a:hover {
		text-decoration: underline;
	}
	/* Titoli e righe come quelli dell'albero a sinistra. */
	.lists h2 {
		margin: 0 0 0.35rem;
		padding: 0.3rem 0.4rem;
		border-bottom: 1px solid var(--c-border);
		font-family: var(--font-head);
		font-size: inherit;
		font-weight: 700;
	}
	.lists section + section {
		margin-top: 0.75rem;
	}
	.lists li a {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		min-height: 1.75rem;
		padding: 0.2rem 0.4rem;
		border-radius: var(--radius);
		color: var(--c-text);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.lists li a:hover {
		background: var(--c-surface2);
	}
	.lists li a:hover .title {
		text-decoration: underline;
	}
	.ico {
		flex: none;
		width: 1.15rem;
		height: 1.15rem;
		margin-top: 0.05rem;
		color: var(--c-muted);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.when {
		display: block;
		font-size: 0.9em;
	}
	.all {
		margin: 0.5rem 0 0;
		padding: 0 0.4rem;
	}
</style>

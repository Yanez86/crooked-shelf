<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import RelTime from '#lib/components/RelTime.svelte';
	import PageBody from '#lib/components/PageBody.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import UserIcon from '#lib/components/UserIcon.svelte';
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import { canWrite } from '#lib/access.ts';
	import { pageIcon } from '#lib/tree.ts';
	import { iconPath } from '#lib/icons.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const user = $derived(page.data.user);
	// Date "di parete", come negli Appuntamenti: in UTC, così il fuso di chi guarda non sposta il giorno.
	const day = (d: string) => new Intl.DateTimeFormat(page.data.locale as string, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z'));
</script>

<svelte:head><title>{page.data.siteName}</title></svelte:head>

{#snippet head()}
	<PageHead page={data.home?.page ?? { slug: '', title: page.data.siteName, icon: null, cover: null }} canEdit={data.home?.canEdit ?? false} />
{/snippet}

{#snippet lists()}
	<div class="lists side-panel panel">
		{#if data.table}{@render table(data.table)}{/if}
		{#if data.schedule?.next}{@render sessions('next', [data.schedule.next])}{/if}
		{#if data.schedule?.toAnswer.length}{@render sessions('toAnswer', data.schedule.toAnswer)}{/if}
		{#if !data.empty}
			{@render recent('recent', data.recent, 'updatedAt')}
			{@render recent('added', data.added, 'createdAt')}
			<p class="all"><a href="/wiki">{t('home.allPages', { n: data.total })}</a></p>
		{/if}
	</div>
{/snippet}

{#snippet person(icon: string | null, avatar: string | null, name: string, sub: string)}
	<UserIcon {icon} {avatar} size="1.5rem" />
	<span>
		<span class="title">{name}</span>
		<span class="when muted">{sub}</span>
	</span>
{/snippet}

<!-- Al tavolo: il Master e i giocatori. Il nome di un giocatore porta alla sua scheda, col nome del personaggio sotto. -->
{#snippet table(tb: NonNullable<typeof data.table>)}
	<section aria-labelledby="table-title">
		<h2 id="table-title">{t('sheets.table')}</h2>
		<ul class="list-plain">
			{#if tb.master}
				<li><span class="row">{@render person(tb.master.icon, tb.master.avatar, tb.master.name, t('campaign.master'))}</span></li>
			{/if}
			{#each tb.players as p, i (i)}
				{@const sub = p.sheet && p.sheet.title !== p.name ? p.sheet.title : t('sheets.player')}
				<li>
					{#if p.sheet}
						<a class="row" href="/wiki/{p.sheet.slug}">{@render person(p.icon, p.avatar, p.name, sub)}</a>
					{:else}
						<span class="row">{@render person(p.icon, p.avatar, p.name, sub)}</span>
					{/if}
				</li>
			{/each}
		</ul>
		{#if !tb.players.length}<p class="none muted">{t('campaign.noPlayers')}</p>{/if}
	</section>
{/snippet}

<!-- Gli appuntamenti: la prossima sessione e le date del mese a cui il giocatore deve ancora rispondere. Portano alla data nel calendario. -->
{#snippet sessions(id: 'next' | 'toAnswer', rows: NonNullable<typeof data.schedule>['toAnswer'])}
	<section aria-labelledby="{id}-title">
		<h2 id="{id}-title">{t('home.' + id)}</h2>
		<ul class="list-plain">
			{#each rows as o (o.id + o.date)}
				<li>
					<a class="row" href="/schedule?m={o.date.slice(0, 7)}#o-{o.id}-{o.date}">
						<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPath('calendar')} /></svg>
						<span>
							<span class="title">{o.title}</span>
							<span class="when muted"><time datetime="{o.date}T{o.starts}">{day(o.date)}, {o.starts}</time></span>
							{#if id === 'next'}
								<span class="when muted">{#if o.status}{t('schedule.status.' + o.status)} · {/if}{o.answer ? t('schedule.answer.' + o.answer) : t('home.notAnswered')}</span>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/snippet}

{#snippet recent(id: 'recent' | 'added', rows: typeof data.recent, when: 'updatedAt' | 'createdAt')}
	<section aria-labelledby="{id}-title">
		<h2 id="{id}-title">{t('home.' + id)}</h2>
		<ul class="list-plain">
			{#each rows as r (r.slug)}
				<li>
					<a class="row" href="/wiki/{r.slug}">
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
	<PageBody title={data.home?.page.title ?? ''} html={data.home?.html ?? ''} fields={data.home?.fields ?? []} session={data.home?.session ?? null} locale={page.data.locale} {head} more={data.empty && !data.table ? undefined : lists} />

	{#if data.empty}
		<section class="card empty">
			<h2>{t('home.emptyTitle')}</h2>
			<p>{t('home.emptyText')}</p>
			{#if canWrite(user)}<a class="btn btn-primary" href="/wiki/new"><Icon name="plus" />{t('home.firstPage')}</a>{/if}
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
	.lists .row {
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
	a.row:hover {
		background: var(--c-surface2);
	}
	a.row:hover .title {
		text-decoration: underline;
	}
	.lists .row :global(.user-icon) {
		margin-top: 0.05rem;
	}
	.none {
		margin: 0;
		padding: 0 0.4rem;
		font-size: var(--fs-sm);
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
		font-size: var(--fs-sm);
	}
	.all {
		margin: 0.5rem 0 0;
		padding: 0 0.4rem;
	}
</style>

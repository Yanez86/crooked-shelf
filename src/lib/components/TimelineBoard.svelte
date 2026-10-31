<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import EventForm from './EventForm.svelte';
	import FormError from './FormError.svelte';
	import Icon from './Icon.svelte';
	import type { timelineView } from '../server/timelinePage.ts';

	// Gli eventi di una pagina «cronologia», in elenco o sulla linea del tempo. I moduli vanno alle azioni della pagina.
	let {
		data,
		slug,
		form
	}: {
		data: NonNullable<ReturnType<typeof timelineView>>;
		slug: string;
		form: { error?: string | null; values?: Record<string, unknown> | null } | null;
	} = $props();
	const t = getT();
	const locale = $derived(page.data.locale as string);
	const realFmt = (d: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(d + 'T12:00:00'));

	const emptyValues = $derived({
		title: '',
		description: '',
		date: null,
		approx: '',
		realDate: data.mode === 'campaign' ? new Date().toISOString().slice(0, 10) : null,
		page: '',
		visibility: 'players'
	});

	// Raggruppa per anno nel mondo (o "senza data").
	const groups = $derived.by(() => {
		const out: { key: string; label: string; items: typeof data.events }[] = [];
		for (const e of data.events) {
			const key = data.mode === 'world' ? String(e.year) : e.realDate ? e.realDate.slice(0, 7) : 'none';
			const label =
				data.mode === 'world'
					? e.yearLabel
					: e.realDate
						? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(e.realDate + 'T12:00:00'))
						: t('timeline.noRealDate');
			const last = out.at(-1);
			if (last?.key === key) last.items.push(e);
			else out.push({ key, label, items: [e] });
		}
		return out;
	});
</script>

<p class="muted">
	{t('timeline.mode.' + data.mode + 'Hint')}
	{t('timeline.calendarIs', { name: data.calendarName })}
	{#if data.today}{t('timeline.today', { date: data.today })}{/if}
	· <a href="/calendar">{t('calendar.title')}</a>
</p>


<nav class="views" aria-label={t('timeline.views')}>
	<a href="?view=list" aria-current={data.view === 'list' ? 'page' : undefined}>{t('timeline.viewList')}</a>
	<a href="?view=line" aria-current={data.view === 'line' ? 'page' : undefined}>{t('timeline.viewLine')}</a>
</nav>

{#if data.canAdd}
	<!-- In alto ma chiuso: la cronologia si legge, il modulo si apre quando serve (e resta aperto dopo un inserimento). -->
	<details class="disclosure add" open={!data.events.length || !!form}>
		<summary class="btn"><Icon name="plus" />{t('timeline.add')}</summary>
		<FormError error={form?.error ?? null} />
		{#key form}
			<EventForm
				values={form?.values ? { ...emptyValues, ...form.values } : emptyValues}
				timeline={data.mode}
				months={data.months}
				visibilities={data.visibilities}
				pageTitles={data.pageTitles}
				action="?/addEvent"
				submitLabel={t('timeline.addSubmit')}
			/>
		{/key}
	</details>
{/if}

{#snippet eventBody(e: (typeof data.events)[number])}
	<p class="when">
		{#if e.approx}<span>{e.approx}</span>{#if e.when}<span class="muted">&nbsp;({e.when})</span>{/if}
		{:else if e.when}<span>{e.when}</span>{/if}
		{#if e.weekday}<span class="muted"> · {e.weekday}</span>{/if}
		{#if e.ago !== null && e.ago > 0}<span class="muted"> · {t(e.ago === 1 ? 'timeline.ago1' : 'timeline.ago', { n: e.ago })}</span>{/if}
		{#if data.mode === 'campaign' && e.realDate}<span class="muted"> · {t('timeline.played', { date: realFmt(e.realDate) })}</span>{/if}
	</p>
	<h3 class="ev-title">
		{#if e.page}<a href="/wiki/{e.page.slug}">{e.title}</a>{:else}{e.title}{/if}
	</h3>
	{#if e.html}<p class="desc">{@html e.html}</p>{/if}
	<p class="tags">
		{#if e.session}<span class="badge">{t('timeline.session')}</span>{/if}
		{#if e.visibility !== 'players'}<span class="badge">{t('visibility.' + e.visibility)}</span>{/if}
		{#if e.canEdit}<a class="btn btn-small btn-ghost" href="/wiki/{slug}/events/{e.id}" title={t('page.edit')}><Icon name="edit" /><span class="visually-hidden">{t('page.edit')}: {e.title}</span></a>{/if}
	</p>
{/snippet}

{#if !data.events.length}
	<p>{t('timeline.empty')}</p>
{:else if data.view === 'line'}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (la striscia scorre: deve poter ricevere il focus da tastiera) -->
	<div class="line" role="region" aria-label={t('timeline.viewLine')} tabindex="0">
		<ol class="list-plain">
			{#each data.events as e (e.id)}
				<li id="event-{e.id}" class="card">{@render eventBody(e)}</li>
			{/each}
		</ol>
	</div>
	<p class="hint">{t('timeline.lineHint')}</p>
{:else}
	{#each groups as g (g.key)}
		<section class="group" aria-labelledby="g-{g.key}">
			<h2 id="g-{g.key}">{g.label}</h2>
			<ol class="list-plain">
				{#each g.items as e (e.id)}
					<li id="event-{e.id}" class="event">{@render eventBody(e)}</li>
				{/each}
			</ol>
		</section>
	{/each}
{/if}

<style>
	.views {
		display: flex;
		gap: 0.5rem;
		margin: 1rem 0;
	}
	.views a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 0.9rem;
		border: 2px solid var(--c-control);
		border-radius: var(--radius);
		color: var(--c-text);
		text-decoration: none;
	}
	.views a[aria-current='page'] {
		background: var(--c-primary);
		border-color: var(--c-primary);
		color: var(--c-on-primary);
		font-weight: 700;
	}
	.group h2 {
		font-size: var(--fs-lg);
		margin: 1.5rem 0 0.5rem;
	}
	.event {
		position: relative;
		padding: 0.25rem 0 0.75rem 1.5rem;
		border-left: 3px solid var(--c-primary);
		margin-left: 0.4rem;
		max-width: var(--measure);
	}
	.event::before {
		content: '';
		position: absolute;
		left: -0.55rem;
		top: 0.55rem;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: var(--radius);
		background: var(--c-surface);
		border: 3px solid var(--c-primary);
		transform: rotate(45deg);
	}
	.when {
		margin: 0;
		font-size: var(--fs-sm);
		font-weight: 600;
	}
	.ev-title {
		margin: 0.1rem 0 0.25rem;
		font-size: var(--fs-md);
	}
	.desc {
		margin: 0 0 0.25rem;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin: 0;
	}
	.line {
		overflow-x: auto;
		padding: 1.5rem 0.25rem 1rem;
		border-top: 3px solid var(--c-primary);
		scroll-snap-type: x proximity;
	}
	.line ol {
		display: flex;
		gap: 1rem;
		width: max-content;
	}
	.line li {
		width: 17rem;
		scroll-snap-align: start;
		position: relative;
	}
	.line li::before {
		content: '';
		position: absolute;
		top: -1.95rem;
		left: 1rem;
		width: 0.9rem;
		height: 0.9rem;
		border-radius: var(--radius);
		background: var(--c-primary);
		transform: rotate(45deg);
	}
	.add {
		margin: 0 0 1.5rem;
	}
	.add[open] {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--c-border);
	}
</style>

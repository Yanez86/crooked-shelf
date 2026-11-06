<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import { refreshAll, replaceState } from '$app/navigation';
	import { getT } from '../i18n/index.ts';
	import { formatDate } from '../calendar.ts';
	import { averageYear, dateOfDay, isoOfDay, monthLength, realDay, realTicks, worldTicks } from '../timelineScale.ts';
	import EventForm from './EventForm.svelte';
	import FormError from './FormError.svelte';
	import Icon from './Icon.svelte';
	import TimelineLine from './TimelineLine.svelte';
	import type { timelineView } from '../server/timelinePage.ts';

	/*
	 * Gli eventi di una pagina «cronologia», in elenco o sulla linea in scala. Ricerca e filtri lavorano nel browser
	 * sugli eventi che il server ha già scelto per chi guarda. I moduli vanno alle azioni della pagina (aggiungere)
	 * e a quelle della pagina dell'evento (modificare, eliminare), senza ricaricare; senza JavaScript funzionano
	 * come moduli normali, e la matita porta alla pagina dell'evento.
	 */
	let {
		data,
		slug,
		form
	}: {
		data: NonNullable<ReturnType<typeof timelineView>>;
		slug: string;
		form: { ok?: string | null; error?: string | null; values?: Record<string, unknown> | null; id?: number } | null;
	} = $props();
	const t = getT();
	type Ev = (typeof data.events)[number];

	const locale = $derived(page.data.locale as string);
	const cal = $derived(data.calendar);
	const dateFmt = $derived(new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }));
	const shortFmt = $derived(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }));
	const monthFmt = $derived(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }));
	const utc = (iso: string) => new Date(iso + 'T12:00:00Z');

	// Sotto questa larghezza la linea non ci sta: si legge l'elenco (che è anche la vista senza JavaScript).
	const NARROW = 520;
	let width = $state(0);
	let mounted = $state(false);
	let view = $state(untrack(() => data.view));
	const narrow = $derived(width > 0 && width < NARROW);
	const shownView = $derived(narrow ? 'list' : view);

	let q = $state('');
	let only = $state({ page: false, master: false, session: false });
	/** Nella cronologia della campagna si sceglie l'ordine: data di gioco o data nel mondo. */
	let axis = $state<'real' | 'world'>('real');
	const axisKey = $derived(data.mode === 'world' ? 'world' : axis);
	let selected = $state<number | null>(null);
	let editing = $state<number | null>(null);
	let editError = $state<string | null>(null);
	let editValues = $state<Record<string, unknown> | null>(null);
	let editKey = $state(0);
	let addOpen = $state(untrack(() => !data.events.length || !!form));
	let addValues = $state<Record<string, unknown> | null>(null);
	let addKey = $state(0);
	let status = $state('');

	onMount(() => {
		mounted = true;
		// Un collegamento a #event-… sceglie quell'evento anche sulla linea.
		const id = Number(location.hash.match(/^#event-(\d+)$/)?.[1]);
		if (id && data.events.some((e) => e.id === id)) selected = id;
	});

	// Dopo un evento aggiunto: il modulo resta aperto per il prossimo e l'evento nuovo è quello scelto.
	$effect(() => {
		if (!form) return;
		untrack(() => {
			addOpen = true;
			if (form.id) selected = form.id;
		});
	});

	const emptyValues = $derived({
		title: '',
		description: '',
		date: null,
		approx: '',
		realDate: data.mode === 'campaign' ? data.todayReal : null,
		page: '',
		visibility: 'players'
	});
	const addFormKey = $derived({ form, addKey });

	// --- Ricerca, filtri e ordine ---

	const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
	const haystack = $derived(new Map(data.events.map((e) => [e.id, fold([e.title, e.html.replace(/<[^>]*>/g, ''), e.approx, e.page?.title ?? ''].join(' '))])));
	const needle = $derived(fold(q.trim()));
	const filtering = $derived(!!needle || only.page || only.master || only.session);
	const hasMaster = $derived(data.events.some((e) => e.visibility === 'master'));
	const byId = $derived(new Map(data.events.map((e) => [e.id, e])));
	const pos = (e: Ev): number | null => (axisKey === 'world' ? e.t : e.realDate ? realDay(e.realDate) : null);

	const shown = $derived.by(() => {
		const list = data.events.filter(
			(e) => (!needle || haystack.get(e.id)!.includes(needle)) && (!only.page || e.page) && (!only.master || e.visibility === 'master') && (!only.session || e.session)
		);
		// Il server li manda già in ordine di data nel mondo (o di gioco, nella campagna); l'altro ordine si fa qui.
		if (data.mode === 'world' || axis === 'real') return list;
		const at = new Map(data.events.map((e, i) => [e.id, i]));
		return [...list].sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity) || at.get(a.id)! - at.get(b.id)!);
	});
	const onLine = $derived(shown.flatMap((e) => (pos(e) === null ? [] : [{ id: e.id, t: pos(e)!, kind: e.visibility === 'master' ? ('master' as const) : e.session ? ('session' as const) : ('event' as const) }])));
	const undated = $derived(shown.length - onLine.length);

	const todayPos = $derived(axisKey === 'world' ? data.todayT : realDay(data.todayReal));
	const todayText = $derived(axisKey === 'world' ? data.today : dateFmt.format(utc(data.todayReal)));

	/** «≈ 318 anni», «≈ 3 settimane»: quanto copre un salto. */
	function gapLabel(days: number): string {
		if (axisKey === 'world') {
			const years = days / averageYear(cal);
			if (years >= 1.5) return t('timeline.gapYears', { n: Math.round(years) });
			return t('timeline.gapMonths', { n: Math.max(1, Math.round(days / monthLength(cal))) });
		}
		if (days >= 60) return t('timeline.gapMonths', { n: Math.round(days / 30) });
		if (days >= 14) return t('timeline.gapWeeks', { n: Math.round(days / 7) });
		return t('timeline.gapDays', { n: Math.round(days) });
	}
	const labelAt = (p: number, ppu: number) => {
		if (axisKey !== 'world') return shortFmt.format(utc(isoOfDay(p)));
		const d = dateOfDay(cal, p);
		return formatDate(cal, ppu * monthLength(cal) >= 46 ? { year: d.year, month: d.month } : { year: d.year });
	};
	const tickGen = $derived(axisKey === 'world' ? worldTicks(cal) : realTicks(locale));

	// L'elenco: un gruppo per anno nel mondo (o per mese di gioco), coi salti lunghi segnati tra un gruppo e l'altro.
	const groups = $derived.by(() => {
		const out: { key: string; label: string; items: Ev[]; first: number | null; last: number | null }[] = [];
		for (const e of shown) {
			const world = axisKey === 'world';
			const key = world ? (e.year === null ? 'none' : String(e.year)) : (e.realDate?.slice(0, 7) ?? 'none');
			const p = pos(e);
			const last = out.at(-1);
			if (last?.key === key) {
				last.items.push(e);
				if (p !== null) last.last = p;
				continue;
			}
			const label =
				key === 'none' ? t(world ? 'timeline.noWorldDate' : 'timeline.noRealDate') : world ? e.yearLabel : monthFmt.format(utc(e.realDate!));
			out.push({ key, label, items: [e], first: p, last: p });
		}
		return out;
	});
	const gapMin = $derived(axisKey === 'world' ? 10 * averageYear(cal) : 14);
	/** Il gruppo prima del quale cade «oggi» (o groups.length, in fondo). */
	const todayAt = $derived(todayPos === null || filtering ? -1 : (() => {
		const i = groups.findIndex((g) => g.first !== null && g.first > todayPos);
		return i < 0 ? (groups.some((g) => g.first !== null) ? groups.length : -1) : i;
	})());

	// --- La linea: l'evento scelto e i suoi vicini ---

	const lineIndex = $derived(selected === null ? -1 : onLine.findIndex((i) => i.id === selected));
	const current = $derived(lineIndex < 0 ? null : byId.get(onLine[lineIndex].id)!);

	function select(id: number | null) {
		selected = id;
		if (editing !== null && editing !== id) stopEdit();
	}

	function setView(ev: MouseEvent, v: 'list' | 'line') {
		if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
		ev.preventDefault();
		view = v;
		editing = null;
		try {
			replaceState(`?view=${v}`, {});
		} catch {
			// Prima che il router sia pronto l'indirizzo resta com'è: conta solo la vista.
		}
	}

	function clearFilters() {
		q = '';
		only = { page: false, master: false, session: false };
		document.getElementById('tl-q')?.focus();
	}

	/** Doppio clic sulla linea: il modulo «Aggiungi» con la data di quel punto (il giorno solo se lo zoom lo mostra). */
	async function pickAt(p: number, ppu: number) {
		if (!data.canAdd) return;
		if (axisKey === 'world') {
			const d = dateOfDay(cal, p);
			const month = ppu * monthLength(cal) >= 46;
			addValues = { date: { year: d.year, month: month ? d.month : null, day: month && ppu >= 20 ? d.day : null } };
		} else addValues = { realDate: isoOfDay(p) };
		addKey++;
		addOpen = true;
		stopEdit();
		await tick();
		const title = document.getElementById('ev-title');
		title?.scrollIntoView({ block: 'center' });
		title?.focus({ preventScroll: true });
	}

	// --- Modifica sul posto ---

	async function startEdit(ev: MouseEvent, id: number) {
		if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
		ev.preventDefault();
		editing = id;
		editError = null;
		editValues = null;
		editKey++;
		selected = id;
		await tick();
		document.getElementById(`edit-${id}-title`)?.focus();
	}
	function stopEdit(focusId?: number) {
		editing = null;
		editError = null;
		editValues = null;
		if (focusId !== undefined) tick().then(() => document.getElementById(`edit-link-${focusId}`)?.focus());
	}
	const editBase = (e: Ev) => ({
		title: e.title,
		description: e.edit?.description ?? '',
		date: e.edit?.date ?? null,
		approx: e.approx,
		realDate: e.realDate,
		page: e.edit?.page ?? '',
		visibility: e.visibility
	});
	const saveEdit =
		(id: number): SubmitFunction =>
		({ submitter }) => {
			const removing = !!(submitter as HTMLButtonElement | null)?.formAction?.includes('?/delete');
			return async ({ result }) => {
				if (result.type === 'failure') {
					editError = (result.data?.error as string) ?? 'errors.generic';
					editValues = (result.data?.values as Record<string, unknown>) ?? null;
					editKey++;
					return;
				}
				if (result.type === 'error') {
					editError = 'errors.generic';
					return;
				}
				editing = null;
				editError = null;
				editValues = null;
				if (removing && selected === id) selected = null;
				await refreshAll();
				status = t(removing ? 'timeline.deleted' : 'timeline.saved');
				await tick();
				(document.getElementById(`edit-link-${id}`) ?? document.getElementById(`event-${id}`))?.focus();
			};
		};

	const afterAdd: SubmitFunction = () => async ({ update }) => {
		addValues = null;
		await update();
		await tick();
		document.getElementById('ev-title')?.focus({ preventScroll: true });
	};

	async function copyLink(e: Ev) {
		const url = `${location.origin}/wiki/${slug}#event-${e.id}`;
		try {
			await navigator.clipboard.writeText(url);
			status = t('timeline.copied');
		} catch {
			status = t('timeline.copyFailed', { url });
		}
	}

	function jump(ev: Event) {
		const sel = ev.currentTarget as HTMLSelectElement;
		const target = document.getElementById(sel.value);
		sel.value = '';
		if (!target) return;
		target.scrollIntoView({ block: 'start' });
		target.focus({ preventScroll: true });
	}

	const lineDate = (e: Ev) => {
		const world = e.approx ? `${e.approx}${e.when ? ` (${e.when})` : ''}` : (e.when ?? '');
		if (data.mode === 'world') return [world, ''];
		const played = e.realDate ? shortFmt.format(utc(e.realDate)) : '';
		return axisKey === 'real' ? [played || world, played ? world : ''] : [world || played, world && played ? t('timeline.played', { date: played }) : ''];
	};
</script>

<div class="tl" bind:clientWidth={width}>
	<p class="muted">
		{t('timeline.mode.' + data.mode + 'Hint')}
		{t('timeline.calendarIs', { name: data.calendarName })}
		{#if data.today}{t('timeline.today', { date: data.today })}{/if}
		· <a href="/calendar">{t('calendar.title')}</a>
	</p>

	{#if data.events.length}
		<div class="tools">
			<div class="search">
				<Icon name="search" />
				<label class="visually-hidden" for="tl-q">{t('timeline.search')}</label>
				<input id="tl-q" type="search" placeholder={t('timeline.search')} autocomplete="off" bind:value={q} />
			</div>
			<div class="chips" role="group" aria-label={t('timeline.filters')}>
				<button type="button" class="chip" aria-pressed={only.page} onclick={() => (only.page = !only.page)}>{t('timeline.filterPage')}</button>
				{#if hasMaster}<button type="button" class="chip" aria-pressed={only.master} onclick={() => (only.master = !only.master)}><Icon name="lock" />{t('visibility.master')}</button>{/if}
				{#if data.mode === 'campaign'}<button type="button" class="chip" aria-pressed={only.session} onclick={() => (only.session = !only.session)}>{t('timeline.filterSession')}</button>{/if}
			</div>
			{#if data.mode === 'campaign'}
				<div class="seg" role="group" aria-label={t('timeline.axis')}>
					<button type="button" aria-pressed={axis === 'real'} onclick={() => (axis = 'real')}>{t('timeline.axisReal')}</button>
					<button type="button" aria-pressed={axis === 'world'} onclick={() => (axis = 'world')}>{t('timeline.axisWorld')}</button>
				</div>
			{/if}
			{#if !narrow}
				<nav class="seg" aria-label={t('timeline.views')}>
					<a href="?view=list" aria-current={shownView === 'list' ? 'page' : undefined} onclick={(e) => setView(e, 'list')}>{t('timeline.viewList')}</a>
					<a href="?view=line" aria-current={shownView === 'line' ? 'page' : undefined} onclick={(e) => setView(e, 'line')}>{t('timeline.viewLine')}</a>
				</nav>
			{/if}
		</div>
		<p class="count" aria-live="polite">
			{#if filtering}
				{t(shown.length === 1 ? 'timeline.countOf1' : 'timeline.countOf', { n: shown.length, total: data.events.length })}
				<button type="button" class="linkish" onclick={clearFilters}>{t('timeline.clear')}</button>
			{:else}
				{t(data.events.length === 1 ? 'timeline.count1' : 'timeline.count', { n: data.events.length })}
			{/if}
			{#if shownView === 'line' && undated}<span>· {t('timeline.undated', { n: undated })}</span>{/if}
			{#if status}<span class="status">· {status}</span>{/if}
		</p>
	{/if}

	{#if data.canAdd}
		<!-- In alto ma chiuso: la cronologia si legge, il modulo si apre quando serve (e resta aperto dopo un inserimento). -->
		<details class="disclosure add" bind:open={addOpen}>
			<summary class="btn"><Icon name="plus" />{t('timeline.add')}</summary>
			<!-- Vince l'ultima cosa fatta: la data presa dalla linea, o quello che il server ha rimandato dopo un errore. -->
			<FormError error={addValues ? null : (form?.error ?? null)} />
			{#key addFormKey}
				<EventForm
					values={addValues ? { ...emptyValues, ...addValues } : form?.values ? { ...emptyValues, ...form.values } : emptyValues}
					timeline={data.mode}
					months={data.months}
					visibilities={data.visibilities}
					pageTitles={data.pageTitles}
					action="?/addEvent"
					submitLabel={t('timeline.addSubmit')}
					submit={afterAdd}
				/>
			{/key}
		</details>
	{/if}

	{#snippet when(e: Ev)}
		<p class="when">
			{#if axisKey === 'real' && data.mode === 'campaign' && e.realDate}
				<span>{t('timeline.played', { date: dateFmt.format(utc(e.realDate)) })}</span>
				{#if e.when}<span class="muted"> · {e.when}</span>{/if}
			{:else}
				{#if e.approx}<span>{e.approx}</span>{#if e.when}<span class="muted">&nbsp;({e.when})</span>{/if}
				{:else if e.when}<span>{e.when}</span>{/if}
				{#if e.weekday}<span class="muted"> · {e.weekday}</span>{/if}
				{#if e.ago !== null && e.ago > 0}<span class="muted"> · {t(e.ago === 1 ? 'timeline.ago1' : 'timeline.ago', { n: e.ago })}</span>{/if}
				{#if data.mode === 'campaign' && e.realDate}<span class="muted"> · {t('timeline.played', { date: dateFmt.format(utc(e.realDate)) })}</span>{/if}
			{/if}
		</p>
	{/snippet}

	{#snippet eventBody(e: Ev, headingId?: string)}
		{@render when(e)}
		<h3 class="ev-title" id={headingId}>
			{#if e.page}<a href="/wiki/{e.page.slug}">{e.title}</a>{:else}{e.title}{/if}
		</h3>
		{#if e.html}<p class="desc">{@html e.html}</p>{/if}
		<p class="tags">
			{#if e.session}<span class="badge">{t('timeline.session')}</span>{/if}
			{#if e.visibility !== 'players'}<span class="badge">{#if e.visibility === 'master'}<Icon name="lock" />{/if}{t('visibility.' + e.visibility)}</span>{/if}
			{#if e.canEdit}
				<a class="btn btn-small btn-ghost" id="edit-link-{e.id}" href="/wiki/{slug}/events/{e.id}" title={t('page.edit')} onclick={(ev) => startEdit(ev, e.id)}
					><Icon name="edit" /><span class="visually-hidden">{t('page.edit')}: {e.title}</span></a
				>
			{/if}
			{#if mounted}
				<button type="button" class="btn btn-small btn-ghost" title={t('timeline.copyLink')} onclick={() => copyLink(e)}
					><Icon name="link" /><span class="visually-hidden">{t('timeline.copyLink')}: {e.title}</span></button
				>
			{/if}
		</p>
	{/snippet}

	{#snippet editForm(e: Ev)}
		<div class="edit-inline">
			<h3 class="visually-hidden">{t('timeline.edit')}: {e.title}</h3>
			<FormError error={editError} />
			{#key editKey}
				<EventForm
					uid="edit-{e.id}"
					values={editValues ? { ...editBase(e), ...editValues } : editBase(e)}
					timeline={data.mode}
					months={data.months}
					visibilities={data.visibilities}
					pageTitles={data.pageTitles}
					action="/wiki/{slug}/events/{e.id}?/save"
					submitLabel={t('common.save')}
					submit={saveEdit(e.id)}
					oncancel={() => stopEdit(e.id)}
				>
					{#snippet extra()}
						<button class="btn btn-danger" type="submit" formaction="/wiki/{slug}/events/{e.id}?/delete" formnovalidate>{t('timeline.delete')}</button>
					{/snippet}
				</EventForm>
			{/key}
		</div>
	{/snippet}

	{#snippet lineCard(id: number)}
		{@const e = byId.get(id)!}
		{@const [d1, d2] = lineDate(e)}
		<span class="c-date">{d1}{#if d2}<span class="c-sec">{' · ' + d2}</span>{/if}</span>
		<span class="c-title">{e.title}</span>
		<span class="c-meta">
			{#if e.session}<span class="badge">{t('timeline.session')}</span>{/if}
			{#if e.visibility === 'master'}<span class="badge"><Icon name="lock" />{t('visibility.master')}</span>{/if}
			{#if e.page && !e.session}<span class="badge"><Icon name="link" />{e.page.title}</span>{/if}
		</span>
	{/snippet}

	{#if !data.events.length}
		<p>{t('timeline.empty')}</p>
	{:else if !shown.length}
		<p class="muted">{t('timeline.noMatch')}</p>
	{:else if shownView === 'line'}
		{#if onLine.length}
			{#key axisKey}
				<TimelineLine
					items={onLine}
					{selected}
					onselect={select}
					onpick={data.canAdd ? pickAt : undefined}
					ticks={tickGen}
					maxPpu={axisKey === 'world' ? 24 : 120}
					todayT={todayPos}
					todayLabel={t('timeline.todayMark', { date: todayText ?? '' })}
					{gapLabel}
					{labelAt}
					card={lineCard}
				/>
			{/key}
			<section class="detail card" aria-labelledby="tl-detail-title">
				{#if current}
					<div class="detail-nav">
						<button type="button" class="btn btn-small btn-ghost" disabled={lineIndex <= 0} onclick={() => select(onLine[lineIndex - 1].id)}><Icon name="arrowLeft" />{t('timeline.prev')}</button>
						<span class="muted">{t('timeline.position', { n: lineIndex + 1, total: onLine.length })}</span>
						<button type="button" class="btn btn-small btn-ghost" disabled={lineIndex >= onLine.length - 1} onclick={() => select(onLine[lineIndex + 1].id)}>{t('timeline.next')}<Icon name="arrowRight" /></button>
					</div>
					{#if editing === current.id}
						<h3 class="visually-hidden" id="tl-detail-title">{t('timeline.details')}</h3>
						{@render editForm(current)}
					{:else}
						{@render eventBody(current, 'tl-detail-title')}
					{/if}
				{:else}
					<h3 class="visually-hidden" id="tl-detail-title">{t('timeline.details')}</h3>
					<p class="muted pick">{t('timeline.pick')}</p>
				{/if}
			</section>
		{:else}
			<p class="muted">{t('timeline.undated', { n: undated })}</p>
		{/if}
	{:else}
		{#if groups.length > 6}
			<p class="jump">
				<label for="tl-jump">{t('timeline.jump')}</label>
				<select id="tl-jump" onchange={jump}>
					<option value="">—</option>
					{#each groups as g, i (g.key)}
						{#if i === todayAt}<option value="tl-today">{t('timeline.todayMark', { date: todayText ?? '' })}</option>{/if}
						<option value="g-{g.key}">{g.label}</option>
					{/each}
					{#if todayAt === groups.length}<option value="tl-today">{t('timeline.todayMark', { date: todayText ?? '' })}</option>{/if}
				</select>
			</p>
		{/if}
		{#each groups as g, i (g.key)}
			{@const prev = groups[i - 1]}
			{#if i === todayAt}<p class="today" id="tl-today" tabindex="-1">{t('timeline.todayMark', { date: todayText ?? '' })}</p>
			{:else if prev && prev.last !== null && g.first !== null && g.first - prev.last >= gapMin}<p class="gap">{gapLabel(g.first - prev.last)}</p>{/if}
			<section class="group" aria-labelledby="g-{g.key}">
				<h2 id="g-{g.key}" tabindex="-1">{g.label}</h2>
				<ol class="list-plain">
					{#each g.items as e (e.id)}
						<li id="event-{e.id}" class="event" class:master={e.visibility === 'master'} class:session={e.session} class:sel={e.id === selected}>
							{#if editing === e.id}{@render editForm(e)}{:else}{@render eventBody(e)}{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/each}
		{#if todayAt === groups.length}<p class="today" id="tl-today" tabindex="-1">{t('timeline.todayMark', { date: todayText ?? '' })}</p>{/if}
	{/if}
</div>

<style>
	.tl {
		container-type: inline-size;
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
		margin: 1rem 0 0.5rem;
	}
	.search {
		position: relative;
		flex: 1 1 14rem;
		min-width: 0;
	}
	.search :global(.icon) {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--c-muted);
		pointer-events: none;
	}
	.search input {
		width: 100%;
		padding-left: 2.4rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.chip,
	.seg > * {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 2.75rem;
		padding: 0 0.9rem;
		font: inherit;
		color: var(--c-text);
		background: var(--c-surface);
		border: 2px solid var(--c-control);
		border-radius: var(--radius);
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
	}
	.chip[aria-pressed='true'],
	.seg > [aria-pressed='true'],
	.seg > [aria-current='page'] {
		background: var(--c-primary);
		border-color: var(--c-primary);
		color: var(--c-on-primary);
		font-weight: 700;
	}
	/* Premuto non è solo un colore: anche il segno di spunta. */
	.chip[aria-pressed='true']::before {
		content: '✓' / '';
	}
	.seg {
		display: inline-flex;
		gap: 0.4rem;
	}
	.count {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
		align-items: center;
		margin: 0 0 1rem;
		color: var(--c-muted);
		font-size: var(--fs-sm);
	}
	.count .status {
		color: var(--c-text);
		font-weight: 600;
	}
	.linkish {
		min-height: 1.5rem;
		padding: 0;
		font: inherit;
		color: var(--c-link);
		background: none;
		border: 0;
		text-decoration: underline;
		cursor: pointer;
	}
	.add {
		margin: 0 0 1.5rem;
	}
	.add[open] {
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--c-border);
	}

	/* Elenco: l'anno a sinistra, gli eventi sulla linea a destra. */
	.group {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr);
		column-gap: 1rem;
		margin-top: 0.5rem;
	}
	.group h2 {
		position: sticky;
		top: calc(var(--sticky-top, 0px) + 0.5rem);
		align-self: start;
		margin: 0;
		padding-top: 0.2rem;
		font-size: var(--fs-md);
		text-align: right;
		font-variant-numeric: tabular-nums;
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
	.event.session::before {
		background: var(--c-primary);
	}
	.event.master::before {
		border: 2px dashed var(--c-secret-border);
	}
	.event.sel::before,
	.event:target::before {
		box-shadow: 0 0 0 3px var(--c-surface), 0 0 0 5px var(--c-primary);
	}
	.gap,
	.today {
		margin: 0.25rem 0 0.25rem calc(6.5rem + 1rem);
		padding: 0.15rem 0 0.15rem 1.4rem;
		font-size: var(--fs-sm);
	}
	.gap {
		border-left: 3px dotted var(--c-control);
		margin-left: calc(6.5rem + 1.4rem);
		color: var(--c-muted);
	}
	.today {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		max-width: var(--measure);
		font-weight: 600;
	}
	.today::after {
		content: '';
		flex: 1;
		border-top: 2px dashed var(--c-warning-border);
	}
	.jump {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin: 0 0 0.5rem;
	}
	@container (max-width: 34rem) {
		.group {
			grid-template-columns: minmax(0, 1fr);
		}
		.group h2 {
			position: static;
			text-align: left;
			margin: 1rem 0 0.4rem;
		}
		.gap,
		.today {
			margin-left: 0.4rem;
		}
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
	.edit-inline {
		padding: 0.5rem 0 0.5rem;
	}

	/* Le schede sulla linea. */
	.c-date {
		font-size: var(--fs-sm);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.c-sec {
		font-weight: 400;
	}
	.c-title {
		font-weight: 700;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.c-meta {
		display: flex;
		gap: 0.3rem;
		margin-top: auto;
		min-width: 0;
		overflow: hidden;
	}
	.c-meta .badge {
		font-size: var(--fs-sm);
		padding: 0 0.4rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.detail {
		margin-top: 1rem;
	}
	.detail-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		font-size: var(--fs-sm);
	}
	.pick {
		margin: 0;
	}
</style>

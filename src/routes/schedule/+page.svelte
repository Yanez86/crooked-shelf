<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import UserIcon from '#lib/components/UserIcon.svelte';
	import { monthGrid, type Answer } from '#lib/schedule.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const locale = $derived(page.data.locale as string);

	// Date "di parete": si formattano in UTC, così il fuso di chi guarda non sposta il giorno.
	const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z'));
	const weekdays = $derived(Array.from({ length: 7 }, (_, i) => ({ short: fmt(`2024-01-0${i + 1}`, { weekday: 'short' }), long: fmt(`2024-01-0${i + 1}`, { weekday: 'long' }) })));
	const weeks = $derived(monthGrid(data.month));
	const byDate = $derived(data.items.reduce((m, o) => m.set(o.date, [...(m.get(o.date) ?? []), o]), new Map<string, typeof data.items>()));
	const anchor = (o: { id: number; date: string }) => `o-${o.id}-${o.date}`;
	const STATUS_ICONS = { confirmed: 'check', pending: 'clock', cancelled: 'close' };
	const CHOICES: Answer[] = ['in_person', 'remote', 'no'];
	const mine = (o: (typeof data.items)[number]) => CHOICES.find((a) => o.answers[a].some((p) => p.id === page.data.user?.id));
	// L'esito va accanto alla data a cui si è risposto, non in cima alla pagina.
	let sent = $state('');
	// Il popup di una data, aperto dal calendario. Si segue la data, non la riga: dopo una risposta i dati si ricaricano.
	let dlg = $state<HTMLDialogElement>();
	let opened = $state('');
	const shown = $derived(data.items.find((o) => anchor(o) === opened));
	$effect(() => {
		if (shown && !dlg?.open) dlg?.showModal();
		else if (!shown) dlg?.close();
	});
</script>

<svelte:head><title>{t('schedule.title')}</title></svelte:head>

<!-- Le specifiche di una data: nella scheda sotto il calendario e nel popup. `id` tiene distinti i due titoli. -->
{#snippet details(o: (typeof data.items)[number], id: string)}
	{@const answer = mine(o)}
	<h3 id="{id}-title">{o.title}</h3>
	<p class="when">
		<time datetime="{o.date}T{o.starts}">{fmt(o.date, { weekday: 'long', day: 'numeric', month: 'long' })}, {o.starts}–{o.ends}</time>
		{#if o.repeat !== 'none'}<span class="muted"> · {t('schedule.repeat.' + o.repeat)}</span>{/if}
	</p>
	{#if o.status}
		<p class="status {o.status}"><Icon name={STATUS_ICONS[o.status]} />{t('schedule.status.' + o.status)}</p>
	{/if}
	<dl class="facts">
		{#if o.inPerson}
			<dt>{t('schedule.inPerson')}</dt>
			<dd>{o.place || '—'}</dd>
		{/if}
		{#if o.remote}
			<dt>{t('schedule.remote')}</dt>
			<dd>{#if o.link}<a href={o.link} target="_blank" rel="noopener noreferrer">{o.link}</a>{:else}—{/if}</dd>
		{/if}
		{#each [...CHOICES, 'waiting'] as k (k)}
			{#if o.answers[k as Answer | 'waiting'].length}
				<dt>{t('schedule.answers.' + k)}</dt>
				<dd>{o.answers[k as Answer | 'waiting'].map((p) => p.displayName).join(', ')}</dd>
			{/if}
		{/each}
	</dl>
	{#if data.starWishes[`${o.id}/${o.date}`]}
		<h4>{t('schedule.starWishes.title')}</h4>
		<ul class="list-plain wishes">
			{#each data.starWishes[`${o.id}/${o.date}`] as w, i (i)}
				<li>
					<strong>{w.name}</strong>
					<dl class="facts">
						<dt>{t('schedule.starWishes.starShort')}</dt>
						<dd>{w.star || '—'}</dd>
						<dt>{t('schedule.starWishes.wishShort')}</dt>
						<dd>{w.wish || '—'}</dd>
					</dl>
				</li>
			{/each}
		</ul>
	{/if}
	{#if data.canAnswer}
		<form
			method="post"
			action="?m={data.month}&/answer"
			class="actions"
			use:enhance={() => async ({ update }) => {
				sent = anchor(o);
				await update({ reset: false });
			}}
		>
			<input type="hidden" name="id" value={o.id} />
			<input type="hidden" name="date" value={o.date} />
			{#each CHOICES.filter((a) => (a !== 'in_person' || o.inPerson) && (a !== 'remote' || o.remote)) as a (a)}
				<button class="btn" class:btn-primary={answer === a} type="submit" name="answer" value={a} aria-pressed={answer === a}>{t('schedule.answer.' + a)}</button>
			{/each}
		</form>
		{#if sent === anchor(o)}
			<FormError error={form?.error} />
			<FormOk message={form?.ok} />
		{/if}
	{/if}
	{#if data.canManage}
		<div class="actions">
			<a class="btn btn-small" href="/schedule/{o.id}"><Icon name="edit" />{t(o.repeat === 'none' ? 'schedule.edit' : 'schedule.editSeries')}<span class="visually-hidden">: {o.title}</span></a>
			{#if o.repeat !== 'none'}
				<form method="post" action="?m={data.month}&/skip">
					<input type="hidden" name="id" value={o.id} />
					<input type="hidden" name="date" value={o.date} />
					<button class="btn btn-small btn-danger" type="submit">{t('schedule.skip')}<span class="visually-hidden">: {o.title}, {fmt(o.date, { day: 'numeric', month: 'long' })}</span></button>
				</form>
			{/if}
		</div>
	{/if}
{/snippet}

<div class="center-column">
	<h1>{t('schedule.title')}</h1>
	{#if data.rule.min > 0}
		<p>{t('schedule.ruleInfo', { n: data.rule.min, hours: data.rule.hours })}</p>
	{/if}

	<div class="month-head">
		<a class="btn btn-ghost" href="?m={data.prev}" title={t('schedule.prev')} aria-label={t('schedule.prev')}><Icon name="arrowLeft" /></a>
		<h2 id="month-title">{fmt(data.month + '-01', { month: 'long', year: 'numeric' })}</h2>
		<a class="btn btn-ghost" href="?m={data.next}" title={t('schedule.next')} aria-label={t('schedule.next')}><Icon name="arrowRight" /></a>
		{#if data.canManage}
			<a class="btn btn-primary new" href="/schedule/new?date={data.month === data.today.slice(0, 7) ? data.today : data.month + '-01'}"><Icon name="plus" />{t('schedule.new')}</a>
		{/if}
	</div>

	<table class="month" aria-labelledby="month-title">
		<thead>
			<tr>
				{#each weekdays as w (w.long)}<th scope="col" abbr={w.long}>{w.short}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each weeks as week, i (i)}
				<tr>
					{#each week as d, j (j)}
						<td class:out={!d} class:today={d === data.today} aria-current={d === data.today ? 'date' : undefined}>
							{#if d}
								<span class="day">{Number(d.slice(8))}</span>
								{#if byDate.get(d)}
									<ul class="list-plain">
										{#each byDate.get(d)! as o (o.id)}
											<li class:off={o.status === 'cancelled'}>
												<a
														href="#{anchor(o)}"
														aria-haspopup="dialog"
														onclick={(e) => {
															e.preventDefault();
															opened = anchor(o);
														}}
													>
														{o.starts} <span class="name">{o.title}</span>{#if o.status}<span class="visually-hidden"> ({t('schedule.status.' + o.status)})</span>{/if}
														<!-- Il Master (bordo dell'accento), chi viene in presenza, da remoto (bordo blu) e chi no (con la croce): i nomi sono nel popup. -->
														{#if data.master || o.answers.in_person.length + o.answers.remote.length + o.answers.no.length}
															<span class="faces" aria-hidden="true">
																{#if data.master}
																	<span class="face master" title="{data.master.name}: {t('campaign.master')}"><UserIcon icon={data.master.icon} avatar={data.master.avatar} size="1.25rem" /></span>
																{/if}
																{#each CHOICES as k (k)}
																	{#each o.answers[k] as p (p.id)}
																		<span class="face {k}" title="{p.displayName}: {t('schedule.answer.' + k)}">
																			<UserIcon icon={p.icon} avatar={p.avatar} size="1.25rem" />
																			{#if k === 'no'}<span class="mark"><Icon name="close" /></span>{/if}
																		</span>
																	{/each}
																{/each}
															</span>
														{/if}
													</a>
											</li>
										{/each}
									</ul>
								{/if}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	<h2>{t('schedule.dates')}</h2>
	{#each data.items as o (anchor(o))}
		<article id={anchor(o)} class="card occurrence" aria-labelledby="{anchor(o)}-title">
			{@render details(o, anchor(o))}
		</article>
	{:else}
		<p class="muted">{t('schedule.empty')}</p>
	{/each}
</div>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<dialog bind:this={dlg} class="occurrence-dialog" aria-labelledby="dlg-title" onclick={(e) => e.target === dlg && dlg.close()} onclose={() => (opened = '')}>
	{#if shown}{@render details(shown, 'dlg')}{/if}
	<!-- In fondo al codice, in alto a destra a schermo: così il fuoco parte dai pulsanti per rispondere. -->
	<button class="btn btn-small btn-ghost close" type="button" title={t('common.close')} aria-label={t('common.close')} onclick={() => dlg?.close()}><Icon name="close" /></button>
</dialog>

<style>
	.month-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.month-head h2 {
		margin: 0;
		min-width: 10rem;
		text-align: center;
	}
	.month-head h2::first-letter {
		text-transform: uppercase;
	}
	.new {
		margin-left: auto;
	}
	.month {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
		margin-bottom: 2rem;
		background: var(--c-surface);
	}
	th {
		font-size: var(--fs-sm);
		padding: 0.3rem;
		text-align: center;
	}
	td {
		vertical-align: top;
		height: 5.5rem;
		padding: 0.25rem;
		border: 1px solid var(--c-border);
		overflow: hidden;
	}
	td.out {
		background: var(--c-surface2);
	}
	.day {
		display: inline-block;
		min-width: 1.6rem;
		font-weight: 600;
	}
	.today .day {
		border-radius: var(--radius);
		background: var(--c-primary);
		color: var(--c-on-primary);
		text-align: center;
	}
	td li a {
		display: block;
		min-height: 1.5rem;
		padding: 0.1rem 0.25rem;
		margin-top: 0.15rem;
		border-left: 3px solid var(--c-primary);
		font-size: var(--fs-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Salta: barrata, oltre che detta a parole a chi usa un lettore di schermo. */
	td li.off a {
		border-left-color: var(--c-muted);
		text-decoration: line-through;
	}
	.faces {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem;
		margin-top: 0.15rem;
	}
	.face {
		position: relative;
		display: inline-flex;
	}
	.mark {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}
	.master :global(.user-icon) {
		border: 2px solid var(--c-primary);
	}
	.remote :global(.user-icon) {
		border: 2px solid var(--c-note-border);
	}
	/* La croce sopra tutta la figura. */
	.no .mark {
		color: var(--c-danger);
	}
	.no .mark :global(.icon) {
		width: 100%;
		height: 100%;
		stroke-width: 2.5;
	}
	.occurrence-dialog {
		width: min(100% - 2rem, 40rem);
		max-width: none;
		padding: 1.25rem;
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
	}
	.occurrence-dialog::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	.occurrence-dialog h3 {
		margin-top: 0;
		padding-right: 2.75rem;
	}
	.close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0;
	}
	.occurrence {
		margin-bottom: 1rem;
		scroll-margin-top: 5rem;
	}
	.occurrence:target {
		outline: 2px solid var(--c-focus);
	}
	.when {
		margin: 0.25rem 0;
	}
	.when::first-letter {
		text-transform: uppercase;
	}
	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.1rem 0.5rem;
		border: 2px solid currentColor;
		border-radius: var(--radius);
		font-weight: 600;
	}
	.status.confirmed {
		color: var(--c-success);
	}
	.status.cancelled {
		color: var(--c-danger);
	}
	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 1rem;
	}
	.facts dt {
		font-weight: 600;
	}
	.facts dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.wishes li + li {
		margin-top: 0.75rem;
	}
	/* Le righe che il giocatore ha scritto restano righe. */
	.wishes dd {
		white-space: pre-line;
	}
	.actions form {
		display: contents;
	}
	/* Sul telefono nelle caselle sta solo l'ora: il resto è nelle schede sotto. */
	@media (max-width: 40rem) {
		td {
			height: 3.5rem;
			padding: 0.1rem;
		}
		.name {
			display: none;
		}
		td li a {
			padding-inline: 0.1rem;
			border-left-width: 2px;
		}
	}
</style>

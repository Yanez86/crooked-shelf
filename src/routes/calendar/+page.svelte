<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const cal = $derived(data.calendar);
	const text = $derived((form && 'text' in form && form.text) || data.text);
</script>

<svelte:head><title>{t('calendar.title')} · {page.data.siteName}</title></svelte:head>

<h1>{t('calendar.title')}: {cal.name}</h1>
<p>
	{t('calendar.summary', { months: cal.months.length, days: data.yearLength })}
	{#if data.today}{t('timeline.today', { date: data.today })}{/if}
</p>

<div class="cols">
	<section aria-labelledby="months-title">
		<h2 id="months-title">{t('calendar.months')}</h2>
		<table class="data">
			<thead><tr><th scope="col">#</th><th scope="col">{t('common.name')}</th><th scope="col">{t('calendar.days')}</th></tr></thead>
			<tbody>
				{#each cal.months as m, i (i)}
					<tr>
						<td>{i + 1}</td>
						<td>{m.name}{#if m.festival} <span class="badge">{t('calendar.festival')}</span>{/if}</td>
						<td>{m.days}{#if cal.leap && cal.leap.month === i + 1} <span class="muted">(+{cal.leap.days} {t('calendar.inLeap')})</span>{/if}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
	<section aria-labelledby="week-title">
		<h2 id="week-title">{t('calendar.weekdays')}</h2>
		{#if cal.weekdays.length}<ol>{#each cal.weekdays as w, i (i)}<li>{w}</li>{/each}</ol>{:else}<p class="muted">—</p>{/if}
		<h2>{t('calendar.eras')}</h2>
		{#if cal.eras.length}
			<ul>{#each cal.eras as e, i (i)}<li>{e.name} ({e.abbr}) — {t('calendar.fromYear', { year: e.start })}</li>{/each}</ul>
		{:else}<p class="muted">—</p>{/if}
		<h2>{t('calendar.leap')}</h2>
		<p>
			{#if cal.leap}
				{t('calendar.leapText', { every: cal.leap.every, days: cal.leap.days, month: cal.months[cal.leap.month - 1]?.name ?? '?' })}
				{#if cal.leap.skip}{t('calendar.leapSkipText', { skip: cal.leap.skip, keep: cal.leap.keep ?? '—' })}{/if}
			{:else}—{/if}
		</p>
	</section>
</div>

{#if data.canEdit}
	<section aria-labelledby="edit-title" class="edit">
		<h2 id="edit-title">{t('calendar.edit')}</h2>
		<FormError error={form && 'error' in form ? form.error : null} params={form && 'line' in form && form.line ? { line: form.line } : undefined} />
		{#if form && 'error' in form && form.line}<p class="alert alert-error">{t('calendar.atLine', { line: form.line })}</p>{/if}
		<FormOk message={form && 'ok' in form ? form.ok : null} />

		<form method="post" action="?/preset" class="card preset">
			<label for="preset">{t('calendar.preset')}</label>
			<select id="preset" name="preset">
				{#each data.presets as p (p)}<option value={p}>{t('calendar.presets.' + p)}</option>{/each}
				{#each data.pluginPresets as p (p.key)}<option value={p.key}>{p.name}</option>{/each}
			</select>
			<button class="btn" type="submit">{t('calendar.loadPreset')}</button>
			<span class="hint">{t('calendar.presetHint')}</span>
		</form>

		{#key text}
			<form method="post" action="?/save">
				<div class="field">
					<label for="name">{t('common.name')}</label>
					<input id="name" name="name" type="text" maxlength="60" value={text.name} />
				</div>
				<div class="field">
					<label for="months">{t('calendar.months')}</label>
					<textarea id="months" name="months" rows="12" aria-describedby="months-hint">{text.months}</textarea>
					<span id="months-hint" class="hint">{t('calendar.monthsHint')}</span>
				</div>
				<div class="field">
					<label for="weekdays">{t('calendar.weekdays')}</label>
					<textarea id="weekdays" name="weekdays" rows="5" aria-describedby="weekdays-hint">{text.weekdays}</textarea>
					<span id="weekdays-hint" class="hint">{t('calendar.weekdaysHint')}</span>
				</div>
				<div class="field">
					<label for="eras">{t('calendar.eras')}</label>
					<textarea id="eras" name="eras" rows="3" aria-describedby="eras-hint">{text.eras}</textarea>
					<span id="eras-hint" class="hint">{t('calendar.erasHint')}</span>
				</div>
				<fieldset>
					<legend>{t('calendar.leap')}</legend>
					<p class="hint">{t('calendar.leapHint')}</p>
					<div class="row">
						<div class="field"><label for="leapEvery">{t('calendar.leapEvery')}</label><input id="leapEvery" name="leapEvery" type="number" min="1" value={text.leapEvery} /></div>
						<div class="field"><label for="leapOffset">{t('calendar.leapOffset')}</label><input id="leapOffset" name="leapOffset" type="number" min="0" value={text.leapOffset} /></div>
						<div class="field"><label for="leapMonth">{t('calendar.leapMonth')}</label><input id="leapMonth" name="leapMonth" type="number" min="1" value={text.leapMonth} /></div>
						<div class="field"><label for="leapDays">{t('calendar.leapDays')}</label><input id="leapDays" name="leapDays" type="number" min="1" value={text.leapDays} /></div>
						<div class="field"><label for="leapSkip">{t('calendar.leapSkip')}</label><input id="leapSkip" name="leapSkip" type="number" min="1" value={text.leapSkip} /></div>
						<div class="field"><label for="leapKeep">{t('calendar.leapKeep')}</label><input id="leapKeep" name="leapKeep" type="number" min="1" value={text.leapKeep} /></div>
					</div>
				</fieldset>
				<fieldset>
					<legend>{t('calendar.todayTitle')}</legend>
					<p class="hint">{t('calendar.todayHint')}</p>
					<div class="row">
						<div class="field"><label for="todayYear">{t('calendar.year')}</label><input id="todayYear" name="todayYear" type="number" value={text.todayYear} /></div>
						<div class="field"><label for="todayMonth">{t('calendar.month')}</label><input id="todayMonth" name="todayMonth" type="number" min="1" value={text.todayMonth} /></div>
						<div class="field"><label for="todayDay">{t('calendar.day')}</label><input id="todayDay" name="todayDay" type="number" min="1" value={text.todayDay} /></div>
					</div>
				</fieldset>
				<button class="btn btn-primary" type="submit">{t('common.save')}</button>
			</form>
		{/key}
	</section>
{/if}

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: 0 2rem;
	}
	.edit {
		margin-top: 2rem;
		border-top: 1px solid var(--c-border);
		max-width: 48rem;
	}
	.preset {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.75rem;
		align-items: center;
		margin-bottom: 1.5rem;
	}
	.preset .hint {
		flex-basis: 100%;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
	}
	.row input {
		width: 7rem;
	}
	textarea {
		font-family: var(--font-mono);
	}
</style>

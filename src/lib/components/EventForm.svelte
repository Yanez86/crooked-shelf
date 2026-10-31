<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import Icon from './Icon.svelte';
	import WorldDateInput from './WorldDateInput.svelte';
	import type { CalMonth } from '../calendar.ts';
	import type { WorldDate } from '../content/types.ts';

	interface Values {
		title: string;
		description: string;
		date: WorldDate | null;
		approx: string;
		realDate: string | null;
		page: string;
		visibility: string;
	}
	let {
		values,
		timeline,
		months,
		visibilities,
		pageTitles,
		action,
		submitLabel
	}: {
		values: Values;
		timeline: string;
		months: CalMonth[];
		visibilities: string[];
		pageTitles: string[];
		action: string;
		submitLabel: string;
	} = $props();
	const t = getT();
</script>

<form method="post" {action} class="event-form">
	<div class="field">
		<label for="ev-title">{t('page.title')}</label>
		<input id="ev-title" name="title" type="text" required maxlength="200" value={values.title} />
	</div>
	<WorldDateInput prefix="date" {months} value={values.date} legend={t('timeline.worldDate')} required={timeline === 'world'} />
	<div class="cols">
		<div class="field">
			<label for="ev-approx">{t('timeline.approx')}</label>
			<input id="ev-approx" name="approx" type="text" maxlength="100" value={values.approx} aria-describedby="ev-approx-hint" />
			<span id="ev-approx-hint" class="hint">{t('timeline.approxHint')}</span>
		</div>
		{#if timeline === 'campaign'}
			<div class="field">
				<label for="ev-real">{t('timeline.realDate')}</label>
				<input id="ev-real" name="realDate" type="date" value={values.realDate ?? ''} />
			</div>
		{/if}
	</div>
	<div class="field">
		<label for="ev-desc">{t('common.description')}</label>
		<textarea id="ev-desc" name="description" rows="3" maxlength="2000" aria-describedby="ev-desc-hint">{values.description}</textarea>
		<span id="ev-desc-hint" class="hint">{t('timeline.descHint')}</span>
	</div>
	<div class="field">
		<label for="ev-page">{t('timeline.page')}</label>
		<input id="ev-page" name="page" type="text" list="ev-pages" autocomplete="off" value={values.page} aria-describedby="ev-page-hint" />
		<span id="ev-page-hint" class="hint">{t('timeline.pageHint')}</span>
		<datalist id="ev-pages">
			{#each pageTitles as p, i (i)}<option value={p}></option>{/each}
		</datalist>
	</div>
	<fieldset>
		<legend>{t('timeline.visibility')}</legend>
		{#each visibilities as v (v)}
			<label class="choice">
				<input type="radio" name="visibility" value={v} checked={values.visibility === v} />
				<span>{t('visibility.' + v)}</span>
			</label>
		{/each}
	</fieldset>
	<button class="btn btn-primary" type="submit">{#if submitLabel === t('common.save')}<Icon name="save" />{/if}{submitLabel}</button>
</form>

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0 1.5rem;
	}
</style>

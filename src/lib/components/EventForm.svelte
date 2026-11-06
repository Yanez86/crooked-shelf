<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SubmitFunction } from '$app/forms';
	import { enhance } from '$app/forms';
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
	/**
	 * Il modulo di un evento. Si invia senza ricaricare la pagina: con `submit` decide chi lo usa cosa fare dopo,
	 * altrimenti vale il comportamento di SvelteKit. `uid` distingue gli id quando nella pagina ce n'è più d'uno.
	 */
	let {
		values,
		timeline,
		months,
		visibilities,
		pageTitles,
		action,
		submitLabel,
		uid = 'ev',
		submit,
		oncancel,
		extra
	}: {
		values: Values;
		timeline: string;
		months: CalMonth[];
		visibilities: string[];
		pageTitles: string[];
		action: string;
		submitLabel: string;
		uid?: string;
		submit?: SubmitFunction;
		oncancel?: () => void;
		extra?: Snippet;
	} = $props();
	const t = getT();
</script>

<form method="post" {action} class="event-form" use:enhance={submit}>
	<div class="field">
		<label for="{uid}-title">{t('page.title')}</label>
		<input id="{uid}-title" name="title" type="text" required maxlength="200" value={values.title} />
	</div>
	<WorldDateInput prefix="date" idPrefix={uid === 'ev' ? undefined : `${uid}-date`} {months} value={values.date} legend={t('timeline.worldDate')} required={timeline === 'world'} />
	<div class="cols">
		<div class="field">
			<label for="{uid}-approx">{t('timeline.approx')}</label>
			<input id="{uid}-approx" name="approx" type="text" maxlength="100" value={values.approx} aria-describedby="{uid}-approx-hint" />
			<span id="{uid}-approx-hint" class="hint">{t('timeline.approxHint')}</span>
		</div>
		{#if timeline === 'campaign'}
			<div class="field">
				<label for="{uid}-real">{t('timeline.realDate')}</label>
				<input id="{uid}-real" name="realDate" type="date" value={values.realDate ?? ''} />
			</div>
		{/if}
	</div>
	<div class="field">
		<label for="{uid}-desc">{t('common.description')}</label>
		<textarea id="{uid}-desc" name="description" rows="3" maxlength="2000" aria-describedby="{uid}-desc-hint">{values.description}</textarea>
		<span id="{uid}-desc-hint" class="hint">{t('timeline.descHint')}</span>
	</div>
	<div class="field">
		<label for="{uid}-page">{t('timeline.page')}</label>
		<input id="{uid}-page" name="page" type="text" list="{uid}-pages" autocomplete="off" value={values.page} aria-describedby="{uid}-page-hint" />
		<span id="{uid}-page-hint" class="hint">{t('timeline.pageHint')}</span>
		<datalist id="{uid}-pages">
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
	<div class="buttons">
		<button class="btn btn-primary" type="submit">{#if submitLabel === t('common.save')}<Icon name="save" />{/if}{submitLabel}</button>
		{#if oncancel}<button class="btn" type="button" onclick={oncancel}>{t('common.cancel')}</button>{/if}
		{@render extra?.()}
	</div>
</form>

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
		gap: 0 1.5rem;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}
</style>

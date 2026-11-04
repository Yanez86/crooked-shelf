<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import { MODES, REPEATS } from '#lib/schedule.ts';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const a = $derived(data.appointment);
	// Si mostrano solo i campi che servono: dove (in presenza), il link (remoto), fino a quando (se si ripete).
	let inPerson = $state(untrack(() => data.appointment.inPerson));
	let remote = $state(untrack(() => data.appointment.remote));
	let repeat = $state(untrack(() => data.appointment.repeat));
	// Come gioca il Master: tra i modi scelti sopra. Con un modo solo è quello.
	let masterMode = $state(untrack(() => data.appointment.masterMode));
	const masterModes = $derived(MODES.filter((m) => (m === 'in_person' ? inPerson : remote)));
	const chosenMode = $derived(masterModes.length === 1 ? masterModes[0] : masterMode);
	const title = $derived(data.isNew ? t('schedule.new') : t('schedule.editTitle', { title: a.title }));
</script>

<svelte:head><title>{title}</title></svelte:head>

<div class="center-column">
	<p><a href="/schedule?m={a.date.slice(0, 7)}">← {t('schedule.title')}</a></p>
	<h1>{title}</h1>
	<FormError error={form?.error} />
	<form method="post" action="?/save" class="card">
		<div class="field">
			<label for="ap-title">{t('schedule.fields.title')}</label>
			<input id="ap-title" name="title" type="text" required maxlength="120" value={a.title} placeholder={t('schedule.fields.titlePlaceholder')} />
		</div>
		<div class="row">
			<div class="field">
				<label for="ap-date">{t('schedule.fields.date')}</label>
				<input id="ap-date" name="date" type="date" required value={a.date} />
			</div>
			<div class="field">
				<label for="ap-starts">{t('schedule.fields.starts')}</label>
				<input id="ap-starts" name="starts" type="time" required value={a.starts} />
			</div>
			<div class="field">
				<label for="ap-ends">{t('schedule.fields.ends')}</label>
				<input id="ap-ends" name="ends" type="time" required value={a.ends} aria-describedby="ap-ends-hint" />
				<span id="ap-ends-hint" class="hint">{t('schedule.fields.endsHint')}</span>
			</div>
		</div>
		<div class="row">
			<div class="field">
				<label for="ap-repeat">{t('schedule.fields.repeat')}</label>
				<select id="ap-repeat" name="repeat" bind:value={repeat}>
					{#each REPEATS as r (r)}<option value={r}>{t('schedule.repeat.' + r)}</option>{/each}
				</select>
			</div>
			{#if repeat !== 'none'}
				<div class="field">
					<label for="ap-until">{t('schedule.fields.until')}</label>
					<input id="ap-until" name="until" type="date" value={a.until ?? ''} aria-describedby="ap-until-hint" />
					<span id="ap-until-hint" class="hint">{t('schedule.fields.untilHint')}</span>
				</div>
			{/if}
		</div>
		<fieldset>
			<legend>{t('schedule.fields.mode')}</legend>
			<p class="hint">{t('schedule.fields.modeHint')}</p>
			<label class="choice"><input type="checkbox" name="inPerson" bind:checked={inPerson} />{t('schedule.inPerson')}</label>
			{#if inPerson}
				<div class="field">
					<label for="ap-place">{t('schedule.fields.place')}</label>
					<input id="ap-place" name="place" type="text" maxlength="200" value={a.place} placeholder={t('schedule.fields.placePlaceholder')} />
				</div>
			{/if}
			<label class="choice"><input type="checkbox" name="remote" bind:checked={remote} />{t('schedule.remote')}</label>
			{#if remote}
				<div class="field">
					<label for="ap-link">{t('schedule.fields.link')}</label>
					<input id="ap-link" name="link" type="url" maxlength="500" value={a.link ?? ''} placeholder={data.campaignLink ?? 'https://discord.gg/…'} aria-describedby="ap-link-hint" />
					<span id="ap-link-hint" class="hint">{data.campaignLink ? t('schedule.fields.linkHint', { link: data.campaignLink }) : t('schedule.fields.linkNone')}</span>
				</div>
			{/if}
		</fieldset>
		{#if masterModes.length}
			<fieldset>
				<legend>{t('schedule.fields.masterMode')}</legend>
				{#each masterModes as m (m)}
					<label class="choice"><input type="radio" name="masterMode" value={m} checked={chosenMode === m} onchange={() => (masterMode = m)} />{t(m === 'in_person' ? 'schedule.inPerson' : 'schedule.remote')}</label>
				{/each}
			</fieldset>
		{/if}
		<div class="actions">
			<button class="btn btn-primary" type="submit"><Icon name="save" />{data.isNew ? t('schedule.create') : t('common.save')}</button>
		</div>
	</form>

	{#if !data.isNew}
		<form method="post" action="?/delete" class="card">
			<h2>{t('schedule.delete')}</h2>
			<p>{t(a.repeat === 'none' ? 'schedule.deleteOne' : 'schedule.deleteSeries')}</p>
			<button class="btn btn-danger" type="submit"><Icon name="trash" />{t('schedule.delete')}</button>
		</form>
	{/if}
</div>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
	}
</style>

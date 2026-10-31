<script lang="ts">
	import { getT } from '../i18n/index.ts';
	import Icon from './Icon.svelte';

	let {
		values,
		requireFile,
		submitLabel,
		cancelHref
	}: {
		values: { title: string; description: string; visibility: string };
		requireFile: boolean;
		submitLabel: string;
		cancelHref: string;
	} = $props();
	const t = getT();
</script>

<form method="post" action="?/save" enctype="multipart/form-data">
	<div class="field">
		<label for="file">{requireFile ? t('resources.file') : t('resources.replaceFile')}</label>
		<!-- Senza "accept": qualsiasi file va bene, e su iPhone un'estensione sconosciuta non diventa grigia. -->
		<input id="file" name="file" type="file" required={requireFile} aria-describedby="file-hint" />
		<span id="file-hint" class="hint">{t('resources.fileHint')}</span>
	</div>
	<div class="field">
		<label for="title">{t('page.title')}</label>
		<input id="title" name="title" type="text" required={!requireFile} maxlength="120" value={values.title} aria-describedby={requireFile ? 'title-hint' : undefined} />
		{#if requireFile}<span id="title-hint" class="hint">{t('resources.titleHint')}</span>{/if}
	</div>
	<div class="field">
		<label for="description">{t('common.description')}</label>
		<textarea id="description" name="description" rows="3" maxlength="2000">{values.description}</textarea>
	</div>
	<fieldset>
		<legend>{t('page.visibility')}</legend>
		{#each ['public', 'players', 'master'] as v (v)}
			<label class="choice">
				<input type="radio" name="visibility" value={v} checked={values.visibility === v} />
				<span>{t('visibility.' + v)}</span>
			</label>
		{/each}
	</fieldset>
	<div class="actions">
		<button class="btn btn-primary" type="submit">{#if submitLabel === t('common.save')}<Icon name="save" />{/if}{submitLabel}</button>
		<a class="btn" href={cancelHref}>{t('common.cancel')}</a>
	</div>
</form>

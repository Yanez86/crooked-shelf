<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import Editor from '#lib/editor/Editor.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const v = $derived(form?.values ?? data.values);
</script>

<svelte:head><title>{data.isNew ? t('templates.new') : t('templates.edit')}</title></svelte:head>

<h1>{data.isNew ? t('templates.new') : t('templates.edit')}</h1>
<FormError error={form?.error} />

{#key form}
	<form method="post" action="?/save">
		<div class="field">
			<label for="name">{t('common.name')}</label>
			<input id="name" name="name" type="text" required maxlength="80" value={v.name} />
		</div>
		<div class="field">
			<label for="description">{t('common.description')}</label>
			<input id="description" name="description" type="text" maxlength="300" value={v.description} />
		</div>
		<div class="field">
			<label for="fieldNames">{t('fields.title')}</label>
			<textarea id="fieldNames" name="fieldNames" rows="5" aria-describedby="fields-hint">{v.fields}</textarea>
			<span id="fields-hint" class="hint">{t('templates.fieldsHint')}</span>
		</div>
		<label class="choice">
			<input type="checkbox" name="session" checked={v.session} />
			<span>{t('templates.sessionCheck')}</span>
		</label>
		<div class="field">
			<span class="label" id="tpl-content">{t('templates.content')}</span>
			<Editor content={v.content} canSecret={true} labelId="tpl-content" />
		</div>
		<div class="actions">
			<button class="btn btn-primary" type="submit">{t('common.save')}</button>
			<a class="btn" href="/templates">{t('common.cancel')}</a>
		</div>
	</form>
{/key}

{#if !data.isNew}
	<form method="post" action="?/delete" class="danger">
		<button class="btn btn-danger" type="submit">{t('templates.delete')}</button>
		<span class="hint">{t('templates.deleteHint')}</span>
	</form>
{/if}

<style>
	.label {
		font-weight: 600;
	}
	.danger {
		margin-top: 2rem;
		border-top: 1px solid var(--c-border);
		padding-top: 1rem;
	}
</style>

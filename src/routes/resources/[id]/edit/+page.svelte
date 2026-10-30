<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import ResourceForm from '#lib/components/ResourceForm.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('resources.edit')}: {data.values.title}</title></svelte:head>

<h1>{t('resources.edit')}: {data.values.title}</h1>
<FormError error={form?.error} />
{#key form}
	<ResourceForm values={form?.values ?? data.values} requireFile={false} submitLabel={t('common.save')} cancelHref="/resources/{data.id}" />
{/key}

<section class="danger" aria-labelledby="del-title">
	<h2 id="del-title">{t('resources.delete')}</h2>
	<form method="post" action="?/delete">
		<label class="choice"><input type="checkbox" name="confirm" required /><span>{t('resources.deleteConfirm', { title: data.values.title })}</span></label>
		<button class="btn btn-danger" type="submit">{t('resources.delete')}</button>
	</form>
</section>

<style>
	.danger {
		margin-top: 3rem;
		border-top: 1px solid var(--c-border);
	}
</style>

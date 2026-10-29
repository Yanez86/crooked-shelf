<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import MapSettingsForm from '#lib/components/MapSettingsForm.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('maps.settings')}: {data.values.title}</title></svelte:head>

<h1>{t('maps.settings')}: {data.values.title}</h1>
<FormError error={form?.error} />
{#key form}
	<MapSettingsForm values={form?.values ?? data.values} parents={data.parents} requireImage={false} submitLabel={t('common.save')} cancelHref="/maps/{data.slug}" />
{/key}

<section class="danger" aria-labelledby="del-title">
	<h2 id="del-title">{t('maps.delete')}</h2>
	<form method="post" action="?/delete">
		<label class="choice"><input type="checkbox" name="confirm" required /><span>{t('maps.deleteConfirm', { title: data.values.title })}</span></label>
		<button class="btn btn-danger" type="submit">{t('maps.delete')}</button>
	</form>
</section>

<style>
	.danger {
		margin-top: 3rem;
		border-top: 1px solid var(--c-border);
	}
</style>

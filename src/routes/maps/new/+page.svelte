<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import MapSettingsForm from '#lib/components/MapSettingsForm.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const values = $derived(form?.values ?? { title: '', description: '', visibility: 'players', parentId: data.parentId, across: '', unit: '' });
</script>

<svelte:head><title>{t('maps.new')}</title></svelte:head>

<h1>{t('maps.new')}</h1>
<FormError error={form?.error} />
{#key form}
	<MapSettingsForm {values} parents={data.parents} requireImage={true} submitLabel={t('maps.create')} cancelHref="/maps" />
{/key}

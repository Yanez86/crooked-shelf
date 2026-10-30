<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import ResourceForm from '#lib/components/ResourceForm.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	const t = getT();
	const values = $derived(form?.values ?? { title: '', description: '', visibility: 'players' });
</script>

<svelte:head><title>{t('resources.new')}</title></svelte:head>

<h1>{t('resources.new')}</h1>
<FormError error={form?.error} />
{#key form}
	<ResourceForm {values} requireFile={true} submitLabel={t('resources.upload')} cancelHref="/resources" />
{/key}

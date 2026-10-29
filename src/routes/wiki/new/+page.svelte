<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import PageForm from '#lib/components/PageForm.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import { EMPTY_DOC, isDoc } from '#lib/content/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();

	const values = $derived(
		form?.values
			? { ...form.values, content: isDoc(form.values.content) ? form.values.content : EMPTY_DOC }
			: {
					title: data.title,
					slug: data.slug,
					content: EMPTY_DOC,
					visibility: 'players',
					playersCanEdit: false,
					categoryId: data.categoryId,
					tags: ''
				}
	);
</script>

<svelte:head><title>{t('page.newTitle')}</title></svelte:head>

<h1>{t('page.newTitle')}</h1>
<FormError error={form?.error} />

{#key form}
	<PageForm
		{values}
		categories={data.categories}
		visibilities={data.visibilities}
		canManage={true}
		canSecret={data.canSecret}
		knownTags={data.knownTags}
		submitLabel={t('page.create')}
		cancelHref="/wiki"
	/>
{/key}

<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { getT } from '#lib/i18n/index.ts';
	import EventForm from '#lib/components/EventForm.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('timeline.edit')}</title></svelte:head>

<h1>{t('timeline.edit')}</h1>
<p><a class="back" href="/wiki/{data.timeline.slug}"><Icon name="arrowLeft" />{data.timeline.title}</a></p>
<FormError error={form?.error} />
{#key form}
	<EventForm
		values={form?.values ?? data.values}
		timeline={data.timeline.mode}
		months={data.months}
		visibilities={data.visibilities}
		pageTitles={data.pageTitles}
		action="?/save"
		submitLabel={t('common.save')}
	/>
{/key}

<form method="post" action="?/delete" class="danger">
	<button class="btn btn-danger" type="submit">{t('timeline.delete')}</button>
</form>

<style>
	.danger {
		margin-top: 2rem;
		border-top: 1px solid var(--c-border);
		padding-top: 1rem;
	}
</style>

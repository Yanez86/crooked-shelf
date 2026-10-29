<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import PageForm from '#lib/components/PageForm.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import { EMPTY_DOC, isDoc, type DocNode } from '#lib/content/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();

	const values = $derived(
		form?.values
			? { ...form.values, content: isDoc(form.values.content) ? form.values.content : EMPTY_DOC }
			: { ...data.page, content: (isDoc(data.page.content) ? data.page.content : EMPTY_DOC) as DocNode }
	);
</script>

<svelte:head><title>{t('page.editTitle', { title: data.page.title })}</title></svelte:head>

<h1>{t('page.editTitle', { title: data.page.title })}</h1>
<FormError error={form?.error} />

{#key form}
	<PageForm
		{values}
		categories={data.categories}
		visibilities={data.visibilities}
		canManage={data.canManage}
		canSecret={data.canSecret}
		knownTags={data.knownTags}
		updatedAt={data.page.updatedAt}
		submitLabel={t('common.save')}
		cancelHref="/wiki/{data.page.slug}"
	/>
{/key}

{#if data.canManage}
	<section class="danger-zone" aria-labelledby="danger-title">
		<h2 id="danger-title">{t('page.deleteTitle')}</h2>
		<form method="post" action="?/delete">
			<label class="choice">
				<input type="checkbox" name="confirm" required />
				<span>{t('page.deleteConfirm', { title: data.page.title })}</span>
			</label>
			<button class="btn btn-danger" type="submit">{t('page.delete')}</button>
		</form>
	</section>
{/if}

<style>
	.danger-zone {
		margin-top: 3rem;
		border-top: 1px solid var(--c-border);
	}
	.danger-zone h2 {
		font-size: 1.15rem;
	}
</style>

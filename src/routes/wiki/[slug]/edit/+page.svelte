<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import PageForm from '#lib/components/PageForm.svelte';
	import KindSettings from '#lib/components/KindSettings.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import { EMPTY_DOC, isDoc, type DocNode } from '#lib/content/types.ts';
	import type { PageKind } from '#lib/pageKinds.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();

	const values = $derived(
		form?.values
			? { ...form.values, kind: form.values.kind as PageKind, content: isDoc(form.values.content) ? form.values.content : EMPTY_DOC }
			: { ...data.page, content: (isDoc(data.page.content) ? data.page.content : EMPTY_DOC) as DocNode }
	);
	const extra = $derived(form?.extra ?? data.extra);
	const kind = $derived(data.page.kind);
	// Le impostazioni della mappa e il modo della cronologia li cambia il Master.
	const hasSettings = $derived((kind === 'map' && !!extra.map) || (kind === 'timeline' && data.canSecret));
</script>

<svelte:head><title>{t('page.editTitle', { title: data.page.title })}</title></svelte:head>

<h1 class="visually-hidden">{t('page.editTitle', { title: data.page.title })}</h1>
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
		months={data.months}
		canTemplate={data.canTemplate}
		multipart={kind === 'map'}
		submitLabel={t('common.save')}
		cancelHref="/wiki/{data.page.slug}"
		settings={hasSettings ? settings : undefined}
	/>
{/key}

{#snippet settings()}
	{#if kind === 'map' || kind === 'timeline'}
		<KindSettings {kind} map={extra.map ?? undefined} mode={extra.mode} parents={data.parents} />
	{/if}
{/snippet}

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
		font-size: var(--fs-md);
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
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
			: {
					title: data.title,
					slug: data.slug,
					content: (data.template?.content ?? EMPTY_DOC) as DocNode,
					visibility: 'players',
					playersCanEdit: false,
					categoryId: data.categoryId,
					tags: '',
					fields: data.template?.fields ?? [],
					template: data.template?.key ?? null,
					session: data.template?.session ? { number: null, realDate: data.today, world: null } : null
				}
	);

	/** Collegamento al modulo con il template scelto, mantenendo titolo e categoria. */
	function withTemplate(key: string) {
		const u = new URL(page.url.href);
		u.searchParams.set('template', key);
		return u.pathname + u.search;
	}
</script>

<svelte:head><title>{t('page.newTitle')}</title></svelte:head>

<h1>{data.template ? t('page.newFromTemplate', { name: data.template.name }) : t('page.newTitle')}</h1>

{#if !data.chosen}
	<p>{t('templates.choose')}</p>
	<ul class="list-plain template-grid">
		<li>
			<a class="card template-card" href={withTemplate('none')}>
				<strong>{t('templates.blank')}</strong>
				<span class="muted">{t('templates.blankHint')}</span>
			</a>
		</li>
		{#each data.templates as tp (tp.key)}
			<li>
				<a class="card template-card" href={withTemplate(tp.key)}>
					<strong>{tp.name}</strong>
					<span class="muted">{tp.description}</span>
				</a>
			</li>
		{/each}
	</ul>
	<p><a href="/templates">{t('templates.manage')}</a></p>
{:else}
	<FormError error={form?.error} />
	{#key form}
		<PageForm
			{values}
			categories={data.categories}
			visibilities={data.visibilities}
			canManage={true}
			canSecret={data.canSecret}
			knownTags={data.knownTags}
			months={data.months}
			submitLabel={t('page.create')}
			cancelHref="/wiki"
		/>
	{/key}
{/if}

<style>
	.template-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 0.75rem;
	}
	.template-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		height: 100%;
		color: var(--c-text);
		text-decoration: none;
		border-width: 2px;
	}
	.template-card strong {
		color: var(--c-link);
		font-size: var(--fs-md);
		text-decoration: underline;
	}
	.template-card:hover {
		border-color: var(--c-primary);
	}
</style>

<script lang="ts">
	import { page as appPage } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import PageList from '#lib/components/PageList.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();

	const heading = $derived(
		data.category
			? t('list.inCategory', { name: data.category.name })
			: data.tag
				? t('list.withTag', { name: data.tag.name })
				: t('list.title')
	);

	function href(p: number) {
		const u = new URL(appPage.url.href);
		u.searchParams.set('p', String(p));
		u.searchParams.delete('deleted');
		return u.pathname + u.search;
	}
</script>

<svelte:head><title>{heading} · {appPage.data.siteName}</title></svelte:head>

<FormOk message={data.deleted ? 'page.deleted' : null} />

<div class="head">
	<h1>{heading}</h1>
	{#if appPage.data.user}
		<a class="btn btn-primary" href="/wiki/new{data.category ? `?category=${data.category.id}` : ''}">+ {t('nav.newPage')}</a>
	{/if}
</div>
{#if data.category?.description}<p>{data.category.description}</p>{/if}

<form method="get" class="filters card" aria-label={t('list.filters')}>
	<div class="field">
		<label for="f-category">{t('page.category')}</label>
		<select id="f-category" name="category">
			<option value="">{t('list.all')}</option>
			{#each data.categories as c (c.slug)}
				<option value={c.slug} selected={data.category?.slug === c.slug}>{c.label}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="f-tag">{t('list.tag')}</label>
		<select id="f-tag" name="tag">
			<option value="">{t('list.all')}</option>
			{#each data.tags as tg (tg.slug)}
				<option value={tg.slug} selected={data.tag?.slug === tg.slug}>{tg.name}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="f-sort">{t('list.sort')}</label>
		<select id="f-sort" name="sort">
			<option value="updated" selected={data.sort === 'updated'}>{t('list.sortUpdated')}</option>
			<option value="title" selected={data.sort === 'title'}>{t('list.sortTitle')}</option>
		</select>
	</div>
	<div class="field submit">
		<button class="btn" type="submit">{t('list.apply')}</button>
	</div>
</form>

<p class="muted" role="status">{t('list.count', { n: data.total })}</p>

{#if data.rows.length}
	<PageList rows={data.rows} />
{:else}
	<p>{t('list.empty')}</p>
{/if}

{#if data.pages > 1}
	<nav class="pager" aria-label={t('list.pagination')}>
		{#if data.page > 1}<a class="btn" href={href(data.page - 1)}>← {t('list.prev')}</a>{/if}
		<span>{t('list.pageOf', { n: data.page, total: data.pages })}</span>
		{#if data.page < data.pages}<a class="btn" href={href(data.page + 1)}>{t('list.next')} →</a>{/if}
	</nav>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem 1rem;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
		align-items: flex-end;
		margin: 1rem 0;
		padding-bottom: 0;
	}
	.filters .field {
		flex: 1 1 12rem;
	}
	.filters .submit {
		flex: 0 0 auto;
	}
	.pager {
		display: flex;
		gap: 1rem;
		align-items: center;
		margin-top: 1.5rem;
	}
</style>

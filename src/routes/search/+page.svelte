<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('search.title')} · {page.data.siteName}</title></svelte:head>

<h1>{t('search.title')}</h1>

<form method="get" role="search" class="search-form">
	<label for="q">{t('search.label')}</label>
	<div class="row">
		<input id="q" name="q" type="search" value={data.q} />
		<button class="btn btn-primary" type="submit">{t('search.submit')}</button>
	</div>
</form>

{#if data.q}
	<p role="status">{t('search.results', { n: data.hits.length, q: data.q })}</p>
	{#if data.hits.length}
		<ol class="list-plain hits">
			{#each data.hits as h (h.slug)}
				<li class="card">
					<h2><a href="/wiki/{h.slug}">{h.title}</a></h2>
					{#if h.snippet}<p>{@html h.snippet}</p>{/if}
				</li>
			{/each}
		</ol>
	{:else}
		<div class="card empty">
			<p class="muted">{t('search.emptyHint')}</p>
			{#if page.data.user}
				<a class="btn btn-primary" href="/wiki/new?title={encodeURIComponent(data.q)}"><Icon name="plus" />{t('search.create', { q: data.q })}</a>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.search-form {
		max-width: 40rem;
		margin-bottom: 1.5rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.3rem;
	}
	.row input {
		flex: 1;
		min-width: 0;
	}
	.hits {
		display: grid;
		gap: 0.75rem;
	}
	.hits h2 {
		margin: 0 0 0.25rem;
		font-size: var(--fs-md);
	}
	.hits p {
		margin: 0;
	}
	.empty {
		max-width: 40rem;
	}
	.empty p {
		margin-top: 0;
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import PageList from '#lib/components/PageList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const user = $derived(page.data.user);
</script>

<svelte:head><title>{page.data.siteName}</title></svelte:head>

<h1>{page.data.siteName}</h1>
{#if user}
	<p>{t('home.welcome', { name: user.displayName })}</p>
{/if}

{#if data.total === 0}
	<section class="card empty">
		<h2>{t('home.emptyTitle')}</h2>
		<p>{t('home.emptyText')}</p>
		{#if user}<a class="btn btn-primary" href="/wiki/new">+ {t('home.firstPage')}</a>{/if}
	</section>
{:else}
	<div class="grid">
		<section aria-labelledby="recent-title">
			<h2 id="recent-title">{t('home.recent')}</h2>
			<PageList rows={data.recent} />
			<p><a href="/wiki">{t('home.allPages', { n: data.total })}</a></p>
		</section>
		<section aria-labelledby="cat-title">
			<h2 id="cat-title">{t('nav.categories')}</h2>
			{#if data.categories.length}
				<ul class="cats">
					{#each data.categories as c (c.slug)}
						<li><a href="/wiki?category={encodeURIComponent(c.slug)}">{c.name}</a> <span class="muted">({c.count})</span></li>
					{/each}
				</ul>
			{:else}
				<p class="muted">{t('categories.empty')}</p>
			{/if}
			<p><a href="/categories">{t('home.manageCategories')}</a></p>
			<h2>{t('home.world')}</h2>
			<ul class="cats">
				<li><a href="/maps">{t('nav.maps')}</a></li>
				<li><a href="/timeline/world">{t('timeline.world')}</a></li>
				<li><a href="/timeline/campaign">{t('timeline.campaign')}</a></li>
				<li><a href="/calendar">{t('calendar.title')}</a></li>
				<li><a href="/templates">{t('templates.title')}</a></li>
				<li><a href="/rules">{t('nav.rules')}</a></li>
				{#if user}<li><a href="/boards">{t('nav.boards')}</a></li><li><a href="/trash">{t('trash.title')}</a></li>{/if}
			</ul>
		</section>
	</div>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: 2rem;
	}
	@media (max-width: 50rem) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
	.empty h2 {
		margin-top: 0;
	}
	.cats {
		padding-left: 1.2rem;
	}
	.cats li {
		margin: 0.35rem 0;
	}
</style>

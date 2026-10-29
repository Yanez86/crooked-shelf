<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const titleOf = (id: number | null) => data.maps.find((m) => m.id === id)?.title;
</script>

<svelte:head><title>{t('nav.maps')} · {page.data.siteName}</title></svelte:head>

<div class="head">
	<h1>{t('nav.maps')}</h1>
	{#if data.canCreate}<a class="btn btn-primary" href="/maps/new">+ {t('maps.new')}</a>{/if}
</div>
<FormOk message={page.url.searchParams.has('deleted') ? 'maps.deleted' : null} />

{#if !data.maps.length}
	<p>{t('maps.empty')}</p>
{:else}
	<ul class="list-plain grid">
		{#each data.maps as m (m.id)}
			<li class="card">
				<a class="thumb" href="/maps/{m.slug}" tabindex="-1" aria-hidden="true">
					<img src="/files/{m.fileId}" alt="" loading="lazy" width={m.width} height={m.height} />
				</a>
				<h2><a href="/maps/{m.slug}">{m.title}</a></h2>
				{#if m.parentId && titleOf(m.parentId)}<p class="muted small">{t('maps.inside', { name: titleOf(m.parentId)! })}</p>{/if}
				{#if m.visibility !== 'players'}<span class="badge">{t('visibility.' + m.visibility)}</span>{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: 1rem;
	}
	.thumb img {
		display: block;
		width: 100%;
		height: 10rem;
		object-fit: cover;
		border-radius: var(--radius);
		background: var(--c-surface2);
	}
	h2 {
		font-size: 1.15rem;
		margin: 0.5rem 0 0.25rem;
	}
	.small {
		margin: 0 0 0.25rem;
		font-size: 0.95rem;
	}
</style>

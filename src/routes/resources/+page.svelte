<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import { RESOURCE_KINDS, formatSize } from '#lib/resources.ts';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const groups = $derived(
		RESOURCE_KINDS.map((kind) => ({ kind, items: data.resources.filter((r) => r.kind === kind) })).filter((g) => g.items.length)
	);
</script>

<svelte:head><title>{t('resources.title')} · {page.data.siteName}</title></svelte:head>

<div class="head">
	<h1>{t('resources.title')}</h1>
	{#if data.canCreate}<a class="btn btn-primary" href="/resources/new"><Icon name="plus" />{t('resources.new')}</a>{/if}
</div>
<p>{t('resources.intro')}</p>
<FormOk message={page.url.searchParams.has('deleted') ? 'resources.deleted' : null} />

{#if !groups.length}
	<p>{t('resources.empty')}</p>
{/if}
{#each groups as g (g.kind)}
	<section aria-labelledby="kind-{g.kind}">
		<h2 id="kind-{g.kind}">{t('resources.kinds.' + g.kind)} <span class="muted">({g.items.length})</span></h2>
		<ul class="list-plain" class:grid={g.kind === 'image'}>
			{#each g.items as r (r.id)}
				<li class="card">
					{#if r.kind === 'image'}
						<a class="thumb" href="/resources/{r.id}" tabindex="-1" aria-hidden="true">
							<img src="/files/{r.file.id}" alt="" loading="lazy" width={r.file.width} height={r.file.height} />
						</a>
					{/if}
					<h3><a href="/resources/{r.id}">{r.title}</a></h3>
					{#if r.kind === 'audio'}
						<audio controls preload="none" src="/files/{r.file.id}" aria-label={t('resources.play', { title: r.title })}></audio>
					{:else if r.kind === 'other'}
						<p class="muted small">{r.file.name} · {formatSize(r.file.size, page.data.locale)}</p>
					{/if}
					{#if r.visibility !== 'players'}<span class="badge">{t('visibility.' + r.visibility)}</span>{/if}
				</li>
			{/each}
		</ul>
	</section>
{/each}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem 1rem;
	}
	section {
		margin-top: 1.5rem;
	}
	ul {
		display: grid;
		gap: 0.75rem;
	}
	.grid {
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 1rem;
	}
	.thumb img {
		display: block;
		width: 100%;
		height: 9rem;
		object-fit: cover;
		border-radius: var(--radius);
		background: var(--c-surface2);
	}
	h3 {
		font-size: var(--fs-md);
		margin: 0.5rem 0 0.4rem;
	}
	ul:not(.grid) h3 {
		margin-top: 0;
	}
	audio {
		display: block;
		width: 100%;
		max-width: 32rem;
		margin-bottom: 0.25rem;
	}
	.small {
		margin: 0 0 0.25rem;
		font-size: var(--fs-sm);
	}
</style>

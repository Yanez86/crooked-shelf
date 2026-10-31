<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import { formatSize } from '#lib/resources.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const r = $derived(data.resource);
	const url = $derived(`/files/${r.file.id}`);
</script>

<svelte:head><title>{r.title} · {page.data.siteName}</title></svelte:head>

<nav aria-label={t('resources.path')}><a href="/resources">{t('resources.title')}</a> › {t('resources.kinds.' + r.kind)}</nav>
<div class="head">
	<h1>{r.title}</h1>
	{#if data.canEdit}<a class="btn" href="/resources/{r.id}/edit" title={t('resources.edit')}><Icon name="edit" /><span class="visually-hidden">{t('resources.edit')}</span></a>{/if}
</div>
{#if r.visibility !== 'players'}<p><span class="badge">{t('visibility.' + r.visibility)}</span></p>{/if}
{#if r.description}<p class="description">{r.description}</p>{/if}
{#if r.sources}
	<ul class="list-plain">
		{#each r.sources as s (s.kind + s.href)}
			<li><span class="muted">{t('gallery.kind.' + s.kind)}</span> <a href={s.href}>{s.title}</a></li>
		{/each}
	</ul>
{/if}

{#if r.kind === 'image'}
	<a href={url} data-sveltekit-reload>
		<img src={url} alt={r.alt ?? r.title} width={r.file.width} height={r.file.height} />
	</a>
{:else if r.kind === 'audio'}
	<audio controls preload="metadata" src={url} aria-label={t('resources.play', { title: r.title })}></audio>
{/if}

<p class="file">
	<span class="muted">{r.file.name} · {formatSize(r.file.size, page.data.locale)}</span>
	<a class="btn btn-small" href={url} download={r.file.name}>{t('resources.download')}</a>
</p>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem 1rem;
	}
	.description {
		white-space: pre-line;
	}
	img {
		display: block;
		max-width: 100%;
		height: auto;
		border-radius: var(--radius);
		background: var(--c-surface2);
	}
	audio {
		display: block;
		width: 100%;
		max-width: 36rem;
	}
	.file {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		margin-top: 1rem;
		overflow-wrap: anywhere;
	}
</style>

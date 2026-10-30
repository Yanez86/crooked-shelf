<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();

	// Visore: si apre sopra la pagina, frecce per scorrere, Esc per chiudere.
	let viewer: HTMLDialogElement;
	let index = $state(0);
	const total = $derived(data.images.length);
	const shown = $derived(data.images[Math.min(index, total - 1)]);

	function open(i: number) {
		index = i;
		if (!viewer.open) viewer.showModal();
	}

	function step(d: number) {
		index = (index + d + total) % total;
	}

	function keys(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') step(1);
		else if (e.key === 'ArrowLeft') step(-1);
		else return;
		e.preventDefault();
	}
</script>

<svelte:head><title>{t('gallery.title')} · {page.data.siteName}</title></svelte:head>

<h1>{t('gallery.title')}</h1>
<p>{t('gallery.intro')}</p>

<nav class="filters" aria-label={t('gallery.filter')}>
	<ul class="list-plain">
		{#each data.filters as f (f.id)}
			<li>
				<a class="btn btn-small" href="/gallery{f.id === 'all' ? '' : `?show=${f.id}`}" aria-current={data.show === f.id ? 'page' : undefined}>
					{t('gallery.show.' + f.id)} <span class="muted">({f.count})</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<p class="muted" role="status">{t('gallery.count', { n: total })}</p>

{#if total}
	<ul class="list-plain grid">
		{#each data.images as img, i (img.id)}
			<li>
				<figure>
					<a
						class="thumb"
						href={img.url}
						data-sveltekit-reload
						onclick={(e) => {
							e.preventDefault();
							open(i);
						}}
					>
						<img src={img.url} alt={img.alt} width={img.width} height={img.height} loading="lazy" />
					</a>
					<figcaption>
						<ul class="list-plain">
							{#each img.sources as s (s.kind + s.href)}
								<li><span class="muted">{t('gallery.kind.' + s.kind)}</span> <a href={s.href}>{s.title}</a></li>
							{/each}
						</ul>
					</figcaption>
				</figure>
			</li>
		{/each}
	</ul>
{:else}
	<p>{t('gallery.empty')}</p>
{/if}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={viewer}
	class="viewer"
	aria-label={shown ? t('gallery.viewer', { n: index + 1, total }) : t('gallery.title')}
	onkeydown={keys}
	onclick={(e) => {
		// Clic fuori dall'immagine (sullo sfondo): chiude.
		if (e.target === viewer) viewer.close();
	}}
>
	{#if shown}
		<div class="viewer-inner">
			<div class="viewer-bar">
				<span>{t('gallery.viewer', { n: index + 1, total })}</span>
				<button class="btn btn-small" type="button" onclick={() => viewer.close()}><Icon name="close" />{t('common.close')}</button>
			</div>
			<img src={shown.url} alt={shown.alt} width={shown.width} height={shown.height} />
			<ul class="list-plain viewer-sources">
				{#each shown.sources as s (s.kind + s.href)}
					<li><span class="muted">{t('gallery.kind.' + s.kind)}</span> <a href={s.href} onclick={() => viewer.close()}>{s.title}</a></li>
				{/each}
				<li><a href={shown.url} target="_blank" rel="noopener" data-sveltekit-reload>{t('gallery.original')}</a></li>
			</ul>
			{#if total > 1}
				<div class="viewer-bar">
					<button class="btn" type="button" onclick={() => step(-1)}>‹ {t('gallery.prev')}</button>
					<button class="btn" type="button" onclick={() => step(1)}>{t('gallery.next')} ›</button>
				</div>
			{/if}
		</div>
	{/if}
</dialog>

<style>
	.filters ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.filters a[aria-current='page'] {
		background: var(--c-primary);
		border-color: var(--c-primary);
		color: var(--c-on-primary);
	}
	.filters a[aria-current='page'] .muted {
		color: inherit;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}
	figure {
		margin: 0;
		height: 100%;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.thumb {
		display: block;
	}
	.thumb img {
		display: block;
		width: 100%;
		height: auto;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		background: var(--c-surface2);
	}
	.thumb:hover img {
		filter: brightness(1.08);
	}
	.thumb:focus-visible {
		outline-offset: -3px;
	}
	figcaption {
		padding: 0.5rem 0.75rem;
		font-size: var(--fs-sm);
		overflow-wrap: anywhere;
	}
	.viewer {
		width: min(96vw, 80rem);
		max-height: 96vh;
		padding: 0;
		color: var(--c-text);
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
	}
	.viewer::backdrop {
		background: rgb(0 0 0 / 0.8);
	}
	.viewer-inner {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
	}
	.viewer-bar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.viewer img {
		display: block;
		max-width: 100%;
		max-height: calc(96vh - 11rem);
		width: auto;
		height: auto;
		margin: 0 auto;
		object-fit: contain;
	}
	.viewer-sources {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.25rem;
	}
</style>

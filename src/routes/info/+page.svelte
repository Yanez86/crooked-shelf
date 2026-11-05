<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import { getT } from '#lib/i18n/index.ts';
	import { REPO } from '#lib/version.ts';

	const t = getT();
	// Ogni frase su una riga sua: si legge meglio.
	const lines = (key: string) => t(key).split(/(?<=\.)\s+/);
</script>

<svelte:head><title>{t('info.title')} · {page.data.siteName}</title></svelte:head>

<h1>{t('info.title')}</h1>

<section class="card about">
	{#each ['info.what', 'info.free', 'info.ai'] as key (key)}
		<p>
			{#each lines(key) as line, i (i)}{#if i}<br />{/if}{line}{/each}
		</p>
	{/each}
</section>

<nav class="links" aria-label={t('info.links')}>
	<a class="btn" href={REPO} rel="noopener noreferrer"><Icon name="github" /> GitHub</a>
	<a class="btn" href="https://happysquid.ink" rel="noopener noreferrer"><Icon name="squid" /> happysquid.ink</a>
	<a class="btn" href="https://crookedshelf.quest" rel="noopener noreferrer"><Icon name="globe" /> crookedshelf.quest</a>
</nav>

<style>
	.about p {
		max-width: 40rem;
	}
	.about p:first-child {
		margin-top: 0;
	}
	.about p:last-child {
		margin-bottom: 0;
	}
	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}
</style>

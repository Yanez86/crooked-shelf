<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('changelog.title')} · {page.data.siteName}</title></svelte:head>

<h1>{t('changelog.title')}</h1>
<p class="muted">{t('changelog.current', { v: page.data.version })}</p>

{#each data.releases as r (r.version)}
	<section class="card release" aria-labelledby="v-{r.version}">
		<h2 id="v-{r.version}">
			{r.version}
			{#if r.date}<time class="muted" datetime={r.date}>{r.date}</time>{/if}
		</h2>
		{#each r.sections as s (s.title)}
			<h3>{s.title}</h3>
			<ul>
				{#each s.items as item, i (i)}<li>{item}</li>{/each}
			</ul>
		{/each}
	</section>
{/each}

<style>
	.release {
		margin-bottom: 1rem;
	}
	.release h2 {
		margin-top: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.75rem;
	}
	time {
		font-size: var(--fs-sm);
		font-weight: 400;
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	const t = getT();
	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{notFound ? t('errors.notFoundTitle') : t('errors.title')}</title></svelte:head>

<h1>{notFound ? t('errors.notFoundTitle') : t('errors.title')}</h1>
<p>{notFound ? t('errors.notFound') : t('errors.unexpected')}</p>
<div class="actions">
	<a class="btn btn-primary" href="/">{t('nav.home')}</a>
	{#if notFound}<a class="btn" href="/wiki">{t('nav.pages')}</a>{/if}
</div>

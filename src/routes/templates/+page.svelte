<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
	const flash = $derived(page.url.searchParams.get('ok'));
</script>

<svelte:head><title>{t('templates.title')} · {page.data.siteName}</title></svelte:head>

<div class="head">
	<h1>{t('templates.title')}</h1>
	{#if data.canManage}<a class="btn btn-primary" href="/templates/new">+ {t('templates.new')}</a>{/if}
</div>
<FormOk message={flash ? 'templates.' + flash : null} />
<p>{t('templates.intro')}</p>

<ul class="list-plain grid">
	{#each data.templates as tp (tp.key)}
		<li class="card">
			<h2>{tp.name}</h2>
			<p class="muted">{tp.description || '—'}</p>
			{#if tp.fields.length}<p class="small"><strong>{t('fields.title')}:</strong> {tp.fields.join(', ')}</p>{/if}
			{#if tp.session}<p class="small">{t('templates.isSession')}</p>{/if}
			<div class="actions">
				{#if page.data.user}<a class="btn btn-small" href="/wiki/new?template={encodeURIComponent(tp.key)}">{t('templates.use')}<span class="visually-hidden">: {tp.name}</span></a>{/if}
				{#if data.canManage && !tp.builtin}
					<a class="btn btn-small" href="/templates/{encodeURIComponent(tp.key)}">{t('page.edit')}<span class="visually-hidden">: {tp.name}</span></a>
				{/if}
				{#if tp.builtin}<span class="badge">{t('templates.builtin')}</span>{/if}
			</div>
		</li>
	{/each}
</ul>

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
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 0.75rem;
	}
	h2 {
		font-size: var(--fs-md);
		margin: 0 0 0.25rem;
	}
	.small {
		font-size: var(--fs-sm);
		margin: 0.25rem 0;
	}
	.actions {
		margin: 0.5rem 0 0;
	}
</style>

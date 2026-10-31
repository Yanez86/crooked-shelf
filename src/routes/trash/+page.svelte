<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const locale = $derived(page.data.locale as string);
	const day = (ts: number) => new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(ts));
</script>

<svelte:head><title>{t('trash.title')} · {page.data.siteName}</title></svelte:head>

<h1>{t('trash.title')}</h1>
<p>{t('trash.intro')}</p>
<FormError error={form && 'error' in form ? form.error : null} />
<FormOk message={form && 'ok' in form ? form.ok : null} />

{#snippet row(id: number, title: string, meta: string, restore: string, purge: string)}
	<li class="row">
		<div>
			<strong>{title}</strong>
			<span class="muted meta">{meta}</span>
		</div>
		<div class="acts">
			<form method="post" action="?/{restore}">
				<input type="hidden" name="id" value={id} />
				<button class="act" type="submit" title={t('trash.restore')}><Icon name="undo" /><span class="visually-hidden">{t('trash.restore')}: {title}</span></button>
			</form>
			<form method="post" action="?/{purge}" class="purge">
				<input type="hidden" name="id" value={id} />
				<label class="choice"><input type="checkbox" name="confirm" required /><span>{t('trash.confirm')}<span class="visually-hidden">: {title}</span></span></label>
				<button class="act danger" type="submit" title={t('trash.purge')}><Icon name="trash" /><span class="visually-hidden">{t('trash.purge')}: {title}</span></button>
			</form>
		</div>
	</li>
{/snippet}

{#if data.pages.length || data.folders.length}
	<ul class="list-plain">
		{#each data.folders as f (f.id)}
			{@render row(f.id, f.name, `${t('trash.folder', { n: f.pages })} — ${t('trash.deletedOn')} ${day(f.deletedAt ?? 0)}`, 'restoreFolder', 'purgeFolder')}
		{/each}
		{#each data.pages as p (p.id)}
			{@const created = day(p.createdAt)}
			{@const updated = day(p.updatedAt)}
			{@render row(p.id, p.title, p.author ? t('trash.meta', { author: p.author, created, updated }) : t('trash.metaNoAuthor', { created, updated }), 'restore', 'purge')}
		{/each}
	</ul>
{:else}
	<p class="muted">{t('trash.empty')}</p>
{/if}

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem 1rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--c-border);
	}
	.meta {
		display: block;
	}
	.acts,
	.purge {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.act {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--c-primary);
		font-size: 1.1rem;
		cursor: pointer;
	}
	.act.danger {
		color: var(--c-danger);
	}
	.act:hover {
		background: var(--c-surface2);
	}
</style>

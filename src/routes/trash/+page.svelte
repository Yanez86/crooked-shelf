<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import RelTime from '#lib/components/RelTime.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const locale = $derived(page.data.locale as string);
</script>

<svelte:head><title>{t('trash.title')} · {page.data.siteName}</title></svelte:head>

<h1>{t('trash.title')}</h1>
<p>{t('trash.intro')}</p>
<FormError error={form && 'error' in form ? form.error : null} />
<FormOk message={form && 'ok' in form ? form.ok : null} />

{#if data.pages.length}
	<ul class="list-plain">
		{#each data.pages as p (p.id)}
			<li class="row">
				<div>
					<strong>{p.title}</strong>
					<span class="muted">— {t('trash.deletedOn')} <RelTime ts={p.deletedAt ?? 0} {locale} /></span>
				</div>
				<div class="acts">
					<form method="post" action="?/restore">
						<input type="hidden" name="id" value={p.id} />
						<button class="btn btn-small btn-primary" type="submit">{t('trash.restore')}<span class="visually-hidden">: {p.title}</span></button>
					</form>
					<form method="post" action="?/purge" class="purge">
						<input type="hidden" name="id" value={p.id} />
						<label class="choice"><input type="checkbox" name="confirm" required /><span>{t('trash.confirm')}<span class="visually-hidden">: {p.title}</span></span></label>
						<button class="btn btn-small btn-danger" type="submit">{t('trash.purge')}<span class="visually-hidden">: {p.title}</span></button>
					</form>
				</div>
			</li>
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
		gap: 0.5rem 1rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--c-border);
	}
	.acts,
	.purge {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
</style>

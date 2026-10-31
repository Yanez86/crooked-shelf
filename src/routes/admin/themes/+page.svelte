<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { ThemeColors } from '#lib/themes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('admin.themes')}</title></svelte:head>

<h2>{t('admin.themes')}</h2>
<p>{t('themes.intro')}</p>
<FormError error={form && 'error' in form ? form.error : null} />
{#if form && 'problems' in form && form.problems?.length}
	<ul class="problems">{#each form.problems as p (p)}<li>{p}</li>{/each}</ul>
{/if}
<FormOk message={form && 'ok' in form ? form.ok : null} />

{#snippet swatches(colors: ThemeColors)}
	<span class="sw" aria-hidden="true" style="background:{colors.bg};border-color:{colors.control}">
		<span style="color:{colors.text}">Aa</span><span style="color:{colors.link}">Aa</span><span class="dot" style="background:{colors.primary}"></span>
	</span>
{/snippet}

<h3>{t('themes.builtin')}</h3>
<ul class="list-plain grid">
	{#each data.builtin as th (th.id)}
		<li class="card">
			{@render swatches(th.colors)}
			<strong>{t('themes.' + th.id)}</strong>
			<div class="acts">
				<a class="btn btn-small" href="/admin/themes/new?from={th.id}">{t('themes.copy')}<span class="visually-hidden">: {t('themes.' + th.id)}</span></a>
				<a class="btn btn-small" href="/admin/themes/{th.id}/export" download>{t('themes.export')}<span class="visually-hidden">: {t('themes.' + th.id)}</span></a>
			</div>
		</li>
	{/each}
</ul>

<h3>{t('themes.custom')}</h3>
{#if data.custom.length}
	<ul class="list-plain grid">
		{#each data.custom as th (th.id)}
			<li class="card">
				{@render swatches(th.colors)}
				<strong>{th.name}</strong>
				<div class="acts">
					<a class="btn btn-small" href="/admin/themes/{th.id}">{t('page.edit')}<span class="visually-hidden">: {th.name}</span></a>
					<a class="btn btn-small" href="/admin/themes/{th.id}/export" download>{t('themes.export')}<span class="visually-hidden">: {th.name}</span></a>
					<form method="post" action="?/delete">
						<input type="hidden" name="id" value={th.id} />
						<button class="btn btn-small btn-danger" type="submit">{t('common.delete')}<span class="visually-hidden">: {th.name}</span></button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">{t('themes.noCustom')}</p>
{/if}
<p><a class="btn btn-primary" href="/admin/themes/new"><Icon name="plus" />{t('themes.new')}</a></p>

<h3>{t('themes.import')}</h3>
<form method="post" action="?/import" enctype="multipart/form-data" class="card inline">
	<label for="theme-file">{t('themes.importFile')}</label>
	<input id="theme-file" name="file" type="file" accept="application/json,.json" required />
	<button class="btn" type="submit">{t('themes.import')}</button>
</form>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: 0.75rem;
	}
	.grid li {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.sw {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
		border: 2px solid;
		border-radius: var(--radius);
		font-family: var(--font-head);
		font-weight: 700;
		font-size: var(--fs-md);
	}
	.dot {
		width: 1.2rem;
		height: 1.2rem;
		border-radius: var(--radius);
	}
	.acts,
	.inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}
	.problems {
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
	}
</style>

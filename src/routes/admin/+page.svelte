<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('admin.settings')}</title></svelte:head>

<h2>{t('admin.settings')}</h2>
<FormError error={form && 'error' in form ? form.error : null} />
<FormOk message={form && 'ok' in form ? form.ok : null} />

<form method="post" class="card">
	<div class="cols">
		<div class="field">
			<label for="siteName">{t('admin.siteName')}</label>
			<input id="siteName" name="siteName" type="text" required maxlength="80" value={data.settings.siteName} />
		</div>
		<div class="field">
			<label for="defaultLocale">{t('admin.defaultLocale')}</label>
			<select id="defaultLocale" name="defaultLocale">
				{#each data.locales as l (l.code)}<option value={l.code} selected={data.settings.defaultLocale === l.code}>{l.name}</option>{/each}
			</select>
		</div>
	</div>
	<label class="choice">
		<input type="checkbox" name="allowVisitors" checked={data.settings.allowVisitors} aria-describedby="visitors-hint" />
		<span>{t('admin.allowVisitors')}<br /><span id="visitors-hint" class="hint">{t('admin.allowVisitorsHint')}</span></span>
	</label>
	<div class="actions"><button class="btn btn-primary" type="submit">{t('common.save')}</button></div>
</form>

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0 1.5rem;
	}
</style>

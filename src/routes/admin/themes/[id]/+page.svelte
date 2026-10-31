<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import { contrastReport, type ThemeColors } from '#lib/themes.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();

	const start = untrack(() => (form && 'values' in form && form.values ? form.values : data.theme));
	let name = $state(start.name);
	let scheme = $state(start.scheme);
	let colors = $state<ThemeColors>({ ...(start.colors as ThemeColors) });

	const report = $derived(contrastReport(colors));
	const failing = $derived(report.filter((r) => !r.ok).length);
	const cssName = (k: string) => '--c-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
	const previewStyle = $derived(Object.entries(colors).map(([k, v]) => `${cssName(k)}:${v}`).join(';') + `;color-scheme:${scheme}`);
</script>

<svelte:head><title>{data.isNew ? t('themes.new') : t('themes.edit')}</title></svelte:head>

<h2>{data.isNew ? t('themes.new') : t('themes.edit')}</h2>
<p><a class="back" href="/admin/themes"><Icon name="arrowLeft" />{t('admin.themes')}</a></p>
<FormError error={form && 'error' in form ? form.error : null} />
<FormOk message={page.url.searchParams.has('saved') ? 'common.saved' : data.imported ? 'themes.imported' : null} />

<div class="layout">
	<form method="post" enctype="multipart/form-data" class="card">
		<div class="field">
			<label for="name">{t('common.name')}</label>
			<input id="name" name="name" type="text" required maxlength="40" bind:value={name} />
		</div>
		<fieldset>
			<legend>{t('themes.scheme')}</legend>
			<label class="choice"><input type="radio" name="scheme" value="light" bind:group={scheme} /><span>{t('themes.light')}</span></label>
			<label class="choice"><input type="radio" name="scheme" value="dark" bind:group={scheme} /><span>{t('themes.dark')}</span></label>
		</fieldset>
		<fieldset>
			<legend>{t('themes.colors')}</legend>
			<div class="colors">
				{#each data.keys as k (k)}
					<div class="color">
						<input id="c-{k}" name={k} type="color" bind:value={colors[k]} aria-describedby="h-{k}" />
						<label for="c-{k}">{t('themes.tokens.' + k)}<br /><span id="h-{k}" class="hint">{colors[k]}</span></label>
					</div>
				{/each}
			</div>
		</fieldset>
		<fieldset>
			<legend>{t('themes.background')}</legend>
			{#if data.theme.background}
				<img class="bg-current" src="/files/{data.theme.background}" alt={t('themes.backgroundCurrent')} />
				<label class="choice"><input type="checkbox" name="removeBackground" /><span>{t('themes.backgroundRemove')}</span></label>
			{/if}
			<div class="field">
				<label for="background">{t('themes.backgroundFile')}</label>
				<input id="background" name="background" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-describedby="background-hint" />
				<p id="background-hint" class="hint">{t('themes.backgroundHint')}</p>
			</div>
		</fieldset>
		<p role="status" class:bad={failing > 0} class="summary">
			{failing ? t('themes.failing', { n: failing }) : t('themes.allGood')}
		</p>
		<button class="btn btn-primary" type="submit">{t('common.save')}</button>
	</form>

	<div class="side">
		<section aria-labelledby="prev-title">
			<h3 id="prev-title">{t('themes.preview')}</h3>
			<div class="preview" style={previewStyle}>
				<p class="pv-title">{name}</p>
				<p>{t('themes.sampleText')} <a href="#prev-title">{t('themes.sampleLink')}</a> · <span class="pv-missing">{t('themes.sampleMissing')}</span></p>
				<p class="pv-muted">{t('themes.sampleMuted')}</p>
				<span class="pv-btn">{t('common.save')}</span>
				<div class="pv-secret"><strong><Icon name="lock" /> {t('editor.secret')}</strong><br />{t('themes.sampleSecret')}</div>
				<div class="pv-note">{t('editor.note')}</div>
				<input class="pv-input" type="text" value="Waterdeep" aria-label={t('themes.sampleInput')} readonly />
			</div>
		</section>
		<section aria-labelledby="contrast-title">
			<h3 id="contrast-title">{t('themes.contrastCheck')}</h3>
			<table class="data">
				<thead><tr><th scope="col">{t('themes.pair')}</th><th scope="col">{t('themes.ratio')}</th><th scope="col">{t('themes.min')}</th></tr></thead>
				<tbody>
					{#each report as r (r.fg + r.bg)}
						<tr class:bad={!r.ok}>
							<td>{t('themes.tokens.' + r.fg)} / {t('themes.tokens.' + r.bg)}</td>
							<td>{r.ratio.toFixed(2)}:1 <Icon name={r.ok ? 'check' : 'close'} /><span class="visually-hidden">{r.ok ? t('themes.ok') : t('themes.notOk')}</span></td>
							<td>{r.min}:1</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	</div>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
		gap: 1.5rem;
		align-items: start;
	}
	.colors {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
		gap: 0.5rem 1rem;
	}
	.side section:first-child h3 {
		margin-top: 0;
	}
	.color {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}
	.color input {
		width: 2.75rem;
		height: 2.75rem;
		padding: 0.1rem;
		border: 2px solid var(--c-control);
		border-radius: var(--radius);
		background: var(--c-surface);
		flex: none;
	}
	.color label {
		font-weight: 600;
		font-size: var(--fs-sm);
	}
	.bg-current {
		display: block;
		max-width: 100%;
		max-height: 10rem;
		margin-bottom: 0.5rem;
		border-radius: var(--radius);
	}
	.summary {
		font-weight: 700;
		color: var(--c-success);
	}
	.summary.bad,
	tr.bad td {
		color: var(--c-danger);
	}
	.preview {
		background: var(--c-bg);
		color: var(--c-text);
		border: 2px solid var(--c-border);
		border-radius: var(--radius);
		padding: 1rem;
	}
	.preview a {
		color: var(--c-link);
	}
	.pv-title {
		font-family: var(--font-head);
		font-size: var(--fs-lg);
		font-weight: 700;
		margin-top: 0;
	}
	.pv-missing {
		color: var(--c-missing);
		text-decoration: underline dashed;
	}
	.pv-muted {
		color: var(--c-muted);
	}
	.pv-btn {
		display: inline-block;
		background: var(--c-primary);
		color: var(--c-on-primary);
		padding: 0.4rem 1rem;
		border-radius: var(--radius);
		font-weight: 700;
	}
	.pv-secret {
		margin-top: 0.75rem;
		background: var(--c-secret-bg);
		color: var(--c-secret-text);
		border-left: 6px solid var(--c-secret-border);
		padding: 0.5rem 0.75rem;
	}
	.pv-note {
		margin-top: 0.5rem;
		background: var(--c-surface);
		border-left: 6px solid var(--c-note-border);
		padding: 0.5rem 0.75rem;
	}
	.pv-input {
		margin-top: 0.75rem;
		background: var(--c-surface);
		color: var(--c-text);
		border: 2px solid var(--c-control);
		outline-color: var(--c-focus);
	}
	table {
		font-size: var(--fs-sm);
	}
</style>

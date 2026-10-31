<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import FormOk from '#lib/components/FormOk.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const KINDS = ['themes', 'templates', 'calendars', 'locales', 'rules', 'links'] as const;
	type Plugin = (typeof data.plugins)[number];

	const contents = (p: Plugin) => KINDS.filter((k) => p.counts[k] > 0).map((k) => t('plugins.kinds.' + k, { n: p.counts[k] })).join(', ');

	let shown = $state<Plugin | null>(null);
	let dlg = $state<HTMLDialogElement>();

	$effect(() => dlg?.showModal());
</script>

<svelte:head><title>{t('admin.plugins')}</title></svelte:head>

<h2>{t('admin.plugins')}</h2>
<p>{t('plugins.intro')}</p>
<FormOk message={form?.ok} />

{#if data.plugins.length}
	<ul class="list-plain plugins">
		{#each data.plugins as p (p.id)}
			<li class="card">
				<div class="head">
					<h3><button class="open" type="button" aria-haspopup="dialog" onclick={() => (shown = p)}>{p.name}</button> <span class="muted small">{p.version}</span></h3>
					<span class="badge">{p.enabled ? t('plugins.on') : t('plugins.off')}</span>
				</div>
				{#if p.description}<p>{p.description}</p>{/if}
				<p class="small">{t('plugins.contains')} {contents(p)}</p>
				{#if p.warnings.length}<p class="small warn">{t('plugins.warnings', { n: p.warnings.length })}</p>{/if}
				<form method="post" action="?/toggle">
					<input type="hidden" name="id" value={p.id} />
					<input type="hidden" name="on" value={p.enabled ? '0' : '1'} />
					<button class="btn btn-small {p.enabled ? '' : 'btn-primary'}" type="submit">
						{p.enabled ? t('plugins.disable') : t('plugins.enable')}<span class="visually-hidden">: {p.name}</span>
					</button>
				</form>
			</li>
		{/each}
	</ul>
{:else}
	<p class="muted">{t('plugins.none')}</p>
{/if}

<section class="install" aria-labelledby="install-title">
	<h3 id="install-title">{t('plugins.installTitle')}</h3>
	<p>{t('plugins.installText')}</p>
	<ul>{#each data.dirs as d (d)}<li><code>{d}</code></li>{/each}</ul>
	<p>{t('plugins.docs')} <code>docs/plugin.md</code></p>
	<form method="post" action="?/reload"><button class="btn" type="submit">{t('plugins.reload')}</button></form>
</section>

{#if shown}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
	<dialog
		bind:this={dlg}
		class="details"
		aria-labelledby="plugin-title"
		onclick={(e) => e.target === dlg && dlg.close()}
		onkeydown={(e) => {
			// Esc chiude questa finestra e basta, non anche il popup di Amministrazione che la contiene.
			if (e.key === 'Escape') e.stopPropagation();
		}}
		onclose={() => (shown = null)}
	>
		<header>
			<h2 id="plugin-title">{shown.name}</h2>
			<button class="btn btn-small btn-ghost" type="button" title={t('common.close')} aria-label={t('common.close')} onclick={() => dlg?.close()}><Icon name="close" /></button>
		</header>
		<!-- Il testo può scorrere: da tastiera ci si arriva con Tab. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="body" role="region" aria-labelledby="plugin-title" tabindex="0">
			{#if shown.description}
				<h3>{t('plugins.purpose')}</h3>
				<p>{shown.description}</p>
			{/if}
			{#if shown.instructions}
				<h3>{t('plugins.howTo')}</h3>
				<p class="steps">{shown.instructions}</p>
			{/if}
			<h3>{t('plugins.info')}</h3>
			<dl>
				<dt>{t('plugins.state')}</dt>
				<dd>{shown.enabled ? t('plugins.on') : t('plugins.off')}</dd>
				{#if shown.author}<dt>{t('plugins.author')}</dt><dd>{shown.author}</dd>{/if}
				{#if shown.version}<dt>{t('plugins.version')}</dt><dd>{shown.version}</dd>{/if}
				{#if shown.license}<dt>{t('plugins.license')}</dt><dd>{shown.license}</dd>{/if}
				<dt>{t('plugins.id')}</dt>
				<dd><code>{shown.id}</code></dd>
				<dt>{t('plugins.contains')}</dt>
				<dd>{contents(shown)}</dd>
			</dl>
			{#if shown.warnings.length}
				<h3 class="warn">{t('plugins.warnings', { n: shown.warnings.length })}</h3>
				<ul>{#each shown.warnings as w (w)}<li><code>{w}</code></li>{/each}</ul>
			{/if}
		</div>
	</dialog>
{/if}

<style>
	.plugins {
		display: grid;
		gap: 0.75rem;
	}
	/* Tutta la scheda apre i dettagli: il pulsante del nome la copre, sotto il modulo per accendere. */
	.plugins .card {
		position: relative;
	}
	.plugins .card:hover {
		border-color: var(--c-control);
	}
	.open {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		text-decoration: underline;
		cursor: pointer;
	}
	.open::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.plugins form {
		position: relative;
		width: fit-content;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	h3 {
		margin: 0;
		font-size: var(--fs-md);
	}
	.small {
		font-size: var(--fs-sm);
	}
	.warn {
		color: var(--c-danger);
		font-weight: 600;
	}
	.install {
		margin-top: 2rem;
	}
	.details {
		width: min(100% - 2rem, 36rem);
		max-height: calc(100dvh - 2rem);
		padding: 0;
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
	}
	.details[open] {
		display: flex;
		flex-direction: column;
	}
	.details::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	.details header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--c-border);
	}
	.details h2 {
		margin: 0;
		font-size: var(--fs-lg);
	}
	.body {
		padding: 0.25rem 1.25rem 1rem;
		overflow-y: auto;
	}
	.body h3 {
		margin-top: 1rem;
	}
	.body p {
		margin: 0.25rem 0 0;
	}
	.steps {
		white-space: pre-line;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
		margin: 0.25rem 0 0;
	}
	dt {
		color: var(--c-muted);
	}
	dd {
		margin: 0;
	}
</style>

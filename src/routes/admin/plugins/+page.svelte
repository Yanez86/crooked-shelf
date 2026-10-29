<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const KINDS = ['themes', 'templates', 'calendars', 'locales', 'rules'] as const;
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
					<h3>{p.name} <span class="muted small">{p.version}</span></h3>
					<span class="badge">{p.enabled ? t('plugins.on') : t('plugins.off')}</span>
				</div>
				{#if p.description}<p>{p.description}</p>{/if}
				<p class="muted small">
					{#if p.author}{t('plugins.author', { name: p.author })} · {/if}{#if p.license}{p.license} · {/if}<code>{p.id}</code>
				</p>
				<p class="small">
					{t('plugins.contains')}
					{#each KINDS.filter((k) => p.counts[k] > 0) as k, i (k)}{i ? ', ' : ' '}{t('plugins.kinds.' + k, { n: p.counts[k] })}{/each}
				</p>
				{#if p.warnings.length}
					<details class="warn">
						<summary>{t('plugins.warnings', { n: p.warnings.length })}</summary>
						<ul>{#each p.warnings as w (w)}<li><code>{w}</code></li>{/each}</ul>
					</details>
				{/if}
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

<style>
	.plugins {
		display: grid;
		gap: 0.75rem;
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
	.warn summary {
		cursor: pointer;
		color: var(--c-danger);
		font-weight: 600;
		min-height: 2.5rem;
		display: flex;
		align-items: center;
	}
	.install {
		margin-top: 2rem;
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('nav.rules')} · {page.data.siteName}</title></svelte:head>

<h1>{t('rules.title')}</h1>
<p>{t('rules.intro', { n: data.total })}</p>
<details class="card how">
	<summary>{t('rules.howTitle')}</summary>
	<p>{t('rules.how1')}</p>
	<p><code>@incantesimo[Fireball]</code> · <code>@mostro[Goblin Warrior|il goblin]</code> · <code>@condizione[Prone]</code></p>
	<p>{t('rules.how2')}</p>
</details>

<form method="get" role="search" class="card filters">
	<div class="field grow">
		<label for="q">{t('rules.search')}</label>
		<input id="q" name="q" type="search" value={data.q} aria-describedby="q-hint" />
		<span id="q-hint" class="hint">{t('rules.searchHint')}</span>
	</div>
	<div class="field">
		<label for="kind">{t('rules.kind')}</label>
		<select id="kind" name="kind">
			<option value="">{t('list.all')}</option>
			{#each data.kinds as k (k)}<option value={k} selected={data.kind === k}>{t('rules.kinds.' + k)}</option>{/each}
		</select>
	</div>
	<div class="field"><button class="btn btn-primary" type="submit">{t('search.submit')}</button></div>
</form>

{#if data.q || data.kind}
	<p role="status">{t('rules.found', { n: data.results.length })}</p>
	<ul class="list-plain results">
		{#each data.results as r (r.kind + r.key)}
			<li>
				<a href="/rules/{r.kind}/{r.key}">{r.name}</a>
				<span class="muted">— {t('rules.kinds.' + r.kind)} · {r.summary}</span>
			</li>
		{/each}
	</ul>
{:else}
	<ul class="list-plain kinds">
		{#each data.kinds as k (k)}<li><a class="btn" href="?kind={k}">{t('rules.kinds.' + k)}</a></li>{/each}
	</ul>
{/if}

<p class="attr muted">{t('rules.attribution')}</p>

<style>
	.how {
		margin-bottom: 1rem;
	}
	.how summary {
		cursor: pointer;
		font-weight: 600;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
		align-items: flex-end;
	}
	.filters .grow {
		flex: 1 1 16rem;
	}
	.results li {
		padding: 0.35rem 0;
		border-bottom: 1px solid var(--c-border);
	}
	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.attr {
		font-size: 0.85rem;
		margin-top: 2rem;
	}
</style>

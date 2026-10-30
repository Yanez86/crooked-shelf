<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	let kind = $state('mine');
</script>

<svelte:head><title>{t('nav.boards')} · {page.data.siteName}</title></svelte:head>

<h1>{t('boards.title')}</h1>
<p>{t('boards.intro')}</p>
<FormOk message={page.url.searchParams.has('deleted') ? 'boards.deleted' : null} />

<div class="cols">
	<section aria-labelledby="mine-title">
		<h2 id="mine-title">{t('boards.mine')}</h2>
		{#if data.mine.length}
			<ul>{#each data.mine as b (b.id)}<li><a href="/boards/{b.id}">{b.title}</a> <span class="muted">({t('boards.cards', { n: b.cards })})</span></li>{/each}</ul>
		{:else}<p class="muted">{t('boards.noMine')}</p>{/if}
	</section>
	<section aria-labelledby="shared-title">
		<h2 id="shared-title">{t('boards.shared')}</h2>
		{#if data.shared.length}
			<ul>
				{#each data.shared as b (b.id)}
					<li>
						<a href="/boards/{b.id}">{b.title}</a> <span class="muted">({t('boards.cards', { n: b.cards })})</span>
						{#if b.visibility === 'master'}<span class="badge">{t('visibility.master')}</span>{/if}
					</li>
				{/each}
			</ul>
		{:else}<p class="muted">{t('boards.noShared')}</p>{/if}
	</section>
</div>

<!-- Aperto finché non c'è nessuna bacheca: allora creare è l'unica cosa da fare. -->
<details class="disclosure new" open={!data.mine.length && !data.shared.length || !!form?.error}>
	<summary class="btn btn-primary"><Icon name="plus" />{t('boards.new')}</summary>
	<FormError error={form?.error} />
	<form method="post" action="?/create" class="card">
		<div class="field">
			<label for="title">{t('page.title')}</label>
			<input id="title" name="title" type="text" required maxlength="80" />
		</div>
		{#if data.canShare}
			<fieldset>
				<legend>{t('boards.kind')}</legend>
				<label class="choice"><input type="radio" name="kind" value="mine" bind:group={kind} /><span>{t('boards.kindMine')}</span></label>
				<label class="choice"><input type="radio" name="kind" value="shared" bind:group={kind} /><span>{t('boards.kindShared')}</span></label>
				{#if kind === 'shared'}
					<label class="choice"><input type="checkbox" name="visibility" value="master" /><span>{t('boards.masterOnly')}</span></label>
				{/if}
			</fieldset>
		{/if}
		<div class="field">
			<label for="columns">{t('boards.columns')}</label>
			<textarea id="columns" name="columns" rows="4" aria-describedby="columns-hint">{t('boards.defaultColumns')}</textarea>
			<span id="columns-hint" class="hint">{t('boards.columnsHint')}</span>
		</div>
		<button class="btn btn-primary" type="submit">{t('boards.create')}</button>
	</form>
</details>

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0 2rem;
	}
	.new {
		max-width: 40rem;
		margin-top: 2rem;
	}
</style>

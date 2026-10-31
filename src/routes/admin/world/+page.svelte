<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	let pagesMode = $state('all');
	const DONE = ['pages', 'skipped', 'categories', 'maps', 'templates', 'events', 'themes'] as const;
</script>

<svelte:head><title>{t('admin.world')}</title></svelte:head>

<h2>{t('admin.world')}</h2>
<p>{t('world.intro')}</p>

<section class="card" aria-labelledby="export-title">
	<h3 id="export-title">{t('world.exportTitle')}</h3>
	<form method="get" action="/admin/world/download">
		<div class="field">
			<label for="pack-name">{t('world.name')}</label>
			<input id="pack-name" name="name" type="text" maxlength="80" value="" placeholder={t('world.namePlaceholder')} />
		</div>
		<div class="cols">
			<fieldset>
				<legend>{t('world.pages')}</legend>
				<label class="choice"><input type="radio" name="pages" value="all" bind:group={pagesMode} /><span>{t('world.allPages')}</span></label>
				<label class="choice"><input type="radio" name="pages" value="some" bind:group={pagesMode} /><span>{t('world.somePages')}</span></label>
				{#if pagesMode === 'some'}
					<div class="cols">
						<fieldset>
							<legend>{t('nav.categories')}</legend>
							{#each data.categories as c (c.id)}
								<label class="choice"><input type="checkbox" name="category" value={c.id} /><span>{c.label} <span class="muted">({c.count})</span></span></label>
							{:else}<p class="muted">—</p>{/each}
						</fieldset>
						<fieldset>
							<legend>{t('nav.tags')}</legend>
							{#each data.tags as tg (tg.id)}
								<label class="choice"><input type="checkbox" name="tag" value={tg.id} /><span>{tg.name} <span class="muted">({tg.count})</span></span></label>
							{:else}<p class="muted">—</p>{/each}
						</fieldset>
					</div>
				{/if}
				<p class="hint">{t('world.pagesHint')}</p>
			</fieldset>
			<fieldset>
				<legend>{t('world.alsoInclude')}</legend>
				<label class="choice"><input type="checkbox" name="maps" checked /><span>{t('kinds.folder.map')}</span></label>
				<label class="choice"><input type="checkbox" name="templates" checked /><span>{t('kinds.folder.template')}</span></label>
				<label class="choice"><input type="checkbox" name="calendar" checked /><span>{t('calendar.title')}</span></label>
				<label class="choice"><input type="checkbox" name="timeline" checked /><span>{t('world.timelines')}</span></label>
				<label class="choice"><input type="checkbox" name="themes" /><span>{t('admin.themes')}</span></label>
			</fieldset>
		</div>
		<label class="choice secrets">
			<input type="checkbox" name="secrets" aria-describedby="secrets-hint" />
			<span>{t('world.secrets')}<br /><span id="secrets-hint" class="hint">{t('world.secretsHint')}</span></span>
		</label>
		<button class="btn btn-primary" type="submit">{t('world.download')}</button>
	</form>
</section>

<section class="card" aria-labelledby="import-title">
	<h3 id="import-title">{t('world.importTitle')}</h3>
	<FormError error={form && 'error' in form ? form.error : null} />

	{#if form && 'done' in form && form.done}
		<div class="alert alert-ok" role="status">
			<strong>{t('world.imported')}</strong>
			<ul>{#each DONE.filter((k) => form.done[k] > 0) as k (k)}<li>{t('world.done.' + k, { n: form.done[k] })}</li>{/each}</ul>
		</div>
	{:else if form && 'preview' in form && form.preview}
		{@const pv = form.preview}
		<div role="status">
			<p><strong>{pv.name}</strong>{#if pv.secrets} · <span class="badge">{t('world.withSecrets')}</span>{/if}</p>
			<ul>
				{#each Object.entries(pv.counts) as [k, n] (k)}{#if n}<li>{t('world.done.' + k, { n })}</li>{/if}{/each}
			</ul>
			{#if pv.pageConflicts.length}
				<p class="alert alert-error">{t('world.conflicts', { list: pv.pageConflicts.join(', ') })}</p>
			{/if}
		</div>
		<form method="post" action="?/import">
			<input type="hidden" name="token" value={form.token} />
			<fieldset>
				<legend>{t('world.conflictTitle')}</legend>
				<label class="choice"><input type="radio" name="conflict" value="rename" checked /><span>{t('world.rename')}</span></label>
				<label class="choice"><input type="radio" name="conflict" value="skip" /><span>{t('world.skip')}</span></label>
				<label class="choice"><input type="radio" name="conflict" value="replace" /><span>{t('world.replace')}</span></label>
			</fieldset>
			{#if pv.hasCalendar}
				<label class="choice"><input type="checkbox" name="calendar" /><span>{t('world.useCalendar')}</span></label>
			{/if}
			<div class="actions">
				<button class="btn btn-primary" type="submit">{t('world.confirm')}</button>
				<a class="btn" href="/admin/world">{t('common.cancel')}</a>
			</div>
		</form>
	{:else}
		<form method="post" action="?/preview" enctype="multipart/form-data" class="inline">
			<label for="pack-file">{t('world.file')}</label>
			<!-- Senza "accept": su iPhone e iPad un file .shelf risulterebbe non selezionabile. Il contenuto lo controlla il server. -->
			<input id="pack-file" name="file" type="file" required />
			<button class="btn" type="submit">{t('world.check')}</button>
		</form>
		<p class="hint">{t('world.importHint')}</p>
	{/if}
</section>

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0 1rem;
	}
	.secrets {
		margin: 0.5rem 0 1rem;
	}
	.inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
</style>

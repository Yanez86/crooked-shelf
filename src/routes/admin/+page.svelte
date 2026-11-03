<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import { REPO } from '#lib/version.ts';
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
	<div class="actions"><button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button></div>
</form>

<section class="card" aria-labelledby="version-title">
	<h3 id="version-title">{t('admin.version')}</h3>
	<p>{t('admin.versionInstalled')} <a href="/changelog">{data.version}</a></p>
	<!-- Lo stato arriva dopo la pagina (GitHub può metterci qualche secondo) e lo si annuncia anche ai lettori di schermo.
	     Non role="status": quello della pagina resta l'esito del salvataggio. -->
	<div aria-live="polite" class="update-status">
		{#await data.update}
			<p class="muted">{t('admin.versionChecking')}</p>
		{:then u}
			{#if u.status === 'current'}
				<p class="update update-ok"><Icon name="check" /><span><strong>{t('admin.versionCurrent')}</strong> {t('admin.versionCurrentHint')}</span></p>
			{:else if u.status === 'outdated'}
				<p class="update update-old"><Icon name="upload" /><span><strong>{t('admin.versionOutdated')}</strong> {t('admin.versionOutdatedHint', { v: u.latest ?? '' })}</span></p>
				<ul class="list-plain update-links">
					<li><a href="{REPO}/blob/main/CHANGELOG.md" rel="noopener noreferrer" hreflang="it">{t('admin.versionNews')}</a></li>
					<li><a href="{REPO}/blob/main/docs/installazione.md" rel="noopener noreferrer" hreflang="it">{t('admin.versionHowTo')}</a></li>
				</ul>
			{:else if u.status === 'unknown'}
				<p class="muted">{t('admin.versionUnknown')}</p>
			{:else}
				<p class="muted">{t('admin.versionOff')}</p>
			{/if}
		{/await}
	</div>
</section>

<style>
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0 1.5rem;
	}
	/* Lo stato si legge dal testo; l'icona e il suo colore lo ripetono soltanto. */
	.update {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}
	.update-status > :global(:last-child) {
		margin-bottom: 0;
	}
	.update :global(.icon) {
		margin-top: 0.15em;
	}
	.update-ok :global(.icon) {
		color: var(--c-success);
	}
	.update-old :global(.icon) {
		color: var(--c-warning-border);
	}
	.update-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.5rem;
	}
</style>

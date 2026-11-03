<script lang="ts">
	import { enhance } from '$app/forms';
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	// Il ritorno a Claude lo fa il browser, non il form (vedi +page.server.ts); senza JavaScript resta il collegamento.
	$effect(() => {
		if (form?.location) location.href = form.location;
	});
</script>

<svelte:head><title>{t('oauth.title')}</title></svelte:head>

<div class="narrow">
	<h1>{t('oauth.title')}</h1>
	{#if data.invalid}
		<div class="alert alert-error" role="alert"><span>{t('oauth.invalid')}</span></div>
	{:else if form?.location}
		<p role="status"><a href={form.location}>{t('oauth.back', { host: data.host })}</a></p>
	{:else if !data.campaign}
		<div class="alert alert-error" role="alert"><span>{t('oauth.notMaster')}</span></div>
	{:else}
		<p>{t('oauth.intro', { campaign: data.campaign })}</p>
		<p class="host">{data.host}</p>
		{#if data.local}<p>{t('oauth.local')}</p>{/if}
		<FormError error={form?.error} />
		<form method="post" class="card" use:enhance>
			<label class="choice">
				<input type="checkbox" name="write" aria-describedby="write-hint" />
				<span>{t('claude.write')}<br /><span id="write-hint" class="hint">{t('claude.writeHint')}</span></span>
			</label>
			<div class="actions">
				<button class="btn btn-primary" type="submit" name="decision" value="allow">{t('oauth.allow')}</button>
				<button class="btn" type="submit" name="decision" value="deny">{t('common.cancel')}</button>
			</div>
		</form>
		<p class="muted">{t('oauth.revoke')}</p>
	{/if}
</div>

<style>
	.narrow {
		max-width: 28rem;
		margin: 1.5rem auto 0;
	}
	.host {
		font-family: var(--font-head);
		font-size: var(--fs-xl);
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.card {
		display: grid;
		gap: 1rem;
	}
</style>

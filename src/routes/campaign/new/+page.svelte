<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('campaign.newTitle')}</title></svelte:head>

<div class="center-column">
	<h1>{t('campaign.newTitle')}</h1>
	<p>{t('campaign.newIntro')}</p>
	<p class="hint" id="campaign-limit">{t('campaign.limitInfo', { held: data.held, limit: data.limit })}</p>
	{#if data.canCreate}
		<form method="post" class="card">
			<FormError error={form?.error} />
			<div class="field">
				<label for="campaign-name">{t('campaign.name')}</label>
				<input id="campaign-name" name="name" type="text" required maxlength="80" value={form?.name ?? ''} aria-describedby="campaign-limit" />
			</div>
			<button class="btn btn-primary" type="submit"><Icon name="plus" />{t('campaign.create')}</button>
		</form>
	{:else}
		<p class="card">{t('campaign.limitReached')}</p>
	{/if}
</div>

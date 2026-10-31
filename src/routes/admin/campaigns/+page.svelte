<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import DeleteCampaign from '#lib/components/DeleteCampaign.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('admin.campaigns')}</title></svelte:head>

<h2>{t('admin.campaigns')}</h2>
<p>{t('admin.campaignsIntro')}</p>
<FormError error={form?.error ?? null} />
<FormOk message={form?.ok ?? (page.url.searchParams.has('deleted') ? 'admin.campaignDeleted' : null)} />

{#each data.campaigns as c (c.id)}
	<form method="post" action="?/update" class="card inline-form">
		<input type="hidden" name="id" value={c.id} />
		<div class="field">
			<label for="name-{c.id}">{t('campaign.name')}</label>
			<input id="name-{c.id}" name="name" type="text" required maxlength="80" value={c.name} />
		</div>
		<div class="field">
			<label for="master-{c.id}">{t('campaign.master')}</label>
			<select id="master-{c.id}" name="masterId" required>
				{#if c.masterId === null}<option value="" selected>—</option>{/if}
				{#each data.masters as m (m.id)}<option value={m.id} selected={m.id === c.masterId}>{m.displayName} (@{m.username})</option>{/each}
			</select>
		</div>
		<p class="field muted">{t('admin.campaignPlayers', { n: c.players })}</p>
		<div class="field"><button class="btn" type="submit">{t('common.save')}<span class="visually-hidden"> {c.name}</span></button></div>
	</form>
	<DeleteCampaign id={c.id} name={c.name} />
{:else}
	<p class="muted">{t('admin.noCampaigns')}</p>
{/each}

<h3>{t('admin.newCampaign')}</h3>
<form method="post" action="?/create" class="card inline-form">
	<div class="field">
		<label for="new-name">{t('campaign.name')}</label>
		<input id="new-name" name="name" type="text" required maxlength="80" />
	</div>
	<div class="field">
		<label for="new-master">{t('campaign.master')}</label>
		<select id="new-master" name="masterId" required>
			{#each data.masters as m (m.id)}<option value={m.id}>{m.displayName} (@{m.username})</option>{/each}
		</select>
	</div>
	<div class="field"><button class="btn btn-primary" type="submit">{t('admin.newCampaign')}</button></div>
</form>

<style>
	.inline-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: flex-end;
	}
	.inline-form .field {
		margin-bottom: 0;
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('campaign.title')}</title></svelte:head>

<!-- Le campagne dell'account e una nuova. Le opzioni di una campagna sono nella sua pagina (Gestisci), solo da Master. -->
<div class="center-column">
	<h1>{t('campaign.yours')}</h1>
	{#if data.campaigns.length}
		<div class="card scroll">
			<table class="data">
				<thead>
					<tr>
						<th scope="col">{t('campaign.name')}</th>
						<th scope="col">{t('campaign.role')}</th>
						<th scope="col" class="col-end"><span class="visually-hidden">{t('common.actions')}</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.campaigns as c (c.id)}
						<tr>
							<td><strong>{c.name}</strong>{#if c.current} <span class="badge">{t('campaign.current')}</span>{/if}</td>
							<td>{t(c.mine ? 'roles.master' : 'roles.player')}{#if !c.mine && c.master} <span class="muted">· {t('campaign.master')}: {c.master}</span>{/if}</td>
							<td class="col-end">
								<div class="row-actions">
									<!-- Nella vista giocatore si guarda soltanto: niente opzioni del Master. -->
									{#if c.mine && !page.data.asPlayer}
										<a class="btn btn-small" href="/campaign/{c.id}">{t('campaign.manage')}<span class="visually-hidden"> {c.name}</span></a>
									{/if}
									{#if !c.current}
										<!-- _top: si entra nella campagna con tutta la wiki, non solo nel popup. -->
										<form method="post" action="?/switch" target="_top">
											<input type="hidden" name="id" value={c.id} />
											<button class="btn btn-small btn-primary" type="submit">{t('campaign.enter')}<span class="visually-hidden"> {c.name}</span></button>
										</form>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p>{t('campaign.none')}</p>
	{/if}

	<h2 id="new-campaign-title">{t('campaign.newTitle')}</h2>
	<p>{t('campaign.newIntro')}</p>
	<p class="hint" id="campaign-limit">{t('campaign.limitInfo', { held: data.allowance.held, limit: data.allowance.limit })}</p>
	{#if data.allowance.canCreate}
		<!-- _top: dopo averla creata si entra nella campagna nuova, con tutta la wiki. -->
		<form method="post" action="?/newCampaign" target="_top" class="card" aria-labelledby="new-campaign-title">
			<FormError error={form?.error} />
			<div class="field">
				<label for="new-campaign-name">{t('campaign.name')}</label>
				<input id="new-campaign-name" name="name" type="text" required maxlength="80" value={form?.name ?? ''} aria-describedby="campaign-limit" />
			</div>
			<button class="btn btn-primary" type="submit"><Icon name="plus" />{t('campaign.create')}</button>
		</form>
	{:else}
		<p class="card">{t('campaign.limitReached')}</p>
	{/if}
</div>

<style>
	.row-actions {
		display: inline-flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.row-actions form {
		margin: 0;
	}
	.scroll {
		overflow-x: auto;
	}
</style>

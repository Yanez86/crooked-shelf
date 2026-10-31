<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import DeleteCampaign from '#lib/components/DeleteCampaign.svelte';
	import Invites from '#lib/components/Invites.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('campaign.title')}</title></svelte:head>

<div class="center-column">
	<h1>{t('campaign.title')}</h1>
	{#if !data.campaign}
		<p>{t('campaign.none')}</p>
	{:else}
		<form method="post" action="?/rename" class="card">
			<div class="field">
				<label for="campaign-name">{t('campaign.name')}</label>
				<input id="campaign-name" name="name" type="text" required maxlength="80" value={data.campaign.name} />
			</div>
			<p>{t('campaign.master')}: <strong>{data.master ?? '—'}</strong></p>
			<button class="btn btn-primary" type="submit">{t('common.save')}</button>
		</form>

		<h2>{t('campaign.players')}</h2>
		{#if data.players.length}
			<div class="card">
				<table class="data">
					<tbody>
						{#each data.players as p (p.id)}
							<tr>
								<td>{p.displayName} <span class="muted">@{p.username}</span></td>
								<td class="col-end">
									<form method="post" action="?/remove">
										<input type="hidden" name="id" value={p.id} />
										<button class="btn btn-small btn-danger" type="submit">{t('campaign.remove')}<span class="visually-hidden"> {p.displayName}</span></button>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="muted">{t('campaign.noPlayers')}</p>
		{/if}

		<h2>{t('admin.invites')}</h2>
		<p>{t('campaign.inviteIntro')}</p>
		<Invites invites={data.invites} {form} />

		<DeleteCampaign id={data.campaign.id} name={data.campaign.name} />
	{/if}
</div>

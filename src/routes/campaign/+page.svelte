<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import DeleteCampaign from '#lib/components/DeleteCampaign.svelte';
	import Invites from '#lib/components/Invites.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import FormError from '#lib/components/FormError.svelte';
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
			<button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button>
		</form>

		<h2>{t('campaign.players')}</h2>
		{#if data.players.length}
			<div class="card">
				<table class="data">
					<tbody>
						{#each data.players as p (p.id)}
							<tr>
								<td>
									{#if p.sheet}<a href="/wiki/{p.sheet}">{p.displayName}</a>{:else}{p.displayName}{/if}
									<span class="muted">@{p.username}</span>
								</td>
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

		{#if data.sheets}
			<h2 id="sheets-title">{t('sheets.templateTitle')}</h2>
			<p>{t('sheets.templateIntro')}</p>
			<form method="post" action="?/sheetTemplate" class="card" aria-labelledby="sheets-title">
				<!-- Solo dopo aver salvato il template: l'esito delle altre azioni lo mostra il riquadro degli inviti. -->
				{#if form && 'sheetError' in form}<FormError error={form.sheetError} />{/if}
				{#if form && 'sheetOk' in form}<FormOk message={form.sheetOk} />{/if}
				<div class="field">
					<label for="sheet-template">{t('sheets.templateLabel')}</label>
					<select id="sheet-template" name="template">
						<option value="" selected={!data.sheets.current}>{t('sheets.blank')}</option>
						{#each data.sheets.templates as tp (tp.slug)}
							<option value={tp.slug} selected={data.sheets.current === tp.slug}>{tp.title}</option>
						{/each}
					</select>
				</div>
				<button class="btn btn-primary" type="submit"><Icon name="save" />{t('common.save')}</button>
			</form>
		{/if}

		<h2>{t('admin.invites')}</h2>
		<p>{t('campaign.inviteIntro')}</p>
		<Invites invites={data.invites} {form} />

		<DeleteCampaign id={data.campaign.id} name={data.campaign.name} />
	{/if}
</div>

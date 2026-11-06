<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import FormError from './FormError.svelte';
	import FormOk from './FormOk.svelte';
	import RelTime from './RelTime.svelte';

	interface Invite {
		id: number;
		expiresAt: number;
		by: string | null;
		campaign: string | null;
	}

	/**
	 * Ogni invito crea un account normale (l'Admin è uno solo; Master e giocatori si è nelle campagne). Senza `site` si invitano
	 * giocatori nella campagna della pagina; con `site` (Amministrazione) si sceglie se entrano in `campaign`, quella in cui si è,
	 * o in nessuna. `query` si aggiunge alle azioni, es. la scheda in cui tornare.
	 */
	let {
		invites,
		site = false,
		campaign = null,
		form,
		query = ''
	}: {
		invites: Invite[];
		site?: boolean;
		campaign?: string | null;
		form: { error?: string; ok?: string; link?: string; campaign?: string | null } | null | undefined;
		query?: string;
	} = $props();
	const t = getT();
	const locale = $derived(page.data.locale as string);
	let copied = $state(false);

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<FormError error={form?.error ?? null} />
<FormOk message={form?.ok ?? null} />

{#if form?.link}
	<div class="alert alert-ok" role="status">
		<p><strong>{form.campaign ? t('admin.inviteCreatedFor', { campaign: form.campaign }) : t('admin.inviteCreated')}</strong></p>
		<p>{t('admin.inviteOnce')}</p>
		<label for="invite-link">{t('admin.inviteLink')}</label>
		<div class="link-row">
			<input id="invite-link" type="text" readonly value={form.link} onfocus={(e) => e.currentTarget.select()} />
			<button class="btn" type="button" onclick={() => copy(form.link!)}>{t('admin.copy')}</button>
		</div>
		<p aria-live="polite">{copied ? t('admin.copied') : ''}</p>
	</div>
{/if}

<form method="post" action="?/create{query}" class="card inline-form">
	{#if site && campaign}
		<div class="field">
			<label for="where">{t('admin.inviteWhere')}</label>
			<select id="where" name="where">
				<option value="campaign" selected>{t('admin.inviteInCampaign', { campaign })}</option>
				<option value="none">{t('admin.inviteNoCampaign')}</option>
			</select>
		</div>
	{/if}
	<div class="field">
		<label for="days">{t('admin.expires')}</label>
		<select id="days" name="days">
			<option value="1">{t('admin.days', { n: 1 })}</option>
			<option value="7" selected>{t('admin.days', { n: 7 })}</option>
			<option value="30">{t('admin.days', { n: 30 })}</option>
		</select>
	</div>
	<div class="field"><button class="btn btn-primary" type="submit">{t('admin.createInvite')}</button></div>
</form>

<h3>{t('admin.activeInvites')}</h3>
{#if invites.length}
	<div class="card scroll">
		<table class="data">
			<thead>
				<tr>
					{#if site}<th scope="col">{t('admin.campaign')}</th>{/if}
					<th scope="col">{t('admin.createdBy')}</th>
					<th scope="col">{t('admin.expiresAt')}</th>
					<th scope="col" class="col-end"><span class="visually-hidden">{t('common.actions')}</span></th>
				</tr>
			</thead>
			<tbody>
				{#each invites as i (i.id)}
					<tr>
						{#if site}<td>{i.campaign ?? '—'}</td>{/if}
						<td>{i.by ?? '—'}</td>
						<td><RelTime ts={i.expiresAt} {locale} /></td>
						<td class="col-end">
							<form method="post" action="?/revoke{query}">
								<input type="hidden" name="id" value={i.id} />
								<button class="btn btn-small btn-danger" type="submit">{t('admin.revoke')}</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="muted">{t('admin.noInvites')}</p>
{/if}

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
	.link-row {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.3rem;
	}
	.link-row input {
		flex: 1;
		min-width: 0;
		font-family: var(--font-mono);
		font-size: var(--fs-sm);
	}
	.scroll {
		overflow-x: auto;
	}
</style>

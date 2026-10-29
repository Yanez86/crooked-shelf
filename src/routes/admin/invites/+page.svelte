<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import RelTime from '#lib/components/RelTime.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
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

<svelte:head><title>{t('admin.invites')}</title></svelte:head>

<h2>{t('admin.invites')}</h2>
<p>{t('admin.invitesIntro')}</p>
<FormError error={form && 'error' in form ? form.error : null} />
<FormOk message={form && 'ok' in form ? form.ok : null} />

{#if form && 'link' in form && form.link}
	<div class="alert alert-ok" role="status">
		<p><strong>{t('admin.inviteCreated', { role: t('roles.' + form.role) })}</strong></p>
		<p>{t('admin.inviteOnce')}</p>
		<label for="invite-link">{t('admin.inviteLink')}</label>
		<div class="link-row">
			<input id="invite-link" type="text" readonly value={form.link} onfocus={(e) => e.currentTarget.select()} />
			<button class="btn" type="button" onclick={() => copy(form.link)}>{t('admin.copy')}</button>
		</div>
		<p aria-live="polite">{copied ? t('admin.copied') : ''}</p>
	</div>
{/if}

<form method="post" action="?/create" class="card inline-form">
	<div class="field">
		<label for="role">{t('admin.role')}</label>
		<select id="role" name="role">
			{#each data.roles as r (r)}<option value={r} selected={r === 'player'}>{t('roles.' + r)}</option>{/each}
		</select>
	</div>
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
{#if data.invites.length}
	<div class="scroll">
		<table class="data">
			<thead>
				<tr>
					<th scope="col">{t('admin.role')}</th>
					<th scope="col">{t('admin.createdBy')}</th>
					<th scope="col">{t('admin.expiresAt')}</th>
					<th scope="col"><span class="visually-hidden">{t('common.actions')}</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.invites as i (i.id)}
					<tr>
						<td>{t('roles.' + i.role)}</td>
						<td>{i.by ?? '—'}</td>
						<td><RelTime ts={i.expiresAt} {locale} /></td>
						<td>
							<form method="post" action="?/revoke">
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
		gap: 0 1rem;
		align-items: flex-end;
		max-width: 48rem;
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
		font-size: 0.9rem;
	}
	.scroll {
		overflow-x: auto;
	}
</style>

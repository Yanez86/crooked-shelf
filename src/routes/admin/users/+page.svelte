<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import Icon from '#lib/components/Icon.svelte';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import UserIcon from '#lib/components/UserIcon.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const me = $derived(page.data.user?.id);
	// A chi passare l'amministrazione: gli altri account attivi.
	const heirs = $derived(data.users.filter((u) => u.id !== me && !u.disabled));
</script>

<svelte:head><title>{t('admin.users')}</title></svelte:head>

<h2>{t('admin.users')}</h2>
<p>{t('admin.usersIntro')} <a href="/admin/invites">{t('admin.invites')}</a></p>
<FormError error={form && 'error' in form ? form.error : null} params={form && 'params' in form ? (form.params as Record<string, number>) : undefined} />
<FormOk message={form && 'ok' in form ? form.ok : null} />
{#if form && 'resetLink' in form}
	<div class="card stack" role="status">
		<p>{t('admin.resetCreated', { user: form.resetFor ?? '' })}</p>
		<div class="field">
			<label for="reset-link">{t('admin.resetLink')}</label>
			<input id="reset-link" type="text" readonly value={form.resetLink} onfocus={(e) => e.currentTarget.select()} />
		</div>
	</div>
{/if}

<div class="card scroll">
	<table class="data">
		<caption class="visually-hidden">{t('admin.users')}</caption>
		<thead>
			<tr>
				<th scope="col">{t('admin.user')}</th>
				<th scope="col">{t('admin.campaignLimit')}</th>
				<th scope="col" class="col-center">{t('admin.disabled')}</th>
				<th scope="col" class="col-end"><span class="visually-hidden">{t('common.actions')}</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr>
					<th scope="row">
						<span class="who">
							<UserIcon icon={u.icon} avatar={u.avatar} />
							<span>
								{u.displayName}{#if u.admin}{' '}<span class="badge">{t('roles.admin')}</span>{/if}{#if u.id === me}{' '}<span class="badge">{t('admin.you')}</span>{/if}<br /><span class="hint">@{u.username}</span>
							</span>
						</span>
					</th>
					<td>
						<form id="user-{u.id}" method="post" action="?/update"><input type="hidden" name="id" value={u.id} /></form>
						<!-- Quante ne tiene, e fino a quante ne può creare da sé. -->
						<span class="limit">
							<span aria-hidden="true">{u.held} /</span>
							<label class="visually-hidden" for="limit-{u.id}">{t('admin.campaignLimitFor', { user: u.username, held: u.held })}</label>
							<input id="limit-{u.id}" name="campaignLimit" form="user-{u.id}" type="number" inputmode="numeric" min="0" max={data.maxCampaigns} required value={u.campaignLimit} />
						</span>
					</td>
					<td class="col-center">
						<label class="choice">
							<input type="checkbox" name="disabled" form="user-{u.id}" checked={u.disabled} />
							<span class="visually-hidden">{t('admin.disabled')}: {u.username}</span>
						</label>
					</td>
					<td class="col-end">
						<!-- I due pulsanti in fila, alla stessa altezza: uno ha l'icona, l'altro sta nel suo modulo. -->
						<div class="row-actions">
							<button class="btn btn-small" type="submit" form="user-{u.id}"><Icon name="save" />{t('common.save')}<span class="visually-hidden">: {u.username}</span></button>
							<form method="post" action="?/reset"><input type="hidden" name="id" value={u.id} /><button class="btn btn-small" type="submit" disabled={u.disabled}>{t('admin.resetPassword')}<span class="visually-hidden">: {u.username}</span></button></form>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="hint">{t('admin.campaignLimitHint')}</p>

<h3>{t('admin.transferTitle')}</h3>
<p>{t('admin.transferIntro')}</p>
{#if heirs.length}
	<!-- _top: anche dal popup dell'amministrazione, che dopo non è più sua. -->
	<form method="post" action="?/transfer" target="_top" class="card inline-form">
		<div class="field">
			<label for="transfer-to">{t('admin.transferTo')}</label>
			<select id="transfer-to" name="id" required>
				{#each heirs as u (u.id)}<option value={u.id}>{u.displayName} (@{u.username})</option>{/each}
			</select>
		</div>
		<label class="choice field">
			<input type="checkbox" name="confirm" required />
			<span>{t('admin.transferConfirm')}</span>
		</label>
		<div class="field"><button class="btn" type="submit">{t('admin.transferSubmit')}</button></div>
	</form>
{:else}
	<p class="muted">{t('admin.transferNone')}</p>
{/if}

<h3>{t('admin.rolesTitle')}</h3>
<p>{t('admin.rolesIntro')}</p>
<dl class="card roles">
	{#each ['admin', 'master', 'player'] as r (r)}
		<dt>{t('roles.' + r)}</dt>
		<dd>{t('roles.' + r + 'Hint')}</dd>
	{/each}
</dl>

<style>
	.row-actions {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.25rem;
	}
	.row-actions form {
		display: contents;
	}
	.scroll {
		overflow-x: auto;
	}
	.who {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.col-center .choice {
		justify-content: center;
	}
	.limit {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
	}
	.limit input {
		width: 4.5rem;
	}
	.inline-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: flex-end;
	}
	.inline-form .field {
		margin-bottom: 0;
	}
	.roles {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 0.5rem 1.5rem;
	}
	.roles dt {
		font-weight: 700;
	}
	.roles dd {
		margin: 0;
	}
	@container (max-width: 34rem) {
		.roles {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
		}
		.roles dd {
			margin-bottom: 0.5rem;
		}
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const me = $derived(page.data.user?.id);
</script>

<svelte:head><title>{t('admin.users')}</title></svelte:head>

<h2>{t('admin.users')}</h2>
<p>{t('admin.usersIntro')} <a href="/admin/invites">{t('admin.invites')}</a></p>
<FormError error={form && 'error' in form ? form.error : null} />
<FormOk message={form && 'ok' in form ? form.ok : null} />

<div class="scroll">
	<table class="data">
		<caption class="visually-hidden">{t('admin.users')}</caption>
		<thead>
			<tr>
				<th scope="col">{t('auth.username')}</th>
				<th scope="col">{t('auth.displayName')}</th>
				<th scope="col">{t('admin.role')}</th>
				<th scope="col">{t('admin.disabled')}</th>
				<th scope="col"><span class="visually-hidden">{t('common.actions')}</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.users as u (u.id)}
				<tr>
					<th scope="row">{u.username}{#if u.id === me} <span class="badge">{t('admin.you')}</span>{/if}</th>
					<td>{u.displayName}</td>
					<td>
						<form id="user-{u.id}" method="post" action="?/update"><input type="hidden" name="id" value={u.id} /></form>
						<label class="visually-hidden" for="role-{u.id}">{t('admin.role')}: {u.username}</label>
						<select id="role-{u.id}" name="role" form="user-{u.id}">
							{#each data.roles as r (r)}<option value={r} selected={u.role === r}>{t('roles.' + r)}</option>{/each}
						</select>
					</td>
					<td>
						<label class="choice">
							<input type="checkbox" name="disabled" form="user-{u.id}" checked={u.disabled} />
							<span class="visually-hidden">{t('admin.disabled')}: {u.username}</span>
						</label>
					</td>
					<td><button class="btn btn-small" type="submit" form="user-{u.id}">{t('common.save')}<span class="visually-hidden">: {u.username}</span></button></td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<h3>{t('admin.rolesTitle')}</h3>
<dl class="roles">
	{#each data.roles as r (r)}
		<dt>{t('roles.' + r)}</dt>
		<dd>{t('roles.' + r + 'Hint')}</dd>
	{/each}
</dl>

<style>
	.scroll {
		overflow-x: auto;
	}
	.roles dt {
		font-weight: 700;
		margin-top: 0.5rem;
	}
	.roles dd {
		margin-left: 0;
	}
</style>

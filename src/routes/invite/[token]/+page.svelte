<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const v = $derived(form?.values);
</script>

<svelte:head><title>{t('invite.title')}</title></svelte:head>

<div class="narrow">
	<h1>{t('invite.title')}</h1>
	{#if !data.valid}
		<div class="alert alert-error" role="alert"><span>{t('invite.invalid')}</span></div>
		<p><a href="/login">{t('auth.loginTitle')}</a></p>
	{:else}
		<p>{t('invite.intro', { role: t('roles.' + data.role) })}</p>
		<FormError error={form?.error} />
		<form method="post" class="card">
			<div class="field">
				<label for="username">{t('auth.username')}</label>
				<input id="username" name="username" type="text" required autocomplete="username" aria-describedby="username-hint" value={v?.username ?? ''} />
				<span id="username-hint" class="hint">{t('auth.usernameHint')}</span>
			</div>
			<div class="field">
				<label for="displayName">{t('auth.displayName')}</label>
				<input id="displayName" name="displayName" type="text" maxlength="60" autocomplete="nickname" value={v?.displayName ?? ''} />
			</div>
			<div class="field">
				<label for="password">{t('auth.password')}</label>
				<input id="password" name="password" type="password" required minlength="10" autocomplete="new-password" aria-describedby="password-hint" />
				<span id="password-hint" class="hint">{t('auth.passwordHint')}</span>
			</div>
			<div class="field">
				<label for="confirm">{t('auth.confirm')}</label>
				<input id="confirm" name="confirm" type="password" required minlength="10" autocomplete="new-password" />
			</div>
			<button class="btn btn-primary" type="submit">{t('invite.submit')}</button>
		</form>
	{/if}
</div>

<style>
	.narrow {
		max-width: 34rem;
		margin: 1.5rem auto 0;
	}
</style>

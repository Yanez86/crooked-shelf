<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('reset.title')}</title></svelte:head>

<div class="narrow">
	<h1>{t('reset.title')}</h1>
	{#if !data.valid}
		<div class="alert alert-error" role="alert"><span>{t('reset.invalid')}</span></div>
		<p><a href="/login">{t('auth.loginTitle')}</a></p>
	{:else}
		<p>{t('reset.intro', { user: data.username ?? '' })}</p>
		<FormError error={form?.error} />
		<form method="post" class="card">
			<div class="field">
				<label for="password">{t('prefs.newPassword')}</label>
				<input id="password" name="password" type="password" required minlength="10" autocomplete="new-password" aria-describedby="password-hint" />
				<span id="password-hint" class="hint">{t('auth.passwordHint')}</span>
			</div>
			<div class="field">
				<label for="confirm">{t('auth.confirm')}</label>
				<input id="confirm" name="confirm" type="password" required minlength="10" autocomplete="new-password" />
			</div>
			<button class="btn btn-primary" type="submit">{t('reset.submit')}</button>
		</form>
	{/if}
</div>

<style>
	.narrow {
		max-width: 28rem;
		margin: 1.5rem auto 0;
	}
</style>

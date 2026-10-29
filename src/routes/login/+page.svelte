<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	const t = getT();
</script>

<svelte:head><title>{t('auth.loginTitle')}</title></svelte:head>

<div class="narrow">
	<h1>{t('auth.loginTitle')}</h1>
	<FormError error={form?.error} />
	<form method="post" class="card">
		<div class="field">
			<label for="username">{t('auth.username')}</label>
			<input id="username" name="username" type="text" required autocomplete="username" value={form?.username ?? ''} />
		</div>
		<div class="field">
			<label for="password">{t('auth.password')}</label>
			<input id="password" name="password" type="password" required autocomplete="current-password" />
		</div>
		<button class="btn btn-primary" type="submit">{t('auth.login')}</button>
	</form>
	<p class="muted">{t('auth.inviteOnly')}</p>
</div>

<style>
	.narrow {
		max-width: 28rem;
		margin: 1.5rem auto 0;
	}
</style>

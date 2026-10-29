<script lang="ts">
	import { getT } from '#lib/i18n/index.ts';
	import FormError from '#lib/components/FormError.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const v = $derived(form?.values);
</script>

<svelte:head><title>{t('setup.title')}</title></svelte:head>

<div class="narrow">
	<h1>{t('setup.title')}</h1>
	<p>{t('setup.intro')}</p>

	<FormError error={form?.error} />

	<form method="post" class="card">
		<h2>{t('setup.site')}</h2>
		<div class="field">
			<label for="siteName">{t('setup.siteName')}</label>
			<input id="siteName" name="siteName" type="text" required maxlength="80" value={v?.siteName ?? 'Crooked Shelf'} />
		</div>
		<div class="field">
			<label for="locale">{t('setup.locale')}</label>
			<select id="locale" name="locale">
				{#each data.locales as l (l.code)}
					<option value={l.code} selected={(v?.locale ?? data.suggested) === l.code}>{l.name}</option>
				{/each}
			</select>
		</div>

		<h2>{t('setup.admin')}</h2>
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
		<button class="btn btn-primary" type="submit">{t('setup.submit')}</button>
	</form>
</div>

<style>
	.narrow {
		max-width: 34rem;
		margin: 1.5rem auto 0;
	}
	.card h2:first-child {
		margin-top: 0;
	}
</style>

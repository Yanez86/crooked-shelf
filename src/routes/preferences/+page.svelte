<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { getT } from '#lib/i18n/index.ts';
	import { THEMES } from '#lib/themes.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const user = $derived(page.data.user);
	const msg = (s: string) => (form?.section === s ? form : null);
	const swatch = (id: string) => THEMES.find((th) => th.id === id)?.colors;
</script>

<svelte:head><title>{t('prefs.title')} · {page.data.siteName}</title></svelte:head>

<h1>{t('prefs.title')}</h1>
<p>{user ? t('prefs.introUser') : t('prefs.introGuest')}</p>

<section aria-labelledby="read-title">
	<h2 id="read-title">{t('prefs.reading')}</h2>
	<FormError error={msg('prefs')?.error} />
	<FormOk message={msg('prefs')?.ok} />
	<form method="post" action="?/prefs" class="card" use:enhance={() => async ({ update }) => update({ reset: false })}>
		<fieldset>
			<legend>{t('prefs.theme')}</legend>
			<div class="themes">
				{#each data.options.theme as th (th)}
					{@const c = swatch(th)}
					<label class="choice theme-choice">
						<input type="radio" name="theme" value={th} checked={data.current.theme === th} />
						<span class="swatch" aria-hidden="true" style={c ? `background:${c.bg};color:${c.text};border-color:${c.control}` : ''}>
							{#if c}<span style="color:{c.link}">Aa</span>{:else}◐{/if}
						</span>
						<span>{t('themes.' + th)}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="cols">
			<div class="field">
				<label for="fontSize">{t('prefs.fontSize')}</label>
				<select id="fontSize" name="fontSize">
					{#each data.options.fontSize as s (s)}<option value={s} selected={data.current.fontSize === s}>{s}%</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="font">{t('prefs.font')}</label>
				<select id="font" name="font" aria-describedby="font-hint">
					{#each data.options.font as s (s)}<option value={s} selected={data.current.font === s}>{t('fonts.' + s)}</option>{/each}
				</select>
				<span id="font-hint" class="hint">{t('prefs.fontHint')}</span>
			</div>
			<div class="field">
				<label for="spacing">{t('prefs.spacing')}</label>
				<select id="spacing" name="spacing">
					{#each data.options.spacing as s (s)}<option value={s} selected={data.current.spacing === s}>{t('spacing.' + s)}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="motion">{t('prefs.motion')}</label>
				<select id="motion" name="motion">
					{#each data.options.motion as s (s)}<option value={s} selected={data.current.motion === s}>{t('motion.' + s)}</option>{/each}
				</select>
			</div>
			<div class="field">
				<label for="locale">{t('prefs.locale')}</label>
				<select id="locale" name="locale">
					<option value="" selected={!data.current.locale}>{t('prefs.localeDefault')}</option>
					{#each data.locales as l (l.code)}<option value={l.code} selected={data.current.locale === l.code}>{l.name}</option>{/each}
				</select>
			</div>
		</div>
		<button class="btn btn-primary" type="submit">{t('common.save')}</button>
	</form>
</section>

{#if user}
	<section aria-labelledby="profile-title">
		<h2 id="profile-title">{t('prefs.profile')}</h2>
		<FormError error={msg('profile')?.error} />
		<FormOk message={msg('profile')?.ok} />
		<form method="post" action="?/profile" class="card">
			<p class="muted">{t('auth.username')}: <strong>{user.username}</strong> · {t('roles.' + user.role)}</p>
			<div class="field">
				<label for="displayName">{t('auth.displayName')}</label>
				<input id="displayName" name="displayName" type="text" required maxlength="60" value={user.displayName} />
			</div>
			<button class="btn" type="submit">{t('common.save')}</button>
		</form>
	</section>

	<section aria-labelledby="pw-title">
		<h2 id="pw-title">{t('prefs.password')}</h2>
		<FormError error={msg('password')?.error} />
		<FormOk message={msg('password')?.ok} />
		<form method="post" action="?/password" class="card">
			<div class="field">
				<label for="current">{t('prefs.currentPassword')}</label>
				<input id="current" name="current" type="password" required autocomplete="current-password" />
			</div>
			<div class="field">
				<label for="password">{t('prefs.newPassword')}</label>
				<input id="password" name="password" type="password" required minlength="10" autocomplete="new-password" aria-describedby="pw-hint" />
				<span id="pw-hint" class="hint">{t('auth.passwordHint')}</span>
			</div>
			<div class="field">
				<label for="confirm">{t('auth.confirm')}</label>
				<input id="confirm" name="confirm" type="password" required minlength="10" autocomplete="new-password" />
			</div>
			<button class="btn" type="submit">{t('prefs.changePassword')}</button>
		</form>
	</section>
{/if}

<style>
	section {
		max-width: 48rem;
	}
	.themes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: 0.5rem;
	}
	.theme-choice {
		align-items: center;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		padding: 0.5rem;
	}
	.theme-choice:has(input:checked) {
		border: 2px solid var(--c-primary);
	}
	.swatch {
		display: inline-grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 2px solid;
		border-radius: var(--radius);
		font-weight: 700;
		font-family: var(--font-head);
		flex: none;
	}
	.cols {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0 1.5rem;
	}
</style>

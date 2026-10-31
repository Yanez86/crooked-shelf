<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { getT } from '#lib/i18n/index.ts';
	import { THEMES } from '#lib/themes.ts';
	import FormError from '#lib/components/FormError.svelte';
	import FormOk from '#lib/components/FormOk.svelte';
	import UserIcon from '#lib/components/UserIcon.svelte';
	import { PAGE_ICONS } from '#lib/pageIcons.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const t = getT();
	const user = $derived(page.data.user);
	const msg = (s: string) => (form?.section === s ? form : null);
	const swatch = (id: string) => [...THEMES, ...data.custom].find((th) => th.id === id)?.colors;
	const themeIds = $derived([...data.options.theme, ...data.custom.map((c) => c.id)]);
	const themeName = (id: string) => data.custom.find((c) => c.id === id)?.name ?? t('themes.' + id);
</script>

<svelte:head><title>{user ? t('profile.title') : t('prefs.title')} · {page.data.siteName}</title></svelte:head>

<!-- Per chi non ha fatto l'accesso ci sono solo le preferenze, salvate nel browser. -->
<div class="center-column">
	<h1>{user ? t('profile.title') : t('prefs.title')}</h1>
	{#if user}
		<div class="card who">
			<UserIcon icon={user.icon} size="4.5rem" />
			<div>
				<p class="name">{user.displayName}</p>
				<p class="muted"><span class="badge">{t('roles.' + user.role)}</span> @{user.username}</p>
				<p class="hint">{t('roles.' + user.role + 'Hint')}</p>
			</div>
		</div>
	{/if}
	<p>{user ? t('prefs.introUser') : t('prefs.introGuest')}</p>

	<section aria-labelledby="read-title">
		<h2 id="read-title">{t('prefs.reading')}</h2>
		<FormError error={msg('prefs')?.error} />
		<FormOk message={msg('prefs')?.ok} />
		<form method="post" action="?/prefs" class="card" use:enhance={() => async ({ update }) => update({ reset: false })}>
			<fieldset>
				<legend>{t('prefs.theme')}</legend>
				<div class="themes">
					{#each themeIds as th (th)}
						{@const c = swatch(th)}
						<label class="choice theme-choice">
							<input type="radio" name="theme" value={th} checked={data.current.theme === th} />
							<span class="swatch" aria-hidden="true" style={c ? `background:${c.bg};color:${c.text};border-color:${c.control}` : ''}>
								{#if c}<span style="color:{c.link}">Aa</span>{:else}<Icon name="contrast" />{/if}
							</span>
							<span>{themeName(th)}</span>
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
					<label for="tree">{t('prefs.tree')}</label>
					<select id="tree" name="tree" aria-describedby="tree-hint">
						{#each data.options.tree as s (s)}<option value={s} selected={data.current.tree === s}>{t('treePref.' + s)}</option>{/each}
					</select>
					<span id="tree-hint" class="hint">{t('prefs.treeHint')}</span>
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
			<form method="post" action="?/profile" class="card" use:enhance={() => async ({ update }) => update({ reset: false })}>
				<fieldset>
					<legend>{t('profile.icon')}</legend>
					<p class="hint">{t('profile.iconHint')}</p>
					<div class="icons">
						{#each Object.entries(PAGE_ICONS) as [name, d] (name)}
							<label class="icon-choice" title={t(`page.icons.${name}`)}>
								<input type="radio" name="icon" value={name} checked={(user.icon ?? 'person') === name} />
								<svg viewBox="0 0 24 24" aria-hidden="true"><path {d} /></svg><span class="visually-hidden">{t(`page.icons.${name}`)}</span>
							</label>
						{/each}
					</div>
				</fieldset>
				<div class="cols">
					<div class="field">
						<label for="displayName">{t('auth.displayName')}</label>
						<input id="displayName" name="displayName" type="text" required maxlength="60" value={user.displayName} />
					</div>
				</div>
				<button class="btn btn-primary" type="submit">{t('common.save')}</button>
			</form>
		</section>

		<section aria-labelledby="pw-title">
			<h2 id="pw-title">{t('prefs.password')}</h2>
			<FormError error={msg('password')?.error} />
			<FormOk message={msg('password')?.ok} />
			<form method="post" action="?/password" class="card">
				<div class="cols">
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
				</div>
				<button class="btn btn-primary" type="submit">{t('prefs.changePassword')}</button>
			</form>
		</section>
	{/if}
</div>

<style>
	.who {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.who p {
		margin: 0.15rem 0;
	}
	.who .name {
		font-family: var(--font-head);
		font-size: var(--fs-xl);
		font-weight: 700;
	}
	.icons {
		display: grid;
		grid-template-columns: repeat(auto-fill, 2.75rem);
		gap: 0.35rem;
	}
	/* Come la scelta dell'icona della pagina. */
	.icon-choice {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.icon-choice svg {
		width: 1.4rem;
		height: 1.4rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.icon-choice input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	.icon-choice:hover {
		background: var(--c-surface2);
	}
	.icon-choice:has(input:checked) {
		border-color: var(--c-primary);
		box-shadow: inset 0 0 0 1px var(--c-primary);
		background: var(--c-surface2);
		color: var(--c-primary);
	}
	.icon-choice:has(input:focus-visible) {
		outline: 2px solid var(--c-primary);
		outline-offset: 2px;
	}
	.themes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
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
		grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
		gap: 0 1.5rem;
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import type { Role } from '../roles.ts';
	import UserIcon from './UserIcon.svelte';
	import { iconPath } from '../icons.ts';

	let { user }: { user: { username: string; displayName: string; role: Role; icon: string | null } | null } = $props();
	const t = getT();

	// <details>: si apre anche senza JavaScript. Con JavaScript si chiude da solo: lo stato è quello di <details>,
	// che cambia subito al clic (l'evento toggle arriva dopo).
	let root = $state<HTMLDetailsElement>();
	const current = (href: string) => (page.url.pathname === href ? 'page' : undefined);

	// Le sezioni della wiki che non sono pagine (le pagine di ogni tipo, le cartelle e le risorse stanno nella barra a sinistra).
	// Le icone sono disegni a tratto come quelli delle pagine.
	const SECTIONS = [
		{ href: '/wiki', key: 'nav.pages', icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
		{ href: '/tags', key: 'nav.tags', icon: 'M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01' },
		{ href: '/gallery', key: 'nav.gallery', icon: 'M3.75 4.75h16.5v14.5H3.75zM3.75 16l5-5 4 4 2.5-2.5 5 5M17 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z' },
		{ href: '/rules', key: 'nav.rules', icon: 'M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5v13' },
		{ href: '/calendar', key: 'calendar.title', icon: 'M4 5.5h16v15H4zM4 10h16M8.5 3v4M15.5 3v4' },
		{ href: '/categories', key: 'nav.folders', master: true, icon: iconPath('folder') },
		{ href: '/trash', key: 'trash.title', user: true, icon: 'M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6' }
	];
	const isMaster = $derived(user?.role === 'admin' || user?.role === 'master');

	function close(focus = false) {
		if (!root?.open) return;
		root.open = false;
		if (focus) root.querySelector('summary')?.focus();
	}

	$effect(() => {
		page.url.pathname;
		close();
	});
</script>

<svelte:window onclick={(e) => !root?.contains(e.target as Node) && close()} onkeydown={(e) => e.key === 'Escape' && close(true)} />

<details class="user-menu" bind:this={root}>
	<summary>
		<UserIcon icon={user?.icon} />
		<span class="who">
			<span class="visually-hidden">{t('profile.title')}:</span>
			<span class="name">{user ? user.displayName : t('profile.guest')}</span>
			{#if user}<span class="role">{t('roles.' + user.role)}</span>{/if}
		</span>
	</summary>
	<div class="panel">
		{#if user}
			<!-- Sul telefono nome e grado non stanno accanto all'icona: si leggono qui. -->
			<p class="head"><strong>{user.displayName}</strong> · {t('roles.' + user.role)}<br /><span>@{user.username}</span></p>
		{/if}
		<nav aria-label={t('nav.main')}>
			<ul class="list-plain sections">
				{#each SECTIONS.filter((x) => (!x.user || user) && (!x.master || isMaster)) as x (x.href)}
					<li>
						<a href={x.href} aria-current={current(x.href)}>
							<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d={x.icon} /></svg>
							{t(x.key)}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<ul class="list-plain account">
			<li><a href="/profile" aria-current={current('/profile')}>{user ? t('profile.title') : t('nav.preferences')}</a></li>
			{#if user?.role === 'admin'}
				<li><a href="/admin" aria-current={current('/admin')}>{t('nav.admin')}</a></li>
			{/if}
			{#if user}
				<li>
					<form method="post" action="/logout">
						<button type="submit">{t('nav.logout')}<span class="visually-hidden"> ({user.displayName})</span></button>
					</form>
				</li>
			{:else}
				<li><a href="/login">{t('nav.login')}</a></li>
			{/if}
		</ul>
	</div>
</details>

<style>
	.user-menu {
		position: relative;
		flex: none;
	}
	summary {
		list-style: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0.2rem 0.6rem 0.2rem 0.25rem;
		border: 1px solid transparent;
		border-radius: var(--radius);
		cursor: pointer;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover,
	.user-menu[open] summary {
		border-color: var(--c-border);
		background: var(--c-surface2);
	}
	.who {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		max-width: 12rem;
	}
	.name {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.role {
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	.panel {
		position: absolute;
		z-index: 30;
		top: calc(100% + 0.35rem);
		right: 0;
		min-width: 14rem;
		padding: 0.35rem;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		box-shadow: 0 6px 18px rgb(0 0 0 / 0.2);
	}
	.head {
		display: none;
		margin: 0;
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid var(--c-border);
	}
	.head span {
		font-size: var(--fs-sm);
		color: var(--c-muted);
	}
	.panel a,
	.panel button {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 2.75rem;
		padding: 0 0.6rem;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--c-text);
		font: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.panel a:hover,
	.panel button:hover {
		background: var(--c-surface2);
	}
	.sections {
		margin-bottom: 0.35rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--c-border);
	}
	.sections a {
		gap: 0.6rem;
	}
	.ico {
		flex: none;
		width: 1.15rem;
		height: 1.15rem;
		color: var(--c-muted);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.panel a[aria-current='page'] {
		font-weight: 700;
		box-shadow: inset 3px 0 0 var(--c-primary);
	}
	.panel form {
		margin: 0;
	}
	/* Telefono: in alto resta solo l'icona; nome e grado nel pannello. */
	@media (max-width: 48rem) {
		summary {
			padding: 0.2rem;
		}
		.who {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
		.head {
			display: block;
		}
	}
</style>

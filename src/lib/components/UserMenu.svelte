<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import type { Role } from '../roles.ts';
	import UserIcon from './UserIcon.svelte';
	import PanelDialog from './PanelDialog.svelte';

	interface Campaign {
		id: number;
		name: string;
	}

	let {
		user,
		campaign,
		campaigns
	}: { user: { username: string; displayName: string; role: Role; icon: string | null } | null; campaign: Campaign | null; campaigns: Campaign[] } = $props();
	const t = getT();

	// <details>: si apre anche senza JavaScript. Con JavaScript si chiude da solo: lo stato è quello di <details>,
	// che cambia subito al clic (l'evento toggle arriva dopo).
	let root = $state<HTMLDetailsElement>();
	const current = (href: string) => (page.url.pathname === href ? 'page' : undefined);

	function close(focus = false) {
		if (!root?.open) return;
		root.open = false;
		if (focus) root.querySelector('summary')?.focus();
	}

	let panel = $state<{ href: string; title: string } | null>(null);

	function openPanel(e: MouseEvent, href: string, title: string) {
		// Ctrl+clic e simili: la pagina intera, in un'altra scheda.
		if (e.ctrlKey || e.metaKey || e.shiftKey) return;
		e.preventDefault();
		close(true);
		panel = { href, title };
	}

	// Solo quando si cambia pagina: page.url si rinnova anche quando si ricaricano i dati, e chiuderebbe il popup appena aperto.
	const path = $derived(page.url.pathname);
	$effect(() => {
		path;
		close();
		panel = null;
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
		{#if campaigns.length > 1}
			<ul class="list-plain campaigns" aria-label={t('campaign.switch')}>
				{#each campaigns as c (c.id)}
					<li>
						<form method="post" action="/campaign?/switch">
							<input type="hidden" name="id" value={c.id} />
							<button type="submit" aria-current={c.id === campaign?.id ? 'true' : undefined}>{c.name}</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
		<ul class="list-plain account">
			<li>
				<a href="/profile" aria-current={current('/profile')} onclick={(e) => openPanel(e, '/profile', user ? t('profile.title') : t('nav.preferences'))}>
					{user ? t('profile.title') : t('nav.preferences')}
				</a>
			</li>
			{#if campaign && (user?.role === 'master' || user?.role === 'admin')}
				<li><a href="/campaign" aria-current={current('/campaign')} onclick={(e) => openPanel(e, '/campaign', t('campaign.title'))}>{t('campaign.title')}</a></li>
			{/if}
			{#if user?.role === 'admin'}
				<li><a href="/admin" aria-current={current('/admin')} onclick={(e) => openPanel(e, '/admin', t('nav.admin'))}>{t('nav.admin')}</a></li>
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

{#if panel}<PanelDialog {...panel} onclose={() => (panel = null)} />{/if}

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
	.campaigns {
		padding-bottom: 0.35rem;
		margin-bottom: 0.35rem;
		border-bottom: 1px solid var(--c-border);
	}
	.panel button[aria-current] {
		font-weight: 700;
		box-shadow: inset 3px 0 0 var(--c-primary);
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

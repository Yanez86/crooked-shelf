<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const t = getT();

	// Sul telefono le linguette scorrono in orizzontale: quella aperta resta in vista.
	let tabs = $state<HTMLUListElement>();
	$effect(() => {
		page.url.pathname;
		const a = tabs?.querySelector<HTMLElement>('[aria-current]');
		if (tabs && a) tabs.scrollLeft = a.offsetLeft - (tabs.clientWidth - a.offsetWidth) / 2;
	});
	const links = [
		['/admin', 'admin.settings'],
		['/admin/campaigns', 'admin.campaigns'],
		['/admin/users', 'admin.users'],
		['/admin/invites', 'admin.invites'],
		['/admin/themes', 'admin.themes'],
		['/admin/plugins', 'admin.plugins'],
		['/admin/backup', 'admin.backup'],
		['/admin/world', 'admin.world'],
		['/admin/export', 'admin.export']
	];
</script>

<div class="center-column">
	<h1>{t('nav.admin')}</h1>
	<nav aria-label={t('nav.admin')} class="subnav">
		<ul class="list-plain" bind:this={tabs}>
			{#each links as [href, key] (href)}
				<li><a {href} aria-current={page.url.pathname === href || (href !== '/admin' && page.url.pathname.startsWith(href + '/')) ? 'page' : undefined}>{t(key)}</a></li>
			{/each}
		</ul>
	</nav>

	{@render children()}
</div>

<style>
	.subnav ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		border-bottom: 1px solid var(--c-border);
		margin-bottom: 1.5rem;
	}
	.subnav a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 0.75rem;
		text-decoration: none;
		color: var(--c-text);
		border-bottom: 3px solid transparent;
	}
	.subnav a:hover {
		background: var(--c-surface2);
	}
	.subnav a[aria-current='page'] {
		border-bottom-color: var(--c-primary);
		font-weight: 700;
	}
	/* Sul telefono una riga sola, da un bordo all'altro dello schermo. */
	@media (max-width: 48rem) {
		.subnav {
			margin-inline: calc(-1 * var(--space));
		}
		.subnav ul {
			position: relative;
			flex-wrap: nowrap;
			gap: 0;
			overflow-x: auto;
			scrollbar-width: none;
			padding-inline: calc(var(--space) - 0.75rem);
			margin-bottom: 1rem;
		}
		.subnav li {
			flex: none;
		}
	}
</style>

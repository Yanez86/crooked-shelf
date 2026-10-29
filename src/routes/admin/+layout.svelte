<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const t = getT();
	const links = [
		['/admin', 'admin.settings'],
		['/admin/users', 'admin.users'],
		['/admin/invites', 'admin.invites'],
		['/admin/themes', 'admin.themes'],
		['/admin/plugins', 'admin.plugins'],
		['/admin/backup', 'admin.backup'],
		['/admin/world', 'admin.world'],
		['/admin/export', 'admin.export']
	];
</script>

<h1>{t('nav.admin')}</h1>
<nav aria-label={t('nav.admin')} class="subnav">
	<ul class="list-plain">
		{#each links as [href, key] (href)}
			<li><a {href} aria-current={page.url.pathname === href || (href !== '/admin' && page.url.pathname.startsWith(href + '/')) ? 'page' : undefined}>{t(key)}</a></li>
		{/each}
	</ul>
</nav>

{@render children()}

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
	.subnav a[aria-current='page'] {
		border-bottom-color: var(--c-primary);
		font-weight: 700;
	}
</style>

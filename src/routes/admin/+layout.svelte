<script lang="ts">
	import { page } from '$app/state';
	import { getT } from '#lib/i18n/index.ts';
	import Tabs from '#lib/components/Tabs.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const t = getT();

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
	const path = $derived(page.url.pathname);
</script>

<div class="center-column">
	<h1>{t('nav.admin')}</h1>
	<Tabs
		label={t('nav.admin')}
		links={links.map(([href, key]) => ({ href, text: t(key), current: path === href || (href !== '/admin' && path.startsWith(href + '/')) }))}
	/>

	{@render children()}
</div>

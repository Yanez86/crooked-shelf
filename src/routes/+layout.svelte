<script lang="ts">
	import '@fontsource/atkinson-hyperlegible/400.css';
	import '@fontsource/atkinson-hyperlegible/700.css';
	import '@fontsource/opendyslexic/400.css';
	import '@fontsource/opendyslexic/700.css';
	import '#lib/styles/app.css';
	import { page } from '$app/state';
	import { setI18n, translate } from '#lib/i18n/index.ts';
	import RulePopover from '#lib/components/RulePopover.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	setI18n(() => data.locale);
	// Il layout non può leggere il contesto che crea: traduce direttamente.
	const t = (k: string, p?: Record<string, string | number>) => translate(data.locale, k, p);

	const REPO = 'https://github.com/yanez86/crooked-shelf';

	// Le preferenze cambiate senza ricaricare la pagina vanno applicate anche a <html>.
	$effect(() => {
		const el = document.documentElement;
		const p = data.prefs;
		el.lang = data.locale;
		el.dataset.theme = p.theme;
		el.dataset.font = p.font;
		el.dataset.spacing = p.spacing;
		el.dataset.motion = p.motion;
		el.style.setProperty('--font-scale', String(Number(p.fontSize) / 100));
	});

	const path = $derived(page.url.pathname);
	const current = (href: string) =>
		href === '/' ? path === '/' : path === href || path.startsWith(href + '/') ? 'page' : undefined;
	const isAdmin = $derived(data.user?.role === 'admin');
	const bare = $derived(path.startsWith('/setup') || path.startsWith('/login') || path.startsWith('/invite/'));
</script>

<svelte:head>
	{@html `<style>${data.themeCss}</style>`}
	<title>{data.siteName}</title>
</svelte:head>

<a class="skip-link" href="#main">{t('nav.skip')}</a>

<header class="site-header">
	<div class="container header-inner">
		<a class="brand" href="/">
			<img src="/favicon.svg" alt="" width="32" height="32" />
			<span>{data.siteName}</span>
		</a>

		{#if !bare}
			<form class="search" role="search" method="get" action="/search">
				<label for="site-search" class="visually-hidden">{t('search.label')}</label>
				<input
					id="site-search"
					type="search"
					name="q"
					placeholder={t('search.placeholder')}
					value={path === '/search' ? (page.url.searchParams.get('q') ?? '') : ''}
				/>
				<button class="btn" type="submit">{t('search.submit')}</button>
			</form>
		{/if}
	</div>

	{#if !bare}
		<nav class="container main-nav" aria-label={t('nav.main')}>
			<ul class="list-plain">
				<li><a href="/" aria-current={current('/')}>{t('nav.home')}</a></li>
				<li><a href="/wiki" aria-current={current('/wiki')}>{t('nav.pages')}</a></li>
				<li><a href="/categories" aria-current={current('/categories')}>{t('nav.categories')}</a></li>
				<li><a href="/tags" aria-current={current('/tags')}>{t('nav.tags')}</a></li>
				<li><a href="/maps" aria-current={current('/maps')}>{t('nav.maps')}</a></li>
				<li><a href="/timeline/world" aria-current={current('/timeline')}>{t('nav.timeline')}</a></li>
				<li><a href="/rules" aria-current={current('/rules')}>{t('nav.rules')}</a></li>
				{#if data.user}<li><a href="/boards" aria-current={current('/boards')}>{t('nav.boards')}</a></li>{/if}
				{#if data.user}
					<li><a class="nav-new" href="/wiki/new" aria-current={current('/wiki/new')}>+ {t('nav.newPage')}</a></li>
				{/if}
			</ul>
			<ul class="list-plain user-nav">
				{#if data.user}
					<li><a href="/preferences" aria-current={current('/preferences')}>{t('nav.preferences')}</a></li>
					{#if isAdmin}
						<li><a href="/admin" aria-current={current('/admin')}>{t('nav.admin')}</a></li>
					{/if}
					<li>
						<form method="post" action="/logout">
							<button class="linklike" type="submit">
								{t('nav.logout')}<span class="visually-hidden"> ({data.user.displayName})</span>
							</button>
						</form>
					</li>
				{:else}
					<li><a href="/preferences" aria-current={current('/preferences')}>{t('nav.preferences')}</a></li>
					<li><a href="/login">{t('nav.login')}</a></li>
				{/if}
			</ul>
		</nav>
	{/if}
</header>

<main id="main" tabindex="-1" class="container">
	{@render children()}
</main>

<RulePopover />

<footer class="site-footer">
	<div class="container">
		<p>
			Crooked Shelf {data.version} ·
			<a href={REPO} rel="noopener noreferrer">{t('footer.source')}</a> ·
			<a href="{REPO}/blob/main/LICENSE" rel="noopener noreferrer" hreflang="en">AGPL-3.0</a>
		</p>
	</div>
</footer>

<style>
	.site-header {
		background: var(--c-surface);
		border-bottom: 1px solid var(--c-border);
		margin-bottom: 1.5rem;
	}
	.header-inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.5rem;
		padding-top: 0.75rem;
		padding-bottom: 0.75rem;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-family: var(--font-head);
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--c-text);
		text-decoration: none;
	}
	.search {
		display: flex;
		gap: 0.4rem;
		flex: 1 1 18rem;
		max-width: 32rem;
	}
	.search input {
		flex: 1;
		min-width: 0;
	}
	.main-nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.25rem 1rem;
		padding-bottom: 0.25rem;
	}
	.main-nav ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.1rem 0.25rem;
	}
	.main-nav a,
	.linklike {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 0.6rem;
		color: var(--c-text);
		text-decoration: none;
		border-bottom: 3px solid transparent;
		font: inherit;
		background: none;
		border-top: 0;
		border-left: 0;
		border-right: 0;
		cursor: pointer;
	}
	.main-nav a:hover,
	.linklike:hover {
		border-bottom-color: var(--c-control);
	}
	.main-nav a[aria-current='page'] {
		border-bottom-color: var(--c-primary);
		font-weight: 700;
	}
	.nav-new {
		color: var(--c-primary) !important;
		font-weight: 700;
	}
	main {
		min-height: 60vh;
		padding-bottom: 3rem;
	}
	main:focus {
		outline: none;
	}
	.site-footer {
		border-top: 1px solid var(--c-border);
		color: var(--c-muted);
		font-size: 0.9rem;
		padding: 1rem 0;
	}
</style>

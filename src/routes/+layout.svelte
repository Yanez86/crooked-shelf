<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/archivo/wdth.css';
	import '@fontsource/atkinson-hyperlegible/400.css';
	import '@fontsource/atkinson-hyperlegible/700.css';
	import '@fontsource/opendyslexic/400.css';
	import '@fontsource/opendyslexic/700.css';
	import '#lib/styles/app.css';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { registerLocale, setI18n, translate } from '#lib/i18n/index.ts';
	import RulePopover from '#lib/components/RulePopover.svelte';
	import LinkPreview from '#lib/components/LinkPreview.svelte';
	import PageTree from '#lib/components/PageTree.svelte';
	import UserMenu from '#lib/components/UserMenu.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { iconCss } from '#lib/icons.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Traduzioni dei plugin: subito (anche sul server) e di nuovo se cambia la lingua.
	untrack(() => registerLocale(data.locale, data.localeExtra));
	$effect.pre(() => registerLocale(data.locale, data.localeExtra));
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
	const bare = $derived(path.startsWith('/setup') || path.startsWith('/login') || path.startsWith('/invite/'));
	// Profilo e Amministrazione senza albero; intestazione e piè di pagina restano larghi come altrove.
	const treeless = $derived(['/profile', '/admin'].some((p) => path === p || path.startsWith(p + '/')));
	const wide = $derived(!bare && !!data.tree);
	const tree = $derived(wide && !treeless ? data.tree : null);

	// Sul telefono la navigazione sta dietro il pulsante Menu e l'albero in un pannello a scomparsa;
	// si richiudono a ogni cambio di pagina.
	let menuOpen = $state(false);
	let treeOpen = $state(false);
	$effect(() => {
		path;
		menuOpen = false;
		treeOpen = false;
	});
</script>

<svelte:head>
	{@html `<style>${data.themeCss}
${iconCss()}</style>`}
	<title>{data.siteName}</title>
</svelte:head>

<a class="skip-link" href="#main">{t('nav.skip')}</a>

<header class="site-header">
	<div class="container header-inner" class:wide class:bare>
		{#if tree}
			<button
				id="tree-toggle"
				class="btn tree-toggle"
				type="button"
				aria-expanded={treeOpen}
				aria-controls="explorer"
				aria-label={t('tree.title')}
				title={t('tree.title')}
				onclick={() => {
					treeOpen = !treeOpen;
					menuOpen = false;
				}}
			>
				<Icon name="panel" />
			</button>
		{/if}
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
			<button
				class="btn menu-toggle"
				type="button"
				aria-expanded={menuOpen}
				aria-controls="main-nav"
				onclick={() => {
					menuOpen = !menuOpen;
					treeOpen = false;
				}}
			>
				<Icon name={menuOpen ? 'close' : 'menu'} />
				{t('nav.menu')}
			</button>
			<!-- Profilo in alto a destra: icona, nome e grado. -->
			<UserMenu user={data.user} />
		{/if}
	</div>

	{#if !bare}
		<nav id="main-nav" class="container main-nav" class:wide class:open={menuOpen} aria-label={t('nav.main')}>
			<ul class="list-plain">
				<li><a href="/" aria-current={current('/')}>{t('nav.home')}</a></li>
				<li><a href="/wiki" aria-current={current('/wiki')}>{t('nav.pages')}</a></li>
				<li><a href="/categories" aria-current={current('/categories')}>{t('nav.categories')}</a></li>
				<li><a href="/tags" aria-current={current('/tags')}>{t('nav.tags')}</a></li>
				<li><a href="/maps" aria-current={current('/maps')}>{t('nav.maps')}</a></li>
				<li><a href="/gallery" aria-current={current('/gallery')}>{t('nav.gallery')}</a></li>
				<li><a href="/resources" aria-current={current('/resources')}>{t('nav.resources')}</a></li>
				<li><a href="/timeline/world" aria-current={current('/timeline')}>{t('nav.timeline')}</a></li>
				<li><a href="/rules" aria-current={current('/rules')}>{t('nav.rules')}</a></li>
				{#if data.user}<li><a href="/boards" aria-current={current('/boards')}>{t('nav.boards')}</a></li>{/if}
				{#if data.user}
					<li><a class="nav-new" href="/wiki/new" aria-current={current('/wiki/new')}><Icon name="plus" />{t('nav.newPage')}</a></li>
				{/if}
			</ul>
		</nav>
	{/if}
</header>

<div class="container shell" class:wide class:with-tree={!!tree}>
	{#if tree}<PageTree {tree} resources={data.resources ?? []} bind:open={treeOpen} />{/if}
	<main id="main" tabindex="-1">
		{@render children()}
	</main>
</div>

<RulePopover />
<LinkPreview />

<footer class="site-footer">
	<div class="container" class:wide class:bare>
		<p>
			<a href="/changelog" title={t('footer.changelog', { v: data.version })}>Crooked Shelf {data.version}</a> ·
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
		font-size: var(--fs-lg);
		font-weight: 700;
		color: var(--c-text);
		text-decoration: none;
	}
	.search {
		display: flex;
		gap: 0.4rem;
		flex: 1 1 18rem;
		max-width: 32rem;
		margin-left: auto;
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
	.main-nav a {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		min-height: 2.75rem;
		padding: 0 0.6rem;
		color: var(--c-text);
		text-decoration: none;
		border-bottom: 3px solid transparent;
	}
	.main-nav a:hover {
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
	.menu-toggle,
	.tree-toggle {
		display: none;
	}
	.tree-toggle {
		width: 2.75rem;
		padding: 0;
		justify-content: center;
	}
	.tree-toggle :global(.icon) {
		width: 1.4rem;
		height: 1.4rem;
	}
	/* Accesso, prima configurazione e invito: tutto al centro, come il modulo. */
	.header-inner.bare {
		justify-content: center;
	}
	.site-footer .bare {
		text-align: center;
	}
	/* Telefono: marchio e Menu sulla prima riga, ricerca sotto, navigazione chiusa. */
	@media (max-width: 48rem) {
		.header-inner {
			gap: 0.5rem;
		}
		.brand {
			flex: 1;
			min-width: 0;
		}
		.brand span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.menu-toggle {
			display: inline-flex;
		}
		.search {
			order: 3;
			flex-basis: 100%;
			max-width: none;
		}
		.main-nav:not(.open) {
			display: none;
		}
		.main-nav {
			flex-direction: column;
			padding-bottom: 0.5rem;
		}
		.main-nav ul {
			flex-direction: column;
		}
		.main-nav a {
			width: 100%;
			border-bottom: 0;
			border-left: 3px solid transparent;
		}
		.main-nav a[aria-current='page'] {
			border-left-color: var(--c-primary);
		}
	}
	/* Albero a sinistra, pagina a destra. */
	.shell.with-tree {
		display: grid;
		grid-template-columns: 17rem minmax(0, 1fr);
		align-items: start;
		gap: 0 2rem;
	}
	@media (max-width: 60rem) {
		.tree-toggle {
			display: inline-flex;
		}
		/* Pulsante dell'albero e nome della wiki a sinistra, ricerca a destra. */
		.brand {
			margin-right: auto;
		}
		.shell.with-tree {
			grid-template-columns: minmax(0, 1fr);
			gap: 1rem;
		}
	}
	main {
		min-width: 0;
		min-height: 60vh;
		padding-bottom: 3rem;
		/* Le pagine si adattano allo spazio che resta accanto all'albero. */
		container-type: inline-size;
	}
	main:focus {
		outline: none;
	}
	.site-footer {
		border-top: 1px solid var(--c-border);
		color: var(--c-muted);
		font-size: var(--fs-sm);
		padding: 1rem 0;
	}
</style>

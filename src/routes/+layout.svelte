<script lang="ts">
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
	const bare = $derived(path.startsWith('/setup') || path.startsWith('/login') || path.startsWith('/invite/'));
	// La barra a sinistra è tutta la navigazione: pagine di ogni tipo, risorse e sezioni della wiki.
	// Di base sta aperta accanto alla pagina; chiusa (si apre col pulsante) se lo chiede il profilo,
	// nelle pagine Profilo e Amministrazione e sul telefono.
	const treeless = $derived(['/profile', '/admin'].some((p) => path === p || path.startsWith(p + '/')));
	const wide = $derived(!bare && !!data.tree);
	const tree = $derived(wide ? data.tree : null);
	const docked = $derived(!!tree && data.prefs.tree === 'show' && !treeless);

	let treeOpen = $state(false);
	$effect(() => {
		path;
		treeOpen = false;
	});
</script>

<svelte:head>
	{@html `<style>${data.themeCss}</style>`}
	<title>{data.siteName}</title>
</svelte:head>

<a class="skip-link" href="#main">{t('nav.skip')}</a>

<header class="site-header">
	<div class="container header-inner" class:wide class:bare>
		{#if tree}
			<button
				id="tree-toggle"
				class="btn tree-toggle"
				class:undocked={!docked}
				type="button"
				aria-expanded={treeOpen}
				aria-controls="explorer"
				aria-label={t('tree.title')}
				title={t('tree.title')}
				onclick={() => (treeOpen = !treeOpen)}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.75 4.75h16.5v14.5H3.75zM9.5 4.75v14.5M5.75 8.5h1.75M5.75 11.5h1.75" /></svg>
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
			<!-- Profilo in alto a destra: icona, nome e grado. -->
			<UserMenu user={data.user} />
		{/if}
	</div>
</header>

<div class="container shell" class:wide class:with-tree={docked}>
	{#if tree}<PageTree {tree} resources={data.resources ?? []} {docked} bind:open={treeOpen} />{/if}
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
	.tree-toggle {
		display: none;
	}
	/* Barra chiusa: il pulsante c'è anche sullo schermo grande. */
	.tree-toggle.undocked {
		display: inline-flex;
	}
	.tree-toggle {
		width: 2.75rem;
		padding: 0;
		justify-content: center;
	}
	.tree-toggle svg {
		width: 1.4rem;
		height: 1.4rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* Accesso, prima configurazione e invito: tutto al centro, come il modulo. */
	.header-inner.bare {
		justify-content: center;
	}
	.site-footer .bare {
		text-align: center;
	}
	/* Telefono: pulsante della barra, marchio e profilo sulla prima riga, ricerca sotto. */
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
		.search {
			order: 3;
			flex-basis: 100%;
			max-width: none;
		}
	}
	/* Albero a sinistra, pagina a destra. */
	.shell.with-tree {
		display: grid;
		grid-template-columns: 17rem minmax(0, 1fr);
		align-items: start;
		gap: 0 2rem;
	}
	/* Pulsante della barra e nome della wiki a sinistra, ricerca a destra. */
	.undocked + .brand {
		margin-right: auto;
	}
	@media (max-width: 60rem) {
		.tree-toggle {
			display: inline-flex;
		}
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

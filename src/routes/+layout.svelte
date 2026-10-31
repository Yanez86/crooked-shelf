<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource-variable/archivo/wdth.css';
	import '@fontsource/atkinson-hyperlegible/400.css';
	import '@fontsource/atkinson-hyperlegible/700.css';
	import '@fontsource/opendyslexic/400.css';
	import '@fontsource/opendyslexic/700.css';
	import '#lib/styles/app.css';
	import { page } from '$app/state';
	import { tick, untrack } from 'svelte';
	import { registerLocale, setI18n, translate } from '#lib/i18n/index.ts';
	import { TREE_COOKIE } from '#lib/prefs.ts';
	import RulePopover from '#lib/components/RulePopover.svelte';
	import LinkPreview from '#lib/components/LinkPreview.svelte';
	import PanelDialog from '#lib/components/PanelDialog.svelte';
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
	const bare = $derived(path.startsWith('/setup') || path.startsWith('/login') || path.startsWith('/invite/'));
	// La barra a sinistra è tutta la navigazione: pagine di ogni tipo, risorse e sezioni della wiki.
	// Di base sta aperta accanto alla pagina; chiusa (si apre col pulsante) se lo chiede il profilo,
	// in Amministrazione e sul telefono. La freccia la nasconde e la riporta accanto alla pagina.
	// Nel Profilo parte nascosta a ogni visita: lì la freccia vale per la visita e non tocca la scelta delle altre pagine.
	const treeless = $derived(path === '/admin' || path.startsWith('/admin/'));
	const onProfile = $derived(path === '/profile');
	// Dentro il popup di Profilo e Amministrazione (PanelDialog) c'è solo la pagina. Il server lo sa solo alla prima richiesta, il browser sempre.
	const framed = typeof window === 'undefined' ? untrack(() => data.framed) : window.self !== window.top;
	const wide = $derived(!bare && !framed && !!data.tree);
	const tree = $derived(wide ? data.tree : null);
	const beside = $derived(!!tree && data.prefs.tree === 'show' && !treeless);
	let treeHidden = $state(untrack(() => data.treeHidden));
	let profileTree = $state(false);
	const hiddenHere = $derived(onProfile ? !profileTree : treeHidden);
	const docked = $derived(beside && !hiddenHere);
	const collapsed = $derived(beside && hiddenHere);

	let treeOpen = $state(false);
	$effect(() => {
		path;
		treeOpen = false;
		profileTree = false;
	});

	// Il fuoco passa alla freccia opposta: quella appena premuta non c'è più.
	async function hideTree(hidden: boolean) {
		if (onProfile) profileTree = !hidden;
		else {
			treeHidden = hidden;
			document.cookie = `${TREE_COOKIE}=${hidden ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
		}
		await tick();
		document.getElementById(hidden ? 'tree-show' : 'tree-hide')?.focus();
	}

	// I collegamenti tra le pagine si aprono in un popup. Dentro il popup si naviga e basta; Ctrl e Cmd aprono come sempre una nuova scheda.
	let linked = $state<{ href: string; title: string } | null>(null);
	function openLinked(e: MouseEvent) {
		if (framed || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
		// [data-wikilink] è il collegamento nell'editor, .missing porta a creare la pagina.
		const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.wikilink:not(.missing, [data-wikilink])');
		if (!a) return;
		e.preventDefault();
		linked = { href: a.href, title: a.dataset.title ?? a.innerText };
	}

	// Il browser mostra il contorno del fuoco anche col mouse, quando il fuoco si sposta da codice o finisce in un campo. Tab lo riporta.
	const pointer = (on: boolean) => document.documentElement.toggleAttribute('data-pointer', on);
</script>

<svelte:document
	onclickcapture={openLinked}
	onpointerdowncapture={() => pointer(true)}
	onkeydowncapture={(e) => e.key === 'Tab' && pointer(false)}
/>

<svelte:head>
	{@html `<style>${data.themeCss}
${iconCss()}</style>`}
	<title>{data.campaign?.name ?? data.siteName}</title>
</svelte:head>

{#if !framed}
	<div class="backdrop"></div>
	<a class="skip-link" href="#main">{t('nav.skip')}</a>

	<header class="site-header">
		<div class="container header-inner" class:wide class:bare>
			{#if tree}
				<button
					id="tree-toggle"
					class="btn tree-toggle"
					class:undocked={!docked && !collapsed}
					type="button"
					aria-expanded={treeOpen}
					aria-controls="explorer"
					aria-label={t('tree.title')}
					title={t('tree.title')}
					onclick={() => (treeOpen = !treeOpen)}
				>
					<Icon name="panel" />
				</button>
			{/if}
			<a class="brand" href="/">
				<img src="/favicon.svg" alt="" width="32" height="32" />
				<span>{data.campaign?.name ?? data.siteName}</span>
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
				<UserMenu user={data.user} campaign={data.campaign} campaigns={data.campaigns} />
			{/if}
		</div>
	</header>
{/if}

<div class="container shell" class:wide class:with-tree={docked} class:collapsed class:framed>
	{#if tree}<PageTree {tree} resources={data.resources ?? []} {docked} bind:open={treeOpen} onhide={() => hideTree(true)} />{/if}
	{#if collapsed}
		<button id="tree-show" class="btn tree-show" type="button" title={t('tree.show')} aria-label={t('tree.show')} onclick={() => hideTree(false)}>
			<Icon name="arrowRight" />
		</button>
	{/if}
	<main id="main" tabindex="-1">
		<div class="column" class:panel={wide}>
			{@render children()}
		</div>
	</main>
</div>

<RulePopover />
<LinkPreview />
{#if linked}<PanelDialog {...linked} expandable onclose={() => (linked = null)} />{/if}

{#if !framed}
	<footer class="site-footer">
		<div class="container" class:wide class:bare>
			<p>
				<a href="/changelog" title={t('footer.changelog', { v: data.version })}>Crooked Shelf {data.version}</a> ·
				<a href={REPO} rel="noopener noreferrer">{t('footer.source')}</a> ·
				<a href="{REPO}/blob/main/LICENSE" rel="noopener noreferrer" hreflang="en">AGPL-3.0</a>
			</p>
		</div>
	</footer>
{/if}

<style>
	/* Sfondo del tema, fermo mentre la pagina scorre. Solo se la pagina ha i suoi riquadri (vedi .column.panel): senza, il testo starebbe sull'immagine. */
	@media (min-width: 70rem) {
		.backdrop {
			position: fixed;
			inset: 0;
			z-index: -1;
			background: var(--bg-image, none) center / cover no-repeat;
		}
	}
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
	/* Nel popup il titolo sta nella barra della finestra. */
	.shell.framed {
		padding-top: 1rem;
	}
	.shell.framed :global(.center-column > h1) {
		display: none;
	}
	/* Albero a sinistra, pagina a destra. L'albero è largo come la colonna a destra. */
	.shell.with-tree {
		display: grid;
		grid-template-columns: var(--side-col) minmax(0, 1fr);
		align-items: start;
		gap: 0 2rem;
	}
	/* Barra nascosta con la freccia: al suo posto resta solo la freccia per riaprirla. */
	.shell.collapsed {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 0 1rem;
	}
	.tree-show {
		position: sticky;
		top: 1rem;
		padding: 0;
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
		.shell.with-tree,
		.shell.collapsed {
			grid-template-columns: minmax(0, 1fr);
			gap: 1rem;
		}
		.tree-show {
			display: none;
		}
	}
	main {
		min-width: 0;
		margin-bottom: 3rem;
		/* Le pagine si adattano allo spazio che resta accanto all'albero. */
		container-type: inline-size;
	}
	.column {
		min-height: 60vh;
	}
	/* Con la colonna a destra il riquadro sta attorno al solo testo: qui conterrebbe anche lei. */
	.column:has(:global(.with-side)) {
		background: none;
		border: 0;
		padding: 0;
	}
	/* Nello spazio stretto (telefono) niente riquadro: lo spazio serve al testo. Il colore dello sfondo resta: col testo al 200% capita anche sugli schermi larghi, sopra l'immagine del tema. */
	@container (max-width: 44rem) {
		.column.panel {
			background: var(--c-bg);
			border: 0;
			padding: 0;
		}
	}
	main:focus {
		outline: none;
	}
	.site-footer {
		background: var(--c-bg);
		border-top: 1px solid var(--c-border);
		color: var(--c-muted);
		font-size: var(--fs-sm);
		padding: 1rem 0;
	}
</style>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import { isMaster } from '../access.ts';
	import { PAGE_ICONS } from '../pageIcons.ts';
	import { treePaths, type Tree, type TreeFolder, type TreePage } from '../tree.ts';
	import { RESOURCE_KINDS, type ResourceItem, type ResourceKind } from '../resources.ts';

	// `open`: sul telefono l'albero è un pannello a scomparsa, aperto dal pulsante in alto (nel layout).
	let { tree, resources, open: shown = $bindable(false) }: { tree: Tree; resources: ResourceItem[]; open?: boolean } = $props();
	const t = getT();
	const canManage = $derived(isMaster(page.data.user));

	// Cartelle aperte: quelle che portano alla pagina che stai leggendo, più quelle che hai aperto tu
	// (ricordate in questo browser).
	const STORE = 'cs-tree-open';
	const paths = $derived(treePaths(tree));
	const path = $derived(page.url.pathname);
	const current = $derived.by(() => {
		const m = /^\/wiki\/([^/]+)/.exec(path);
		try {
			return m ? decodeURIComponent(m[1]) : null;
		} catch {
			return null;
		}
	});
	const toOpen = $derived([
		...((current && paths.pages.get(current)) || []),
		...((path === '/wiki' && paths.folders.get(page.url.searchParams.get('category') ?? '')) || [])
	]);

	const open = new SvelteSet<number>(untrack(() => toOpen));
	$effect(() => {
		const ids = toOpen;
		untrack(() => ids.forEach((id) => open.add(id)));
	});

	// Due linguette: le pagine con le loro cartelle, e le risorse (immagini, audio, altri file).
	// Si apre quella di ciò che stai guardando; altrove resta l'ultima scelta, ricordata in questo browser.
	type Tab = 'pages' | 'resources';
	const TABS: Tab[] = ['pages', 'resources'];
	const TAB_STORE = 'cs-tree-tab';
	const tabFor = (p: string): Tab | null => (p.startsWith('/resources') ? 'resources' : p.startsWith('/wiki') ? 'pages' : null);
	let tab = $state<Tab>(untrack(() => tabFor(page.url.pathname)) ?? 'pages');
	$effect(() => {
		const want = tabFor(path);
		if (want) tab = want;
	});

	// Risorse divise per tipo; i gruppi sono aperti finché non li chiudi.
	const RES_STORE = 'cs-tree-res-closed';
	const groups = $derived(
		RESOURCE_KINDS.map((kind) => ({ kind, items: resources.filter((r) => r.kind === kind) })).filter((g) => g.items.length)
	);
	const closed = new SvelteSet<string>();
	const currentRes = $derived(Number(/^\/resources\/(\d+)(?:\/|$)/.exec(path)?.[1]));

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORE) ?? '[]');
			if (Array.isArray(saved)) for (const id of saved) if (Number.isInteger(id)) open.add(id);
			const shut = JSON.parse(localStorage.getItem(RES_STORE) ?? '[]');
			if (Array.isArray(shut)) for (const k of shut) if (RESOURCE_KINDS.includes(k)) closed.add(k);
			const last = localStorage.getItem(TAB_STORE);
			if (!tabFor(path) && (last === 'pages' || last === 'resources')) tab = last;
		} catch {
			/* memoria del browser non disponibile */
		}
	});

	function selectTab(id: Tab, focus = false) {
		tab = id;
		if (focus) document.getElementById(`tree-tab-${id}`)?.focus();
		remember(TAB_STORE, id);
	}

	// Frecce, Inizio e Fine passano da una linguetta all'altra.
	function tabKeys(e: KeyboardEvent) {
		const i = TABS.indexOf(tab);
		const n = TABS.length;
		const moves: Record<string, number> = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 };
		const to = moves[e.key];
		if (to === undefined) return;
		e.preventDefault();
		selectTab(TABS[to], true);
	}

	function toggled(id: number, isOpen: boolean) {
		if (isOpen === open.has(id)) return;
		if (isOpen) open.add(id);
		else open.delete(id);
		save();
	}

	function toggledKind(kind: ResourceKind, isOpen: boolean) {
		if (isOpen !== closed.has(kind)) return;
		if (isOpen) closed.delete(kind);
		else closed.add(kind);
		remember(RES_STORE, JSON.stringify([...closed]));
	}

	function setAll(isOpen: boolean) {
		if (tab === 'resources') {
			closed.clear();
			if (!isOpen) for (const g of groups) closed.add(g.kind);
			remember(RES_STORE, JSON.stringify([...closed]));
			return;
		}
		open.clear();
		if (isOpen) for (const p of paths.folders.values()) open.add(p[p.length - 1]);
		save();
	}

	function save() {
		remember(STORE, JSON.stringify([...open]));
	}

	function remember(key: string, value: string) {
		try {
			localStorage.setItem(key, value);
		} catch {
			/* memoria del browser non disponibile */
		}
	}

	// Pannello aperto: il fuoco entra sulla linguetta scelta. Esc, il pulsante Chiudi, un tocco fuori
	// o il fuoco che esce lo richiudono; con Esc e Chiudi il fuoco torna al pulsante che l'ha aperto.
	$effect(() => {
		if (shown) untrack(() => document.getElementById(`tree-tab-${tab}`)?.focus());
	});

	function close(refocus = true) {
		shown = false;
		if (refocus) document.getElementById('tree-toggle')?.focus();
	}

	function keys(e: KeyboardEvent) {
		if (shown && e.key === 'Escape') close();
	}

	function focusMoved(e: FocusEvent) {
		const to = e.target as Node;
		if (shown && !document.getElementById('explorer')?.contains(to) && !document.getElementById('tree-toggle')?.contains(to)) close(false);
	}
</script>

<svelte:window onkeydown={keys} onfocusin={focusMoved} />

{#snippet folderIcon()}
	<svg class="ico folder closed" viewBox="0 0 24 24" aria-hidden="true">
		<path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h5l2 2h9a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5z" />
	</svg>
	<svg class="ico folder opened" viewBox="0 0 24 24" aria-hidden="true">
		<path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h5l2 2h7.5A1.5 1.5 0 0 1 20 8.5V10H7.3a1.5 1.5 0 0 0-1.4 1l-2.4 7.2-1-1z" />
		<path d="M6.6 11.5h15a.8.8 0 0 1 .75 1.06l-2 5.6A1.5 1.5 0 0 1 18.95 19H3.6z" />
	</svg>
{/snippet}

{#snippet leaf(p: TreePage)}
	<li>
		<a href="/wiki/{p.slug}" aria-current={current === p.slug ? 'page' : undefined}>
			<svg class="ico doc" viewBox="0 0 24 24" aria-hidden="true">
				{#if p.icon}
					<path d={PAGE_ICONS[p.icon]} />
				{:else}
					<path d="M6 2.75h8.25L19 7.5v13.75H6z" />
					<path d="M14 2.75V7.5h5M9 12h7M9 15.5h7" />
				{/if}
			</svg>
			<span>{p.title}</span>
		</a>
	</li>
{/snippet}

{#snippet resourceLeaf(r: ResourceItem)}
	<li>
		<a href="/resources/{r.id}" aria-current={currentRes === r.id ? 'page' : undefined}>
			<svg class="ico doc" viewBox="0 0 24 24" aria-hidden="true">
				{#if r.kind === 'image'}
					<path d="M3.75 4.75h16.5v14.5H3.75zM3.75 16l5-5 4 4 2.5-2.5 5 5" />
					<path d="M17 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
				{:else if r.kind === 'audio'}
					<path d="M9 18V5.5l11-2.5v12.5" />
					<path d="M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
				{:else}
					<path d="M6 2.75h8.25L19 7.5v13.75H6z" />
					<path d="M14 2.75V7.5h5" />
				{/if}
			</svg>
			<span>{r.title}</span>
		</a>
	</li>
{/snippet}

{#snippet folder(f: TreeFolder)}
	<li>
		<details open={open.has(f.id)} ontoggle={(e) => toggled(f.id, e.currentTarget.open)}>
			<summary>
				<span class="chevron" aria-hidden="true"></span>
				{@render folderIcon()}
				<span>{f.name}</span>
			</summary>
			<ul class="list-plain level">
				{#each f.folders as sub (sub.id)}{@render folder(sub)}{/each}
				{#each f.pages as p (p.slug)}{@render leaf(p)}{/each}
				{#if !f.folders.length && !f.pages.length}<li class="none muted">{t('tree.emptyFolder')}</li>{/if}
			</ul>
		</details>
	</li>
{/snippet}

<nav id="explorer" class="explorer" class:open={shown} aria-label={t('tree.label')}>
	<div>
		<div class="explorer-head">
			<div class="tabs" role="tablist" aria-label={t('tree.tabs')}>
				{#each TABS as id (id)}
					<button
						type="button"
						role="tab"
						id="tree-tab-{id}"
						aria-selected={tab === id}
						aria-controls="tree-panel-{id}"
						tabindex={tab === id ? 0 : -1}
						onclick={() => selectTab(id)}
						onkeydown={tabKeys}
					>
						{t('tree.tab.' + id)}
					</button>
				{/each}
			</div>
			{#if tab === 'pages' ? tree.folders.length : groups.length}
				<button type="button" class="tool" title={t('tree.expandAll')} aria-label={t('tree.expandAll')} onclick={() => setAll(true)}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l5-5 5 5M7 15l5 5 5-5" /></svg>
				</button>
				<button type="button" class="tool" title={t('tree.collapseAll')} aria-label={t('tree.collapseAll')} onclick={() => setAll(false)}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l5 5 5-5M7 20l5-5 5 5" /></svg>
				</button>
			{/if}
			{#if canManage && tab === 'pages'}
				<a class="tool" href="/categories#new-cat" title={t('tree.newFolder')} aria-label={t('tree.newFolder')}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h5l2 2h9a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5zM12 10v6M9 13h6" />
					</svg>
				</a>
			{:else if canManage}
				<a class="tool" href="/resources/new" title={t('resources.new')} aria-label={t('resources.new')}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 14.5v4.75h15V14.5" /></svg>
				</a>
			{/if}
			<button type="button" class="tool close" title={t('common.close')} aria-label={t('common.close')} onclick={() => close()}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
			</button>
		</div>
		<div role="tabpanel" id="tree-panel-pages" aria-labelledby="tree-tab-pages" hidden={tab !== 'pages'}>
			{#if tree.folders.length || tree.pages.length}
				<ul class="list-plain level root">
					{#each tree.folders as f (f.id)}{@render folder(f)}{/each}
					{#each tree.pages as p (p.slug)}{@render leaf(p)}{/each}
				</ul>
			{:else}
				<p class="muted none">{t('tree.empty')}</p>
			{/if}
		</div>
		<div role="tabpanel" id="tree-panel-resources" aria-labelledby="tree-tab-resources" hidden={tab !== 'resources'}>
			{#if groups.length}
				<ul class="list-plain level root">
					{#each groups as g (g.kind)}
						<li>
							<details open={!closed.has(g.kind)} ontoggle={(e) => toggledKind(g.kind, e.currentTarget.open)}>
								<summary>
									<span class="chevron" aria-hidden="true"></span>
									{@render folderIcon()}
									<span>{t('resources.kinds.' + g.kind)}</span>
								</summary>
								<ul class="list-plain level">
									{#each g.items as r (r.id)}{@render resourceLeaf(r)}{/each}
								</ul>
							</details>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted none">{t('resources.empty')}</p>
			{/if}
		</div>
	</div>
</nav>
{#if shown}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions (da tastiera c'è Esc, o il pulsante Chiudi) -->
	<div class="backdrop" aria-hidden="true" onclick={() => close(false)}></div>
{/if}

<style>
	.explorer {
		position: sticky;
		top: 1rem;
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		font-size: var(--fs-sm);
		line-height: 1.35;
		background: var(--c-surface);
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		padding: 0.5rem 0.4rem 0.75rem;
	}
	.explorer-head {
		display: flex;
		align-items: center;
		gap: 0.1rem;
		margin: 0 0 0.35rem;
		padding: 0 0 0.2rem;
		border-bottom: 1px solid var(--c-border);
	}
	.tabs {
		flex: 1;
		display: flex;
		align-self: stretch;
		min-width: 0;
	}
	/* Linguette: quella aperta è sottolineata, come la voce del menu in alto. */
	[role='tab'] {
		min-height: 2rem;
		margin-bottom: -0.2rem;
		padding: 0 0.5rem;
		border: 0;
		border-bottom: 3px solid transparent;
		background: none;
		color: var(--c-muted);
		font: inherit;
		font-family: var(--font-head);
		font-weight: 600;
		cursor: pointer;
	}
	[role='tab']:hover {
		color: var(--c-text);
		border-bottom-color: var(--c-control);
	}
	[role='tab'][aria-selected='true'] {
		color: var(--c-text);
		font-weight: 700;
		border-bottom-color: var(--c-primary);
	}
	.tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--c-muted);
		cursor: pointer;
	}
	.tool:hover {
		background: var(--c-surface2);
		color: var(--c-text);
	}
	.tool svg {
		width: 1.15rem;
		height: 1.15rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.close,
	.backdrop {
		display: none;
	}
	.level.root {
		margin: 0;
	}
	/* Righe guida tra una cartella e il suo contenuto, come in Esplora risorse. */
	.level .level {
		margin-left: 0.95rem;
		padding-left: 0.35rem;
		border-left: 1px dotted var(--c-control);
	}
	summary,
	a {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		min-height: 1.75rem;
		padding: 0.2rem 0.4rem;
		border-radius: var(--radius);
		color: var(--c-text);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	summary {
		cursor: pointer;
		list-style: none;
		font-weight: 600;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover,
	a:hover {
		background: var(--c-surface2);
	}
	a:hover span {
		text-decoration: underline;
	}
	a[aria-current='page'] {
		background: var(--c-surface2);
		box-shadow: inset 3px 0 0 var(--c-primary);
		font-weight: 700;
	}
	.chevron {
		flex: none;
		width: 0.9rem;
		align-self: center;
		text-align: center;
		transition: transform 0.15s;
	}
	.chevron::before {
		content: '▸';
	}
	details[open] > summary > .chevron {
		transform: rotate(90deg);
	}
	.ico {
		flex: none;
		width: 1.15rem;
		height: 1.15rem;
		margin-top: 0.05rem;
	}
	.folder {
		fill: var(--c-warning-border);
	}
	.doc {
		/* Spazio della freccia delle cartelle, per allineare le pagine. */
		margin-left: 0.25rem;
		fill: none;
		stroke: var(--c-muted);
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.folder.opened,
	details[open] > summary > .folder.closed {
		display: none;
	}
	details[open] > summary > .folder.opened {
		display: block;
	}
	.none {
		margin: 0;
		padding: 0.2rem 0.4rem 0.2rem 1.6rem;
		font-style: italic;
	}
	@media (forced-colors: active) {
		.folder {
			fill: CanvasText;
		}
		a[aria-current='page'],
		[role='tab'][aria-selected='true'] {
			outline: 2px solid CanvasText;
		}
	}
	/* Sul telefono l'albero è un pannello a scomparsa: entra da sinistra sopra la pagina, senza spostarla. */
	@media (max-width: 60rem) {
		.explorer {
			position: fixed;
			inset: 0 auto 0 0;
			z-index: 30;
			width: min(20rem, 85vw);
			max-height: none;
			padding: 0.75rem 0.5rem;
			border-width: 0 1px 0 0;
			border-radius: 0;
			box-shadow: 0 0 1.5rem rgb(0 0 0 / 0.3);
			overscroll-behavior: contain;
			transform: translateX(-100%);
			visibility: hidden;
			transition:
				transform 0.2s ease,
				visibility 0s 0.2s;
		}
		.explorer.open {
			transform: none;
			visibility: visible;
			transition: transform 0.2s ease;
		}
		.close {
			display: inline-flex;
		}
		.backdrop {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 29;
			background: rgb(0 0 0 / 0.4);
		}
	}
</style>

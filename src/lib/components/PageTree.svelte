<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import { isMaster } from '../access.ts';
	import { PAGE_ICONS } from '../pageIcons.ts';
	import { iconPath } from '../icons.ts';
	import Icon from './Icon.svelte';
	import { KIND_ICONS } from '../pageKinds.ts';
	import { treePaths, type Tree, type TreeFolder, type TreePage } from '../tree.ts';
	import { RESOURCE_KINDS, type ResourceItem, type ResourceKind } from '../resources.ts';

	// La barra a sinistra: in alto «Nuova pagina», sotto l'albero delle pagine (di ogni tipo) e delle risorse.
	// Le sezioni della wiki (galleria, regole, calendario…) stanno nel menu del profilo in alto a destra.
	// `docked`: sta accanto alla pagina; altrimenti (e sempre sul telefono) è un pannello a scomparsa, aperto dal pulsante in alto.
	let {
		tree,
		resources,
		docked = true,
		open: shown = $bindable(false)
	}: { tree: Tree; resources: ResourceItem[]; docked?: boolean; open?: boolean } = $props();
	const t = getT();
	const canManage = $derived(isMaster(page.data.user));
	const user = $derived(page.data.user);

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

	// Nuova cartella: compare subito in cima all'albero col nome da scrivere, come in Esplora risorse.
	// Invio (o il fuoco che esce) la crea, Esc la lascia perdere.
	let naming = $state<string | null>(null);
	let nameError = $state(false);
	let nameInput = $state<HTMLInputElement>();

	async function newFolder() {
		selectTab('pages');
		nameError = false;
		naming = t('tree.newFolder');
		await tick();
		nameInput?.focus();
		nameInput?.select();
	}

	async function cancelFolder() {
		naming = null;
		nameError = false;
		await tick();
		document.getElementById('tree-new-folder')?.focus();
	}

	let creating = false;
	async function createFolder() {
		if (naming === null || creating) return;
		const name = naming.trim();
		if (!name) return cancelFolder();
		creating = true;
		try {
			const r = await fetch('/api/categories', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name })
			});
			const res = await r.json().catch(() => ({}));
			if (!r.ok || !res.id) throw new Error(String(r.status));
			await invalidateAll();
			naming = null;
			nameError = false;
			await tick();
			document.getElementById(`folder-${res.id}`)?.focus();
		} catch {
			nameError = true;
			nameInput?.focus();
		} finally {
			creating = false;
		}
	}

	function nameKeys(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			createFolder();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			cancelFolder();
		}
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

	// Pannello aperto: il fuoco entra sul primo collegamento (Nuova pagina, o la prima pagina). Esc, il pulsante Chiudi, un tocco fuori
	// o il fuoco che esce lo richiudono; con Esc e Chiudi il fuoco torna al pulsante che l'ha aperto.
	$effect(() => {
		if (shown) untrack(() => document.querySelector<HTMLElement>('#explorer a')?.focus());
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
	<svg class="ico folder closed" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPath('folder')} /></svg>
	<svg class="ico folder opened" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPath('folderOpen')} /></svg>
{/snippet}

{#snippet leaf(p: TreePage)}
	<li>
		<!-- Il tipo (mappa, cronologia, template) si legge anche con il lettore di schermo. -->
		<a
			href="/wiki/{p.slug}"
			aria-current={current === p.slug ? 'page' : undefined}
			aria-label={p.kind && p.kind !== 'page' ? `${p.title}, ${t('kinds.' + p.kind)}` : undefined}
		>
			<svg class="ico doc" viewBox="0 0 24 24" aria-hidden="true">
				{#if p.icon && PAGE_ICONS[p.icon]}
					<path d={PAGE_ICONS[p.icon]} />
				{:else if p.kind && p.kind !== 'page'}
					<path d={KIND_ICONS[p.kind]} />
				{:else}
					<path d={iconPath('doc')} />
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
					<path d={iconPath('image')} />
				{:else if r.kind === 'audio'}
					<path d={iconPath('audio')} />
				{:else}
					<path d="M6 2.75h8.25L19 7.5v13.75H6zM14 2.75V7.5h5" />
				{/if}
			</svg>
			<span>{r.title}</span>
		</a>
	</li>
{/snippet}

{#snippet folder(f: TreeFolder)}
	<li>
		<details open={open.has(f.id)} ontoggle={(e) => toggled(f.id, e.currentTarget.open)}>
			<summary id="folder-{f.id}">
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

<div id="explorer" class="explorer" class:floating={!docked} class:open={shown}>
	<div class="explorer-top">
		{#if user}
			<a class="new-page" href="/wiki/new" aria-current={path === '/wiki/new' ? 'page' : undefined}>
				<Icon name="plus" />
				<span>{t('nav.newPage')}</span>
			</a>
		{/if}
		<button type="button" class="tool close" title={t('common.close')} aria-label={t('common.close')} onclick={() => close()}>
			<Icon name="close" />
		</button>
	</div>
	<nav aria-label={t('tree.label')}>
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
					<Icon name="expandAll" />
				</button>
				<button type="button" class="tool" title={t('tree.collapseAll')} aria-label={t('tree.collapseAll')} onclick={() => setAll(false)}>
					<Icon name="collapseAll" />
				</button>
			{/if}
			{#if canManage && tab === 'pages'}
				<button
					type="button"
					id="tree-new-folder"
					class="tool"
					title={t('tree.newFolder')}
					aria-label={t('tree.newFolder')}
					disabled={naming !== null}
					onclick={newFolder}
				>
					<Icon name="folderPlus" />
				</button>
			{:else if canManage}
				<a class="tool" href="/resources/new" title={t('resources.new')} aria-label={t('resources.new')}>
					<Icon name="upload" />
				</a>
			{/if}
		</div>
		<div role="tabpanel" id="tree-panel-pages" aria-labelledby="tree-tab-pages" hidden={tab !== 'pages'}>
			{#if naming !== null}
				<div class="naming">
					<svg class="ico folder" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPath('folder')} /></svg>
					<input
						type="text"
						maxlength="80"
						aria-label={t('tree.folderName')}
						aria-invalid={nameError || undefined}
						aria-describedby={nameError ? 'tree-folder-error' : undefined}
						bind:value={naming}
						bind:this={nameInput}
						onkeydown={nameKeys}
						onblur={createFolder}
					/>
				</div>
				{#if nameError}<p id="tree-folder-error" class="folder-error" role="alert">{t('tree.folderError')}</p>{/if}
			{/if}
			{#if tree.folders.length || tree.pages.length}
				<ul class="list-plain level root">
					{#each tree.folders as f (f.id)}{@render folder(f)}{/each}
					{#each tree.pages as p (p.slug)}{@render leaf(p)}{/each}
				</ul>
			{:else if naming === null}
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
	</nav>
</div>
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
	.explorer-top {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin: 0 0 0.35rem;
	}
	/* Nuova pagina: l'azione principale della barra, come un pulsante. */
	.new-page {
		flex: 1;
		align-items: center;
		justify-content: center;
		min-height: 2.25rem;
		border: 2px solid var(--c-primary);
		color: var(--c-primary);
		font-weight: 700;
	}
	.new-page :global(.icon) {
		flex: none;
		width: 1.15rem;
		height: 1.15rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.new-page:hover,
	.new-page[aria-current='page'] {
		background: var(--c-primary);
		color: var(--c-on-primary);
		box-shadow: none;
	}
	.new-page:hover span {
		text-decoration: none;
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
	.tool :global(.icon) {
		width: 1.15rem;
		height: 1.15rem;
	}
	.tool:disabled {
		opacity: 0.5;
		cursor: default;
	}
	/* La cartella che sta nascendo: icona e nome da scrivere, al posto della riga. */
	.naming {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.15rem 0.4rem 0.15rem 1.6rem;
	}
	.naming input {
		flex: 1;
		min-width: 0;
		min-height: 1.75rem;
		padding: 0 0.3rem;
		font: inherit;
		font-weight: 600;
	}
	.folder-error {
		margin: 0.2rem 0.4rem 0.3rem 1.6rem;
		color: var(--c-danger);
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
		content: '';
		display: block;
		height: 0.9rem;
		background: currentColor;
		-webkit-mask: var(--icon-chevron-right) center / contain no-repeat;
		mask: var(--icon-chevron-right) center / contain no-repeat;
		forced-color-adjust: none;
	}
	details[open] > summary > .chevron {
		transform: rotate(90deg);
	}
	/* Cartelle e pagine: lo stesso disegno a tratto, nello stesso colore. */
	.ico {
		flex: none;
		width: 1.15rem;
		height: 1.15rem;
		margin-top: 0.05rem;
		color: var(--c-muted);
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.doc {
		/* Spazio della freccia delle cartelle, per allineare le pagine. */
		margin-left: 0.25rem;
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
		a[aria-current='page'],
		[role='tab'][aria-selected='true'] {
			outline: 2px solid CanvasText;
		}
	}
	/*
	 * Barra chiusa (dal profilo, in Profilo e Amministrazione) e sempre sul telefono: un pannello a scomparsa
	 * che entra da sinistra sopra la pagina, senza spostarla. Le stesse regole due volte: per la classe e per lo schermo stretto.
	 */
	.explorer.floating {
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
	.explorer.floating.open {
		transform: none;
		visibility: visible;
		transition: transform 0.2s ease;
	}
	.floating .close {
		display: inline-flex;
	}
	.floating ~ .backdrop {
		display: block;
		position: fixed;
		inset: 0;
		z-index: 29;
		background: rgb(0 0 0 / 0.4);
	}
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

<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import { allowedVisibilities, canWrite, isMaster, SHEET_VISIBILITIES } from '../access.ts';
	import type { Visibility } from '../roles.ts';
	import { iconPath } from '../icons.ts';
	import Icon from './Icon.svelte';
	import { childrenOf, keyPlace, locate, nodeKey, pageIcon, placeAt, treePaths, treeTemplates, withoutTemplates, type Tree, type TreeNode, type TreePage, type TreePlace } from '../tree.ts';
	import { RESOURCE_KINDS, type ResourceItem, type ResourceKind } from '../resources.ts';

	// La barra a sinistra: in alto le linguette Pagine, Tag, Risorse e Template, sotto le icone delle azioni, poi l'albero.
	// Le sezioni della wiki (galleria, regole, calendario…) stanno nel menu del profilo in alto a destra.
	// `docked`: sta accanto alla pagina (la freccia chiama `onhide`); altrimenti (e sempre sul telefono) è un pannello a scomparsa, aperto dal pulsante in alto.
	let {
		tree,
		tags,
		resources,
		docked = true,
		open: shown = $bindable(false),
		onhide
	}: { tree: Tree; tags: { id: number; name: string; slug: string; color: string; count: number }[]; resources: ResourceItem[]; docked?: boolean; open?: boolean; onhide?: () => void } = $props();
	const t = getT();
	const canManage = $derived(isMaster(page.data.user));
	const user = $derived(page.data.user);
	// Nella vista giocatore non si creano pagine.
	const canNew = $derived(canWrite(user));

	// Cartelle aperte: quelle che portano alla pagina che stai leggendo, più quelle che hai aperto tu
	// (ricordate in questo browser).
	const STORE = 'cs-tree-open';
	// Riordino e cartelle lavorano su ciò che si vede: i template stanno nella loro linguetta.
	const pagesTree = $derived<Tree>({ items: withoutTemplates(tree.items) });
	const templates = $derived(treeTemplates(tree.items));
	const paths = $derived(treePaths(pagesTree));
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

	const open = new SvelteSet<string>(untrack(() => toOpen));
	$effect(() => {
		const ids = toOpen;
		untrack(() => ids.forEach((id) => open.add(id)));
	});

	// Quattro linguette: le pagine con le loro cartelle, i tag, le risorse (immagini, audio, altri file) e i template.
	// Si apre quella di ciò che stai guardando; altrove resta l'ultima scelta, ricordata in questo browser.
	type Tab = 'pages' | 'tags' | 'resources' | 'templates';
	const TABS: Tab[] = ['pages', 'tags', 'resources', 'templates'];
	const TAB_ICONS: Record<Tab, string> = { pages: 'doc', tags: 'tag', resources: 'image', templates: 'template' };
	const TAB_STORE = 'cs-tree-tab';
	const onTemplate = $derived(page.url.searchParams.get('kind') === 'template' || templates.some((p) => p.slug === current));
	const currentTag = $derived(path === '/wiki' ? page.url.searchParams.get('tag') : null);
	const tabFor = (p: string): Tab | null =>
		p.startsWith('/resources') ? 'resources' : p === '/tags' || currentTag ? 'tags' : !p.startsWith('/wiki') ? null : onTemplate ? 'templates' : 'pages';
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
	const foldable = $derived(tab === 'pages' ? paths.parents.length > 0 : tab === 'resources' && groups.length > 0);
	const newTemplate = $derived(canManage && tab === 'templates');
	const newLabel = $derived(t(newTemplate ? 'kinds.new.template' : 'nav.newPage'));
	const closed = new SvelteSet<string>();
	const currentRes = $derived(/^\/resources\/([^/]+)/.exec(path)?.[1]);

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORE) ?? '[]');
			if (Array.isArray(saved)) for (const id of saved) if (typeof id === 'string') open.add(id);
			const shut = JSON.parse(localStorage.getItem(RES_STORE) ?? '[]');
			if (Array.isArray(shut)) for (const k of shut) if (RESOURCE_KINDS.includes(k)) closed.add(k);
			const last = localStorage.getItem(TAB_STORE);
			if (!tabFor(path) && TABS.includes(last as Tab)) tab = last as Tab;
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

	function toggled(id: string, isOpen: boolean) {
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
		if (isOpen) for (const key of paths.parents) open.add(key);
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

	// Riordino, per il Master: si trascinano le righe, o da tastiera Alt e le frecce. Su, giù, dentro la voce sopra, fuori.
	type Where = 'before' | 'after' | 'inside';
	const MOVE_KEYS = 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight';
	const ARROWS: Record<string, 'up' | 'down' | 'in' | 'out'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'in', ArrowLeft: 'out' };
	let dragging = $state<string | null>(null);
	let target: TreePlace | null = null;
	let over = $state<{ key: string; where: Where } | null>(null);
	let announce = $state('');
	let failed = $state(false);

	const rowOf = (e: Event) => (e.target as Element).closest<HTMLElement>('[data-node]');
	const rowAttrs = (n: TreeNode) => ({
		'data-node': nodeKey(n),
		'data-drop': over?.key === nodeKey(n) ? over.where : undefined,
		draggable: (canManage && !(n.type === 'page' && n.home)) || undefined
	});

	function dragStart(e: DragEvent) {
		const row = rowOf(e);
		if (!canManage || !row?.draggable || !e.dataTransfer) return;
		dragging = row.dataset.node!;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', row.textContent?.trim() ?? '');
	}

	function dragOver(e: DragEvent) {
		if (!dragging) return;
		const row = rowOf(e);
		const key = row?.dataset.node;
		let where: Where = 'after';
		if (row) {
			const box = row.getBoundingClientRect();
			const y = (e.clientY - box.top) / box.height;
			where = row.classList.contains('divider') ? (y < 0.5 ? 'before' : 'after') : y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside';
		}
		// Sotto l'ultima riga si torna in fondo alla radice.
		target = key ? placeAt(pagesTree, dragging, key, where, open.has(key)) : e.target === e.currentTarget ? { parent: null, before: null } : null;
		if (!target) {
			over = null;
			return;
		}
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		if (over?.key !== key || over?.where !== where) over = key ? { key, where } : null;
	}

	function dragLeave(e: DragEvent) {
		if ((e.currentTarget as Element).contains(e.relatedTarget as Node | null)) return;
		over = null;
		target = null;
	}

	function dragEnd() {
		dragging = null;
		target = null;
		over = null;
	}

	function dragDrop(e: DragEvent) {
		if (!dragging || !target) return;
		e.preventDefault();
		const key = dragging;
		const place = target;
		dragEnd();
		move(key, place);
	}

	async function changed(r: Response | null, done: string, params?: Record<string, string | number>) {
		failed = !r?.ok;
		announce = failed ? '' : t(done, params);
		await invalidateAll();
		await tick();
	}

	async function move(key: string, place: TreePlace) {
		if (place.parent) {
			open.add(place.parent);
			save();
		}
		const body = JSON.stringify({ node: key, ...place });
		await changed(await fetch('/api/tree', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body }).catch(() => null), 'tree.moved');
	}

	async function moveKeys(e: KeyboardEvent) {
		const dir = ARROWS[e.key];
		const from = rowOf(e);
		const key = from?.draggable ? from.dataset.node : undefined;
		if (!canManage || !e.altKey || !dir || !key) return;
		e.preventDefault();
		const place = keyPlace(pagesTree, key, dir);
		if (!place) return;
		await move(key, place);
		const row = document.querySelector<HTMLElement>(`[data-node="${key}"]`);
		(row?.matches('summary') ? row : (row?.querySelector('a') ?? row?.querySelector('button')))?.focus();
	}

	async function newDivider() {
		const r = await fetch('/api/tree', { method: 'POST' }).catch(() => null);
		const res = r?.ok ? await r.json().catch(() => null) : null;
		await changed(r, 'tree.dividerAdded');
		document.querySelector<HTMLElement>(`[data-node="${res?.key}"] button`)?.focus();
	}

	const holdsCurrent = (n: TreeNode): boolean => childrenOf(n).some((c) => (c.type === 'page' && c.slug === current) || holdsCurrent(c));

	// Il cestino: la voce sparisce dall'albero, e se stavi leggendo proprio lei si torna all'elenco.
	async function remove(n: TreeNode) {
		const key = nodeKey(n);
		const hit = locate(tree.items, key);
		const reading = !!hit && (holdsCurrent(hit.node) || (hit.node.type === 'page' && hit.node.slug === current));
		const body = JSON.stringify({ node: key });
		const r = await fetch('/api/tree', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body }).catch(() => null);
		if (r?.ok && reading) return goto('/wiki?deleted=1', { invalidateAll: true });
		await changed(r, n.type === 'divider' ? 'tree.dividerRemoved' : 'tree.trashed');
		document.querySelector<HTMLElement>('#explorer .new-page')?.focus();
	}

	// Chi può vedere una pagina, per il Master: l'icona accanto al cestino apre i livelli.
	// Se la pagina ne contiene altre, prima di cambiare anche quelle si chiede. «Personale» solo sulle proprie pagine.
	const VIS_ICONS: Record<Visibility, string> = { public: 'globe', players: 'eye', master: 'eyeOff', personal: 'lock' };
	const level = (v: Visibility) => t('visibility.' + v);
	let visFor = $state<TreePage | null>(null);
	let visMenu = $state<HTMLElement>();
	// Il clic sull'icona di un menu aperto lo chiude (fuori dal menu) e basta: non lo deve riaprire.
	let visBlocked = false;
	let ask = $state<{ p: TreePage; level: Visibility; n: number; others: boolean } | null>(null);
	let askDlg = $state<HTMLDialogElement>();
	let choice: 'all' | 'one' | null = null;
	const visButton = (p: TreePage) => document.querySelector<HTMLElement>(`[data-vis="${nodeKey(p)}"]`);
	// Una scheda giocatore resta Pubblica o Giocatori.
	const visLevels = (p: TreePage) => allowedVisibilities(user, !!p.sheet).filter((v) => v !== 'personal' || p.mine);

	async function openVis(p: TreePage, btn: HTMLElement, viaPointer: boolean) {
		if (visBlocked && viaPointer) {
			visBlocked = false;
			return;
		}
		visFor = p;
		await tick();
		if (!visMenu) return;
		visMenu.showPopover();
		const box = btn.getBoundingClientRect();
		const menu = visMenu.getBoundingClientRect();
		const below = box.bottom + 4 + menu.height <= innerHeight - 8;
		visMenu.style.top = `${Math.max(8, below ? box.bottom + 4 : box.top - 4 - menu.height)}px`;
		visMenu.style.left = `${Math.max(8, Math.min(box.right - menu.width, innerWidth - menu.width - 8))}px`;
		(visMenu.querySelector<HTMLElement>('[aria-checked="true"]') ?? visMenu.querySelector<HTMLElement>('button'))?.focus();
	}

	function visToggled(e: ToggleEvent) {
		if (e.newState !== 'closed' || !visFor) return;
		const p = visFor;
		visFor = null;
		// Con Esc o un clic fuori il fuoco torna sull'icona; se si sceglie un livello lo sposta chi cambia.
		if (!document.activeElement || document.activeElement === document.body || visMenu?.contains(document.activeElement)) visButton(p)?.focus();
	}

	function menuKeys(e: KeyboardEvent) {
		const items = [...(visMenu?.querySelectorAll<HTMLElement>('button') ?? [])];
		const i = items.indexOf(document.activeElement as HTMLElement);
		const to: Record<string, number> = { ArrowDown: (i + 1) % items.length, ArrowUp: (i - 1 + items.length) % items.length, Home: 0, End: items.length - 1 };
		if (e.key === 'Tab') {
			e.preventDefault();
			visMenu?.hidePopover();
		} else if (to[e.key] !== undefined) {
			e.preventDefault();
			items[to[e.key]]?.focus();
		}
	}

	// Le pagine dentro questa, come nell'albero (i template stanno nella loro linguetta).
	function inside(p: TreePage): TreePage[] {
		const hit = locate(pagesTree.items, nodeKey(p));
		const out: TreePage[] = [];
		const walk = (n: TreeNode) =>
			childrenOf(n).forEach((c) => {
				if (c.type === 'page' && !c.home) out.push(c);
				walk(c);
			});
		if (hit) walk(hit.node);
		return out;
	}

	async function chooseVis(p: TreePage, v: Visibility) {
		visFor = null;
		visMenu?.hidePopover();
		const rest = inside(p).filter((c) => c.visibility !== v);
		const n = rest.filter((c) => (v !== 'personal' || c.mine) && (!c.sheet || SHEET_VISIBILITIES.includes(v))).length;
		if (n) {
			ask = { p, level: v, n, others: n < rest.length };
			choice = null;
			await tick();
			askDlg?.showModal();
			return;
		}
		if (v !== p.visibility) await setVis(p, v, false);
		else visButton(p)?.focus();
	}

	function answer(c: 'all' | 'one') {
		choice = c;
		askDlg?.close();
	}

	// Chiusa con la X o con Esc: non cambia niente.
	async function answered() {
		const a = ask;
		ask = null;
		if (!a) return;
		if (choice === 'all' || (choice === 'one' && a.level !== a.p.visibility)) await setVis(a.p, a.level, choice === 'all');
		else visButton(a.p)?.focus();
	}

	async function setVis(p: TreePage, v: Visibility, branch: boolean) {
		const body = JSON.stringify({ node: nodeKey(p), visibility: v, branch });
		const r = await fetch('/api/tree/visibility', { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => null);
		const res = r?.ok ? await r.json().catch(() => null) : null;
		await changed(r, branch ? 'tree.visibilityChangedBranch' : 'tree.visibilityChanged', { level: level(v), n: res?.changed ?? 0 });
		visButton(p)?.focus();
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

{#snippet link(p: TreePage)}
	<!-- Il tipo (mappa, cronologia, template) si legge anche con il lettore di schermo. -->
	<a
		href={p.home ? '/' : `/wiki/${p.slug}`}
		aria-current={current === p.slug || (p.home && path === '/') ? 'page' : undefined}
		aria-label={p.kind && p.kind !== 'page' ? `${p.title}, ${t('kinds.' + p.kind)}` : undefined}
		aria-keyshortcuts={canManage && !p.home && p.kind !== 'template' ? MOVE_KEYS : undefined}
	>
		<svg class="ico doc" viewBox="0 0 24 24" aria-hidden="true">
			<path d={pageIcon(p)} />
		</svg>
		<span>{p.title}</span>
	</a>
{/snippet}

{#snippet trash(n: TreeNode, name: string)}
	<button type="button" class="tool trash" title={t('tree.trash')} aria-label="{t('tree.trash')}: {name}" onclick={() => remove(n)}>
		<Icon name="trash" />
	</button>
{/snippet}

{#snippet vis(p: TreePage)}
	{#if canManage && p.visibility && !p.home}
		<button
			type="button"
			class="tool vis"
			data-vis={nodeKey(p)}
			data-level={p.visibility}
			title={t('tree.visibility', { level: level(p.visibility) })}
			aria-label={t('tree.visibilityOf', { title: p.title, level: level(p.visibility) })}
			aria-haspopup="menu"
			aria-expanded={visFor?.id === p.id}
			aria-controls={visFor?.id === p.id ? 'tree-vis-menu' : undefined}
			onpointerdown={() => (visBlocked = visFor?.id === p.id)}
			onclick={(e) => openVis(p, e.currentTarget, e.detail > 0)}
		>
			<Icon name={VIS_ICONS[p.visibility]} />
		</button>
	{/if}
{/snippet}

{#snippet resourceLeaf(r: ResourceItem)}
	<li>
		<a href="/resources/{r.id}" aria-current={currentRes === String(r.id) ? 'page' : undefined}>
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

{#snippet rows(list: TreeNode[])}
	{#each list as n (nodeKey(n))}
		{#if n.type === 'divider'}
			<li class="divider" {...rowAttrs(n)}>
				<hr />
				{#if canManage}
					<button type="button" class="tool" title={t('tree.deleteDivider')} aria-label={t('tree.deleteDivider')} aria-keyshortcuts={MOVE_KEYS} onclick={() => remove(n)}>
						<Icon name="close" />
					</button>
				{/if}
			</li>
		{:else if n.type === 'folder'}
			<li class="holder">
				<!-- Dentro <summary> non ci possono stare pulsanti: il cestino sta accanto e si sovrappone alla riga. -->
				{#if canManage && !n.pc}{@render trash(n, n.name)}{/if}
				<details open={open.has(nodeKey(n))} ontoggle={(e) => toggled(nodeKey(n), e.currentTarget.open)}>
					<summary id="folder-{n.id}" aria-keyshortcuts={canManage ? MOVE_KEYS : undefined} {...rowAttrs(n)}>
						<span class="chevron" aria-hidden="true"></span>
						{@render folderIcon()}
						<span>{n.name}</span>
					</summary>
					<ul class="list-plain level">
						{@render rows(n.items)}
						{#if !n.items.length}<li class="none muted">{t('tree.emptyFolder')}</li>{/if}
					</ul>
				</details>
			</li>
		{:else if n.items.length}
			<!-- Una pagina con voci dentro: la freccia apre, il titolo porta alla pagina. -->
			<li>
				<div class="row page-row" {...rowAttrs(n)}>
					<button
						type="button"
						class="twist"
						aria-expanded={open.has(nodeKey(n))}
						aria-label={t('tree.inside', { title: n.title })}
						onclick={() => toggled(nodeKey(n), !open.has(nodeKey(n)))}
					>
						<span class="chevron" aria-hidden="true"></span>
					</button>
					{@render link(n)}
					{@render vis(n)}
					{#if n.canTrash}{@render trash(n, n.title)}{/if}
				</div>
				{#if open.has(nodeKey(n))}
					<ul class="list-plain level">{@render rows(n.items)}</ul>
				{/if}
			</li>
		{:else}
			<li class="row" {...rowAttrs(n)}>
				{@render link(n)}
				{@render vis(n)}
				{#if n.canTrash}{@render trash(n, n.title)}{/if}
			</li>
		{/if}
	{/each}
{/snippet}

<div id="explorer" class="explorer side-panel panel" class:floating={!docked} class:open={shown}>
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
						<Icon name={TAB_ICONS[id]} />
						{t('tree.tab.' + id)}
					</button>
				{/each}
			</div>
			<button type="button" class="tool close" title={t('common.close')} aria-label={t('common.close')} onclick={() => close()}>
				<Icon name="close" />
			</button>
			{#if docked}
				<button type="button" id="tree-hide" class="tool hide" title={t('tree.hide')} aria-label={t('tree.hide')} onclick={onhide}>
					<Icon name="arrowLeft" />
				</button>
			{/if}
		</div>
		{#if canNew || foldable || (canManage && tab === 'tags')}
			<div class="explorer-tools">
				{#if canNew}
					<a
						class="tool new-page"
						href={newTemplate ? '/wiki/new?kind=template' : '/wiki/new'}
						title={newLabel}
						aria-label={newLabel}
						aria-current={path === '/wiki/new' ? 'page' : undefined}
					>
						<Icon name="docPlus" />
					</a>
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
					<button type="button" id="tree-new-divider" class="tool" title={t('tree.newDivider')} aria-label={t('tree.newDivider')} onclick={newDivider}>
						<Icon name="divider" />
					</button>
				{:else if canManage && tab === 'tags'}
					<a class="tool" href="/tags" title={t('tree.manageTags')} aria-label={t('tree.manageTags')} aria-current={path === '/tags' ? 'page' : undefined}>
						<Icon name="sliders" />
					</a>
				{:else if canManage && tab === 'resources'}
					<a class="tool" href="/resources/new" title={t('resources.new')} aria-label={t('resources.new')}>
						<Icon name="upload" />
					</a>
				{/if}
				{#if foldable}
					<button type="button" class="tool" title={t('tree.collapseAll')} aria-label={t('tree.collapseAll')} onclick={() => setAll(false)}>
						<Icon name="collapseAll" />
					</button>
					<button type="button" class="tool" title={t('tree.expandAll')} aria-label={t('tree.expandAll')} onclick={() => setAll(true)}>
						<Icon name="expandAll" />
					</button>
				{/if}
			</div>
		{/if}
		<!-- Fuori dalle linguette: pagine, cartelle e template si spostano e si eliminano da linguette diverse. -->
		{#if failed}<p class="folder-error" role="alert">{t('tree.actionError')}</p>{/if}
		<p class="visually-hidden" aria-live="polite">{announce}</p>
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
			{#if pagesTree.items.length}
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions (gli eventi arrivano dalle righe, che sono link e pulsanti) -->
				<ul
					class="list-plain level root"
					class:sortable={canManage}
					class:dragging
					ondragstart={dragStart}
					ondragover={dragOver}
					ondragleave={dragLeave}
					ondrop={dragDrop}
					ondragend={dragEnd}
					onkeydown={moveKeys}
				>
					{@render rows(pagesTree.items)}
				</ul>
			{:else if naming === null}
				<p class="muted none">{t('tree.empty')}</p>
			{/if}
		</div>
		<div role="tabpanel" id="tree-panel-tags" aria-labelledby="tree-tab-tags" hidden={tab !== 'tags'}>
			{#if tags.length}
				<ul class="list-plain level root">
					{#each tags as tag (tag.id)}
						<li>
							<a href="/wiki?tag={encodeURIComponent(tag.slug)}" aria-current={currentTag === tag.slug ? 'page' : undefined}>
								<span class="tag-dot tag-{tag.color}" aria-hidden="true"></span>
								<span>{tag.name}</span>
								<span class="muted count">{tag.count}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted none">{t('tags.empty')}</p>
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
		<div role="tabpanel" id="tree-panel-templates" aria-labelledby="tree-tab-templates" hidden={tab !== 'templates'}>
			{#if templates.length}
				<ul class="list-plain level root">
					{#each templates as p (p.id)}
						<li class="row">
							{@render link(p)}
							{@render vis(p)}
							{#if p.canTrash}{@render trash(p, p.title)}{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted none">{t('tree.noTemplates')}</p>
			{/if}
		</div>
		<!-- Fuori dalle linguette: sempre in fondo alla barra, anche ad albero vuoto. A chi non ha fatto l'accesso non servono. -->
		{#if user}
			<a class="bin" href="/schedule" aria-current={path.startsWith('/schedule') ? 'page' : undefined}>
				<svg class="ico doc" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPath('calendar')} /></svg>
				<span>{t('schedule.title')}</span>
			</a>
			<a class="bin" href="/trash" aria-current={path === '/trash' ? 'page' : undefined}>
				<svg class="ico doc" viewBox="0 0 24 24" aria-hidden="true"><path d={iconPath('trash')} /></svg>
				<span>{t('trash.title')}</span>
			</a>
		{/if}
		<!-- Un solo menu per tutte le righe, in primo piano (popover): non lo taglia il bordo della barra. Esc o un clic fuori lo chiudono. -->
		<div
			id="tree-vis-menu"
			class="vis-menu"
			role="menu"
			tabindex="-1"
			popover="auto"
			aria-label={visFor ? t('tree.visibilityMenu', { title: visFor.title }) : undefined}
			bind:this={visMenu}
			ontoggle={visToggled}
			onkeydown={menuKeys}
		>
			{#if visFor}
				{@const p = visFor}
				{#each visLevels(p) as v (v)}
					<button type="button" role="menuitemradio" aria-checked={p.visibility === v} onclick={() => chooseVis(p, v)}>
						<Icon name={VIS_ICONS[v]} />
						<span>{level(v)}<small>{t('visibility.' + v + 'Hint')}</small></span>
						{#if p.visibility === v}<Icon name="check" />{/if}
					</button>
				{/each}
			{/if}
		</div>
		{#if ask}
			<dialog bind:this={askDlg} class="vis-ask" aria-labelledby="vis-ask-q" onclose={answered}>
				<p id="vis-ask-q">{t('tree.branchQuestion', { title: ask.p.title, n: ask.n, level: level(ask.level) })}</p>
				{#if ask.others}<p class="muted">{t('tree.branchOthers')}</p>{/if}
				<div class="actions">
					<button class="btn btn-primary" type="button" onclick={() => answer('all')}>{t('tree.branchAll')}</button>
					<button class="btn" type="button" onclick={() => answer('one')}>{t('tree.branchOne')}</button>
				</div>
				<button class="btn btn-small btn-ghost close-ask" type="button" title={t('common.cancel')} aria-label={t('common.cancel')} onclick={() => askDlg?.close()}><Icon name="close" /></button>
			</dialog>
		{/if}
	</nav>
</div>
{#if shown}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions (da tastiera c'è Esc, o il pulsante Chiudi) -->
	<div class="backdrop" aria-hidden="true" onclick={() => close(false)}></div>
{/if}

<style>
	.explorer {
		--row: 1.5rem;
		--row-pad: 0.1rem;
		--tool: 1.75rem;
	}
	.explorer-head {
		display: flex;
		align-items: center;
		gap: 0.1rem;
		margin: 0 0 0.2rem;
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
		flex: 1;
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		min-height: var(--tool);
		margin-bottom: -0.2rem;
		padding: 0 0.5rem 0.25rem;
		border: 0;
		border-bottom: 3px solid transparent;
		background: none;
		color: var(--c-muted);
		font: inherit;
		font-family: var(--font-head);
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.2;
		cursor: pointer;
	}
	/* Più grandi delle altre icone; il tratto resta sottile come nel resto della barra. */
	[role='tab'] :global(.icon) {
		width: 1.6rem;
		height: 1.6rem;
		stroke-width: 1.25;
	}
	[role='tab']:hover {
		color: var(--c-text);
		border-bottom-color: var(--c-control);
	}
	[role='tab'][aria-selected='true'] {
		color: var(--c-text);
		border-bottom-color: var(--c-primary);
	}
	.tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--tool);
		height: var(--tool);
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
		width: 1.05rem;
		height: 1.05rem;
	}
	.tool:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.explorer-tools {
		display: flex;
		gap: 0;
		margin: 0 0 0.2rem;
	}
	/* Nuova pagina: l'azione principale della barra. */
	.new-page {
		color: var(--c-primary);
	}
	.new-page:hover,
	.new-page[aria-current='page'] {
		background: var(--c-primary);
		color: var(--c-on-primary);
		box-shadow: none;
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
	/* Spazio sotto l'ultima riga: lasciare qui una voce la riporta in fondo alla radice. */
	.level.sortable {
		padding-bottom: 1rem;
	}
	/* Dove cade la voce trascinata: una riga tra due voci, o un bordo attorno a quella che la conterrà. */
	.root [data-drop='before'] {
		box-shadow: inset 0 2px 0 var(--c-primary);
	}
	.root [data-drop='after'] {
		box-shadow: inset 0 -2px 0 var(--c-primary);
	}
	.root [data-drop='inside'] {
		outline: 2px solid var(--c-primary);
		outline-offset: -2px;
	}
	.divider {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 1.75rem;
		padding: 0 0.4rem;
	}
	.divider[draggable] {
		cursor: grab;
	}
	.divider hr {
		flex: 1;
		margin: 0;
		border: 0;
		border-top: 1px solid var(--c-control);
	}
	/* Si vede passando sulla riga o con il fuoco, a destra nel riquadro evidenziato. */
	.row,
	.holder {
		position: relative;
	}
	.holder > .trash {
		z-index: 1;
	}
	.holder:has(> .trash:hover) > details > summary {
		background: var(--c-surface2);
	}
	/* Mentre si trascina non deve intralciare: sotto c'è la riga dove lasciare la voce. */
	.dragging .trash,
	.dragging .vis {
		pointer-events: none;
	}
	.tool.trash {
		position: absolute;
		top: 0;
		right: 0.1rem;
	}
	.tool.trash,
	.divider .tool {
		width: 1.5rem;
		height: 1.5rem;
		opacity: 0;
	}
	.row:hover > .tool.trash,
	.holder:has(> details > summary:hover) > .tool.trash,
	.tool.trash:hover,
	.divider:hover .tool,
	.tool.trash:focus-visible,
	.divider .tool:focus-visible {
		opacity: 1;
	}
	.tool.trash:hover,
	.divider .tool:hover {
		background: none;
		color: var(--c-danger);
	}
	/* Col dito niente cestino accanto a ogni riga: è facile toccarlo per sbaglio. Le pagine si eliminano dalla modifica, le cartelle da Categorie. */
	@media (hover: none) {
		.tool.trash {
			display: none;
		}
		.divider .tool,
		.tool.vis {
			opacity: 1;
		}
		.tool.vis:has(+ .trash) {
			right: 0.1rem;
		}
		.row:has(> .vis + .trash) > a {
			padding-right: 1.85rem;
		}
	}
	.row:has(> .trash) > a,
	.row:has(> .vis) > a,
	.holder:has(> .trash) > details > summary {
		padding-right: 1.85rem;
	}
	/*
	 * Chi può vedere la pagina, accanto al cestino. Solo Master e Personale si vedono sempre: sono quelle da notare scorrendo.
	 * Pubblica e Giocatori compaiono passando sulla riga, come il cestino. L'icona cambia forma, non solo colore.
	 */
	.tool.vis {
		position: absolute;
		top: calc((var(--row) - 1.5rem) / 2);
		right: 0.1rem;
		width: 1.5rem;
		height: 1.5rem;
		opacity: 0;
	}
	.tool.vis:has(+ .trash) {
		right: 1.6rem;
	}
	.row:has(> .vis + .trash) > a {
		padding-right: 3.35rem;
	}
	.tool.vis[data-level='master'],
	.tool.vis[data-level='personal'],
	.tool.vis[aria-expanded='true'],
	.row:hover > .tool.vis,
	.tool.vis:hover,
	.tool.vis:focus-visible {
		opacity: 1;
	}
	.tool.vis:hover {
		background: none;
		color: var(--c-text);
	}
	.vis-menu {
		position: fixed;
		inset: auto;
		width: max-content;
		max-width: min(19rem, calc(100vw - 1rem));
		margin: 0;
		padding: 0.25rem;
		border: 1px solid var(--c-border);
		border-radius: var(--radius);
		background: var(--c-bg);
		color: var(--c-text);
		box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.25);
	}
	.vis-menu button {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
		min-height: 2rem;
		padding: 0.35rem 0.5rem;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.vis-menu button > span {
		flex: 1;
	}
	.vis-menu button :global(.icon) {
		flex: none;
		width: 1.05rem;
		height: 1.05rem;
		margin-top: 0.15rem;
	}
	.vis-menu small {
		display: block;
		color: var(--c-muted);
		font-size: 0.8rem;
	}
	.vis-menu button:hover,
	.vis-menu button:focus-visible {
		background: var(--c-surface2);
	}
	.vis-menu [aria-checked='true'] {
		font-weight: 700;
		box-shadow: inset 3px 0 0 var(--c-primary);
	}
	.vis-ask {
		width: min(100% - 2rem, 28rem);
		max-width: none;
		padding: 1.25rem;
		color: var(--c-text);
		background: var(--c-bg);
		border: 1px solid var(--c-border);
		border-top: 4px solid var(--c-primary);
		border-radius: var(--radius);
	}
	.vis-ask::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	.vis-ask p:first-child {
		margin-top: 0;
		padding-right: 2.25rem;
	}
	.vis-ask .actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.close-ask {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0;
	}
	.page-row {
		display: flex;
		align-items: stretch;
	}
	.page-row a {
		flex: 1;
		min-width: 0;
	}
	.page-row .doc {
		margin-left: 0;
	}
	.twist {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		width: 1.5rem;
		padding: 0;
		border: 0;
		background: none;
		color: var(--c-text);
		cursor: pointer;
	}
	.twist[aria-expanded='true'] .chevron {
		transform: rotate(90deg);
	}
	/* Righe guida tra una cartella e il suo contenuto, come in Esplora risorse. */
	.level .level {
		margin-left: 0.8rem;
		padding-left: 0.2rem;
		border-left: 1px dotted var(--c-control);
	}
	summary,
	a {
		display: flex;
		align-items: flex-start;
		gap: 0.3rem;
		min-height: var(--row);
		padding: var(--row-pad) 0.35rem;
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
	.bin {
		margin-top: 0.2rem;
		font-weight: 600;
	}
	summary:hover,
	a:hover {
		background: var(--c-surface2);
	}
	.row:hover > a {
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
	/* Il tag: il pallino del suo colore al posto dell'icona, il numero di pagine in fondo alla riga. */
	a > .tag-dot {
		margin: 0.3rem 0.2rem 0;
	}
	.count {
		margin-left: auto;
		font-size: var(--fs-sm);
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
		width: 1rem;
		height: 1rem;
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
		[role='tab'][aria-selected='true'],
		.root [data-drop] {
			outline: 2px solid CanvasText;
		}
	}
	/*
	 * Barra chiusa (dal profilo, nascosta con la freccia, in Amministrazione) e sempre sul telefono: un pannello a scomparsa
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
		/* Col dito servono righe più alte. */
		.explorer {
			--row: 2.5rem;
			--row-pad: 0.25rem;
			--tool: 2.5rem;
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
		summary,
		a {
			align-items: center;
		}
		.close {
			display: inline-flex;
		}
		.hide {
			display: none;
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

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { getT } from '../i18n/index.ts';
	import { isMaster } from '../access.ts';
	import { treePaths, type Tree, type TreeFolder, type TreePage } from '../tree.ts';

	let { tree }: { tree: Tree } = $props();
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

	onMount(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORE) ?? '[]');
			if (Array.isArray(saved)) for (const id of saved) if (Number.isInteger(id)) open.add(id);
		} catch {
			/* memoria del browser non disponibile */
		}
	});

	function toggled(id: number, isOpen: boolean) {
		if (isOpen === open.has(id)) return;
		if (isOpen) open.add(id);
		else open.delete(id);
		save();
	}

	function setAll(isOpen: boolean) {
		open.clear();
		if (isOpen) for (const p of paths.folders.values()) open.add(p[p.length - 1]);
		save();
	}

	function save() {
		try {
			localStorage.setItem(STORE, JSON.stringify([...open]));
		} catch {
			/* memoria del browser non disponibile */
		}
	}

	// Sul telefono l'albero è chiuso in un pulsante; si richiude quando apri una pagina.
	let shown = $state(false);
	$effect(() => {
		void path;
		shown = false;
	});
</script>

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
			{#if p.icon}
				<span class="ico emoji" aria-hidden="true">{p.icon}</span>
			{:else}
				<svg class="ico doc" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M6 2.75h8.25L19 7.5v13.75H6z" />
					<path d="M14 2.75V7.5h5M9 12h7M9 15.5h7" />
				</svg>
			{/if}
			<span>{p.title}</span>
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

<nav class="explorer" aria-label={t('tree.label')}>
	<button type="button" class="btn explorer-toggle" aria-expanded={shown} aria-controls="explorer-body" onclick={() => (shown = !shown)}>
		<span class="chevron" aria-hidden="true"></span>
		{t('tree.title')}
	</button>
	<div id="explorer-body" class="explorer-body" class:shown>
		<div class="explorer-head">
			<p class="explorer-title" aria-hidden="true">{t('tree.title')}</p>
			{#if tree.folders.length}
				<button type="button" class="tool" title={t('tree.expandAll')} aria-label={t('tree.expandAll')} onclick={() => setAll(true)}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l5-5 5 5M7 15l5 5 5-5" /></svg>
				</button>
				<button type="button" class="tool" title={t('tree.collapseAll')} aria-label={t('tree.collapseAll')} onclick={() => setAll(false)}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l5 5 5-5M7 20l5-5 5 5" /></svg>
				</button>
			{/if}
			{#if canManage}
				<a class="tool" href="/categories#new-cat" title={t('tree.newFolder')} aria-label={t('tree.newFolder')}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h5l2 2h9a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5zM12 10v6M9 13h6" />
					</svg>
				</a>
			{/if}
		</div>
		{#if tree.folders.length || tree.pages.length}
			<ul class="list-plain level root">
				{#each tree.folders as f (f.id)}{@render folder(f)}{/each}
				{#each tree.pages as p (p.slug)}{@render leaf(p)}{/each}
			</ul>
		{:else}
			<p class="muted none">{t('tree.empty')}</p>
		{/if}
	</div>
</nav>

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
		padding: 0 0 0.35rem 0.4rem;
		border-bottom: 1px solid var(--c-border);
	}
	.explorer-title {
		flex: 1;
		margin: 0;
		font-family: var(--font-head);
		font-weight: 700;
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
	.explorer-toggle {
		display: none;
		width: 100%;
		justify-content: flex-start;
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
	details[open] > summary > .chevron,
	.explorer-toggle[aria-expanded='true'] > .chevron {
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
		stroke-linejoin: round;
	}
	.emoji {
		margin-left: 0.25rem;
		margin-top: 0;
		font-size: 0.95rem;
		line-height: 1.15rem;
		text-align: center;
	}
	a:hover .emoji {
		text-decoration: none;
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
		a[aria-current='page'] {
			outline: 2px solid CanvasText;
		}
	}
	/* Sul telefono l'albero sta sopra la pagina, chiuso in un pulsante. */
	@media (max-width: 60rem) {
		.explorer {
			position: static;
			max-height: none;
			overflow: visible;
			padding: 0;
			border: 0;
			background: none;
		}
		.explorer-title {
			display: none;
		}
		.explorer-toggle {
			display: inline-flex;
		}
		.explorer-body {
			display: none;
		}
		.explorer-body.shown {
			display: block;
			margin-top: 0.5rem;
			padding: 0.5rem 0.4rem;
			background: var(--c-surface);
			border: 1px solid var(--c-border);
			border-radius: var(--radius);
		}
	}
</style>

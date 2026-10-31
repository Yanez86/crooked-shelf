import { iconPath } from './icons.ts';
import { PAGE_ICONS } from './pageIcons.ts';
import { KIND_ICONS, type PageKind } from './pageKinds.ts';

/**
 * Albero delle cartelle (le categorie), delle pagine di ogni tipo e dei divisori, come in Esplora risorse.
 * Ogni livello è una sola lista, nell'ordine scelto trascinando: cartelle e pagine si possono mischiare e annidare
 * una dentro l'altra. `sort` nullo = mai spostata: sta in fondo, cartelle e poi pagine, in ordine alfabetico.
 */
export interface TreePage {
	type: 'page';
	id: number;
	slug: string;
	title: string;
	icon?: string | null;
	kind?: PageKind;
	sort: number | null;
	items: TreeNode[];
	/** Chi guarda la può spostare nel cestino. */
	canTrash?: boolean;
	/** La pagina iniziale del sito: in cima alla radice, non si sposta. */
	home?: boolean;
}

/** Il disegno di una pagina: l'icona scelta, altrimenti quella del tipo. */
export function pageIcon(p: Pick<TreePage, 'icon' | 'kind'>): string {
	if (p.icon && PAGE_ICONS[p.icon]) return PAGE_ICONS[p.icon];
	return p.kind && p.kind !== 'page' ? KIND_ICONS[p.kind] : iconPath('doc');
}

export interface TreeFolder {
	type: 'folder';
	id: number;
	name: string;
	slug: string;
	sort: number | null;
	items: TreeNode[];
}

/** Una riga che separa due voci, come un <hr>. */
export interface TreeDivider {
	type: 'divider';
	id: number;
	sort: number | null;
}

export type TreeNode = TreeFolder | TreePage | TreeDivider;

export interface Tree {
	items: TreeNode[];
}

/** Dove va una voce spostata: dentro `parent` (null = la radice), prima di `before` (null = in fondo). */
export interface TreePlace {
	parent: string | null;
	before: string | null;
}

export const nodeKey = (n: Pick<TreeNode, 'type' | 'id'>) => `${n.type}-${n.id}`;

export const childrenOf = (n: TreeNode) => (n.type === 'divider' ? [] : n.items);

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const RANK = { folder: 0, page: 1, divider: 2 };
const labelOf = (n: TreeNode) => (n.type === 'folder' ? n.name : n.type === 'page' ? n.title : '');
const placed = (n: TreeNode) => n.sort ?? Number.MAX_SAFE_INTEGER;
const byOrder = (a: TreeNode, b: TreeNode) => placed(a) - placed(b) || RANK[a.type] - RANK[b.type] || collator.compare(labelOf(a), labelOf(b));

/** A chi non gestisce: un divisorio che non separa niente (le voci vicine possono essere nascoste) non si vede. */
const trimDividers = (list: TreeNode[]) =>
	list.filter((n, i) => n.type !== 'divider' || (i > 0 && list[i - 1].type !== 'divider' && list.slice(i + 1).some((x) => x.type !== 'divider')));

/** `keepEmpty` = mostra anche le cartelle senza pagine visibili (per chi gestisce le categorie). */
export function buildTree(
	cats: { id: number; name: string; slug: string; parentId: number | null; parentPageId?: number | null; sort?: number | null }[],
	pages: { id: number; slug: string; title: string; categoryId: number | null; parentPageId?: number | null; sort?: number | null; icon?: string | null; kind?: PageKind; canTrash?: boolean; home?: boolean }[],
	keepEmpty: boolean,
	dividers: { id: number; categoryId: number | null; parentPageId: number | null; sort: number | null }[] = []
): Tree {
	const nodes = new Map<string, TreeFolder | TreePage>();
	for (const c of cats) nodes.set(`folder-${c.id}`, { type: 'folder', id: c.id, name: c.name, slug: c.slug, sort: c.sort ?? null, items: [] });
	for (const p of pages)
		nodes.set(`page-${p.id}`, { type: 'page', id: p.id, slug: p.slug, title: p.title, icon: p.icon ?? null, kind: p.kind ?? 'page', sort: p.sort ?? null, items: [], canTrash: p.canTrash ?? false, home: p.home });
	const root: Tree = { items: [] };

	// Chi contiene chi. Dentro una pagina nascosta o nel cestino non si può stare: si risale alla cartella.
	const holder = (page: number | null | undefined, folder: number | null) => [`page-${page}`, `folder-${folder}`].find((k) => nodes.has(k)) ?? null;
	const up = new Map<string, string | null>();
	for (const c of cats) up.set(`folder-${c.id}`, holder(c.parentPageId, c.parentId));
	for (const p of pages) up.set(`page-${p.id}`, holder(p.parentPageId, p.categoryId));

	// Una voce finita (per errore) dentro sé stessa va alla radice, invece di sparire.
	const looped = (key: string) => {
		const seen = new Set<string>();
		for (let k = up.get(key) ?? null; k !== null && !seen.has(k); k = up.get(k) ?? null) {
			if (k === key) return true;
			seen.add(k);
		}
		return false;
	};
	for (const [key, node] of nodes) {
		const parent = looped(key) ? null : up.get(key);
		(parent ? nodes.get(parent)! : root).items.push(node);
	}
	for (const d of dividers) {
		const parent = d.parentPageId ? nodes.get(`page-${d.parentPageId}`) : d.categoryId ? nodes.get(`folder-${d.categoryId}`) : root;
		parent?.items.push({ type: 'divider', id: d.id, sort: d.sort });
	}

	const tidy = (list: TreeNode[]): TreeNode[] => {
		const out = [];
		for (const n of list) {
			if (n.type !== 'divider') n.items = tidy(n.items);
			if (keepEmpty || n.type !== 'folder' || n.items.length) out.push(n);
		}
		out.sort(byOrder);
		return keepEmpty ? out : trimDividers(out);
	};
	root.items = tidy(root.items);
	return root;
}

/** I template hanno la loro linguetta: qui non ci sono, chi stava dentro di loro risale, e una cartella che aveva solo loro sparisce. */
export function withoutTemplates(list: TreeNode[]): TreeNode[] {
	return list.flatMap((n): TreeNode[] => {
		if (n.type === 'divider') return [n];
		const items = withoutTemplates(n.items);
		if (n.type === 'page' && n.kind === 'template') return items;
		return n.type === 'folder' && n.items.length && !items.length ? [] : [{ ...n, items }];
	});
}

/** Tutti i template dell'albero, dovunque stiano, per titolo. */
export function treeTemplates(list: TreeNode[]): TreePage[] {
	const out: TreePage[] = [];
	const walk = (nodes: TreeNode[]) => {
		for (const n of nodes) {
			if (n.type === 'page' && n.kind === 'template') out.push(n);
			walk(childrenOf(n));
		}
	};
	walk(list);
	return out.sort((a, b) => collator.compare(a.title, b.title));
}

/** Trova una voce: chi la contiene e la lista in cui sta. */
export function locate(list: TreeNode[], key: string, parent: string | null = null): { node: TreeNode; parent: string | null; list: TreeNode[] } | null {
	for (const node of list) {
		if (nodeKey(node) === key) return { node, parent, list };
		const hit = locate(childrenOf(node), key, nodeKey(node));
		if (hit) return hit;
	}
	return null;
}

/** Il percorso di una pagina, dalla radice fino a lei: cartelle e pagine si alternano come nell'albero. */
export function pageTrail(tree: Tree, id: number) {
	const trail: { type: 'folder' | 'page'; name: string; slug: string }[] = [];
	for (let hit = locate(tree.items, `page-${id}`); hit; hit = hit.parent ? locate(tree.items, hit.parent) : null) {
		if (hit.node.type !== 'divider') trail.unshift({ type: hit.node.type, name: labelOf(hit.node), slug: hit.node.slug });
	}
	return trail;
}

/** `key` può finire dentro `parent`? Non in un divisorio, non in sé stessa né in ciò che contiene. */
export function canHold(tree: Tree, key: string, parent: string | null): boolean {
	if (parent === null) return true;
	const holder = locate(tree.items, parent);
	const moved = locate(tree.items, key);
	return !!holder && !!moved && holder.node.type !== 'divider' && parent !== key && !locate(childrenOf(moved.node), parent);
}

/** Dove cade `moved` lasciandola prima, dopo o dentro la riga `key`; null se lì non può andare. */
export function placeAt(tree: Tree, moved: string, key: string, where: 'before' | 'after' | 'inside', isOpen: boolean): TreePlace | null {
	const target = locate(tree.items, key);
	if (!target || key === moved) return null;
	const inner = childrenOf(target.node).filter((n) => nodeKey(n) !== moved);
	// Sotto una cartella aperta c'è il suo contenuto: la riga lì in mezzo vuol dire «prima di tutto, dentro».
	const into = where === 'inside' || (where === 'after' && isOpen && inner.length > 0);
	if (into) return canHold(tree, moved, key) ? { parent: key, before: where === 'after' ? nodeKey(inner[0]) : null } : null;
	const after = target.list.slice(target.list.indexOf(target.node) + 1).find((n) => nodeKey(n) !== moved);
	const before = where === 'before' ? key : after ? nodeKey(after) : null;
	return canHold(tree, moved, target.parent) ? { parent: target.parent, before } : null;
}

/** Lo stesso da tastiera: su, giù, dentro la voce sopra, fuori dalla voce che la contiene. */
export function keyPlace(tree: Tree, key: string, dir: 'up' | 'down' | 'in' | 'out'): TreePlace | null {
	const here = locate(tree.items, key);
	if (!here) return null;
	const i = here.list.indexOf(here.node);
	const near = here.list[dir === 'down' ? i + 1 : i - 1];
	if (dir === 'out') return here.parent ? placeAt(tree, key, here.parent, 'after', false) : null;
	if (!near) return null;
	return placeAt(tree, key, nodeKey(near), dir === 'up' ? 'before' : dir === 'down' ? 'after' : 'inside', false);
}

/** Per ogni pagina e cartella, le voci da aprire per arrivarci (dalla radice), e tutte quelle che si aprono. */
export function treePaths(tree: Tree): { pages: Map<string, string[]>; folders: Map<string, string[]>; parents: string[] } {
	const pages = new Map<string, string[]>();
	const folders = new Map<string, string[]>();
	const parents: string[] = [];
	const walk = (list: TreeNode[], path: string[]) => {
		for (const n of list) {
			if (n.type === 'divider') continue;
			const here = [...path, nodeKey(n)];
			if (n.type === 'folder') folders.set(n.slug, here);
			else pages.set(n.slug, path);
			if (n.type === 'folder' || n.items.length) parents.push(nodeKey(n));
			walk(n.items, here);
		}
	};
	walk(tree.items, []);
	return { pages, folders, parents };
}

/** Albero delle cartelle (le categorie) e delle pagine, come in Esplora risorse. */
export interface TreePage {
	slug: string;
	title: string;
}

export interface TreeFolder {
	id: number;
	name: string;
	slug: string;
	folders: TreeFolder[];
	pages: TreePage[];
}

/** Radice: cartelle principali e pagine senza categoria. */
export interface Tree {
	folders: TreeFolder[];
	pages: TreePage[];
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** `keepEmpty` = mostra anche le cartelle senza pagine visibili (per chi gestisce le categorie). */
export function buildTree(
	cats: { id: number; name: string; slug: string; parentId: number | null }[],
	pages: { slug: string; title: string; categoryId: number | null }[],
	keepEmpty: boolean
): Tree {
	const byId = new Map(cats.map((c) => [c.id, c]));
	const nodes = new Map<number, TreeFolder>(cats.map((c) => [c.id, { id: c.id, name: c.name, slug: c.slug, folders: [], pages: [] }]));
	const root: Tree = { folders: [], pages: [] };

	// Una categoria finita (per errore) dentro sé stessa va alla radice, invece di sparire.
	const looped = (id: number) => {
		const seen = new Set<number>();
		for (let c: number | null = id; c !== null; c = byId.get(c)?.parentId ?? null) {
			if (seen.has(c)) return true;
			seen.add(c);
		}
		return false;
	};
	for (const c of cats) {
		const parent = c.parentId !== null && !looped(c.id) ? nodes.get(c.parentId) : undefined;
		(parent ?? root).folders.push(nodes.get(c.id)!);
	}
	for (const p of pages) {
		const folder = p.categoryId !== null ? nodes.get(p.categoryId) : undefined;
		(folder ?? root).pages.push({ slug: p.slug, title: p.title });
	}

	const tidy = (list: TreeFolder[]): TreeFolder[] => {
		const out = [];
		for (const f of list) {
			f.folders = tidy(f.folders);
			f.pages.sort((a, b) => collator.compare(a.title, b.title));
			if (keepEmpty || f.folders.length || f.pages.length) out.push(f);
		}
		return out.sort((a, b) => collator.compare(a.name, b.name));
	};
	root.folders = tidy(root.folders);
	root.pages.sort((a, b) => collator.compare(a.title, b.title));
	return root;
}

/** Per ogni pagina e cartella, le cartelle da aprire per arrivarci (dalla radice). */
export function treePaths(tree: Tree): { pages: Map<string, number[]>; folders: Map<string, number[]> } {
	const pages = new Map<string, number[]>();
	const folders = new Map<string, number[]>();
	const walk = (list: TreeFolder[], path: number[]) => {
		for (const f of list) {
			const here = [...path, f.id];
			folders.set(f.slug, here);
			for (const p of f.pages) pages.set(p.slug, here);
			walk(f.folders, here);
		}
	};
	walk(tree.folders, []);
	return { pages, folders };
}

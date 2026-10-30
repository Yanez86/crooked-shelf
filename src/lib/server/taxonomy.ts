import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { slugify } from '../slug.ts';
import { visibleTo } from './visibility.ts';
import { isMaster, type Viewer } from '../access.ts';
import { TAG_COLORS, type TagColor } from '../roles.ts';
import { buildTree, type Tree } from '../tree.ts';

const { categories, tags, pageTags, pages } = schema;

export interface CategoryNode {
	id: number;
	name: string;
	slug: string;
	parentId: number | null;
	description: string;
	depth: number;
	/** Percorso completo, es. "Luoghi › Città". */
	label: string;
	count: number;
	children: CategoryNode[];
}

function uniqueSlug(table: typeof categories | typeof tags, base: string, excludeId?: number): string {
	const db = getDb();
	let slug = base;
	for (let i = 2; ; i++) {
		const hit = db.select({ id: table.id }).from(table).where(eq(table.slug, slug)).get();
		if (!hit || hit.id === excludeId) return slug;
		slug = `${base}-${i}`;
	}
}

// --- Categorie ---

export function listCategories() {
	return getDb().select().from(categories).orderBy(asc(categories.name)).all();
}

/** Albero delle categorie con il numero di pagine visibili (sottocategorie escluse). */
export function categoryTree(u: Viewer | null): { roots: CategoryNode[]; flat: CategoryNode[] } {
	const db = getDb();
	const counts = new Map(
		db
			.select({ id: pages.categoryId, n: sql<number>`count(*)` })
			.from(pages)
			.where(visibleTo(u))
			.groupBy(pages.categoryId)
			.all()
			.map((r) => [r.id, r.n])
	);
	const nodes = new Map<number, CategoryNode>();
	for (const c of listCategories())
		nodes.set(c.id, { ...c, depth: 0, label: c.name, count: counts.get(c.id) ?? 0, children: [] });
	const roots: CategoryNode[] = [];
	for (const n of nodes.values()) {
		const parent = n.parentId ? nodes.get(n.parentId) : undefined;
		(parent ? parent.children : roots).push(n);
	}
	const flat: CategoryNode[] = [];
	const walk = (list: CategoryNode[], depth: number, prefix: string, seen: Set<number>) => {
		for (const n of list) {
			if (seen.has(n.id)) continue;
			seen.add(n.id);
			n.depth = depth;
			n.label = prefix + n.name;
			flat.push(n);
			walk(n.children, depth + 1, n.label + ' › ', seen);
		}
	};
	walk(roots, 0, '', new Set());
	return { roots, flat };
}

/** Cartelle e pagine visibili per l'albero a sinistra. Il Master vede anche le cartelle vuote. */
export function pageTree(u: Viewer | null): Tree {
	const rows = getDb()
		.select({ slug: pages.slug, title: pages.title, categoryId: pages.categoryId, icon: pages.icon, kind: pages.kind })
		.from(pages)
		.where(visibleTo(u))
		.all();
	return buildTree(listCategories(), rows, isMaster(u));
}

/** Id della categoria e di tutte le sue discendenti. */
export function categoryWithDescendants(id: number): number[] {
	const all = listCategories();
	const out = [id];
	for (let i = 0; i < out.length; i++) for (const c of all) if (c.parentId === out[i] && !out.includes(c.id)) out.push(c.id);
	return out;
}

export function getCategoryBySlug(slug: string) {
	return getDb().select().from(categories).where(eq(categories.slug, slug)).get();
}

export function getCategory(id: number) {
	return getDb().select().from(categories).where(eq(categories.id, id)).get();
}

/** Percorso dalla radice: [Luoghi, Regni, Città]. */
export function categoryPath(id: number | null) {
	const all = new Map(listCategories().map((c) => [c.id, c]));
	const path = [];
	const seen = new Set<number>();
	for (let c = id ? all.get(id) : undefined; c && !seen.has(c.id); c = c.parentId ? all.get(c.parentId) : undefined) {
		seen.add(c.id);
		path.unshift({ name: c.name, slug: c.slug });
	}
	return path;
}

export function createCategory(name: string, parentId: number | null, description = '') {
	return getDb()
		.insert(categories)
		.values({ name, slug: uniqueSlug(categories, slugify(name, 'category')), parentId, description })
		.returning()
		.get();
}

/** Impedisce che una categoria diventi figlia di sé stessa o di una sua discendente. */
export function validParent(id: number, parentId: number | null): boolean {
	return parentId === null || !categoryWithDescendants(id).includes(parentId);
}

export function updateCategory(id: number, name: string, parentId: number | null, description: string) {
	getDb()
		.update(categories)
		.set({ name, parentId, description, slug: uniqueSlug(categories, slugify(name, 'category'), id) })
		.where(eq(categories.id, id))
		.run();
}

/** Le sottocategorie passano al genitore, le pagine restano senza categoria. */
export function deleteCategory(id: number) {
	const db = getDb();
	const c = getCategory(id);
	if (!c) return;
	db.transaction((tx) => {
		tx.update(categories).set({ parentId: c.parentId }).where(eq(categories.parentId, id)).run();
		tx.delete(categories).where(eq(categories.id, id)).run();
	});
}

// --- Tag ---

export function parseTagNames(raw: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const t of raw.split(',')) {
		const name = t.trim().replace(/\s+/g, ' ').slice(0, 40);
		if (name && !seen.has(name.toLowerCase())) {
			seen.add(name.toLowerCase());
			out.push(name);
		}
	}
	return out.slice(0, 30);
}

/** Restituisce gli id dei tag, creando quelli nuovi. */
export function ensureTags(names: string[]): number[] {
	const db = getDb();
	return names.map((name) => {
		const hit = db.select({ id: tags.id }).from(tags).where(sql`${tags.name} = ${name} COLLATE NOCASE`).get();
		if (hit) return hit.id;
		return db
			.insert(tags)
			.values({ name, slug: uniqueSlug(tags, slugify(name, 'tag')) })
			.returning({ id: tags.id })
			.get().id;
	});
}

export function tagsForPages(ids: number[]) {
	if (!ids.length) return new Map<number, { name: string; slug: string; color: string }[]>();
	const rows = getDb()
		.select({ pageId: pageTags.pageId, name: tags.name, slug: tags.slug, color: tags.color })
		.from(pageTags)
		.innerJoin(tags, eq(tags.id, pageTags.tagId))
		.where(inArray(pageTags.pageId, ids))
		.orderBy(asc(tags.name))
		.all();
	const map = new Map<number, { name: string; slug: string; color: string }[]>();
	for (const r of rows) {
		const list = map.get(r.pageId) ?? [];
		list.push({ name: r.name, slug: r.slug, color: r.color });
		map.set(r.pageId, list);
	}
	return map;
}

/** Tag con il numero di pagine visibili; i tag senza pagine visibili restano nascosti a chi non gestisce. */
export function listTags(u: Viewer | null, includeEmpty = false) {
	const db = getDb();
	const rows = db
		.select({
			id: tags.id,
			name: tags.name,
			slug: tags.slug,
			color: tags.color,
			count: sql<number>`count(${pages.id})`
		})
		.from(tags)
		.leftJoin(pageTags, eq(pageTags.tagId, tags.id))
		.leftJoin(pages, and(eq(pages.id, pageTags.pageId), visibleTo(u)))
		.groupBy(tags.id)
		.orderBy(asc(tags.name))
		.all();
	return includeEmpty ? rows : rows.filter((r) => r.count > 0);
}

export function getTagBySlug(slug: string) {
	return getDb().select().from(tags).where(eq(tags.slug, slug)).get();
}

export function updateTag(id: number, name: string, color: TagColor) {
	getDb()
		.update(tags)
		.set({ name, color, slug: uniqueSlug(tags, slugify(name, 'tag'), id) })
		.where(eq(tags.id, id))
		.run();
}

export function deleteTag(id: number) {
	getDb().delete(tags).where(eq(tags.id, id)).run();
}

export const isTagColor = (c: unknown): c is TagColor => TAG_COLORS.includes(c as TagColor);

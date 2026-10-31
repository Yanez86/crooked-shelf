import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { isHomePage } from './settings.ts';
import { campaignId, currentCampaign, ofCampaign } from './campaigns.ts';
import { slugify } from '../slug.ts';
import { visibleTo } from './visibility.ts';
import { canEdit, canManage, isMaster, type Viewer } from '../access.ts';
import { TAG_COLORS, type TagColor } from '../roles.ts';
import { buildTree, canHold, locate, nodeKey, type Tree, type TreePlace } from '../tree.ts';

const { categories, tags, pageTags, pages, treeDividers } = schema;

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
		const hit = db.select({ id: table.id }).from(table).where(and(ofCampaign(table), eq(table.slug, slug))).get();
		if (!hit || hit.id === excludeId) return slug;
		slug = `${base}-${i}`;
	}
}

// --- Categorie ---

/** Le cartelle nel cestino non esistono per il resto della wiki. */
const alive = sql`${categories.deletedAt} IS NULL`;

export function listCategories() {
	return getDb().select().from(categories).where(and(ofCampaign(categories), alive)).orderBy(asc(categories.name)).all();
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

/** La home sta in cima alla radice, fuori da tutte le cartelle (anche se ci era finita prima), e non va nel cestino. */
const HOME_ROW = { categoryId: null, parentPageId: null, sort: 0, home: true, canTrash: false };

function readTree(where: SQL, keepEmpty: boolean, u: Viewer | null = null): Tree {
	const db = getDb();
	const rows = db
		.select({
			id: pages.id,
			slug: pages.slug,
			title: pages.title,
			categoryId: pages.categoryId,
			parentPageId: pages.parentPageId,
			sort: pages.sort,
			icon: pages.icon,
			kind: pages.kind,
			visibility: pages.visibility,
			authorId: pages.authorId,
			playersCanEdit: pages.playersCanEdit,
			hasSecret: pages.hasSecret
		})
		.from(pages)
		.where(where)
		.all()
		.map((p) => ({ ...p, canTrash: canEdit(p, u) && canManage(p, u), ...(isHomePage(p.id) && HOME_ROW) }));
	return buildTree(listCategories(), rows, keepEmpty, db.select().from(treeDividers).where(ofCampaign(treeDividers)).all());
}

/** Cartelle e pagine visibili per l'albero a sinistra. Il Master vede anche le cartelle vuote. */
export function pageTree(u: Viewer | null): Tree {
	return readTree(visibleTo(u), isMaster(u), u);
}

/** Una pagina cambia cartella: quelle annidate dentro di lei la seguono. */
export function syncBranch(pageId: number, categoryId: number | null) {
	getDb().run(sql`
		WITH RECURSIVE branch(id) AS (
			SELECT id FROM pages WHERE parent_page_id = ${pageId}
			UNION SELECT p.id FROM pages p JOIN branch b ON p.parent_page_id = b.id
		)
		UPDATE pages SET category_id = ${categoryId} WHERE id IN branch
	`);
}

/** Sposta una voce dell'albero. L'ordine si riscrive su tutta la lista, anche sulle pagine che chi sposta non vede. */
export function moveTreeNode(u: Viewer, key: string, place: TreePlace): boolean {
	const seen = pageTree(u);
	if (!locate(seen.items, key) || (place.parent && !locate(seen.items, place.parent))) return false;
	if (key === `page-${currentCampaign().homePageId}`) return false;
	const all = readTree(and(ofCampaign(pages), sql`${pages.deletedAt} IS NULL`)!, true);
	const moved = locate(all.items, key);
	if (!moved || !canHold(all, key, place.parent)) return false;
	const holder = place.parent ? locate(all.items, place.parent)!.node : null;
	const list = (holder && holder.type !== 'divider' ? holder.items : all.items).filter((n) => nodeKey(n) !== key);
	const at = list.findIndex((n) => nodeKey(n) === place.before);
	list.splice(at < 0 ? list.length : at, 0, moved.node);

	const parentPageId = holder?.type === 'page' ? holder.id : null;
	const folderId = holder?.type === 'folder' ? holder.id : null;
	const db = getDb();
	db.transaction(() => {
		list.forEach((n, i) => {
			const table = n.type === 'folder' ? categories : n.type === 'page' ? pages : treeDividers;
			db.update(table).set({ sort: i + 1 }).where(eq(table.id, n.id)).run();
		});
		const { node } = moved;
		if (node.type === 'folder') {
			db.update(categories).set({ parentId: folderId, parentPageId }).where(eq(categories.id, node.id)).run();
		} else if (node.type === 'divider') {
			db.update(treeDividers).set({ categoryId: folderId, parentPageId }).where(eq(treeDividers.id, node.id)).run();
		} else {
			// Dentro una pagina si resta nella sua cartella: elenchi e percorsi non cambiano.
			const categoryId = parentPageId ? (db.select({ c: pages.categoryId }).from(pages).where(eq(pages.id, parentPageId)).get()?.c ?? null) : folderId;
			db.update(pages).set({ parentPageId, categoryId }).where(eq(pages.id, node.id)).run();
			syncBranch(node.id, categoryId);
		}
	});
	return true;
}

/** Un divisorio nasce in fondo alla radice; da lì si trascina dove serve. */
export function createDivider() {
	return getDb().insert(treeDividers).values({ campaignId: campaignId() }).returning().get();
}

export function deleteDivider(id: number) {
	getDb().delete(treeDividers).where(and(ofCampaign(treeDividers), eq(treeDividers.id, id))).run();
}

/** Id della categoria e di tutte le sue discendenti. */
export function categoryWithDescendants(id: number): number[] {
	const all = listCategories();
	const out = [id];
	for (let i = 0; i < out.length; i++) for (const c of all) if (c.parentId === out[i] && !out.includes(c.id)) out.push(c.id);
	return out;
}

export function getCategoryBySlug(slug: string) {
	return getDb().select().from(categories).where(and(ofCampaign(categories), eq(categories.slug, slug), alive)).get();
}

export function getCategory(id: number) {
	return getDb().select().from(categories).where(and(ofCampaign(categories), eq(categories.id, id), alive)).get();
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
		.values({ campaignId: campaignId(), name, slug: uniqueSlug(categories, slugify(name, 'category')), parentId, description })
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
		.set({ name, parentId, description, slug: uniqueSlug(categories, slugify(name, 'category'), id), ...(parentId !== null ? { parentPageId: null } : {}) })
		.where(and(ofCampaign(categories), eq(categories.id, id)))
		.run();
}

/** Le sottocategorie passano al genitore, le pagine restano senza categoria. */
export function deleteCategory(id: number) {
	const db = getDb();
	const c = getCategory(id);
	if (!c) return;
	db.transaction((tx) => {
		tx.update(categories).set({ parentId: c.parentId, parentPageId: c.parentPageId }).where(eq(categories.parentId, id)).run();
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
		const hit = db.select({ id: tags.id }).from(tags).where(and(ofCampaign(tags), sql`${tags.name} = ${name} COLLATE NOCASE`)).get();
		if (hit) return hit.id;
		return db
			.insert(tags)
			.values({ campaignId: campaignId(), name, slug: uniqueSlug(tags, slugify(name, 'tag')) })
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
		.where(ofCampaign(tags))
		.groupBy(tags.id)
		.orderBy(asc(tags.name))
		.all();
	return includeEmpty ? rows : rows.filter((r) => r.count > 0);
}

export function getTagBySlug(slug: string) {
	return getDb().select().from(tags).where(and(ofCampaign(tags), eq(tags.slug, slug))).get();
}

export function updateTag(id: number, name: string, color: TagColor) {
	getDb()
		.update(tags)
		.set({ name, color, slug: uniqueSlug(tags, slugify(name, 'tag'), id) })
		.where(and(ofCampaign(tags), eq(tags.id, id)))
		.run();
}

export function deleteTag(id: number) {
	getDb().delete(tags).where(and(ofCampaign(tags), eq(tags.id, id))).run();
}

export const isTagColor = (c: unknown): c is TagColor => TAG_COLORS.includes(c as TagColor);

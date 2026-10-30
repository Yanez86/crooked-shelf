import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { slugify } from '../slug.ts';
import { canView, isMaster, type Viewer } from '../access.ts';
import { visibleTo } from './visibility.ts';
import type { PageRow } from './pages.ts';

const { maps, mapLayers, mapPins, pages } = schema;

export type MapRow = typeof maps.$inferSelect;
export type PinRow = typeof mapPins.$inferSelect;
export type LayerRow = typeof mapLayers.$inferSelect;

export const PIN_ICONS = ['pin', 'city', 'castle', 'dungeon', 'tavern', 'temple', 'camp', 'danger', 'treasure', 'portal', 'star'] as const;
export const PIN_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'gray'] as const;

/** La pagina di una mappa si vede con le regole di tutte le pagine (e non se è nel cestino). */
const canSeePage = (p: Pick<PageRow, 'visibility' | 'authorId' | 'deletedAt'>, u: Viewer | null) =>
	p.deletedAt === null && canView({ visibility: p.visibility, authorId: p.authorId, playersCanEdit: false, hasSecret: false }, u);

/** Le mappe che chi guarda può vedere, con indirizzo e titolo della loro pagina. */
export function listMaps(u: Viewer | null) {
	return getDb()
		.select({ id: maps.id, pageId: pages.id, slug: pages.slug, title: pages.title, fileId: maps.fileId, parentId: maps.parentId, width: maps.width, height: maps.height })
		.from(maps)
		.innerJoin(pages, eq(pages.id, maps.pageId))
		.where(visibleTo(u))
		.orderBy(sql`${pages.title} COLLATE NOCASE`, asc(maps.id))
		.all();
}

export function getMap(id: number) {
	return getDb().select().from(maps).where(eq(maps.id, id)).get();
}

export function getMapOfPage(pageId: number) {
	return getDb().select().from(maps).where(eq(maps.pageId, pageId)).get();
}

/** Mappa e pagina, per i vecchi indirizzi /maps/<slug>. */
export function pageOfOldMapSlug(slug: string) {
	return getDb()
		.select({ slug: pages.slug, visibility: pages.visibility, authorId: pages.authorId, deletedAt: pages.deletedAt })
		.from(maps)
		.innerJoin(pages, eq(pages.id, maps.pageId))
		.where(eq(maps.slug, slug))
		.get();
}

function uniqueMapSlug(base: string, excludeId?: number) {
	let slug = base;
	for (let i = 2; ; i++) {
		const hit = getDb().select({ id: maps.id }).from(maps).where(eq(maps.slug, slug)).get();
		if (!hit || hit.id === excludeId) return slug;
		slug = `${base}-${i}`;
	}
}

/** Le impostazioni della mappa; titolo, testo e visibilità sono quelli della pagina. */
export interface MapInput {
	parentId: number | null;
	scale: number | null;
	unit: string;
}

export function createMap(page: Pick<PageRow, 'id' | 'slug' | 'title'>, input: MapInput, file: { id: string; width: number; height: number }, userId: number): MapRow {
	const now = Date.now();
	return getDb()
		.insert(maps)
		.values({
			...input,
			pageId: page.id,
			slug: uniqueMapSlug(slugify(page.slug, 'map')),
			title: page.title,
			visibility: 'master',
			fileId: file.id,
			width: file.width,
			height: file.height,
			createdBy: userId,
			createdAt: now,
			updatedAt: now
		})
		.returning()
		.get();
}

export function updateMap(id: number, input: MapInput, file?: { id: string; width: number; height: number }) {
	getDb()
		.update(maps)
		.set({
			...input,
			...(file ? { fileId: file.id, width: file.width, height: file.height } : {}),
			updatedAt: Date.now()
		})
		.where(eq(maps.id, id))
		.run();
}

/** Una mappa non può essere contenuta in sé stessa (anche indirettamente). */
export function validParentMap(id: number, parentId: number | null): boolean {
	const seen = new Set<number>([id]);
	for (let p = parentId; p !== null; ) {
		if (seen.has(p)) return false;
		seen.add(p);
		p = getMap(p)?.parentId ?? null;
	}
	return true;
}

/** Le mappe che contengono questa, dalla più grande, che chi guarda può vedere. */
export function mapPath(map: MapRow, u: Viewer | null) {
	const out: { slug: string; title: string }[] = [];
	const seen = new Set([map.id]);
	for (let id = map.parentId; id !== null && !seen.has(id); ) {
		seen.add(id);
		const r = getDb()
			.select({ parentId: maps.parentId, slug: pages.slug, title: pages.title, visibility: pages.visibility, authorId: pages.authorId, deletedAt: pages.deletedAt })
			.from(maps)
			.innerJoin(pages, eq(pages.id, maps.pageId))
			.where(eq(maps.id, id))
			.get();
		if (!r) break;
		if (canSeePage(r, u)) out.unshift({ slug: r.slug, title: r.title });
		id = r.parentId;
	}
	return out;
}

// --- Livelli e pin ---

export function layersOf(mapId: number, u: Viewer | null) {
	const vis = isMaster(u) ? sql`1=1` : sql`${mapLayers.visibility} = 'players'`;
	return getDb().select().from(mapLayers).where(and(eq(mapLayers.mapId, mapId), vis)).orderBy(asc(mapLayers.sort), asc(mapLayers.id)).all();
}

/** Pin visibili: il pin, il suo livello e la mappa di destinazione devono essere visibili. */
export function pinsOf(mapId: number, u: Viewer | null) {
	const master = isMaster(u);
	const layers = new Map(getDb().select().from(mapLayers).where(eq(mapLayers.mapId, mapId)).all().map((l) => [l.id, l]));
	const rows = getDb().select().from(mapPins).where(eq(mapPins.mapId, mapId)).orderBy(asc(mapPins.label)).all();
	const targets = new Map(
		rows.some((r) => r.targetMapId)
			? getDb()
					.select({ id: maps.id, slug: pages.slug, title: pages.title, visibility: pages.visibility, authorId: pages.authorId, deletedAt: pages.deletedAt })
					.from(maps)
					.innerJoin(pages, eq(pages.id, maps.pageId))
					.where(inArray(maps.id, rows.map((r) => r.targetMapId ?? -1)))
					.all()
					.map((m) => [m.id, m])
			: []
	);
	return rows
		.filter((r) => master || (r.visibility === 'players' && (!r.layerId || layers.get(r.layerId)?.visibility === 'players')))
		.map((r) => {
			const t = r.targetMapId ? targets.get(r.targetMapId) : undefined;
			return { ...r, target: t && canSeePage(t, u) ? { slug: t.slug, title: t.title } : null };
		});
}

export function getPin(id: number) {
	return getDb().select().from(mapPins).where(eq(mapPins.id, id)).get();
}

export interface PinInput {
	x: number;
	y: number;
	label: string;
	description: string;
	icon: string;
	color: string;
	pageSlug: string | null;
	targetMapId: number | null;
	layerId: number | null;
	visibility: 'players' | 'master';
}

export function savePin(mapId: number, input: PinInput, id?: number): number {
	if (id) {
		getDb().update(mapPins).set(input).where(and(eq(mapPins.id, id), eq(mapPins.mapId, mapId))).run();
		return id;
	}
	return getDb()
		.insert(mapPins)
		.values({ ...input, mapId })
		.returning({ id: mapPins.id })
		.get().id;
}

export function movePin(mapId: number, id: number, x: number, y: number) {
	getDb().update(mapPins).set({ x, y }).where(and(eq(mapPins.id, id), eq(mapPins.mapId, mapId))).run();
}

export function deletePin(mapId: number, id: number) {
	getDb().delete(mapPins).where(and(eq(mapPins.id, id), eq(mapPins.mapId, mapId))).run();
}

export function saveLayer(mapId: number, name: string, visibility: 'players' | 'master', id?: number): number {
	if (id) {
		getDb().update(mapLayers).set({ name, visibility }).where(and(eq(mapLayers.id, id), eq(mapLayers.mapId, mapId))).run();
		return id;
	}
	const n = getDb().select({ n: sql<number>`count(*)` }).from(mapLayers).where(eq(mapLayers.mapId, mapId)).get()?.n ?? 0;
	return getDb().insert(mapLayers).values({ mapId, name, visibility, sort: n }).returning({ id: mapLayers.id }).get().id;
}

export function deleteLayer(mapId: number, id: number) {
	getDb().delete(mapLayers).where(and(eq(mapLayers.id, id), eq(mapLayers.mapId, mapId))).run();
}

/** Mappe (visibili) dove una pagina ha un pin: compare nella pagina. */
export function mapsForPage(slug: string, u: Viewer | null) {
	const master = isMaster(u);
	const rows = getDb()
		.select({
			slug: pages.slug,
			title: pages.title,
			visibility: pages.visibility,
			authorId: pages.authorId,
			deletedAt: pages.deletedAt,
			pinVis: mapPins.visibility,
			layerVis: mapLayers.visibility
		})
		.from(mapPins)
		.innerJoin(maps, eq(maps.id, mapPins.mapId))
		.innerJoin(pages, eq(pages.id, maps.pageId))
		.leftJoin(mapLayers, eq(mapLayers.id, mapPins.layerId))
		.where(eq(mapPins.pageSlug, slug))
		.all();
	const out = new Map<string, string>();
	for (const r of rows)
		if (canSeePage(r, u) && (master || (r.pinVis === 'players' && (r.layerVis ?? 'players') === 'players'))) out.set(r.slug, r.title);
	return [...out].map(([slug, title]) => ({ slug, title }));
}

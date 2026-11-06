import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { canView, isMaster, type Viewer } from '../access.ts';
import { ofCampaign, pageInCampaign } from './campaigns.ts';
import { pluginHexTilesets } from './plugins.ts';
import { translate } from '../i18n/index.ts';
import { HEX_RANGE, hexKey, hexLabel, isHexState, neighbors, topLeft, type Axial, type HexOrientation, type HexOrigin, type HexState } from '../hex.ts';
import { BUILTIN_TERRAINS, BUILTIN_TILESET, FALLBACK_TERRAIN, TERRAIN_ID, terrainName, type HexTerrain, type HexTileset } from '../hexTiles.ts';
import type { PageRow } from './pages.ts';

/**
 * Mappe a esagoni. La regola che conta: a chi non è Master arrivano solo gli esagoni scoperti (intravisti o esplorati)
 * e, negli esagoni esplorati, solo gli elementi per i giocatori. Un esagono nascosto non arriva per niente: né il
 * terreno, né le coordinate, né cosa c'è dentro, così dal browser non si indovina neanche quanto è grande la mappa.
 * Le note degli esagoni sono del Master. Tutte le letture per chi guarda passano da `visibleCells` e `visibleFeatures`.
 */
const { hexMaps, hexCells, hexFeatures, pages } = schema;

export type HexMapRow = typeof hexMaps.$inferSelect;
export type HexCellRow = typeof hexCells.$inferSelect;
export type HexFeatureRow = typeof hexFeatures.$inferSelect;

/** Quanti esagoni può avere una mappa (e fin dove può arrivare: HEX_RANGE in hex.ts). */
export const HEX_MAX_CELLS = 5000;
/** Quanti esagoni si cambiano in una volta sola (una pennellata). */
export const HEX_BATCH = 500;

export const inRange = (h: Axial) => Number.isInteger(h.q) && Number.isInteger(h.r) && Math.abs(h.q) <= HEX_RANGE && Math.abs(h.r) <= HEX_RANGE;

export interface HexMapInput {
	orientation: HexOrientation;
	scale: number | null;
	unit: string;
	tileset: string;
}

/** Una mappa nuova parte da un esagono solo, al centro, nascosto ai giocatori: da lì il Master la allarga. */
export function createHexMap(pageId: number, input: HexMapInput, firstTerrain = 'plains'): HexMapRow {
	const now = Date.now();
	const row = getDb()
		.insert(hexMaps)
		.values({ ...input, pageId, createdAt: now, updatedAt: now })
		.returning()
		.get();
	getDb().insert(hexCells).values({ mapId: row.id, q: 0, r: 0, terrain: firstTerrain, state: 'hidden' }).run();
	return row;
}

export const getHexMapOfPage = (pageId: number) => getDb().select().from(hexMaps).where(eq(hexMaps.pageId, pageId)).get();

export const getHexMap = (id: number) => getDb().select().from(hexMaps).where(and(eq(hexMaps.id, id), pageInCampaign(hexMaps.pageId))).get();

/**
 * Cambia le impostazioni. Con `renumber`, o cambiando orientamento (i numeri cambiano comunque), la numerazione
 * riparte dall'esagono più in alto a sinistra: ferma se i giocatori hanno già scoperto qualcosa, altrimenti automatica.
 */
export function updateHexMap(id: number, input: HexMapInput, renumber = false) {
	getDb().transaction(() => {
		const before = getDb().select().from(hexMaps).where(eq(hexMaps.id, id)).get();
		if (!before) return;
		const again = renumber || before.orientation !== input.orientation;
		const known = again && getDb().select({ q: hexCells.q }).from(hexCells).where(and(eq(hexCells.mapId, id), sql`${hexCells.state} <> 'hidden'`)).get();
		const origin = again ? (known ? topLeft(cellsOf(id), input.orientation) : null) : undefined;
		getDb()
			.update(hexMaps)
			.set({ ...input, ...(origin !== undefined ? { originCol: origin?.col ?? null, originRow: origin?.row ?? null } : {}), updatedAt: Date.now() })
			.where(eq(hexMaps.id, id))
			.run();
	});
}

/** Da dove si contano i numeri: quella ferma, altrimenti l'angolo in alto a sinistra di tutti gli esagoni. */
export function labelOrigin(map: Pick<HexMapRow, 'id' | 'orientation' | 'originCol' | 'originRow'>): HexOrigin {
	return map.originCol !== null && map.originRow !== null ? { col: map.originCol, row: map.originRow } : topLeft(cellsOf(map.id), map.orientation);
}

/** Alla prima scoperta la numerazione si ferma: i numeri che i giocatori vedono non cambieranno più da soli. */
function freezeOrigin(mapId: number) {
	const map = getDb().select().from(hexMaps).where(eq(hexMaps.id, mapId)).get();
	if (!map || map.originCol !== null) return;
	const o = labelOrigin(map);
	getDb().update(hexMaps).set({ originCol: o.col, originRow: o.row }).where(eq(hexMaps.id, mapId)).run();
}

const touch = (mapId: number) => getDb().update(hexMaps).set({ updatedAt: Date.now() }).where(eq(hexMaps.id, mapId)).run();

// --- Set di tasselli ---

/** Il set incluso, coi nomi nella lingua di chi guarda. */
export function builtinTileset(locale: string): HexTileset {
	return {
		id: BUILTIN_TILESET,
		name: translate(locale, 'hex.tilesets.tratto'),
		source: '',
		license: '',
		terrains: BUILTIN_TERRAINS.map((t) => ({ ...t, name: translate(locale, `hex.terrains.${t.id}`) }))
	};
}

/** Tutti i set tra cui scegliere: l'incluso e quelli dei plugin accesi. */
export function hexTilesets(locale: string): HexTileset[] {
	return [
		builtinTileset(locale),
		...pluginHexTilesets().map((t) => ({ ...t, terrains: t.terrains.map((x) => ({ ...x, name: terrainName(x.name, locale) })) }))
	];
}

/** Il set della mappa; se non c'è più (plugin spento o tolto) si usa quello incluso. */
export function tilesetOf(map: Pick<HexMapRow, 'tileset'>, locale: string): { set: HexTileset; missing: boolean } {
	const all = hexTilesets(locale);
	const set = all.find((t) => t.id === map.tileset);
	return { set: set ?? all[0], missing: !set };
}

export const validTileset = (id: string) => id === BUILTIN_TILESET || pluginHexTilesets().some((t) => t.id === id);

/** Come si disegna un terreno: dal set della mappa, poi dal set incluso, altrimenti colore di riserva e il suo id. */
export function terrainLook(id: string, set: HexTileset, builtin: HexTileset): HexTerrain & { fallback: boolean } {
	const t = set.terrains.find((x) => x.id === id) ?? builtin.terrains.find((x) => x.id === id);
	return t ? { ...t, fallback: false } : { id, name: id, ...FALLBACK_TERRAIN, glyph: '', fallback: true };
}

// --- Letture ---

export const cellsOf = (mapId: number) => getDb().select().from(hexCells).where(eq(hexCells.mapId, mapId)).orderBy(asc(hexCells.r), asc(hexCells.q)).all();

export const getCell = (mapId: number, h: Axial) =>
	getDb()
		.select()
		.from(hexCells)
		.where(and(eq(hexCells.mapId, mapId), eq(hexCells.q, h.q), eq(hexCells.r, h.r)))
		.get();

export const featuresOf = (mapId: number) =>
	getDb().select().from(hexFeatures).where(eq(hexFeatures.mapId, mapId)).orderBy(asc(hexFeatures.sort), asc(hexFeatures.id)).all();

export const getFeature = (mapId: number, id: number) =>
	getDb()
		.select()
		.from(hexFeatures)
		.where(and(eq(hexFeatures.mapId, mapId), eq(hexFeatures.id, id)))
		.get();

/** Gli esagoni che chi guarda riceve. Al Master tutti, agli altri solo quelli scoperti e senza la nota. */
export function visibleCells(mapId: number, u: Viewer | null): HexCellRow[] {
	const all = cellsOf(mapId);
	return isMaster(u) ? all : all.filter((c) => c.state !== 'hidden').map((c) => ({ ...c, note: '' }));
}

/** Gli elementi che chi guarda riceve: al Master tutti, agli altri quelli per i giocatori negli esagoni esplorati. */
export function visibleFeatures(mapId: number, u: Viewer | null): HexFeatureRow[] {
	const all = featuresOf(mapId);
	if (isMaster(u)) return all;
	const explored = new Set(
		cellsOf(mapId)
			.filter((c) => c.state === 'explored')
			.map((c) => hexKey(c.q, c.r))
	);
	return all.filter((f) => f.visibility === 'players' && explored.has(hexKey(f.q, f.r)));
}

/** Il segnalino del gruppo, se chi guarda vede l'esagono dove sta. */
export function visibleParty(map: HexMapRow, u: Viewer | null): Axial | null {
	if (map.partyQ === null || map.partyR === null) return null;
	const at = { q: map.partyQ, r: map.partyR };
	const cell = getCell(map.id, at);
	if (!cell) return null;
	return isMaster(u) || cell.state !== 'hidden' ? at : null;
}

// --- Modifiche (le fa il Master: lo controlla chi chiama) ---

const cellWhere = (mapId: number, list: Axial[]) =>
	and(eq(hexCells.mapId, mapId), sql`(${hexCells.q}, ${hexCells.r}) IN (${sql.join(list.map((h) => sql`(${h.q}, ${h.r})`), sql`, `)})`);

/** Toglie i doppioni e quelli fuori dai confini; al massimo `HEX_BATCH`. */
export function cleanCells(list: unknown): Axial[] {
	const out = new Map<string, Axial>();
	for (const raw of Array.isArray(list) ? list.slice(0, HEX_BATCH) : []) {
		const h = { q: Number((raw as Axial)?.q), r: Number((raw as Axial)?.r) };
		if (inRange(h)) out.set(hexKey(h.q, h.r), h);
	}
	return [...out.values()];
}

const countCells = (mapId: number) => getDb().select({ n: sql<number>`count(*)` }).from(hexCells).where(eq(hexCells.mapId, mapId)).get()?.n ?? 0;

/**
 * Dipinge gli esagoni col terreno; quelli che non c'erano nascono nascosti ai giocatori.
 * Restituisce quanti ne ha aggiunti, o `null` se la mappa diventerebbe troppo grande (allora non cambia niente).
 */
export function paintCells(mapId: number, list: Axial[], terrain: string): number | null {
	if (!list.length) return 0;
	return getDb().transaction(() => {
		const existing = new Set(
			getDb()
				.select({ q: hexCells.q, r: hexCells.r })
				.from(hexCells)
				.where(cellWhere(mapId, list))
				.all()
				.map((c) => hexKey(c.q, c.r))
		);
		const fresh = list.filter((h) => !existing.has(hexKey(h.q, h.r)));
		if (countCells(mapId) + fresh.length > HEX_MAX_CELLS) return null;
		if (existing.size) getDb().update(hexCells).set({ terrain }).where(cellWhere(mapId, list)).run();
		if (fresh.length) getDb().insert(hexCells).values(fresh.map((h) => ({ mapId, q: h.q, r: h.r, terrain, state: 'hidden' as const }))).run();
		touch(mapId);
		return fresh.length;
	});
}

/** Cambia cosa sanno i giocatori. Scoprire un esagono (anche solo intravederlo) ne segna la data, se non l'aveva. */
export function setCellsState(mapId: number, list: Axial[], state: HexState, now = Date.now()) {
	if (!list.length) return;
	if (state !== 'hidden') freezeOrigin(mapId);
	getDb()
		.update(hexCells)
		.set({ state, revealedAt: state === 'hidden' ? null : sql`coalesce(${hexCells.revealedAt}, ${now})` })
		.where(cellWhere(mapId, list))
		.run();
	touch(mapId);
}

/**
 * Toglie gli esagoni. Quelli con dentro qualcosa restano (togliere un esagono non deve portarsi via una città per
 * un clic sbagliato): prima si tolgono gli elementi. Neanche quello col gruppo si toglie. Restituisce quelli rimasti.
 */
export function removeCells(mapId: number, list: Axial[]): Axial[] {
	if (!list.length) return [];
	return getDb().transaction(() => {
		const map = getDb().select().from(hexMaps).where(eq(hexMaps.id, mapId)).get();
		const busy = new Set(
			getDb()
				.select({ q: hexFeatures.q, r: hexFeatures.r })
				.from(hexFeatures)
				.where(eq(hexFeatures.mapId, mapId))
				.all()
				.map((f) => hexKey(f.q, f.r))
		);
		if (map && map.partyQ !== null && map.partyR !== null) busy.add(hexKey(map.partyQ, map.partyR));
		const kept = list.filter((h) => busy.has(hexKey(h.q, h.r)));
		const gone = list.filter((h) => !busy.has(hexKey(h.q, h.r)));
		// L'ultimo esagono resta: una mappa vuota non avrebbe da dove ripartire.
		if (gone.length && countCells(mapId) - gone.length < 1) return list;
		if (gone.length) getDb().delete(hexCells).where(cellWhere(mapId, gone)).run();
		touch(mapId);
		return kept;
	});
}

/** L'esagono e quelli intorno: il primo diventa esplorato, i vicini nascosti diventano intravisti. */
export function revealAround(mapId: number, at: Axial, now = Date.now()) {
	getDb().transaction(() => {
		setCellsState(mapId, [at], 'explored', now);
		const around = neighbors(at);
		const hidden = getDb()
			.select({ q: hexCells.q, r: hexCells.r })
			.from(hexCells)
			.where(and(cellWhere(mapId, around), eq(hexCells.state, 'hidden')))
			.all();
		setCellsState(mapId, hidden, 'glimpsed', now);
	});
}

/** Sposta il gruppo su un esagono che c'è (o lo toglie dalla mappa con `null`); con `reveal` scopre lì intorno. */
export function moveParty(mapId: number, at: Axial | null, reveal: boolean, now = Date.now()): boolean {
	if (at && !getCell(mapId, at)) return false;
	getDb().transaction(() => {
		getDb()
			.update(hexMaps)
			.set({ partyQ: at?.q ?? null, partyR: at?.r ?? null, updatedAt: now })
			.where(eq(hexMaps.id, mapId))
			.run();
		if (at && reveal) revealAround(mapId, at, now);
	});
	return true;
}

export function setCellNote(mapId: number, at: Axial, note: string) {
	getDb()
		.update(hexCells)
		.set({ note })
		.where(and(eq(hexCells.mapId, mapId), eq(hexCells.q, at.q), eq(hexCells.r, at.r)))
		.run();
	touch(mapId);
}

export interface HexFeatureInput {
	q: number;
	r: number;
	icon: string;
	name: string;
	description: string;
	pageSlug: string | null;
	visibility: 'players' | 'master';
}

export function saveFeature(mapId: number, input: HexFeatureInput, id?: number): number {
	const db = getDb();
	const out = id
		? (db.update(hexFeatures).set(input).where(and(eq(hexFeatures.id, id), eq(hexFeatures.mapId, mapId))).run(), id)
		: db
				.insert(hexFeatures)
				.values({
					...input,
					mapId,
					sort:
						db
							.select({ n: sql<number>`count(*)` })
							.from(hexFeatures)
							.where(and(eq(hexFeatures.mapId, mapId), eq(hexFeatures.q, input.q), eq(hexFeatures.r, input.r)))
							.get()?.n ?? 0
				})
				.returning({ id: hexFeatures.id })
				.get().id;
	touch(mapId);
	return out;
}

export function deleteFeature(mapId: number, id: number) {
	getDb()
		.delete(hexFeatures)
		.where(and(eq(hexFeatures.id, id), eq(hexFeatures.mapId, mapId)))
		.run();
	touch(mapId);
}

// --- Le altre pagine ---

/** Pagina e mappa, per sapere se chi guarda vede la pagina della mappa (e non è nel cestino). */
const canSeePage = (p: Pick<PageRow, 'visibility' | 'authorId' | 'deletedAt'>, u: Viewer | null) =>
	p.deletedAt === null && canView({ visibility: p.visibility, authorId: p.authorId, playersCanEdit: false, hasSecret: false }, u);

/** Le mappe a esagoni (visibili) dove un elemento che chi guarda vede porta a questa pagina: compaiono nella pagina. */
export function hexMapsForPage(slug: string, u: Viewer | null) {
	const rows = getDb()
		.select({
			mapId: hexMaps.id,
			slug: pages.slug,
			title: pages.title,
			visibility: pages.visibility,
			authorId: pages.authorId,
			deletedAt: pages.deletedAt
		})
		.from(hexFeatures)
		.innerJoin(hexMaps, eq(hexMaps.id, hexFeatures.mapId))
		.innerJoin(pages, eq(pages.id, hexMaps.pageId))
		.where(and(ofCampaign(pages), eq(hexFeatures.pageSlug, slug)))
		.all();
	const out = new Map<string, string>();
	for (const r of rows) {
		if (out.has(r.slug) || !canSeePage(r, u)) continue;
		if (visibleFeatures(r.mapId, u).some((f) => f.pageSlug === slug)) out.set(r.slug, r.title);
	}
	return [...out].map(([slug, title]) => ({ slug, title }));
}

// --- Pacchetto mondo ed esportazione ---

export interface HexExport {
	orientation: HexOrientation;
	scale: number | null;
	unit: string;
	tileset: string;
	origin: HexOrigin | null;
	party: Axial | null;
	cells: { q: number; r: number; terrain: string; state: HexState; note?: string }[];
	features: { q: number; r: number; icon: string; name: string; description: string; page: string | null; visibility: 'players' | 'master' }[];
}

/**
 * La mappa per il pacchetto mondo. Con i segreti, tutta; senza, come la vede un giocatore: gli esagoni scoperti, gli
 * elementi per i giocatori in quelli esplorati, niente note.
 */
export function exportHexMap(pageId: number, secrets: boolean): HexExport | undefined {
	const map = getHexMapOfPage(pageId);
	if (!map) return undefined;
	const as: Viewer = secrets ? { id: 0, role: 'master' } : { id: 0, role: 'player' };
	return {
		orientation: map.orientation,
		scale: map.scale,
		unit: map.unit,
		tileset: map.tileset,
		origin: map.originCol !== null && map.originRow !== null ? { col: map.originCol, row: map.originRow } : null,
		party: visibleParty(map, as),
		cells: visibleCells(map.id, as).map((c) => ({ q: c.q, r: c.r, terrain: c.terrain, state: c.state, ...(secrets && c.note ? { note: c.note } : {}) })),
		features: visibleFeatures(map.id, as).map((f) => ({ q: f.q, r: f.r, icon: f.icon, name: f.name, description: f.description, page: f.pageSlug, visibility: f.visibility }))
	};
}

/** Mette nella mappa gli esagoni e gli elementi di un pacchetto, al posto di quelli che c'erano. Quello scritto male si salta. */
export function importHexMap(pageId: number, data: Partial<HexExport>, pageSlug: (slug: string) => string, icons: readonly string[]) {
	const input: HexMapInput = {
		orientation: data.orientation === 'pointy' ? 'pointy' : 'flat',
		scale: typeof data.scale === 'number' && data.scale > 0 ? data.scale : null,
		unit: String(data.unit ?? '').slice(0, 20),
		tileset: typeof data.tileset === 'string' && validTileset(data.tileset) ? data.tileset : 'tratto'
	};
	getDb().transaction(() => {
		const old = getHexMapOfPage(pageId);
		const mapId = old?.id ?? getDb().insert(hexMaps).values({ ...input, pageId, createdAt: Date.now(), updatedAt: Date.now() }).returning().get().id;
		if (old) {
			getDb().delete(hexCells).where(eq(hexCells.mapId, mapId)).run();
			getDb().delete(hexFeatures).where(eq(hexFeatures.mapId, mapId)).run();
		}
		const seen = new Set<string>();
		const cells = (Array.isArray(data.cells) ? data.cells : [])
			.map((c) => ({ q: Number(c?.q), r: Number(c?.r), terrain: String(c?.terrain ?? ''), state: c?.state, note: String(c?.note ?? '').slice(0, 2000) }))
			.filter((c) => inRange(c) && TERRAIN_ID.test(c.terrain) && !seen.has(hexKey(c.q, c.r)) && seen.add(hexKey(c.q, c.r)))
			.slice(0, HEX_MAX_CELLS)
			.map((c) => ({ mapId, q: c.q, r: c.r, terrain: c.terrain, state: isHexState(c.state) ? c.state : ('hidden' as const), note: c.note }));
		if (!cells.length) cells.push({ mapId, q: 0, r: 0, terrain: 'plains', state: 'hidden', note: '' });
		for (let i = 0; i < cells.length; i += 500) getDb().insert(hexCells).values(cells.slice(i, i + 500)).run();
		for (const f of Array.isArray(data.features) ? data.features : []) {
			const h = { q: Number(f?.q), r: Number(f?.r) };
			const name = String(f?.name ?? '').slice(0, 120);
			if (!name || !seen.has(hexKey(h.q, h.r))) continue;
			saveFeature(mapId, {
				...h,
				name,
				icon: icons.includes(String(f.icon)) ? String(f.icon) : 'pin',
				description: String(f.description ?? '').slice(0, 1000),
				pageSlug: typeof f.page === 'string' && f.page ? pageSlug(f.page) : null,
				visibility: f.visibility === 'master' ? 'master' : 'players'
			});
		}
		const party = data.party && seen.has(hexKey(Number(data.party.q), Number(data.party.r))) ? { q: Number(data.party.q), r: Number(data.party.r) } : null;
		const origin = data.origin && Number.isInteger(data.origin.col) && Number.isInteger(data.origin.row) ? data.origin : null;
		getDb()
			.update(hexMaps)
			.set({ ...input, partyQ: party?.q ?? null, partyR: party?.r ?? null, originCol: origin?.col ?? null, originRow: origin?.row ?? null, updatedAt: Date.now() })
			.where(eq(hexMaps.id, mapId))
			.run();
	});
}

/** Gli esagoni come righe di testo (esportazione in Markdown), come li vede chi esporta. */
export function hexLines(pageId: number, u: Viewer | null, locale: string): string[] {
	const map = getHexMapOfPage(pageId);
	if (!map) return [];
	const master = isMaster(u);
	const { set } = tilesetOf(map, locale);
	const builtin = builtinTileset(locale);
	const origin = master ? labelOrigin(map) : map.originCol !== null && map.originRow !== null ? { col: map.originCol, row: map.originRow } : { col: 0, row: 0 };
	const feats = new Map<string, string[]>();
	for (const f of visibleFeatures(map.id, u)) {
		const k = hexKey(f.q, f.r);
		feats.set(k, [...(feats.get(k) ?? []), f.name]);
	}
	return visibleCells(map.id, u)
		.map((c) => {
			const parts = [`${hexLabel(c, map.orientation, origin)} — ${terrainLook(c.terrain, set, builtin).name} (${translate(locale, `hex.states.${c.state}`)})`];
			const f = feats.get(hexKey(c.q, c.r));
			if (f) parts.push(f.join(', '));
			if (master && c.note) parts.push(c.note);
			return parts.join(': ');
		})
		.sort();
}

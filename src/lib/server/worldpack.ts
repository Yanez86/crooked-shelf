import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { getFile, readFile, saveImage } from './files.ts';
import { createPage, getPageBySlug, pageCover, pageMeta, uniquePageSlug, updatePage, type PageInput, type PageRow } from './pages.ts';
import { cleanFields } from './pageForm.ts';
import { categoryWithDescendants, createCategory, listCategories, categoryPath } from './taxonomy.ts';
import { getCalendar, getSettings, saveSettings, customThemes } from './settings.ts';
import { getTimeline, listEvents, listTimelines, recomputeSortKeys, saveEvent, setTimelineMode, type EventVisibility } from './timeline.ts';
import { createMap, getMap, getMapOfPage, saveLayer, savePin, updateMap } from './maps.ts';
import { importTemplate } from './templates.ts';
import { pageIcon } from '../pageIcons.ts';
import { cleanCover, type PageCover } from '../covers.ts';
import { storeTheme } from './themesAdmin.ts';
import { stripSecrets } from '../content/extract.ts';
import { frontMatter, toMarkdown } from '../content/markdown.ts';
import { EMPTY_DOC, isDoc, type DocNode, type PageField } from '../content/types.ts';
import { canView, isMaster, type Viewer } from '../access.ts';
import { checkTheme } from '../themes.ts';
import { formatDate, fromText, isCalendar, toText } from '../calendar.ts';
import { isPageKind, type PageKind, type TimelineMode } from '../pageKinds.ts';
import { SESSION_TEMPLATE } from '../templates.ts';
import { translate } from '../i18n/index.ts';
import type { Visibility } from '../roles.ts';

export const PACK_FORMAT = 'crooked-shelf-world';
/** 2 = template, mappe e cronologie sono pagine. I pacchetti 1 si leggono ancora. */
const PACK_VERSION = 2;
const MAX_ENTRY = 30 * 1024 * 1024;
const MAX_TOTAL = 500 * 1024 * 1024;

export interface ExportOptions {
	name: string;
	allPages: boolean;
	categoryIds: number[];
	tagIds: number[];
	/** Pagine «mappa», con pin e livelli. */
	maps: boolean;
	/** Pagine «template». */
	templates: boolean;
	calendar: boolean;
	/** Cronologie del mondo, con i loro eventi (quelle della campagna restano fuori). */
	timeline: boolean;
	themes: boolean;
	/** Includere pagine, blocchi, mappe, pin ed eventi "solo Master". */
	secrets: boolean;
}

interface PackPin {
	x: number;
	y: number;
	label: string;
	description: string;
	icon: string;
	color: string;
	page: string | null;
	/** Indirizzo della pagina della mappa che il pin apre. */
	target: string | null;
	layer: number | null;
	visibility: string;
}

interface PackMap {
	file: string;
	/** Indirizzo della pagina della mappa che contiene questa. */
	parent: string | null;
	scale: number | null;
	unit: string;
	layers: { key: number; name: string; visibility: string }[];
	pins: PackPin[];
}

interface PackEvent {
	title: string;
	description: string;
	year: number | null;
	month: number | null;
	day: number | null;
	approx: string;
	realDate: string | null;
	visibility: string;
	page: string | null;
}

interface PackPage {
	slug: string;
	title: string;
	content: DocNode;
	fields: PageField[];
	visibility: Visibility;
	category: string | null;
	tags: string[];
	template: string | null;
	/**
	 * Immagine della pagina: nome del file in files/. Oggi è il primo riquadro immagine dei campi;
	 * resta per i pacchetti di prima, che non hanno riquadri immagine.
	 */
	image?: string | null;
	icon?: string | null;
	/** Copertina: `image` è il nome del file in files/. Manca nei pacchetti di prima. */
	cover?: PageCover | null;
	/** Manca nei pacchetti della 0.10 e precedenti: una pagina normale. */
	kind?: PageKind;
	/** Solo nei template: le loro copie sono resoconti di sessione. */
	session?: boolean;
	map?: PackMap;
	timeline?: { mode: TimelineMode; events: PackEvent[] };
}

const { pages, pageTags, mapLayers, mapPins, timelineEvents } = schema;

/** Indirizzi delle immagini caricate usate in un documento. */
function imageIds(doc: DocNode, out: Set<string>) {
	if (doc.type === 'image') {
		const m = /^\/files\/([\w-]+)$/.exec(String(doc.attrs?.src ?? ''));
		if (m) out.add(m[1]);
	}
	for (const c of doc.content ?? []) imageIds(c, out);
}

/** Cambia gli indirizzi delle immagini e dei collegamenti in un documento importato. */
function remap(doc: DocNode, files: Map<string, string>, slugs: Map<string, string>): DocNode {
	const n: DocNode = { ...doc };
	if (n.type === 'image') {
		const m = /^\/files\/([\w-]+)$/.exec(String(n.attrs?.src ?? ''));
		if (m && files.has(m[1])) n.attrs = { ...n.attrs, src: `/files/${files.get(m[1])}` };
	}
	if (n.type === 'wikiLink' && slugs.has(String(n.attrs?.target))) n.attrs = { ...n.attrs, target: slugs.get(String(n.attrs?.target)) };
	if (n.content) n.content = n.content.map((c) => remap(c, files, slugs));
	return n;
}

/** Testo semplice (le descrizioni delle mappe di prima) in paragrafi. */
function paragraphs(text: string): DocNode {
	const parts = text
		.split(/\n\s*\n/)
		.map((s) => s.replace(/\s*\n\s*/g, ' ').trim())
		.filter(Boolean);
	return parts.length ? { type: 'doc', content: parts.map((s) => ({ type: 'paragraph', content: [{ type: 'text', text: s }] })) } : EMPTY_DOC;
}

const extOf = (mime: string) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' })[mime] ?? 'bin';
const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));
const kindOf = (p: { kind?: unknown }): PageKind => (isPageKind(p.kind) ? p.kind : 'page');

// --- Esportazione ---

function exportablePages(o: ExportOptions, u: Viewer): PageRow[] {
	const db = getDb();
	const rows = db.select().from(pages).where(sql`${pages.deletedAt} IS NULL`).orderBy(asc(pages.title)).all();
	const cats = new Set(o.categoryIds.flatMap((id) => categoryWithDescendants(id)));
	const tagged = new Set(
		o.tagIds.length
			? db
					.select({ id: pageTags.pageId })
					.from(pageTags)
					.where(inArray(pageTags.tagId, o.tagIds))
					.all()
					.map((r) => r.id)
			: []
	);
	return rows.filter((p) => {
		if (p.visibility === 'personal') return false;
		if (p.visibility === 'master' && !o.secrets) return false;
		if (!canView(p, u)) return false;
		if (p.kind === 'template') return o.templates;
		if (p.kind === 'map') return o.maps;
		if (p.kind === 'timeline') return o.timeline && getTimeline(p.id)?.mode === 'world';
		return o.allPages || (p.categoryId !== null && cats.has(p.categoryId)) || tagged.has(p.id);
	});
}

export function exportWorld(o: ExportOptions, u: Viewer): Uint8Array {
	const out: Zippable = {};
	const fileIds = new Set<string>();
	const secrets = o.secrets && isMaster(u);
	const catSlug = new Map(listCategories().map((c) => [c.id, c.slug]));
	const counts: Record<string, number> = { pages: 0, templates: 0, maps: 0, events: 0 };
	const db = getDb();

	const list = exportablePages(o, u);
	const titles = new Map(list.map((p) => [p.slug, p.title]));
	const slugOfPage = new Map(db.select({ id: pages.id, slug: pages.slug }).from(pages).all().map((p) => [p.id, p.slug]));
	const slugOfMap = (mapId: number | null) => {
		const m = mapId ? getMap(mapId) : undefined;
		return m ? (slugOfPage.get(m.pageId) ?? null) : null;
	};

	const mapOf = (p: PageRow): PackMap | undefined => {
		const m = getMapOfPage(p.id);
		if (!m) return undefined;
		fileIds.add(m.fileId);
		const layers = db.select().from(mapLayers).where(eq(mapLayers.mapId, m.id)).all().filter((l) => secrets || l.visibility === 'players');
		const layerIds = new Set(layers.map((l) => l.id));
		const pins = db
			.select()
			.from(mapPins)
			.where(eq(mapPins.mapId, m.id))
			.all()
			.filter((x) => (secrets || x.visibility === 'players') && (x.layerId === null || layerIds.has(x.layerId)));
		return {
			file: m.fileId,
			parent: slugOfMap(m.parentId),
			scale: m.scale,
			unit: m.unit,
			layers: layers.map((l) => ({ key: l.id, name: l.name, visibility: l.visibility })),
			pins: pins.map((x) => ({
				x: x.x,
				y: x.y,
				label: x.label,
				description: x.description,
				icon: x.icon,
				color: x.color,
				page: x.pageSlug,
				target: slugOfMap(x.targetMapId),
				layer: x.layerId,
				visibility: x.visibility
			}))
		};
	};

	const timelineOf = (p: PageRow): PackPage['timeline'] => {
		const tl = getTimeline(p.id);
		if (!tl) return undefined;
		const evs = db
			.select()
			.from(timelineEvents)
			.where(and(eq(timelineEvents.timelineId, p.id), eq(timelineEvents.source, 'manual')))
			.orderBy(asc(timelineEvents.sortKey), asc(timelineEvents.id))
			.all()
			.filter((e) => secrets || e.visibility !== 'master');
		counts.events += evs.length;
		return {
			mode: tl.mode,
			events: evs.map((e) => ({
				title: e.title,
				description: e.description,
				year: e.year,
				month: e.month,
				day: e.day,
				approx: e.approx,
				realDate: e.realDate,
				visibility: e.visibility,
				page: e.pageId ? (slugOfPage.get(e.pageId) ?? null) : null
			}))
		};
	};

	const packPages: PackPage[] = list.map((p) => {
		const raw = isDoc(p.content) ? p.content : EMPTY_DOC;
		const content = secrets ? raw : stripSecrets(raw);
		imageIds(content, fileIds);
		for (const f of p.fields ?? []) if (f.image) fileIds.add(f.image);
		const cover = pageCover(p);
		if (cover?.image) fileIds.add(cover.image);
		const meta = pageMeta(p);
		out[`pages/${p.slug}.md`] = strToU8(
			frontMatter({ title: p.title, category: categoryPath(p.categoryId).map((c) => c.name).join(' / ') || null, tags: meta.tags.map((t) => t.name), fields: p.fields ?? [] }) +
				`# ${p.title}\n\n` +
				toMarkdown(content, { secrets, titleOf: (s) => titles.get(s) ?? null }) +
				'\n'
		);
		counts[p.kind === 'page' || p.kind === 'timeline' ? 'pages' : p.kind === 'template' ? 'templates' : 'maps']++;
		return {
			slug: p.slug,
			title: p.title,
			content,
			fields: p.fields ?? [],
			visibility: p.visibility,
			category: p.categoryId ? (catSlug.get(p.categoryId) ?? null) : null,
			tags: meta.tags.map((t) => t.name),
			template: p.template,
			image: p.imageId,
			icon: p.icon,
			cover,
			kind: p.kind,
			...(p.kind === 'template' ? { session: !!p.session } : {}),
			...(p.kind === 'map' ? { map: mapOf(p) } : {}),
			...(p.kind === 'timeline' ? { timeline: timelineOf(p) } : {})
		};
	});
	out['pages.json'] = json(packPages);

	// Categorie usate (con i genitori).
	const used = new Set<number>();
	for (const p of list) for (let c = p.categoryId; c !== null && !used.has(c); ) {
		used.add(c);
		c = listCategories().find((x) => x.id === c)?.parentId ?? null;
	}
	const cats = listCategories().filter((c) => used.has(c.id) || o.categoryIds.includes(c.id));
	out['categories.json'] = json(cats.map((c) => ({ slug: c.slug, name: c.name, parent: c.parentId ? (catSlug.get(c.parentId) ?? null) : null, description: c.description })));
	counts.categories = cats.length;

	if (o.calendar) out['calendar.json'] = json(getCalendar());

	if (o.themes) {
		out['themes.json'] = json(customThemes().map(({ name, scheme, colors }) => ({ name, scheme, colors })));
		counts.themes = customThemes().length;
	}

	for (const id of fileIds) {
		const f = getFile(id);
		const buf = f && readFile(f);
		if (f && buf) out[`files/${id}.${extOf(f.mime)}`] = buf;
	}
	counts.files = fileIds.size;

	out['manifest.json'] = json({
		format: PACK_FORMAT,
		version: PACK_VERSION,
		name: o.name || 'World',
		createdAt: new Date().toISOString(),
		app: `Crooked Shelf ${__APP_VERSION__}`,
		secrets,
		counts
	});
	return zipSync(out, { level: 6 });
}

// --- Importazione ---

export interface Pack {
	manifest: { format: string; version: number; name: string; secrets: boolean; counts: Record<string, number> };
	entries: Record<string, Uint8Array>;
}

export function readPack(buf: Uint8Array): { ok: true; pack: Pack } | { ok: false; error: string } {
	let total = 0;
	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(buf, {
			filter: (f) => {
				total += f.originalSize;
				if (f.originalSize > MAX_ENTRY || total > MAX_TOTAL) throw new Error('too big');
				return !f.name.endsWith('/');
			}
		});
	} catch {
		return { ok: false, error: 'world.errFile' };
	}
	try {
		const manifest = JSON.parse(strFromU8(entries['manifest.json']));
		if (manifest.format !== PACK_FORMAT || ![1, PACK_VERSION].includes(manifest.version)) return { ok: false, error: 'world.errFile' };
		return { ok: true, pack: { manifest, entries } };
	} catch {
		return { ok: false, error: 'world.errFile' };
	}
}

function part<T>(pack: Pack, name: string): T[] {
	const e = pack.entries[name];
	if (!e) return [];
	try {
		const v = JSON.parse(strFromU8(e));
		return Array.isArray(v) ? v : [];
	} catch {
		return [];
	}
}

/** Le pagine del pacchetto; quelli della 0.10 e precedenti avevano le mappe a parte (maps.json): diventano pagine «mappa». */
function packPagesOf(pack: Pack): PackPage[] {
	const list = part<PackPage>(pack, 'pages.json').filter((p) => p && typeof p.slug === 'string' && typeof p.title === 'string');
	type OldMap = { slug: string; title: string; description: string; file: string; visibility: Visibility; parent: string | null; scale: number | null; unit: string; layers: PackMap['layers']; pins: PackPin[] };
	for (const m of part<OldMap>(pack, 'maps.json')) {
		if (!m || typeof m.slug !== 'string' || typeof m.title !== 'string') continue;
		list.push({
			slug: m.slug,
			title: m.title,
			content: paragraphs(String(m.description ?? '')),
			fields: [],
			visibility: m.visibility,
			category: null,
			tags: [],
			template: null,
			kind: 'map',
			map: { file: m.file, parent: m.parent, scale: m.scale, unit: m.unit, layers: m.layers, pins: m.pins }
		});
	}
	return list;
}

/** Cosa c'è nel pacchetto e cosa esiste già. */
export function previewPack(pack: Pack) {
	return {
		name: pack.manifest.name,
		secrets: !!pack.manifest.secrets,
		counts: pack.manifest.counts ?? {},
		hasCalendar: !!pack.entries['calendar.json'],
		pageConflicts: packPagesOf(pack)
			.filter((x) => getPageBySlug(x.slug))
			.map((x) => x.title)
	};
}

export type Conflict = 'skip' | 'rename' | 'replace';

const VIS3 = ['public', 'players', 'master'];
const vis = (v: unknown): Visibility => (VIS3.includes(String(v)) ? (v as Visibility) : 'players');
const eventVis = (v: unknown): EventVisibility => (VIS3.includes(String(v)) ? (v as EventVisibility) : 'players');
const num = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);

export function importPack(pack: Pack, opts: { conflict: Conflict; calendar: boolean }, u: Viewer) {
	const done = { pages: 0, skipped: 0, maps: 0, templates: 0, events: 0, themes: 0, categories: 0 };
	const db = getDb();
	const locale = getSettings().defaultLocale;

	// Immagini: nuovi indirizzi.
	const fileMap = new Map<string, string>();
	for (const [name, data] of Object.entries(pack.entries)) {
		const m = /^files\/([\w-]+)\.\w+$/.exec(name);
		if (!m) continue;
		const r = saveImage(Buffer.from(data), name.slice(6), u.id);
		if (r.ok) fileMap.set(m[1], r.file.id);
	}

	// Categorie: riusa quelle con lo stesso indirizzo.
	const catIds = new Map<string, number>(listCategories().map((c) => [c.slug, c.id]));
	const packCats = part<{ slug: string; name: string; parent: string | null; description: string }>(pack, 'categories.json');
	for (const c of packCats) {
		if (catIds.has(c.slug)) continue;
		catIds.set(c.slug, createCategory(String(c.name).slice(0, 80) || c.slug, null, String(c.description ?? '').slice(0, 500)).id);
		done.categories++;
	}
	for (const c of packCats) {
		const id = catIds.get(c.slug);
		const parent = c.parent ? catIds.get(c.parent) : undefined;
		if (id && parent && id !== parent) db.update(schema.categories).set({ parentId: parent }).where(and(eq(schema.categories.id, id), sql`${schema.categories.parentId} IS NULL`)).run();
	}

	// Pagine: prima si decidono gli indirizzi (per aggiustare i collegamenti), poi si scrivono.
	// Una mappa senza la sua immagine non si importa; una pagina di un altro tipo non si sostituisce, si rinomina.
	const packPages = packPagesOf(pack).filter((p) => kindOf(p) !== 'map' || (p.map && fileMap.has(p.map.file)));
	const slugMap = new Map<string, string>();
	const plan: { p: PackPage; kind: PageKind; existing?: PageRow; slug: string }[] = [];
	for (const p of packPages) {
		const kind = kindOf(p);
		const existing = getPageBySlug(p.slug);
		if (existing && opts.conflict === 'skip') {
			done.skipped++;
			continue;
		}
		const replace = existing && opts.conflict === 'replace' && existing.kind === kind;
		// Anche una pagina nel cestino tiene il suo indirizzo: in quel caso si prende il primo libero.
		const slug = replace ? p.slug : uniquePageSlug(p.slug);
		slugMap.set(p.slug, slug);
		plan.push({ p, kind, existing: replace ? existing : undefined, slug });
	}
	const written: { p: PackPage; kind: PageKind; page: PageRow; replaced: boolean }[] = [];
	for (const { p, kind, existing, slug } of plan) {
		const fields = cleanFields(p.fields, (id) => fileMap.get(id) ?? null);
		const cover = typeof p.image === 'string' ? fileMap.get(p.image) : undefined;
		if (cover && !fields.some((f) => f.image)) fields.unshift({ label: '', value: '', image: cover });
		const input: PageInput = {
			title: p.title.slice(0, 200),
			content: remap(isDoc(p.content) ? p.content : EMPTY_DOC, fileMap, slugMap),
			visibility: vis(p.visibility),
			playersCanEdit: false,
			categoryId: p.category ? (catIds.get(p.category) ?? null) : null,
			tags: (Array.isArray(p.tags) ? p.tags : []).map(String).slice(0, 30),
			fields,
			template: typeof p.template === 'string' ? (slugMap.get(p.template) ?? p.template).slice(0, 120) : null,
			session: kind === 'template' && p.session ? SESSION_TEMPLATE : null,
			// I pacchetti di prima non hanno l'icona né la copertina: in quel caso resta quella che c'è.
			icon: p.icon === undefined ? undefined : pageIcon(p.icon),
			cover: p.cover === undefined ? undefined : cleanCover(p.cover, (id) => fileMap.get(id) ?? null),
			kind,
			slug
		};
		if (existing) updatePage(existing, input, u, true);
		const page = existing ? getPageBySlug(existing.slug)! : createPage(input, u);
		written.push({ p, kind, page, replaced: !!existing });
		done[kind === 'template' ? 'templates' : kind === 'map' ? 'maps' : 'pages']++;
	}

	// La mappa di una pagina, dall'indirizzo che aveva nel pacchetto (o di una mappa che c'era già).
	const mapIdOf = (slug: unknown) => {
		if (typeof slug !== 'string') return null;
		const page = getPageBySlug(slugMap.get(slug) ?? slug);
		return page?.kind === 'map' ? (getMapOfPage(page.id)?.id ?? null) : null;
	};

	// Mappe: prima l'immagine e i livelli di tutte, poi genitori e pin (che possono aprire un'altra mappa del pacchetto).
	const layerMaps = new Map<number, Map<number, number>>();
	for (const { p, kind, page, replaced } of written) {
		if (kind !== 'map' || !p.map) continue;
		const f = getFile(fileMap.get(p.map.file)!);
		if (!f) continue;
		const input = { parentId: null, scale: typeof p.map.scale === 'number' && p.map.scale > 0 ? p.map.scale : null, unit: String(p.map.unit ?? '').slice(0, 20) };
		const old = replaced ? getMapOfPage(page.id) : undefined;
		if (old) {
			updateMap(old.id, input, f);
			db.delete(mapPins).where(eq(mapPins.mapId, old.id)).run();
			db.delete(mapLayers).where(eq(mapLayers.mapId, old.id)).run();
		}
		const id = old?.id ?? createMap(page, input, f, u.id).id;
		const layerMap = new Map<number, number>();
		for (const l of Array.isArray(p.map.layers) ? p.map.layers : []) layerMap.set(Number(l.key), saveLayer(id, String(l.name).slice(0, 60), l.visibility === 'master' ? 'master' : 'players'));
		layerMaps.set(page.id, layerMap);
	}
	for (const { p, kind, page } of written) {
		const map = kind === 'map' ? getMapOfPage(page.id) : undefined;
		const layerMap = layerMaps.get(page.id);
		if (!map || !layerMap || !p.map) continue;
		const parent = mapIdOf(p.map.parent);
		if (parent && parent !== map.id) db.update(schema.maps).set({ parentId: parent }).where(eq(schema.maps.id, map.id)).run();
		for (const x of Array.isArray(p.map.pins) ? p.map.pins : []) {
			savePin(map.id, {
				x: Math.min(map.width, Math.max(0, Number(x.x) || 0)),
				y: Math.min(map.height, Math.max(0, Number(x.y) || 0)),
				label: String(x.label ?? '').slice(0, 120) || '—',
				description: String(x.description ?? '').slice(0, 1000),
				icon: String(x.icon ?? 'pin'),
				color: String(x.color ?? 'red'),
				pageSlug: typeof x.page === 'string' ? (slugMap.get(x.page) ?? x.page) : null,
				targetMapId: mapIdOf(x.target),
				layerId: x.layer != null ? (layerMap.get(Number(x.layer)) ?? null) : null,
				visibility: x.visibility === 'master' ? 'master' : 'players'
			});
		}
	}

	// Eventi: quelli delle cronologie del pacchetto, e quelli dei pacchetti di prima (timeline.json) nella prima cronologia del mondo.
	const addEvent = (timelineId: number, e: Partial<PackEvent>) => {
		if (typeof e.title !== 'string' || !e.title) return;
		const year = num(e.year);
		const pageSlug = typeof e.page === 'string' ? (slugMap.get(e.page) ?? e.page) : null;
		const linked = pageSlug ? getPageBySlug(pageSlug) : undefined;
		saveEvent(
			{
				timelineId,
				title: e.title.slice(0, 200),
				description: String(e.description ?? '').slice(0, 2000),
				date: year !== null ? { year, month: num(e.month), day: num(e.day) } : null,
				approx: String(e.approx ?? '').slice(0, 100),
				realDate: typeof e.realDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.realDate) ? e.realDate : null,
				pageId: linked?.id ?? null,
				visibility: eventVis(e.visibility)
			},
			u.id
		);
		done.events++;
	};
	for (const { p, kind, page, replaced } of written) {
		if (kind !== 'timeline') continue;
		setTimelineMode(page.id, p.timeline?.mode === 'campaign' ? 'campaign' : 'world');
		if (replaced) db.delete(timelineEvents).where(and(eq(timelineEvents.timelineId, page.id), eq(timelineEvents.source, 'manual'))).run();
		for (const e of Array.isArray(p.timeline?.events) ? p.timeline.events : []) addEvent(page.id, e);
	}
	const oldEvents = part<Partial<PackEvent>>(pack, 'timeline.json').filter((e) => typeof e?.year === 'number');
	if (oldEvents.length) {
		const world =
			listTimelines(u, 'world')[0]?.id ??
			createPage(
				{ kind: 'timeline', title: translate(locale, 'timeline.world'), content: EMPTY_DOC, visibility: 'public', playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null },
				u,
				(pg) => setTimelineMode(pg.id, 'world')
			).id;
		for (const e of oldEvents) addEvent(world, e);
	}

	// Template dei pacchetti di prima (templates.json): diventano pagine template.
	for (const t of part<{ name: string; fields: string[]; content: DocNode; session: boolean }>(pack, 'templates.json')) {
		if (!t?.name || !isDoc(t.content)) continue;
		importTemplate({ name: String(t.name).slice(0, 80), fields: (Array.isArray(t.fields) ? t.fields : []).map(String).slice(0, 30), content: t.content, session: !!t.session }, locale, u);
		done.templates++;
	}

	if (opts.calendar && pack.entries['calendar.json']) {
		try {
			const c = JSON.parse(strFromU8(pack.entries['calendar.json']));
			if (isCalendar(c)) {
				const r = fromText(toText(c));
				if (r.ok) {
					const cal = { ...r.cal, today: c.today ?? null };
					saveSettings({ calendar: cal });
					recomputeSortKeys(cal);
				}
			}
		} catch {
			/* calendario non valido: ignorato */
		}
	}

	for (const t of part<unknown>(pack, 'themes.json')) {
		const r = checkTheme(t);
		if (r.ok) {
			storeTheme(r.theme, null);
			done.themes++;
		}
	}
	return done;
}

// --- Esportazione in Markdown (tutta la wiki, come la vede chi esporta) ---

export function exportMarkdown(u: Viewer): Uint8Array {
	const out: Zippable = {};
	const all = getDb()
		.select()
		.from(pages)
		.where(sql`${pages.deletedAt} IS NULL`)
		.all()
		.filter((p) => canView(p, u));
	const titles = new Map(all.map((p) => [p.slug, p.title]));
	const secrets = isMaster(u);
	const fileIds = new Set<string>();
	const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || '_';
	const index: string[] = ['# Indice', ''];
	const cal = getCalendar();
	const text = (t: string): DocNode => ({ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] });
	for (const p of all) {
		const body = isDoc(p.content) ? p.content : EMPTY_DOC;
		// La copertina, la mappa e le immagini della colonna a lato vanno in cima al testo.
		const coverImage = pageCover(p)?.image;
		const map = p.kind === 'map' ? getMapOfPage(p.id) : undefined;
		const side: DocNode[] = [
			...(coverImage ? [{ type: 'image', attrs: { src: `/files/${coverImage}`, alt: p.title } }] : []),
			...(map ? [{ type: 'image', attrs: { src: `/files/${map.fileId}`, alt: p.title } }] : []),
			...(p.fields ?? []).flatMap((f) => (f.image ? [{ type: 'image', attrs: { src: `/files/${f.image}`, alt: f.label || p.title } }] : []))
		];
		// Gli eventi della cronologia in fondo, uno per riga: data, titolo, descrizione.
		const tl = p.kind === 'timeline' ? getTimeline(p.id) : undefined;
		const events = tl ? listEvents(tl, u) : [];
		const list: DocNode[] = events.length
			? [
					{
						type: 'bulletList',
						content: events.map((e) => {
							const when = e.approx || (e.year !== null ? formatDate(cal, { year: e.year, month: e.month, day: e.day }) : (e.realDate ?? ''));
							return { type: 'listItem', content: [text([when, e.title].filter(Boolean).join(' — ') + (e.description ? `: ${e.description}` : ''))] };
						})
					}
				]
			: [];
		const doc: DocNode = side.length || list.length ? { ...body, content: [...side, ...(body.content ?? []), ...list] } : body;
		const folder = categoryPath(p.categoryId).map((c) => safe(c.name));
		const depth = folder.length;
		const path = [...folder, `${safe(p.title)}.md`].join('/');
		imageIds(doc, fileIds);
		const meta = pageMeta(p);
		out[path] = strToU8(
			frontMatter({ title: p.title, category: folder.join(' / ') || null, tags: meta.tags.map((t) => t.name), visibility: p.visibility, fields: p.fields ?? [] }) +
				toMarkdown(doc, {
					secrets,
					titleOf: (s) => titles.get(s) ?? null,
					imagePath: (src) => {
						const id = /^\/files\/([\w-]+)$/.exec(src)?.[1];
						const f = id ? getFile(id) : undefined;
						return f ? `${'../'.repeat(depth)}_files/${f.id}.${extOf(f.mime)}` : src;
					}
				}) +
				'\n'
		);
		index.push(`- [[${p.title}]]`);
	}
	for (const id of fileIds) {
		const f = getFile(id);
		const buf = f && readFile(f);
		if (f && buf) out[`_files/${id}.${extOf(f.mime)}`] = buf;
	}
	out['Indice.md'] = strToU8(index.join('\n') + '\n');
	return zipSync(out, { level: 6 });
}


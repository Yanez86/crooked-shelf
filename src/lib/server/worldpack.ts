import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { getFile, readFile, saveImage } from './files.ts';
import { createPage, getPageBySlug, pageMeta, uniquePageSlug, updatePage, type PageRow } from './pages.ts';
import { cleanFields } from './pageForm.ts';
import { categoryWithDescendants, createCategory, listCategories, categoryPath } from './taxonomy.ts';
import { getCalendar, saveSettings, customThemes } from './settings.ts';
import { recomputeSortKeys, saveEvent } from './timeline.ts';
import { createMap, deleteMap, getMapBySlug, saveLayer, savePin } from './maps.ts';
import { saveTemplate } from './templates.ts';
import { pageIcon } from '../pageIcons.ts';
import { storeTheme } from './themesAdmin.ts';
import { stripSecrets } from '../content/extract.ts';
import { frontMatter, toMarkdown } from '../content/markdown.ts';
import { EMPTY_DOC, isDoc, type DocNode, type PageField } from '../content/types.ts';
import { canView, isMaster, type Viewer } from '../access.ts';
import { checkTheme } from '../themes.ts';
import { fromText, isCalendar, toText } from '../calendar.ts';
import type { Visibility } from '../roles.ts';

export const PACK_FORMAT = 'crooked-shelf-world';
const MAX_ENTRY = 30 * 1024 * 1024;
const MAX_TOTAL = 500 * 1024 * 1024;

export interface ExportOptions {
	name: string;
	allPages: boolean;
	categoryIds: number[];
	tagIds: number[];
	maps: boolean;
	templates: boolean;
	calendar: boolean;
	timeline: boolean;
	themes: boolean;
	/** Includere pagine, blocchi, mappe, pin ed eventi "solo Master". */
	secrets: boolean;
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
}

const { pages, pageTags, maps, mapLayers, mapPins, timelineEvents, templates } = schema;

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

const extOf = (mime: string) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' })[mime] ?? 'bin';
const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));

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
		return o.allPages || (p.categoryId !== null && cats.has(p.categoryId)) || tagged.has(p.id);
	});
}

export function exportWorld(o: ExportOptions, u: Viewer): Uint8Array {
	const out: Zippable = {};
	const fileIds = new Set<string>();
	const secrets = o.secrets && isMaster(u);
	const catSlug = new Map(listCategories().map((c) => [c.id, c.slug]));
	const counts: Record<string, number> = {};

	const list = exportablePages(o, u);
	const titles = new Map(list.map((p) => [p.slug, p.title]));
	const packPages: PackPage[] = list.map((p) => {
		const raw = isDoc(p.content) ? p.content : EMPTY_DOC;
		const content = secrets ? raw : stripSecrets(raw);
		imageIds(content, fileIds);
		for (const f of p.fields ?? []) if (f.image) fileIds.add(f.image);
		const meta = pageMeta(p);
		out[`pages/${p.slug}.md`] = strToU8(
			frontMatter({ title: p.title, category: categoryPath(p.categoryId).map((c) => c.name).join(' / ') || null, tags: meta.tags.map((t) => t.name), fields: p.fields ?? [] }) +
				`# ${p.title}\n\n` +
				toMarkdown(content, { secrets, titleOf: (s) => titles.get(s) ?? null }) +
				'\n'
		);
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
			icon: p.icon
		};
	});
	out['pages.json'] = json(packPages);
	counts.pages = packPages.length;

	// Categorie usate (con i genitori).
	const used = new Set<number>();
	for (const p of list) for (let c = p.categoryId; c !== null && !used.has(c); ) {
		used.add(c);
		c = listCategories().find((x) => x.id === c)?.parentId ?? null;
	}
	const cats = listCategories().filter((c) => used.has(c.id) || o.categoryIds.includes(c.id));
	out['categories.json'] = json(cats.map((c) => ({ slug: c.slug, name: c.name, parent: c.parentId ? (catSlug.get(c.parentId) ?? null) : null, description: c.description })));
	counts.categories = cats.length;

	if (o.maps) {
		const visible = getDb()
			.select()
			.from(maps)
			.all()
			.filter((m) => secrets || m.visibility !== 'master');
		const mapSlug = new Map(visible.map((m) => [m.id, m.slug]));
		out['maps.json'] = json(
			visible.map((m) => {
				fileIds.add(m.fileId);
				const layers = getDb().select().from(mapLayers).where(eq(mapLayers.mapId, m.id)).all().filter((l) => secrets || l.visibility === 'players');
				const layerIds = new Set(layers.map((l) => l.id));
				const pins = getDb()
					.select()
					.from(mapPins)
					.where(eq(mapPins.mapId, m.id))
					.all()
					.filter((p) => (secrets || p.visibility === 'players') && (p.layerId === null || layerIds.has(p.layerId)));
				return {
					slug: m.slug,
					title: m.title,
					description: m.description,
					file: m.fileId,
					visibility: m.visibility,
					parent: m.parentId ? (mapSlug.get(m.parentId) ?? null) : null,
					scale: m.scale,
					unit: m.unit,
					layers: layers.map((l) => ({ key: l.id, name: l.name, visibility: l.visibility })),
					pins: pins.map((p) => ({
						x: p.x,
						y: p.y,
						label: p.label,
						description: p.description,
						icon: p.icon,
						color: p.color,
						page: p.pageSlug,
						target: p.targetMapId ? (mapSlug.get(p.targetMapId) ?? null) : null,
						layer: p.layerId,
						visibility: p.visibility
					}))
				};
			})
		);
		counts.maps = visible.length;
	}

	if (o.templates) {
		const rows = getDb().select().from(templates).all();
		out['templates.json'] = json(rows.map((t) => ({ name: t.name, description: t.description, fields: t.fields, content: secrets ? t.content : stripSecrets(t.content as DocNode), session: t.session })));
		counts.templates = rows.length;
	}

	if (o.calendar) out['calendar.json'] = json(getCalendar());

	if (o.timeline) {
		const pageSlug = new Map(getDb().select({ id: pages.id, slug: pages.slug }).from(pages).all().map((p) => [p.id, p.slug]));
		const evs = getDb()
			.select()
			.from(timelineEvents)
			.where(eq(timelineEvents.timeline, 'world'))
			.orderBy(asc(timelineEvents.sortKey))
			.all()
			.filter((e) => secrets || e.visibility !== 'master');
		out['timeline.json'] = json(
			evs.map((e) => ({ title: e.title, description: e.description, year: e.year, month: e.month, day: e.day, approx: e.approx, visibility: e.visibility, page: e.pageId ? (pageSlug.get(e.pageId) ?? null) : null }))
		);
		counts.events = evs.length;
	}

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
		version: 1,
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
		if (manifest.format !== PACK_FORMAT || manifest.version !== 1) return { ok: false, error: 'world.errFile' };
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

/** Cosa c'è nel pacchetto e cosa esiste già. */
export function previewPack(pack: Pack) {
	const p = part<PackPage>(pack, 'pages.json');
	const m = part<{ slug: string; title: string }>(pack, 'maps.json');
	return {
		name: pack.manifest.name,
		secrets: !!pack.manifest.secrets,
		counts: pack.manifest.counts ?? {},
		hasCalendar: !!pack.entries['calendar.json'],
		pageConflicts: p.filter((x) => getPageBySlug(x.slug)).map((x) => x.title),
		mapConflicts: m.filter((x) => getMapBySlug(x.slug)).map((x) => x.title)
	};
}

export type Conflict = 'skip' | 'rename' | 'replace';

export function importPack(pack: Pack, opts: { conflict: Conflict; calendar: boolean }, u: Viewer) {
	const done = { pages: 0, skipped: 0, maps: 0, templates: 0, events: 0, themes: 0, categories: 0 };
	const db = getDb();

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
	const packPages = part<PackPage>(pack, 'pages.json').filter((p) => p && typeof p.slug === 'string' && typeof p.title === 'string');
	const slugMap = new Map<string, string>();
	const plan: { p: PackPage; existing?: PageRow; slug: string }[] = [];
	for (const p of packPages) {
		const existing = getPageBySlug(p.slug);
		if (existing && opts.conflict === 'skip') {
			done.skipped++;
			continue;
		}
		const slug = existing && opts.conflict === 'rename' ? uniquePageSlug(p.slug) : p.slug;
		slugMap.set(p.slug, slug);
		plan.push({ p, existing: opts.conflict === 'replace' ? existing : undefined, slug });
	}
	const vis = (v: string): Visibility => (['public', 'players', 'master'].includes(v) ? (v as Visibility) : 'players');
	for (const { p, existing, slug } of plan) {
		const fields = cleanFields(p.fields, (id) => fileMap.get(id) ?? null);
		const cover = typeof p.image === 'string' ? fileMap.get(p.image) : undefined;
		if (cover && !fields.some((f) => f.image)) fields.unshift({ label: '', value: '', image: cover });
		const input = {
			title: p.title.slice(0, 200),
			content: remap(isDoc(p.content) ? p.content : EMPTY_DOC, fileMap, slugMap),
			visibility: vis(p.visibility),
			playersCanEdit: false,
			categoryId: p.category ? (catIds.get(p.category) ?? null) : null,
			tags: (Array.isArray(p.tags) ? p.tags : []).map(String).slice(0, 30),
			fields,
			template: p.template ?? null,
			session: null,
			// I pacchetti di prima non hanno l'icona: in quel caso resta quella che c'è.
			icon: p.icon === undefined ? undefined : pageIcon(p.icon),
			slug
		};
		if (existing) updatePage(existing, input, u, true);
		else createPage(input, u);
		done.pages++;
	}

	// Mappe: prima tutte, poi genitori, livelli e pin.
	type PackMap = { slug: string; title: string; description: string; file: string; visibility: string; parent: string | null; scale: number | null; unit: string; layers: { key: number; name: string; visibility: string }[]; pins: Record<string, unknown>[] };
	const packMaps = part<PackMap>(pack, 'maps.json');
	const mapIds = new Map<string, number>();
	const layerMaps = new Map<string, Map<number, number>>();
	for (const m of packMaps) {
		const existing = getMapBySlug(m.slug);
		if (existing && opts.conflict === 'skip') {
			mapIds.set(m.slug, existing.id);
			continue;
		}
		if (existing && opts.conflict === 'replace') deleteMap(existing.id);
		const fileId = fileMap.get(m.file);
		const f = fileId ? getFile(fileId) : undefined;
		if (!f) continue;
		const created = createMap(
			{
				title: String(m.title).slice(0, 120),
				description: String(m.description ?? '').slice(0, 1000),
				visibility: (['public', 'players', 'master'].includes(m.visibility) ? m.visibility : 'players') as 'public' | 'players' | 'master',
				parentId: null,
				scale: typeof m.scale === 'number' && m.scale > 0 ? m.scale : null,
				unit: String(m.unit ?? '').slice(0, 20)
			},
			f,
			u.id
		);
		mapIds.set(m.slug, created.id);
		done.maps++;

		const layerMap = new Map<number, number>();
		for (const l of Array.isArray(m.layers) ? m.layers : []) {
			saveLayer(created.id, String(l.name).slice(0, 60), l.visibility === 'master' ? 'master' : 'players');
			const last = db.select().from(mapLayers).where(eq(mapLayers.mapId, created.id)).orderBy(sql`${mapLayers.id} DESC`).get();
			if (last) layerMap.set(Number(l.key), last.id);
		}
		layerMaps.set(m.slug, layerMap);
	}
	for (const m of packMaps) {
		const id = mapIds.get(m.slug);
		const layerMap = layerMaps.get(m.slug);
		if (!id || !layerMap) continue;
		const parent = m.parent ? mapIds.get(m.parent) : undefined;
		if (parent && parent !== id) db.update(maps).set({ parentId: parent }).where(eq(maps.id, id)).run();
		const map = db.select().from(maps).where(eq(maps.id, id)).get()!;
		for (const p of Array.isArray(m.pins) ? m.pins : []) {
			const page = typeof p.page === 'string' ? (slugMap.get(p.page) ?? p.page) : null;
			savePin(id, {
				x: Math.min(map.width, Math.max(0, Number(p.x) || 0)),
				y: Math.min(map.height, Math.max(0, Number(p.y) || 0)),
				label: String(p.label ?? '').slice(0, 120) || '—',
				description: String(p.description ?? '').slice(0, 1000),
				icon: String(p.icon ?? 'pin'),
				color: String(p.color ?? 'red'),
				pageSlug: page,
				targetMapId: typeof p.target === 'string' ? (mapIds.get(p.target) ?? null) : null,
				layerId: p.layer != null ? (layerMap.get(Number(p.layer)) ?? null) : null,
				visibility: p.visibility === 'master' ? 'master' : 'players'
			});
		}
	}

	for (const t of part<{ name: string; description: string; fields: string[]; content: DocNode; session: boolean }>(pack, 'templates.json')) {
		if (!t?.name || !isDoc(t.content)) continue;
		saveTemplate({ name: String(t.name).slice(0, 80), description: String(t.description ?? '').slice(0, 300), fields: (Array.isArray(t.fields) ? t.fields : []).map(String).slice(0, 30), content: t.content, session: !!t.session }, u.id);
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

	for (const e of part<Record<string, unknown>>(pack, 'timeline.json')) {
		if (typeof e.title !== 'string' || typeof e.year !== 'number') continue;
		const pageSlug = typeof e.page === 'string' ? (slugMap.get(e.page) ?? e.page) : null;
		const page = pageSlug ? getPageBySlug(pageSlug) : undefined;
		saveEvent(
			{
				timeline: 'world',
				title: e.title.slice(0, 200),
				description: String(e.description ?? '').slice(0, 2000),
				date: { year: e.year, month: typeof e.month === 'number' ? e.month : null, day: typeof e.day === 'number' ? e.day : null },
				approx: String(e.approx ?? '').slice(0, 100),
				realDate: null,
				pageId: page?.id ?? null,
				visibility: (['public', 'players', 'master'].includes(String(e.visibility)) ? e.visibility : 'players') as 'public' | 'players' | 'master'
			},
			u.id
		);
		done.events++;
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
	for (const p of all) {
		const body = isDoc(p.content) ? p.content : EMPTY_DOC;
		// Le immagini della colonna a lato vanno in cima al testo.
		const side: DocNode[] = (p.fields ?? []).flatMap((f) => (f.image ? [{ type: 'image', attrs: { src: `/files/${f.image}`, alt: f.label || p.title } }] : []));
		const doc: DocNode = side.length ? { ...body, content: [...side, ...(body.content ?? [])] } : body;
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


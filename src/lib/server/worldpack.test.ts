import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { useMemoryDb, schema } from './db/index.ts';
import { resetSettingsCache, saveSettings, getCalendar } from './settings.ts';
import { createPage, getPageBySlug, listPages } from './pages.ts';
import { createCategory } from './taxonomy.ts';
import { createMap, listMaps, pinsOf, saveLayer, layersOf, savePin } from './maps.ts';
import { saveImage } from './files.ts';
import { saveEvent, listEvents, setTimelineMode, getTimeline, listTimelines } from './timeline.ts';
import { listTemplates } from './templates.ts';
import { exportMarkdown, exportWorld, importPack, previewPack, readPack, type ExportOptions } from './worldpack.ts';
import { preset } from '../calendar.ts';
import type { DocNode } from '../content/types.ts';

const admin = { id: 1, role: 'admin' as const };
const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null, content: { type: 'doc' } };
const p = (text: string): DocNode => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const all: ExportOptions = { name: 'Faerûn', allPages: true, categoryIds: [], tagIds: [], maps: true, templates: true, calendar: true, timeline: true, themes: true, secrets: false };

let db: ReturnType<typeof useMemoryDb>;
beforeEach(() => {
	process.env.CS_DATA_DIR = mkdtempSync(join(tmpdir(), 'cs-pack-'));
	db = useMemoryDb();
	resetSettingsCache();
	db.insert(schema.users).values({ id: 1, username: 'a', displayName: 'A', passwordHash: 'x', role: 'admin', createdAt: 0 }).run();
});

function buildWorld() {
	saveSettings({ calendar: preset('harptos', 'it') });
	const cat = createCategory('Luoghi', null);
	const img = saveImage(readFileSync('tests/fixtures/city.png'), 'city.png', 1);
	if (!img.ok) throw new Error('img');
	createPage({ ...base, title: 'Bartolo', categoryId: cat.id, tags: ['Nord'], content: { type: 'doc', content: [p('Oste.'), { type: 'secret', content: [p('Spia.')] }, { type: 'image', attrs: { src: `/files/${img.file.id}`, alt: 'Ritratto' } }] } }, admin);
	const sign = saveImage(readFileSync('tests/fixtures/map.png'), 'insegna.png', 1);
	if (!sign.ok) throw new Error('img');
	const fields = [{ label: 'Oste', value: '[[Bartolo]]' }, { label: "L'insegna", value: '', image: sign.file.id }];
	createPage({ ...base, title: 'Locanda', categoryId: cat.id, fields, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { target: 'bartolo', title: 'Bartolo' } }] }] } }, admin);
	createPage({ ...base, visibility: 'master', title: 'Piano segreto', content: { type: 'doc', content: [p('x')] } }, admin);
	createPage({ ...base, visibility: 'personal', title: 'Diario', content: { type: 'doc', content: [p('x')] } }, admin);
	const costa = createPage({ ...base, kind: 'map', title: 'Costa', content: { type: 'doc', content: [p('La costa.')] } }, admin, (pg) =>
		createMap(pg, { parentId: null, scale: 1, unit: 'km' }, img.file, 1)
	);
	const map = listMaps(admin)[0];
	createPage({ ...base, kind: 'map', title: 'Porto' }, admin, (pg) => createMap(pg, { parentId: map.id, scale: null, unit: '' }, sign.file, 1));
	const port = listMaps(admin).find((m) => m.title === 'Porto')!;
	saveLayer(map.id, 'Segreti', 'master');
	const secretLayer = layersOf(map.id, admin)[0];
	savePin(map.id, { x: 10, y: 10, label: 'Locanda', description: '', icon: 'tavern', color: 'red', pageSlug: 'locanda', targetMapId: port.id, layerId: null, visibility: 'players' });
	savePin(map.id, { x: 20, y: 20, label: 'Covo', description: '', icon: 'pin', color: 'red', pageSlug: null, targetMapId: null, layerId: secretLayer.id, visibility: 'players' });
	const timeline = (title: string, mode: 'world' | 'campaign') => createPage({ ...base, kind: 'timeline', visibility: 'public', title }, admin, (pg) => setTimelineMode(pg.id, mode));
	const world = timeline('Storia', 'world');
	saveEvent({ timelineId: world.id, title: 'Fondazione', description: '', date: { year: 1200 }, approx: '', realDate: null, pageId: null, visibility: 'players' }, 1);
	saveEvent({ timelineId: world.id, title: 'Complotto', description: '', date: { year: 1300 }, approx: '', realDate: null, pageId: null, visibility: 'master' }, 1);
	// La cronologia della campagna resta fuori dal pacchetto.
	const campaign = timeline('Al tavolo', 'campaign');
	saveEvent({ timelineId: campaign.id, title: 'Sessione zero', description: '', date: null, approx: '', realDate: '2026-10-01', pageId: null, visibility: 'players' }, 1);
	createPage({ ...base, kind: 'template', title: 'PNG', fields: [{ label: 'Razza', value: '' }], session: null }, admin);
	void costa;
}

describe('pacchetto mondo', () => {
	it('esporta senza segreti né pagine personali', () => {
		buildWorld();
		const zip = unzipSync(exportWorld(all, admin));
		const pages = JSON.parse(strFromU8(zip['pages.json']));
		type P = { title: string; kind: string; map?: { pins: { label: string; target: string | null }[]; parent: string | null }; timeline?: { events: { title: string }[] } };
		expect(pages.map((x: P) => `${x.kind}:${x.title}`).sort()).toEqual(['map:Costa', 'map:Porto', 'page:Bartolo', 'page:Locanda', 'template:PNG', 'timeline:Storia']);
		expect(JSON.stringify(pages)).not.toContain('Spia');
		const costa = pages.find((x: P) => x.title === 'Costa');
		expect(costa.map.pins).toEqual([expect.objectContaining({ label: 'Locanda', target: 'porto' })]);
		expect(pages.find((x: P) => x.title === 'Porto').map.parent).toBe('costa');
		expect(pages.find((x: P) => x.title === 'Storia').timeline.events.map((e: { title: string }) => e.title)).toEqual(['Fondazione']);
		expect(JSON.stringify(pages)).not.toContain('Sessione zero');
		expect(Object.keys(zip).filter((k) => k.startsWith('files/'))).toHaveLength(2);
		expect(zip[`files/${pages.find((x: { title: string }) => x.title === 'Locanda').image}.png`]).toBeDefined();
		expect(strFromU8(zip['pages/locanda.md'])).toContain('[[Bartolo]]');
	});

	it('importa in un\'altra wiki, aggiustando collegamenti e immagini', () => {
		buildWorld();
		const bytes = exportWorld({ ...all, secrets: true }, admin);
		// Nuova wiki vuota con già una pagina "Bartolo".
		process.env.CS_DATA_DIR = mkdtempSync(join(tmpdir(), 'cs-pack2-'));
		db = useMemoryDb();
		resetSettingsCache();
		db.insert(schema.users).values({ id: 1, username: 'b', displayName: 'B', passwordHash: 'x', role: 'admin', createdAt: 0 }).run();
		createPage({ ...base, title: 'Bartolo', content: { type: 'doc', content: [p('Un altro Bartolo')] } }, admin);

		const r = readPack(bytes);
		if (!r.ok) throw new Error(r.error);
		expect(previewPack(r.pack).pageConflicts).toEqual(['Bartolo']);
		const done = importPack(r.pack, { conflict: 'rename', calendar: true }, admin);
		expect(done).toMatchObject({ pages: 4, maps: 2, templates: 1, events: 2 });

		// "Bartolo" importato diventa bartolo-2 e il collegamento della Locanda lo segue.
		const loc = getPageBySlug('locanda')!;
		expect(JSON.stringify(loc.content)).toContain('"target":"bartolo-2"');
		// L'immagine della colonna a lato arriva con un indirizzo nuovo, con la sua didascalia.
		expect(loc.imageId).toMatch(/^[\w-]+$/);
		expect(db.select().from(schema.files).all().map((f) => f.id)).toContain(loc.imageId);
		expect(loc.fields).toEqual([{ label: 'Oste', value: '[[Bartolo]]' }, { label: "L'insegna", value: '', image: loc.imageId }]);
		expect(getPageBySlug('bartolo-2')!.title).toBe('Bartolo');
		expect(JSON.stringify(getPageBySlug('bartolo-2')!.content)).toMatch(/\/files\/[\w-]+/);
		expect(getCalendar().name).toBe('Harptos');
		const storia = getTimeline(getPageBySlug('storia')!.id)!;
		expect(storia.mode).toBe('world');
		expect(listEvents(storia, admin).map((e) => e.title)).toEqual(['Fondazione', 'Complotto']);
		const map = listMaps(admin).find((m) => m.title === 'Costa')!;
		const port = listMaps(admin).find((m) => m.title === 'Porto')!;
		expect(port.parentId).toBe(map.id);
		expect(pinsOf(map.id, admin).map((x) => x.label).sort()).toEqual(['Covo', 'Locanda']);
		expect(pinsOf(map.id, admin).find((x) => x.label === 'Locanda')!.target).toEqual({ slug: 'porto', title: 'Porto' });
		expect(layersOf(map.id, admin).map((l) => l.name)).toEqual(['Segreti']);
		expect(JSON.stringify(getPageBySlug('costa')!.content)).toContain('La costa.');
		expect(listTemplates(admin).map((t) => t.title)).toEqual(['PNG']);
		expect(listPages(admin).total).toBe(8);
	});

	it('legge i pacchetti della 0.10 e precedenti: mappe, eventi e template a parte', () => {
		const img = saveImage(readFileSync('tests/fixtures/map.png'), 'm.png', 1);
		if (!img.ok) throw new Error('img');
		const files = { [`files/oldmap.png`]: readFileSync('tests/fixtures/map.png') };
		const manifest = { format: 'crooked-shelf-world', version: 1, name: 'Vecchio', secrets: false, counts: {} };
		const json = (v: unknown) => strToU8(JSON.stringify(v));
		const zip = zipSync({
			'manifest.json': json(manifest),
			'pages.json': json([{ slug: 'bartolo', title: 'Bartolo', content: { type: 'doc', content: [p('Oste.')] }, fields: [], visibility: 'players', category: null, tags: [], template: null }]),
			'maps.json': json([
				{ slug: 'regno', title: 'Regno', description: 'Il regno.', file: 'oldmap', visibility: 'players', parent: null, scale: null, unit: '', layers: [], pins: [{ x: 1, y: 1, label: 'Città', description: '', icon: 'city', color: 'red', page: 'bartolo', target: 'citta', layer: null, visibility: 'players' }] },
				{ slug: 'citta', title: 'Città', description: '', file: 'oldmap', visibility: 'players', parent: 'regno', scale: null, unit: '', layers: [], pins: [] }
			]),
			'timeline.json': json([{ title: 'Fondazione', description: '', year: 100, month: null, day: null, approx: '', visibility: 'players', page: 'bartolo' }]),
			'templates.json': json([{ name: 'Taverna', description: 'Una locanda.', fields: ['Oste'], content: { type: 'doc', content: [p('Menù')] }, session: false }]),
			...files
		});
		const r = readPack(zip);
		if (!r.ok) throw new Error(r.error);
		expect(previewPack(r.pack).pageConflicts).toEqual([]);
		const done = importPack(r.pack, { conflict: 'rename', calendar: false }, admin);
		expect(done).toMatchObject({ pages: 1, maps: 2, templates: 1, events: 1 });
		const regno = getPageBySlug('regno')!;
		expect(regno.kind).toBe('map');
		expect(JSON.stringify(regno.content)).toContain('Il regno.');
		const maps = listMaps(admin);
		expect(maps.find((m) => m.title === 'Città')!.parentId).toBe(maps.find((m) => m.title === 'Regno')!.id);
		expect(pinsOf(maps.find((m) => m.title === 'Regno')!.id, admin)[0].target).toEqual({ slug: 'citta', title: 'Città' });
		// Gli eventi vanno in una cronologia del mondo (creata se non c'è).
		const world = listTimelines(admin, 'world');
		expect(world).toHaveLength(1);
		const evs = listEvents({ id: world[0].id, mode: 'world' }, admin);
		expect(evs.map((e) => [e.title, e.pageSlug])).toEqual([['Fondazione', 'bartolo']]);
		expect(listTemplates(admin)[0]).toMatchObject({ title: 'Taverna', fields: ['Oste'] });
	});

	it("dai pacchetti di prima l'immagine della pagina diventa il primo riquadro", () => {
		buildWorld();
		const zip = unzipSync(exportWorld(all, admin));
		const pages = JSON.parse(strFromU8(zip['pages.json']));
		for (const pg of pages) pg.fields = pg.fields.filter((f: { image?: string }) => !f.image);
		zip['pages.json'] = strToU8(JSON.stringify(pages));
		db.update(schema.pages).set({ deletedAt: 1 }).run();
		const r = readPack(zipSync(zip));
		if (!r.ok) throw new Error(r.error);
		importPack(r.pack, { conflict: 'rename', calendar: false }, admin);
		expect(getPageBySlug('costa-2')!.kind).toBe('map');
		const loc = getPageBySlug('locanda-2')!;
		expect(loc.fields).toEqual([{ label: '', value: '', image: loc.imageId }, { label: 'Oste', value: '[[Bartolo]]' }]);
	});

	it('rifiuta file che non sono pacchetti', () => {
		expect(readPack(new Uint8Array([1, 2, 3]))).toEqual({ ok: false, error: 'world.errFile' });
	});

	it('esporta tutta la wiki in Markdown', () => {
		buildWorld();
		const zip = unzipSync(exportMarkdown(admin));
		expect(Object.keys(zip).sort()).toEqual(expect.arrayContaining(['Luoghi/Bartolo.md', 'Luoghi/Locanda.md', 'Piano segreto.md', 'Diario.md', 'Indice.md']));
		expect(strFromU8(zip['Luoghi/Bartolo.md'])).toContain('![Ritratto](../_files/');
		expect(strFromU8(zip['Luoghi/Bartolo.md'])).toContain('> [!secret]');
		// Le immagini della colonna a lato in cima al testo, con il file accanto; i campi di testo nell'intestazione.
		const md = strFromU8(zip['Luoghi/Locanda.md']);
		const cover = /^!\[L'insegna\]\(\.\.\/(_files\/[\w-]+\.png)\)$/m.exec(md);
		expect(cover).not.toBeNull();
		expect(zip[cover![1]]).toBeDefined();
		expect(md).toContain('"Oste": "[[Bartolo]]"');
		expect(md).not.toContain(`"L'insegna"`);
	});
});


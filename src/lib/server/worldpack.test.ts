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
import { saveEvent, listEvents } from './timeline.ts';
import { exportMarkdown, exportWorld, importPack, previewPack, readPack, type ExportOptions } from './worldpack.ts';
import { preset } from '../calendar.ts';
import type { DocNode } from '../content/types.ts';

const admin = { id: 1, role: 'admin' as const };
const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null };
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
	const map = createMap({ title: 'Costa', description: '', visibility: 'players', parentId: null, scale: 1, unit: 'km' }, img.file, 1);
	saveLayer(map.id, 'Segreti', 'master');
	const secretLayer = layersOf(map.id, admin)[0];
	savePin(map.id, { x: 10, y: 10, label: 'Locanda', description: '', icon: 'tavern', color: 'red', pageSlug: 'locanda', targetMapId: null, layerId: null, visibility: 'players' });
	savePin(map.id, { x: 20, y: 20, label: 'Covo', description: '', icon: 'pin', color: 'red', pageSlug: null, targetMapId: null, layerId: secretLayer.id, visibility: 'players' });
	saveEvent({ timeline: 'world', title: 'Fondazione', description: '', date: { year: 1200 }, approx: '', realDate: null, pageId: null, visibility: 'players' }, 1);
	saveEvent({ timeline: 'world', title: 'Complotto', description: '', date: { year: 1300 }, approx: '', realDate: null, pageId: null, visibility: 'master' }, 1);
}

describe('pacchetto mondo', () => {
	it('esporta senza segreti né pagine personali', () => {
		buildWorld();
		const zip = unzipSync(exportWorld(all, admin));
		const pages = JSON.parse(strFromU8(zip['pages.json']));
		expect(pages.map((x: { title: string }) => x.title).sort()).toEqual(['Bartolo', 'Locanda']);
		expect(JSON.stringify(pages)).not.toContain('Spia');
		const maps = JSON.parse(strFromU8(zip['maps.json']));
		expect(maps[0].pins.map((x: { label: string }) => x.label)).toEqual(['Locanda']);
		expect(JSON.parse(strFromU8(zip['timeline.json'])).map((e: { title: string }) => e.title)).toEqual(['Fondazione']);
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
		expect(done.pages).toBe(3);

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
		expect(listEvents('world', admin).map((e) => e.title)).toEqual(['Fondazione', 'Complotto']);
		const map = listMaps(admin)[0];
		expect(pinsOf(map.id, admin).map((x) => x.label).sort()).toEqual(['Covo', 'Locanda']);
		expect(layersOf(map.id, admin).map((l) => l.name)).toEqual(['Segreti']);
		expect(listPages(admin).total).toBe(4);
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


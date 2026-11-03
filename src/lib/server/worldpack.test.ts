import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { eq } from 'drizzle-orm';
import { useMemoryDb, schema } from './db/index.ts';
import { resetSettingsCache, getCalendar, customThemes } from './settings.ts';
import { storeTheme } from './themesAdmin.ts';
import { FIRST_CAMPAIGN, getCampaign, inCampaign, saveCampaign } from './campaigns.ts';
import { createPage, getPageBySlug, listPages, pageCover, updatePage } from './pages.ts';
import { createCategory } from './taxonomy.ts';
import { createMap, listMaps, pinsOf, saveLayer, layersOf, savePin } from './maps.ts';
import { getFile, saveImage } from './files.ts';
import { saveEvent, listEvents, setTimelineMode, getTimeline, listTimelines } from './timeline.ts';
import { homePage, listTemplates, seedWiki } from './templates.ts';
import { exportMarkdown, exportWorld, importAsCampaign, importPack, previewPack, readPack, type ExportOptions, type Pack } from './worldpack.ts';
import { hasRule } from './rules/index.ts';
import { preset } from '../calendar.ts';
import { THEMES } from '../themes.ts';
import { BUILTIN_TEMPLATES } from '../templates.ts';
import { inlineLinks, stripSecrets } from '../content/extract.ts';
import { ruleTarget, type RuleKind } from '../rules/index.ts';
import type { DocNode } from '../content/types.ts';

const admin = { id: 1, role: 'master' as const, admin: true };
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
	saveCampaign(FIRST_CAMPAIGN, { calendar: preset('harptos', 'it') });
	const cat = createCategory('Luoghi', null);
	const img = saveImage(readFileSync('tests/fixtures/city.png'), 'city.png', 1);
	if (!img.ok) throw new Error('img');
	createPage({ ...base, title: 'Bartolo', categoryId: cat.id, tags: ['Nord'], cover: { image: img.file.id, color: null, y: 30 }, content: { type: 'doc', content: [p('Oste.'), { type: 'secret', content: [p('Spia.')] }, { type: 'image', attrs: { src: `/files/${img.file.id}`, alt: 'Ritratto' } }] } }, admin);
	const sign = saveImage(readFileSync('tests/fixtures/map.png'), 'insegna.png', 1);
	if (!sign.ok) throw new Error('img');
	const fields = [{ label: 'Oste', value: '[[Bartolo]]' }, { label: "L'insegna", value: '', image: sign.file.id }];
	createPage({ ...base, title: 'Locanda', categoryId: cat.id, fields, cover: { image: null, color: 'night', y: 50 }, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { target: 'bartolo', title: 'Bartolo' } }] }] } }, admin);
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
		expect(previewPack(r.pack, admin).pageConflicts).toEqual(['Bartolo']);
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
		// Le copertine arrivano anche loro: l'immagine con l'indirizzo nuovo, il colore così com'è.
		const cover = pageCover(getPageBySlug('bartolo-2')!);
		expect(cover).toMatchObject({ color: null, y: 30 });
		expect(db.select().from(schema.files).all().map((f) => f.id)).toContain(cover!.image);
		expect(pageCover(loc)).toEqual({ image: null, color: 'night', y: 50 });
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

	it("porta con sé l'immagine di sfondo dei temi", () => {
		const img = saveImage(readFileSync('tests/fixtures/city.png'), 'cielo.png', 1);
		if (!img.ok) throw new Error('img');
		storeTheme({ name: 'Cielo', scheme: 'dark', colors: THEMES[1].colors, background: img.file.id }, null);
		const bytes = exportWorld(all, admin);
		process.env.CS_DATA_DIR = mkdtempSync(join(tmpdir(), 'cs-pack2-'));
		db = useMemoryDb();
		resetSettingsCache();
		db.insert(schema.users).values({ id: 1, username: 'b', displayName: 'B', passwordHash: 'x', role: 'admin', createdAt: 0 }).run();

		const r = readPack(bytes);
		if (!r.ok) throw new Error(r.error);
		importPack(r.pack, { conflict: 'rename', calendar: false }, admin);
		const [theme] = customThemes();
		expect(theme.background).toBeTruthy();
		expect(theme.background).not.toBe(img.file.id);
		expect(getFile(theme.background!)?.name).toBe(`${img.file.id}.png`);
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
		expect(previewPack(r.pack, admin).pageConflicts).toEqual([]);
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

	it.each([
		{ name: 'la-campana-sommersa', pages: 11, categories: 4, spoiler: /Oddone|paratie si aprirono/ },
		{ name: 'la-notte-in-affitto', pages: 7, categories: 2, spoiler: /engramma|perdit[ae] termic/ }
	])("l'avventura di esempio $name si importa con tutti i collegamenti e i prompt, e non anticipa nulla ai giocatori", ({ name, pages: n, categories, spoiler }) => {
		const dir = `examples/${name}`;
		const r = readPack(readFileSync(`${dir}/${name}.shelf`));
		if (!r.ok) throw new Error(r.error);
		expect(importPack(r.pack, { conflict: 'rename', calendar: false }, admin)).toMatchObject({ pages: n, categories });
		const prompts = readFileSync(`${dir}/prompt-immagini.md`, 'utf8');
		const pages = JSON.parse(strFromU8(r.pack.entries['pages.json'])) as { slug: string; title: string }[];
		const refs = (n: DocNode): DocNode[] => [...(n.type === 'wikiLink' || n.type === 'ruleRef' ? [n] : []), ...(n.content ?? []).flatMap(refs)];
		for (const { slug, title } of pages) {
			const page = getPageBySlug(slug)!;
			const content = page.content as DocNode;
			expect(prompts).toContain(`## ${title}\n`);
			const links = [
				...refs(content).map((n) => (n.type === 'wikiLink' ? String(n.attrs!.target) : ruleTarget(n.attrs!.kind as RuleKind, String(n.attrs!.name)))),
				...page.fields!.flatMap((f) => inlineLinks(f.value))
			];
			for (const l of links) {
				const rule = /^@(\w+)\/(.+)$/.exec(l);
				expect(rule ? hasRule(rule[1] as RuleKind, rule[2]) : !!getPageBySlug(l), `${title}: ${l}`).toBe(true);
			}
			if (page.visibility !== 'master') expect(JSON.stringify([stripSecrets(content), page.fields])).not.toMatch(spoiler);
		}
	});

	describe('in una campagna nuova', () => {
		const dm = { id: 2, role: 'master' as const };
		const read = (bytes: Uint8Array): Pack => {
			const r = readPack(bytes);
			if (!r.ok) throw new Error(r.error);
			return r.pack;
		};
		const pagesOf = (id: number) => db.select().from(schema.pages).where(eq(schema.pages.campaignId, id)).all();
		beforeEach(() => {
			db.insert(schema.users).values({ id: 2, username: 'm', displayName: 'M', passwordHash: 'x', role: 'master', createdAt: 0 }).run();
		});

		it('la home e i template sono quelli del pacchetto: niente doppioni delle pagine di partenza', () => {
			saveCampaign(FIRST_CAMPAIGN, { name: 'Faerûn', calendar: preset('harptos', 'it') });
			seedWiki('it', admin);
			const home = homePage(admin)!;
			updatePage(home, { ...base, visibility: 'public', title: home.title, content: { type: 'doc', content: [p('Benvenuti sulla Costa.')] } }, admin, true);
			createPage({ ...base, title: 'Bartolo' }, admin);
			const bytes = exportWorld(all, admin);
			expect(JSON.parse(strFromU8(unzipSync(bytes)['manifest.json'])).home).toBe(home.slug);
			const before = pagesOf(FIRST_CAMPAIGN).length;

			const { campaign, done } = importAsCampaign(read(bytes), { name: 'Faerûn, di nuovo', master: dm });
			expect(done).toMatchObject({ templates: BUILTIN_TEMPLATES.length, skipped: 0 });
			expect(getCampaign(campaign.id)).toMatchObject({ name: 'Faerûn, di nuovo', masterId: 2, calendar: { name: 'Harptos' } });
			inCampaign(getCampaign(campaign.id)!, () => {
				const newHome = homePage(dm)!;
				expect(newHome.title).toBe('Faerûn');
				expect(JSON.stringify(newHome.content)).toContain('Benvenuti sulla Costa.');
				expect(getCalendar().name).toBe('Harptos');
				expect(listTemplates(dm)).toHaveLength(BUILTIN_TEMPLATES.length);
				expect(listTimelines(dm, 'world').map((t) => t.slug)).toEqual(['cronologia-del-mondo']);
				expect(listTimelines(dm, 'campaign')).toHaveLength(1);
				expect(getPageBySlug('bartolo')).toBeDefined();
			});
			// Tutte quelle del pacchetto, più la cronologia della campagna (che il pacchetto non porta mai); la prima campagna è com'era.
			expect(pagesOf(campaign.id).filter((x) => !x.slug.endsWith('-2'))).toHaveLength(pagesOf(campaign.id).length);
			expect(pagesOf(campaign.id)).toHaveLength(before);
			expect(pagesOf(FIRST_CAMPAIGN)).toHaveLength(before);
		});

		it("un Admin che qui è giocatore: i segreti del pacchetto vanno al Master della campagna nuova, e non vede i titoli del Master di qui", () => {
			createPage({ ...base, title: 'Bartolo', content: { type: 'doc', content: [p('Oste.'), { type: 'secret', content: [p('Spia.')] }] } }, admin);
			createPage({ ...base, visibility: 'master', title: 'Piano segreto', content: { type: 'doc', content: [p('x')] } }, admin);
			const bytes = exportWorld({ ...all, secrets: true }, admin);
			const player = { ...admin, role: 'player' as const };
			expect(previewPack(read(bytes), player).pageConflicts).toEqual(['Bartolo']);

			const { campaign } = importAsCampaign(read(bytes), { name: 'Altrove', master: dm });
			inCampaign(getCampaign(campaign.id)!, () => {
				expect(JSON.stringify(getPageBySlug('bartolo')!.content)).toContain('Spia.');
				expect(getPageBySlug('piano-segreto')).toMatchObject({ visibility: 'master', authorId: dm.id });
			});
		});

		it('quello che il pacchetto non ha arriva come in ogni campagna nuova', () => {
			// Senza home (es. un pacchetto della 0.11), senza template e senza cronologie.
			createPage({ ...base, title: 'Bartolo' }, admin);
			const bytes = exportWorld({ ...all, templates: false, timeline: false }, admin);
			expect(JSON.parse(strFromU8(unzipSync(bytes)['manifest.json'])).home).toBeNull();

			const { campaign } = importAsCampaign(read(bytes), { name: 'Bartolo', master: dm });
			inCampaign(getCampaign(campaign.id)!, () => {
				// La home nasce dopo il pacchetto: le sue pagine tengono il loro indirizzo.
				expect(getPageBySlug('bartolo')!.id).not.toBe(homePage(dm)!.id);
				expect(homePage(dm)).toMatchObject({ title: 'Bartolo', slug: 'bartolo-2' });
				expect(listTemplates(dm)).toHaveLength(BUILTIN_TEMPLATES.length);
				expect(listTimelines(dm).map((t) => t.mode).sort()).toEqual(['campaign', 'world']);
			});
		});

		it('in una campagna che esiste già la home del pacchetto resta una pagina', () => {
			seedWiki('it', admin);
			const home = homePage(admin)!;
			const bytes = exportWorld(all, admin);
			importPack(read(bytes), { conflict: 'rename', calendar: false }, admin);
			expect(homePage(admin)!.id).toBe(home.id);
			expect(getPageBySlug(`${home.slug}-2`)).toBeDefined();
		});
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


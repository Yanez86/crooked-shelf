import { beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { useMemoryDb, schema } from './db/index.ts';
import { resetSettingsCache, saveSettings } from './settings.ts';
import { createPage, deletePage, type PageRow } from './pages.ts';
import {
	cellsOf,
	createHexMap,
	getHexMapOfPage,
	hexMapsForPage,
	hexTilesets,
	labelOrigin,
	updateHexMap,
	HEX_MAX_CELLS,
	moveParty,
	paintCells,
	removeCells,
	revealAround,
	saveFeature,
	setCellNote,
	setCellsState,
	tilesetOf,
	visibleCells,
	visibleFeatures,
	visibleParty
} from './hexmaps.ts';
import { applyHexOp, hexActions, hexView, HEX_DEFAULTS, masterHexMap, readHexForm } from './hexPage.ts';
import { allPlugins, reloadPlugins, setPluginEnabled } from './plugins.ts';
import { getDb } from './db/index.ts';
import { hexLabel } from '../hex.ts';
import { strFromU8, unzipSync } from 'fflate';
import { exportMarkdown, exportWorld, importAsCampaign, readPack, type ExportOptions } from './worldpack.ts';
import { inCampaign, getCampaign } from './campaigns.ts';
import { getPageBySlug } from './pages.ts';
import { handleMcp } from './mcp.ts';

const master = { id: 1, role: 'master' as const };
const alice = { id: 2, role: 'player' as const };
// Il Master nella vista giocatore: per il server è un giocatore qualunque.
const asPlayer = { id: 1, role: 'player' as const, asPlayer: true };
const base = { playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null, content: { type: 'doc' } };

beforeEach(() => {
	const db = useMemoryDb();
	resetSettingsCache();
	for (const [id, role] of [
		[1, 'master'],
		[2, 'player']
	] as const)
		db.insert(schema.users).values({ id, username: 'u' + id, displayName: 'U' + id, passwordHash: 'x', role, createdAt: 0 }).run();
	process.env.CS_DATA_DIR = mkdtempSync(join(tmpdir(), 'cs-hex-'));
	reloadPlugins();
});

/** Una pagina «mappa a esagoni» con la sua mappa (un esagono a 0,0, nascosto). */
function hexPage(title = 'Valle', visibility: 'public' | 'players' | 'master' = 'players') {
	const page = createPage({ ...base, kind: 'hexmap', visibility, title }, master, (p) => createHexMap(p.id, HEX_DEFAULTS));
	return { page, map: getHexMapOfPage(page.id)! };
}

/** Una valle piccola: 0,0 esplorato con la città, 1,0 intravisto col tempio, 2,0 nascosto con la tana. */
function valley() {
	const { page, map } = hexPage();
	paintCells(map.id, [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }], 'forest');
	setCellsState(map.id, [{ q: 0, r: 0 }], 'explored');
	setCellsState(map.id, [{ q: 1, r: 0 }], 'glimpsed');
	setCellNote(map.id, { q: 0, r: 0 }, 'Il borgomastro paga i briganti');
	setCellNote(map.id, { q: 2, r: 0 }, 'Qui dorme la viverna');
	const feat = (q: number, name: string, visibility: 'players' | 'master', pageSlug: string | null = null) =>
		saveFeature(map.id, { q, r: 0, icon: 'city', name, description: '', pageSlug, visibility });
	feat(0, 'Vadoscuro', 'players', 'vadoscuro');
	feat(0, 'Cunicoli dei contrabbandieri', 'master', 'cunicoli');
	feat(1, 'Santuario della Luna', 'players', 'santuario');
	feat(2, 'Tana della viverna', 'master');
	return { page, map: getHexMapOfPage(page.id)! };
}

const keys = (cells: { q: number; r: number }[]) => cells.map((c) => `${c.q},${c.r}`).sort();

describe('mappe a esagoni: cosa arriva a chi', () => {
	it('il giocatore non riceve gli esagoni nascosti né le note', () => {
		const { map } = valley();
		expect(keys(visibleCells(map.id, master))).toEqual(['0,0', '1,0', '2,0', '3,0']);
		expect(keys(visibleCells(map.id, alice))).toEqual(['0,0', '1,0']);
		expect(visibleCells(map.id, alice).every((c) => c.note === '')).toBe(true);
		expect(visibleCells(map.id, master).find((c) => c.q === 0)?.note).toBe('Il borgomastro paga i briganti');
		// La vista giocatore del Master è la stessa del giocatore.
		expect(visibleCells(map.id, asPlayer)).toEqual(visibleCells(map.id, alice));
		expect(visibleCells(map.id, null)).toEqual(visibleCells(map.id, alice));
	});

	it('elementi: al giocatore solo quelli per i giocatori, negli esagoni esplorati', () => {
		const { map } = valley();
		expect(visibleFeatures(map.id, master).map((f) => f.name)).toHaveLength(4);
		// Il tempio è per i giocatori ma l'esagono è solo intravisto; i cunicoli e la tana sono del Master.
		expect(visibleFeatures(map.id, alice).map((f) => f.name)).toEqual(['Vadoscuro']);
		expect(visibleFeatures(map.id, asPlayer).map((f) => f.name)).toEqual(['Vadoscuro']);
	});

	it('nella pagina per il giocatore non c’è niente dei segreti', () => {
		const { page } = valley();
		const view = hexView(page as PageRow, alice, 'it');
		const text = JSON.stringify(view);
		for (const secret of ['briganti', 'viverna', 'Cunicoli', 'Santuario', 'cunicoli', 'santuario', '"2,0"', '"q":2', '"q":3'])
			expect(text, secret).not.toContain(secret);
		expect(view.canEdit).toBe(false);
		expect(view.editData).toBeNull();
		expect(view.palette).toEqual([]);
		expect(view.features.map((f) => f.name)).toEqual(['Vadoscuro']);
		// Il Master vede tutto.
		const full = hexView(page as PageRow, master, 'it');
		expect(full.cells).toHaveLength(4);
		expect(full.features).toHaveLength(4);
		expect(full.canEdit).toBe(true);
	});

	it('il gruppo si vede solo se l’esagono dove sta è scoperto', () => {
		const { map } = valley();
		moveParty(map.id, { q: 2, r: 0 }, false);
		expect(visibleParty(getHexMapOfPage(map.pageId)!, master)).toEqual({ q: 2, r: 0 });
		expect(visibleParty(getHexMapOfPage(map.pageId)!, alice)).toBeNull();
		moveParty(map.id, { q: 0, r: 0 }, false);
		expect(visibleParty(getHexMapOfPage(map.pageId)!, alice)).toEqual({ q: 0, r: 0 });
		// Su un esagono che non c'è il gruppo non va.
		expect(moveParty(map.id, { q: 9, r: 9 }, false)).toBe(false);
	});

	it('le pagine collegate dicono in che mappa compaiono, a chi vede l’elemento', () => {
		const { page } = valley();
		expect(hexMapsForPage('vadoscuro', alice)).toEqual([{ slug: page.slug, title: 'Valle' }]);
		expect(hexMapsForPage('cunicoli', alice)).toEqual([]);
		expect(hexMapsForPage('santuario', alice)).toEqual([]);
		expect(hexMapsForPage('cunicoli', master)).toEqual([{ slug: page.slug, title: 'Valle' }]);
		// Una mappa solo per il Master non la nomina a nessun altro, e nel cestino a nessuno.
		deletePage(page.id);
		expect(hexMapsForPage('vadoscuro', master)).toEqual([]);
	});

	it('una mappa solo per il Master non si vede, e il giocatore non la modifica', () => {
		const { page } = hexPage('Segreta', 'master');
		expect(() => masterHexMap(page as PageRow, alice)).toThrow();
		expect(() => masterHexMap(page as PageRow, asPlayer)).toThrow();
		expect(masterHexMap(page as PageRow, master).pageId).toBe(page.id);
		const f = new FormData();
		f.set('q', '0');
		f.set('r', '0');
		f.set('name', 'Spia');
		expect(() => hexActions.hexFeature(page as PageRow, alice, f)).toThrow();
	});
});

describe('mappe a esagoni: il Master costruisce', () => {
	it('dipinge e aggiunge: gli esagoni nuovi nascono nascosti', () => {
		const { map } = hexPage();
		expect(paintCells(map.id, [{ q: 0, r: 0 }, { q: 1, r: -1 }], 'hills')).toBe(1);
		const cells = cellsOf(map.id);
		expect(cells.map((c) => [c.q, c.r, c.terrain, c.state])).toEqual([
			[1, -1, 'hills', 'hidden'],
			[0, 0, 'hills', 'hidden']
		]);
	});

	it('scoprire segna la data una volta sola; nascondere la toglie', () => {
		const { map } = hexPage();
		setCellsState(map.id, [{ q: 0, r: 0 }], 'glimpsed', 1000);
		setCellsState(map.id, [{ q: 0, r: 0 }], 'explored', 2000);
		expect(cellsOf(map.id)[0]).toMatchObject({ state: 'explored', revealedAt: 1000 });
		setCellsState(map.id, [{ q: 0, r: 0 }], 'hidden', 3000);
		expect(cellsOf(map.id)[0]).toMatchObject({ state: 'hidden', revealedAt: null });
	});

	it('il gruppo esplora dove arriva e fa intravedere intorno, senza nascondere quello che era già esplorato', () => {
		const { map } = hexPage();
		const ring = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 2, r: 0 }];
		paintCells(map.id, ring, 'plains');
		setCellsState(map.id, [{ q: 0, r: 1 }], 'explored');
		moveParty(map.id, { q: 0, r: 0 }, true);
		const by = Object.fromEntries(cellsOf(map.id).map((c) => [`${c.q},${c.r}`, c.state]));
		expect(by).toMatchObject({ '0,0': 'explored', '1,0': 'glimpsed', '-1,1': 'glimpsed', '0,1': 'explored', '2,0': 'hidden' });
		revealAround(map.id, { q: 1, r: 0 });
		expect(cellsOf(map.id).find((c) => c.q === 2)?.state).toBe('glimpsed');
	});

	it('non toglie gli esagoni con dentro qualcosa, col gruppo, né l’ultimo', () => {
		const { map } = hexPage();
		paintCells(map.id, [{ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }], 'plains');
		saveFeature(map.id, { q: 1, r: 0, icon: 'city', name: 'Borgo', description: '', pageSlug: null, visibility: 'players' });
		moveParty(map.id, { q: 2, r: 0 }, false);
		expect(removeCells(map.id, [{ q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }])).toEqual([{ q: 1, r: 0 }, { q: 2, r: 0 }]);
		expect(keys(cellsOf(map.id))).toEqual(['0,0', '1,0', '2,0']);
		const { map: lone } = hexPage('Sola');
		expect(removeCells(lone.id, [{ q: 0, r: 0 }])).toEqual([{ q: 0, r: 0 }]);
		expect(cellsOf(lone.id)).toHaveLength(1);
	});

	it('le modifiche dall’API: controlli e risposta', () => {
		const { map } = hexPage();
		expect(applyHexOp(map, { op: 'paint', terrain: '<script>', cells: [{ q: 1, r: 0 }] })).toEqual({ error: 'errors.generic' });
		expect(applyHexOp(map, { op: 'state', state: 'boh', cells: [{ q: 0, r: 0 }] })).toEqual({ error: 'errors.generic' });
		expect(applyHexOp(map, { op: 'reveal' })).toEqual({ error: 'hex.errNoParty' });
		// Fuori dai confini e doppioni si scartano.
		const r = applyHexOp(map, { op: 'paint', terrain: 'swamp', cells: [{ q: 1, r: 0 }, { q: 1, r: 0 }, { q: 999, r: 0 }, { q: 'x', r: 0 }] });
		expect(r).toMatchObject({ cells: [{ q: 1, r: 0, terrain: 'swamp', state: 'hidden' }], party: null });
		const party = applyHexOp(map, { op: 'party', at: { q: 0, r: 0 }, reveal: true });
		expect('cells' in party ? party.cells?.find((c) => c.q === 1) : null).toMatchObject({ state: 'glimpsed' });
		const erased = applyHexOp(map, { op: 'erase', cells: [{ q: 1, r: 0 }] });
		expect(erased).toMatchObject({ cells: [{ q: 1, r: 0, terrain: null }], kept: [] });
	});

	it('non supera il numero massimo di esagoni', () => {
		const { map } = hexPage();
		// Uno in meno del massimo, a blocchi (SQLite ha un limite ai parametri di una query).
		const rows = Array.from({ length: HEX_MAX_CELLS - 2 }, (_, i) => ({ mapId: map.id, q: (i % 150) - 75, r: Math.floor(i / 150) + 1, terrain: 'plains' }));
		for (let i = 0; i < rows.length; i += 1000) getDb().insert(schema.hexCells).values(rows.slice(i, i + 1000)).run();
		expect(paintCells(map.id, [{ q: 0, r: -1 }, { q: 1, r: -1 }], 'hills')).toBeNull();
		expect(paintCells(map.id, [{ q: 0, r: -1 }], 'hills')).toBe(1);
	});

	it('i numeri seguono l’angolo in alto a sinistra finché non si scopre niente, poi restano fermi', () => {
		const { page, map } = hexPage();
		const fresh = () => getHexMapOfPage(page.id)!;
		const name = (q: number, r: number) => hexLabel({ q, r }, 'flat', labelOrigin(fresh()));
		expect(name(0, 0)).toBe('0101');
		// Il Master allarga la mappa verso ovest: prima della partita i numeri si spostano con lei.
		paintCells(map.id, [{ q: -1, r: 0 }, { q: -2, r: 1 }], 'hills');
		expect(name(-2, 1)).toBe('0102');
		expect(name(0, 0)).toBe('0302');
		expect(hexView(page as PageRow, master, 'it').numbering).toBeNull();
		// Alla prima scoperta si fermano: allargando ancora, quelli che i giocatori hanno visto non cambiano.
		setCellsState(map.id, [{ q: 0, r: 0 }], 'glimpsed');
		expect(hexView(page as PageRow, alice, 'it').numbering).toEqual({ col: -2, row: -1 });
		paintCells(map.id, [{ q: -3, r: 1 }], 'hills');
		expect(name(0, 0)).toBe('0302');
		expect(name(-3, 1)).toBe('−0101');
		// Rinumerare: l'esagono più in alto a sinistra torna 0101.
		updateHexMap(map.id, { ...HEX_DEFAULTS }, true);
		expect(name(-3, 1)).toBe('0101');
		expect(name(0, 0)).toBe('0402');
		// Cambiare orientamento rinumera comunque.
		updateHexMap(map.id, { ...HEX_DEFAULTS, orientation: 'pointy' });
		expect(fresh()).toMatchObject({ orientation: 'pointy' });
		expect(hexLabel({ q: -3, r: 1 }, 'pointy', labelOrigin(fresh())).slice(2)).toBe('02');
	});

	it('impostazioni dal modulo: un set che non c’è torna a quello incluso', () => {
		const f = new FormData();
		f.set('orientation', 'pointy');
		f.set('across', '6,5');
		f.set('unit', 'miglia');
		f.set('tileset', 'inesistente/set');
		expect(readHexForm(f).input).toEqual({ orientation: 'pointy', scale: 6.5, unit: 'miglia', tileset: 'tratto' });
	});
});

describe('set di tasselli dai plugin', () => {
	it('il set di un plugin acceso si sceglie; spento il plugin, la mappa usa quello incluso', () => {
		const dir = join(process.env.CS_DATA_DIR!, 'plugins', 'mappe-test');
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, 'plugin.json'),
			JSON.stringify({ id: 'mappe-test', name: 'Mappe di prova', description: 'x', instructions: 'y', license: 'CC0', contributes: { hexTilesets: ['set.json', 'brutto.json'] } })
		);
		writeFileSync(
			join(dir, 'set.json'),
			JSON.stringify({
				id: 'seppia',
				name: 'Seppia',
				terrains: [
					{ id: 'forest', name: { it: 'Bosco', en: 'Wood' }, fill: '#efe3c8', ink: '#5a4325', glyph: 'M12 3l7 13H5z' },
					{ id: 'moor', name: 'Brughiera', fill: '#efe3c8', ink: '#5a4325', glyph: 'M4 17h16' },
					{ id: 'evil', name: 'Male', fill: '#efe3c8', ink: '#5a4325', glyph: 'M0 0" onload="alert(1)' },
					{ id: 'BAD ID', name: 'x', fill: '#efe3c8', ink: '#5a4325', glyph: '' },
					{ id: 'nocolor', name: 'x', fill: 'red', ink: '#5a4325', glyph: '' }
				]
			})
		);
		writeFileSync(join(dir, 'brutto.json'), JSON.stringify({ id: 'tratto', name: 'Copia', terrains: [] }));
		reloadPlugins();
		setPluginEnabled('mappe-test', true);
		const f = new FormData();
		f.set('tileset', 'mappe-test/seppia');
		expect(readHexForm(f).input.tileset).toBe('mappe-test/seppia');
		const { page, map } = hexPage();
		getDb().update(schema.hexMaps).set({ tileset: 'mappe-test/seppia' }).run();
		paintCells(map.id, [{ q: 0, r: 0 }], 'moor');
		paintCells(map.id, [{ q: 1, r: 0 }], 'hills');
		paintCells(map.id, [{ q: 2, r: 0 }], 'volcano');
		const view = hexView(page as PageRow, master, 'it');
		expect(view.tileset).toMatchObject({ id: 'mappe-test/seppia', name: 'Seppia', missing: null });
		// I terreni scritti male non entrano: niente attributi nei tracciati, id e colori controllati.
		expect(view.palette).toEqual(['forest', 'moor']);
		expect(view.terrains.forest).toMatchObject({ name: 'Bosco', fill: '#efe3c8', fallback: false });
		// Un terreno che il set non ha prende quello incluso; uno che non c'è da nessuna parte, colore di riserva e id.
		expect(view.terrains.hills).toMatchObject({ name: 'Colline', fallback: false });
		expect(view.terrains.volcano).toMatchObject({ name: 'volcano', glyph: '', fallback: true });
		expect(hexView(page as PageRow, master, 'en').terrains.forest.name).toBe('Wood');

		setPluginEnabled('mappe-test', false);
		const off = getHexMapOfPage(page.id)!;
		expect(tilesetOf(off, 'it')).toMatchObject({ set: { id: 'tratto' }, missing: true });
		expect(hexView(page as PageRow, master, 'it').tileset.missing).toBe('mappe-test/seppia');
		expect(hexView(page as PageRow, alice, 'it').tileset.missing).toBeNull();
		// La brughiera non c'è nel set incluso: resta col suo id e il colore di riserva, ma l'esagono c'è sempre.
		expect(hexView(page as PageRow, master, 'it').terrains.moor).toMatchObject({ fallback: true });
	});

	it('il plugin d’esempio porta «Pergamena», senza avvisi', () => {
		setPluginEnabled('esempio-gotico', true);
		const set = hexTilesets('it').find((t) => t.id === 'esempio-gotico/pergamena');
		expect(set).toMatchObject({ name: 'Pergamena', source: 'Esempio: atmosfera gotica' });
		expect(set!.terrains.map((t) => t.name)).toContain('Cimitero');
		expect(allPlugins().find((p) => p.id === 'esempio-gotico')!.warnings).toEqual([]);
	});
});

describe('mappe a esagoni nel pacchetto mondo e nel Markdown', () => {
	const opts: ExportOptions = { name: 'Valle', allPages: true, categoryIds: [], tagIds: [], maps: true, templates: false, calendar: false, timeline: false, themes: false, secrets: false };
	const packPages = (zip: Uint8Array) => JSON.parse(strFromU8(unzipSync(zip)['pages.json'])) as { slug: string; kind: string; hex?: { cells: { q: number; note?: string }[]; features: { name: string }[]; party: unknown } }[];

	it('senza segreti esce solo quello che sanno i giocatori; coi segreti tutto', () => {
		const { map } = valley();
		moveParty(map.id, { q: 2, r: 0 }, false);
		const open = packPages(exportWorld(opts, master)).find((p) => p.kind === 'hexmap')!;
		expect(keys(open.hex!.cells as { q: number; r: number }[])).toEqual(['0,0', '1,0']);
		expect(open.hex!.features.map((f) => f.name)).toEqual(['Vadoscuro']);
		expect(open.hex!.party).toBeNull();
		expect(JSON.stringify(open)).not.toContain('briganti');
		const full = packPages(exportWorld({ ...opts, secrets: true }, master)).find((p) => p.kind === 'hexmap')!;
		expect(full.hex!.cells).toHaveLength(4);
		expect(full.hex!.features).toHaveLength(4);
		expect(full.hex!.cells.find((c) => c.q === 0)?.note).toBe('Il borgomastro paga i briganti');
		// Senza «mappe» la mappa a esagoni resta fuori.
		expect(packPages(exportWorld({ ...opts, maps: false }, master)).some((p) => p.kind === 'hexmap')).toBe(false);
	});

	it('si importa in una campagna nuova com’era', () => {
		valley();
		const read = readPack(exportWorld({ ...opts, secrets: true }, master));
		if (!read.ok) throw new Error(read.error);
		const { campaign } = importAsCampaign(read.pack, { name: 'Copia', master });
		expect(getCampaign(campaign.id)?.name).toBe('Copia');
		inCampaign(campaign, () => {
			const page = getPageBySlug('valle')!;
			const map = getHexMapOfPage(page.id)!;
			expect(page.kind).toBe('hexmap');
			expect(cellsOf(map.id).map((c) => [c.q, c.state])).toEqual([
				[0, 'explored'],
				[1, 'glimpsed'],
				[2, 'hidden'],
				[3, 'hidden']
			]);
			expect(visibleFeatures(map.id, alice).map((f) => [f.name, f.pageSlug])).toEqual([['Vadoscuro', 'vadoscuro']]);
			expect(visibleCells(map.id, master).find((c) => c.q === 2)?.note).toBe('Qui dorme la viverna');
		});
	});

	it('nel Markdown un esagono per riga, come lo vede chi esporta', () => {
		saveSettings({ defaultLocale: 'it' });
		valley();
		const md = (u: typeof master | typeof alice) => strFromU8(unzipSync(exportMarkdown(u))['Valle.md']);
		const mine = md(master);
		expect(mine).toContain('0101 — Foresta (Esplorato): Vadoscuro, Cunicoli dei contrabbandieri: Il borgomastro paga i briganti');
		expect(mine).toContain('0302 — Foresta (Nascosto): Tana della viverna: Qui dorme la viverna');
		const theirs = md(alice);
		expect(theirs).toContain('0101 — Foresta (Esplorato): Vadoscuro');
		expect(theirs).toContain('0201 — Foresta (Intravisto)');
		for (const secret of ['Nascosto', 'briganti', 'Cunicoli', 'Santuario', 'viverna']) expect(theirs).not.toContain(secret);
	});

	it('Claude legge gli esagoni con gli occhi di chi lo usa', () => {
		saveSettings({ defaultLocale: 'it' });
		valley();
		const read = (u: typeof master | typeof alice) =>
			(handleMcp({ id: 1, method: 'tools/call', params: { name: 'read_page', arguments: { slug: 'valle' } } }, u, 'Valle', 'it') as { result: { content: { text: string }[] } }).result.content[0].text;
		expect(read(master)).toContain('Qui dorme la viverna');
		expect(read(alice)).toContain('0101 — Foresta (Esplorato): Vadoscuro');
		for (const secret of ['Nascosto', 'briganti', 'Cunicoli', 'Santuario', 'viverna']) expect(read(alice)).not.toContain(secret);
	});
});

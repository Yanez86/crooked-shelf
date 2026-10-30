import { beforeEach, describe, expect, it } from 'vitest';
import { useMemoryDb, schema } from './db/index.ts';
import { resetSettingsCache, saveSettings } from './settings.ts';
import { createPage, deletePage, getPageBySlug, updatePage } from './pages.ts';
import { checkEvent, listEvents, saveEvent, recomputeSortKeys, setTimelineMode, getTimeline, type EventInput } from './timeline.ts';
import { createMap, getMap, mapsForPage, pinsOf, saveLayer, savePin, layersOf, validParentMap, listMaps, mapPath } from './maps.ts';
import { preset } from '../calendar.ts';
import { listTemplates, getTemplatePage, seedWiki, templateCopy } from './templates.ts';
import { builtinTemplate } from '../templates.ts';
import { extract } from '../content/extract.ts';
import type { TimelineMode } from '../pageKinds.ts';

const master = { id: 1, role: 'master' as const };
const alice = { id: 2, role: 'player' as const };
const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null, content: { type: 'doc' } };

beforeEach(() => {
	const db = useMemoryDb();
	resetSettingsCache();
	for (const [id, role] of [
		[1, 'master'],
		[2, 'player']
	] as const)
		db.insert(schema.users).values({ id, username: 'u' + id, displayName: 'U' + id, passwordHash: 'x', role, createdAt: 0 }).run();
	saveSettings({ calendar: preset('harptos', 'it') });
});

/** Una pagina «cronologia» del mondo o della campagna. */
function timeline(title: string, mode: TimelineMode, visibility: 'public' | 'players' | 'master' = 'public') {
	const page = createPage({ ...base, kind: 'timeline', visibility, title }, master, (p) => setTimelineMode(p.id, mode));
	return getTimeline(page.id)!;
}

const event = (tl: { id: number }, e: Partial<EventInput> & { title: string }) =>
	saveEvent({ timelineId: tl.id, description: '', date: null, approx: '', realDate: null, pageId: null, visibility: 'players', ...e }, 1);

describe('cronologia', () => {
	it('ordina gli eventi del mondo per data, anche negativi', () => {
		const tl = timeline('Storia', 'world');
		event(tl, { title: 'Caduta di Netheril', date: { year: -339 } });
		event(tl, { title: 'Anno corrente', date: { year: 1491, month: 7, day: 15 } });
		event(tl, { title: 'Inizio', date: { year: 1491, month: 1, day: 2 } });
		expect(listEvents(tl, alice).map((e) => e.title)).toEqual(['Caduta di Netheril', 'Inizio', 'Anno corrente']);
	});

	it('ogni pagina cronologia ha i suoi eventi', () => {
		const a = timeline('Storia del Nord', 'world');
		const b = timeline('Storia del Sud', 'world');
		event(a, { title: 'Nord', date: { year: 1 } });
		event(b, { title: 'Sud', date: { year: 2 } });
		expect(listEvents(a, alice).map((e) => e.title)).toEqual(['Nord']);
		expect(listEvents(b, alice).map((e) => e.title)).toEqual(['Sud']);
	});

	it('nasconde gli eventi del Master ai giocatori', () => {
		const tl = timeline('Storia', 'world');
		event(tl, { title: 'Patto segreto', date: { year: 1400 }, visibility: 'master' });
		expect(listEvents(tl, alice)).toEqual([]);
		expect(listEvents(tl, master)).toHaveLength(1);
		expect(listEvents(tl, null)).toEqual([]);
	});

	it('controlla le date nel calendario', () => {
		const e = { title: 'X', description: '', approx: '', realDate: null, pageId: null, visibility: 'players' as const };
		const cal = preset('harptos', 'it');
		expect(checkEvent({ ...e, date: { year: 1491, month: 10, day: 2 } }, 'world', cal)).toBe('timeline.errDate');
		expect(checkEvent({ ...e, date: null }, 'world', cal)).toBe('timeline.errNeedYear');
		expect(checkEvent({ ...e, date: null, realDate: '2026-10-29' }, 'campaign', cal)).toBeNull();
		expect(checkEvent({ ...e, date: null, realDate: '29/10/2026' }, 'campaign', cal)).toBe('timeline.errRealDate');
	});

	it('ricalcola l\'ordine dopo un cambio di calendario', () => {
		const tl = timeline('Storia', 'world');
		event(tl, { title: 'A', date: { year: 10, month: 3 } });
		event(tl, { title: 'B', date: { year: 10, month: 2 } });
		recomputeSortKeys(preset('simple', 'it'));
		expect(listEvents(tl, alice).map((e) => e.title)).toEqual(['B', 'A']);
	});
});

describe('resoconti di sessione', () => {
	it('creano, aggiornano e tolgono la voce nelle cronologie della campagna', () => {
		const campaign = timeline('Al tavolo', 'campaign');
		const world = timeline('Storia', 'world');
		const pg = createPage({ ...base, title: 'Sessione 1', session: { number: 1, realDate: '2026-10-01', world: { year: 1491, month: 3, day: 5 } } }, master);
		expect(listEvents(world, alice)).toEqual([]);
		let evs = listEvents(campaign, alice);
		expect(evs).toHaveLength(1);
		expect(evs[0]).toMatchObject({ title: 'Sessione 1', realDate: '2026-10-01', year: 1491, pageSlug: 'sessione-1', source: 'session' });

		// Anche i giocatori scrivono nella cronologia della campagna; la voce del resoconto resta accanto ai loro eventi.
		event(campaign, { title: 'Alice trova una mappa', realDate: '2026-10-05' });
		updatePage(getPageBySlug('sessione-1')!, { ...base, title: 'Sessione 1: la locanda', session: { number: 1, realDate: '2026-10-02', world: null } }, master, true);
		evs = listEvents(campaign, alice);
		expect(evs.map((e) => e.title)).toEqual(['Sessione 1: la locanda', 'Alice trova una mappa']);
		expect(evs[0]).toMatchObject({ realDate: '2026-10-02', year: null });

		updatePage(getPageBySlug('sessione-1')!, { ...base, visibility: 'master', title: 'S', session: { number: 1, realDate: '2026-10-02', world: null } }, master, true);
		expect(listEvents(campaign, alice).map((e) => e.title)).toEqual(['Alice trova una mappa']);
		expect(listEvents(campaign, master)).toHaveLength(2);

		deletePage(pg.id);
		expect(listEvents(campaign, master)).toHaveLength(1);
	});

	it('un template di resoconti non entra nella cronologia, le sue copie sì', () => {
		const campaign = timeline('Al tavolo', 'campaign');
		createPage({ ...base, kind: 'template', title: 'Resoconto', session: { number: null, realDate: '2026-10-01', world: null } }, master);
		expect(listEvents(campaign, master)).toEqual([]);
		const tpl = getTemplatePage('resoconto', master)!;
		const copy = templateCopy(tpl, master, '2026-10-30');
		createPage({ ...base, ...copy, title: 'Sessione 2' }, master);
		expect(listEvents(campaign, master).map((e) => e.title)).toEqual(['Sessione 2']);
	});
});

describe('mappe', () => {
	it('nasconde pin, livelli e mappe del Master', () => {
		const db = useMemoryDb();
		resetSettingsCache();
		db.insert(schema.users).values({ id: 1, username: 'm', displayName: 'M', passwordHash: 'x', role: 'master', createdAt: 0 }).run();
		db.insert(schema.files).values({ id: 'f1xxxxxxxxxx', sha256: 'x', name: 'm.png', mime: 'image/png', size: 1, width: 1000, height: 800, createdAt: 0 }).run();
		const file = { id: 'f1xxxxxxxxxx', width: 1000, height: 800 };
		const map = (title: string, visibility: 'players' | 'master', parentId: number | null) => {
			createPage({ ...base, kind: 'map', title, visibility }, master, (p) => createMap(p, { parentId, scale: null, unit: '' }, file, 1));
			return listMaps(master).find((m) => m.title === title)!;
		};
		const world = map('Faerûn', 'players', null);
		const lair = map('Tana del drago', 'master', world.id);
		saveLayer(world.id, 'Segreti', 'master');
		const secretLayer = layersOf(world.id, master)[0];
		const pin = (label: string, extra = {}) =>
			savePin(world.id, { x: 1, y: 1, label, description: '', icon: 'pin', color: 'red', pageSlug: null, targetMapId: null, layerId: null, visibility: 'players', ...extra });
		pin('Waterdeep', { pageSlug: 'waterdeep' });
		pin('Covo', { visibility: 'master', pageSlug: 'waterdeep' });
		pin('Rovine', { layerId: secretLayer.id });
		pin('Tana', { targetMapId: lair.id });

		expect(listMaps(alice).map((m) => m.title)).toEqual(['Faerûn']);
		expect(layersOf(world.id, alice)).toEqual([]);
		const pins = pinsOf(world.id, alice);
		expect(pins.map((p) => p.label)).toEqual(['Tana', 'Waterdeep']);
		expect(pins.find((p) => p.label === 'Tana')!.target).toBeNull();
		expect(pinsOf(world.id, master).find((p) => p.label === 'Tana')!.target).toEqual({ slug: 'tana-del-drago', title: 'Tana del drago' });
		expect(mapsForPage('waterdeep', alice)).toEqual([{ slug: 'faerun', title: 'Faerûn' }]);
		expect(validParentMap(world.id, lair.id)).toBe(false);
		expect(validParentMap(lair.id, world.id)).toBe(true);
		expect(getPageBySlug('tana-del-drago')!.kind).toBe('map');

		// La mappa nel cestino sparisce con la sua pagina, anche dai pin che la aprono.
		const lairPage = getPageBySlug('tana-del-drago')!;
		expect(mapPath(getMap(lair.id)!, master)).toEqual([{ slug: 'faerun', title: 'Faerûn' }]);
		deletePage(lairPage.id);
		expect(listMaps(master).map((m) => m.title)).toEqual(['Faerûn']);
		expect(pinsOf(world.id, master).find((p) => p.label === 'Tana')!.target).toBeNull();
	});
});

describe('template', () => {
	it('preinstallati nella lingua della wiki', () => {
		const npc = builtinTemplate('npc', 'it');
		expect(npc.name).toBe('PNG');
		expect(npc.fields).toContain('Allineamento');
		expect(extract(npc.content).hasSecret).toBe(true);
		expect(builtinTemplate('session', 'en').session).toBe(true);
	});

	it('alla creazione della wiki diventano pagine, con le due cronologie', () => {
		seedWiki('it', master);
		const list = listTemplates(alice);
		expect(list.map((t) => t.title)).toContain('PNG');
		expect(list.find((t) => t.title === 'Resoconto di sessione')!.session).toBe(true);
		const npc = getPageBySlug('png')!;
		expect(npc).toMatchObject({ kind: 'template', icon: 'person', template: 'b:npc' });
		expect(getTimeline(getPageBySlug('cronologia-del-mondo')!.id)!.mode).toBe('world');
		expect(getTimeline(getPageBySlug('cronologia-della-campagna')!.id)!.mode).toBe('campaign');
	});

	it('la fotocopia porta blocchi, colonna e icona; i segreti solo al Master', () => {
		seedWiki('it', master);
		const npc = getTemplatePage('png', alice)!;
		const forAlice = templateCopy(npc, alice, '2026-10-30');
		expect(forAlice).toMatchObject({ icon: 'person', template: 'png', session: null });
		expect(forAlice.fields.map((f) => f.label)).toContain('Allineamento');
		expect(extract(forAlice.content).hasSecret).toBe(false);
		expect(extract(templateCopy(npc, master, '2026-10-30').content).hasSecret).toBe(true);
		expect(templateCopy(getTemplatePage('resoconto-di-sessione', alice)!, alice, '2026-10-30').session).toEqual({ number: null, realDate: '2026-10-30', world: null });
		// Una pagina normale non è un template.
		createPage({ ...base, title: 'Locanda' }, master);
		expect(getTemplatePage('locanda', alice)).toBeUndefined();
	});

	it('una pagina diventa template e torna pagina; mappe e cronologie restano quello che sono', () => {
		const pg = createPage({ ...base, title: 'Taverna' }, master);
		updatePage(pg, { ...base, title: 'Taverna', kind: 'template' }, master, true);
		expect(getPageBySlug('taverna')!.kind).toBe('template');
		updatePage(getPageBySlug('taverna')!, { ...base, title: 'Taverna', kind: 'page' }, master, true);
		expect(getPageBySlug('taverna')!.kind).toBe('page');
		const tl = timeline('Storia', 'world');
		updatePage(getPageBySlug('storia')!, { ...base, title: 'Storia', kind: 'template' }, master, true);
		expect(getPageBySlug('storia')!.kind).toBe('timeline');
		expect(tl.mode).toBe('world');
	});
});

import { getRevision, listRevisions, listTrash, purgePage, restorePage, revisionText } from './pages.ts';
import { searchPages } from './search.ts';

describe('versioni e cestino', () => {
	it('ogni salvataggio crea una versione, visibile solo a chi poteva vederla', () => {
		const pg = createPage({ ...base, visibility: 'master', title: 'Piano', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'segretissimo' }] }] } }, master);
		updatePage(getPageBySlug('piano')!, { ...base, title: 'Piano pubblico' }, master, true);
		const page = getPageBySlug('piano')!;
		expect(listRevisions(page, master)).toHaveLength(2);
		// La prima versione era "solo Master": il giocatore non la vede.
		const forAlice = listRevisions(page, alice);
		expect(forAlice.map((r) => r.title)).toEqual(['Piano pubblico']);
		const first = listRevisions(page, master).at(-1)!;
		expect(getRevision(page, first.id, alice)).toBeUndefined();
		expect(revisionText(getRevision(page, first.id, master)!, master)).toContain('segretissimo');
		expect(pg.id).toBe(page.id);
	});

	it('il cestino recupera e cancella per sempre', () => {
		const pg = createPage({ ...base, title: 'Torre', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'antica' }] }] } }, alice);
		deletePage(pg.id);
		expect(searchPages('antica', alice)).toEqual([]);
		expect(listTrash(alice).map((t) => t.title)).toEqual(['Torre']);
		expect(listTrash(master).map((t) => t.title)).toEqual(['Torre']);
		restorePage(pg.id);
		expect(getPageBySlug('torre')).toBeDefined();
		expect(searchPages('antica', alice).map((h) => h.title)).toEqual(['Torre']);
		deletePage(pg.id);
		purgePage(pg.id);
		expect(listTrash(master)).toEqual([]);
	});
});

import { boardContent, canSeeBoard, createBoard, listBoards, moveCard, addCard, placeCard } from './boards.ts';

describe('bacheche', () => {
	it('personali, condivise e spostamenti', () => {
		const mine = createBoard('Appunti di Alice', true, 'players', ['Indizi'], alice);
		const shared = createBoard('Missioni', false, 'players', ['Da fare', 'Fatto'], master);
		const gm = createBoard('Trama', false, 'master', ['Idee'], master);
		expect(listBoards(alice).map((b) => b.title)).toEqual(['Appunti di Alice', 'Missioni']);
		expect(listBoards(master).map((b) => b.title)).toEqual(['Missioni', 'Trama']);
		expect(canSeeBoard({ ownerId: alice.id, visibility: 'players' }, master)).toBe(false);
		expect(gm).toBeGreaterThan(mine);

		const [todo, done] = boardContent(shared);
		addCard(todo.id, { title: 'A', body: '', color: 'yellow' }, 2);
		addCard(todo.id, { title: 'B', body: '', color: 'yellow' }, 2);
		const titles = () => boardContent(shared).map((c) => c.cards.map((k) => k.title));
		const idOf = (t: string) => boardContent(shared).flatMap((c) => c.cards).find((k) => k.title === t)!.id;
		moveCard(shared, idOf('B'), 'up');
		expect(titles()).toEqual([['B', 'A'], []]);
		moveCard(shared, idOf('A'), 'right');
		expect(titles()).toEqual([['B'], ['A']]);
		placeCard(idOf('B'), done.id, 0);
		expect(titles()).toEqual([[], ['B', 'A']]);
	});
});

import { beforeEach, describe, expect, it } from 'vitest';
import { useMemoryDb, schema } from './db/index.ts';
import { resetSettingsCache, saveSettings } from './settings.ts';
import { createPage, deletePage, getPageBySlug, updatePage } from './pages.ts';
import { checkEvent, listEvents, saveEvent, recomputeSortKeys } from './timeline.ts';
import { createMap, mapsForPage, pinsOf, saveLayer, savePin, layersOf, validParentMap, listMaps } from './maps.ts';
import { preset } from '../calendar.ts';
import { listTemplates, getTemplate } from './templates.ts';
import { extract } from '../content/extract.ts';

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

describe('cronologia', () => {
	it('ordina gli eventi del mondo per data, anche negativi', () => {
		const ev = (title: string, year: number, month?: number, day?: number) =>
			saveEvent({ timeline: 'world', title, description: '', date: { year, month, day }, approx: '', realDate: null, pageId: null, visibility: 'players' }, 1);
		ev('Caduta di Netheril', -339);
		ev('Anno corrente', 1491, 7, 15);
		ev('Inizio', 1491, 1, 2);
		expect(listEvents('world', alice).map((e) => e.title)).toEqual(['Caduta di Netheril', 'Inizio', 'Anno corrente']);
	});

	it('nasconde gli eventi del Master ai giocatori', () => {
		saveEvent({ timeline: 'world', title: 'Patto segreto', description: '', date: { year: 1400 }, approx: '', realDate: null, pageId: null, visibility: 'master' }, 1);
		expect(listEvents('world', alice)).toEqual([]);
		expect(listEvents('world', master)).toHaveLength(1);
		expect(listEvents('world', null)).toEqual([]);
	});

	it('controlla le date nel calendario', () => {
		const e = { timeline: 'world' as const, title: 'X', description: '', approx: '', realDate: null, pageId: null, visibility: 'players' as const };
		const cal = preset('harptos', 'it');
		expect(checkEvent({ ...e, date: { year: 1491, month: 10, day: 2 } }, cal)).toBe('timeline.errDate');
		expect(checkEvent({ ...e, date: null }, cal)).toBe('timeline.errNeedYear');
		expect(checkEvent({ ...e, timeline: 'campaign', date: null, realDate: '2026-10-29' }, cal)).toBeNull();
		expect(checkEvent({ ...e, timeline: 'campaign', date: null, realDate: '29/10/2026' }, cal)).toBe('timeline.errRealDate');
	});

	it('ricalcola l\'ordine dopo un cambio di calendario', () => {
		saveEvent({ timeline: 'world', title: 'A', description: '', date: { year: 10, month: 3 }, approx: '', realDate: null, pageId: null, visibility: 'players' }, 1);
		saveEvent({ timeline: 'world', title: 'B', description: '', date: { year: 10, month: 2 }, approx: '', realDate: null, pageId: null, visibility: 'players' }, 1);
		recomputeSortKeys(preset('simple', 'it'));
		expect(listEvents('world', alice).map((e) => e.title)).toEqual(['B', 'A']);
	});
});

describe('resoconti di sessione', () => {
	it('creano, aggiornano e tolgono la voce nella cronologia della campagna', () => {
		const pg = createPage({ ...base, title: 'Sessione 1', session: { number: 1, realDate: '2026-10-01', world: { year: 1491, month: 3, day: 5 } } }, master);
		let evs = listEvents('campaign', alice);
		expect(evs).toHaveLength(1);
		expect(evs[0]).toMatchObject({ title: 'Sessione 1', realDate: '2026-10-01', year: 1491, pageSlug: 'sessione-1', source: 'session' });

		updatePage(getPageBySlug('sessione-1')!, { ...base, title: 'Sessione 1: la locanda', session: { number: 1, realDate: '2026-10-02', world: null } }, master, true);
		evs = listEvents('campaign', alice);
		expect(evs[0]).toMatchObject({ title: 'Sessione 1: la locanda', realDate: '2026-10-02', year: null });

		updatePage(getPageBySlug('sessione-1')!, { ...base, visibility: 'master', title: 'S', session: { number: 1, realDate: '2026-10-02', world: null } }, master, true);
		expect(listEvents('campaign', alice)).toEqual([]);
		expect(listEvents('campaign', master)).toHaveLength(1);

		deletePage(pg.id);
		expect(listEvents('campaign', master)).toEqual([]);
	});
});

describe('mappe', () => {
	it('nasconde pin, livelli e mappe del Master', () => {
		const db = useMemoryDb();
		resetSettingsCache();
		db.insert(schema.users).values({ id: 1, username: 'm', displayName: 'M', passwordHash: 'x', role: 'master', createdAt: 0 }).run();
		db.insert(schema.files).values({ id: 'f1xxxxxxxxxx', sha256: 'x', name: 'm.png', mime: 'image/png', size: 1, width: 1000, height: 800, createdAt: 0 }).run();
		const file = { id: 'f1xxxxxxxxxx', width: 1000, height: 800 };
		const world = createMap({ title: 'Faerûn', description: '', visibility: 'players', parentId: null, scale: null, unit: '' }, file, 1);
		const lair = createMap({ title: 'Tana del drago', description: '', visibility: 'master', parentId: world.id, scale: null, unit: '' }, file, 1);
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
	});
});

describe('template', () => {
	it('preinstallati nella lingua della wiki', () => {
		const list = listTemplates('it');
		expect(list.map((t) => t.key)).toContain('b:npc');
		const npc = getTemplate('b:npc', 'it')!;
		expect(npc.name).toBe('PNG');
		expect(npc.fields).toContain('Allineamento');
		expect(extract(npc.content).hasSecret).toBe(true);
		expect(getTemplate('b:session', 'en')!.session).toBe(true);
		expect(getTemplate('b:nope', 'it')).toBeUndefined();
	});
});

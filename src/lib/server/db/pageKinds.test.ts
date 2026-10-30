import { describe, expect, it } from 'vitest';
import { getSqlite, migrate, useMemoryDb } from './index.ts';
import { MIGRATIONS } from './migrations.ts';
import { resetSettingsCache } from '../settings.ts';
import { getPageBySlug } from '../pages.ts';
import { getMapOfPage, listMaps, pinsOf } from '../maps.ts';
import { getTimeline, listEvents } from '../timeline.ts';
import { listTemplates } from '../templates.ts';
import { searchPages } from '../search.ts';

const admin = { id: 1, role: 'admin' as const };
const alice = { id: 2, role: 'player' as const };

describe('migrazione dopo la 0.10: template, mappe e cronologie diventano pagine', () => {
	it('converte i dati di una wiki che c’è già', () => {
		useMemoryDb(MIGRATIONS.length - 1);
		resetSettingsCache();
		const db = getSqlite();
		const run = (q: string, ...p: unknown[]) => db.prepare(q).run(...p);
		run(`INSERT INTO settings (key, value) VALUES ('defaultLocale', '"it"')`);
		run(`INSERT INTO users (id, username, display_name, password_hash, role, created_at) VALUES (1, 'a', 'A', 'x', 'admin', 0), (2, 'b', 'B', 'x', 'player', 0)`);
		const page = (slug: string, title: string, template: string | null = null, session: string | null = null) =>
			run(`INSERT INTO pages (slug, title, content, visibility, created_at, updated_at, fields, template, session) VALUES (?, ?, '{"type":"doc"}', 'players', 0, 0, '[]', ?, ?)`, slug, title, template, session);
		page('costa', 'Costa (il luogo)');
		page('bartolo', 'Bartolo', 'b:npc');
		page('taverna-del-porto', 'Taverna del porto', 'c:1');
		page('sessione-1', 'Sessione 1', 'b:session', '{"number":1,"realDate":"2026-10-01","world":null}');
		run(`INSERT INTO files (id, sha256, name, mime, size, width, height, created_at) VALUES ('mapxxxxxxxx', 'x', 'm.png', 'image/png', 1, 100, 80, 0)`);
		run(`INSERT INTO maps (id, slug, title, description, file_id, width, height, visibility, created_at, updated_at) VALUES (1, 'costa', 'Costa', 'La costa.\n\nVerso nord.', 'mapxxxxxxxx', 100, 80, 'players', 0, 0)`);
		run(`INSERT INTO maps (id, slug, title, description, file_id, width, height, visibility, parent_id, created_at, updated_at) VALUES (2, 'tana', 'Tana', '', 'mapxxxxxxxx', 100, 80, 'master', 1, 0, 0)`);
		run(`INSERT INTO map_pins (map_id, x, y, label, page_slug, target_map_id, visibility) VALUES (1, 1, 1, 'Tana', 'bartolo', 2, 'players')`);
		const ev = (timeline: string, title: string, source = 'manual', pageId: number | null = null) =>
			run(`INSERT INTO timeline_events (timeline, title, year, sort_key, real_date, page_id, source, visibility, created_at, updated_at) VALUES (?, ?, 1491, 1, '2026-10-01', ?, ?, 'players', 0, 0)`, timeline, title, pageId, source);
		ev('world', 'Fondazione');
		ev('campaign', 'Alice trova una mappa');
		ev('campaign', 'Sessione 1', 'session', 4);
		run(`INSERT INTO templates (id, name, fields, content, session, created_at, updated_at) VALUES (1, 'Taverna', '["Oste"]', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Menù"}]}]}', 0, 0, 0)`);

		migrate(db);

		// La mappa diventa una pagina (l'indirizzo era già preso), con la descrizione come testo.
		const costa = getPageBySlug('costa-2')!;
		expect(costa).toMatchObject({ kind: 'map', title: 'Costa', visibility: 'players' });
		expect(JSON.stringify(costa.content)).toContain('Verso nord.');
		expect(getMapOfPage(costa.id)!.slug).toBe('costa');
		expect(getPageBySlug('tana')!).toMatchObject({ kind: 'map', visibility: 'master' });
		expect(listMaps(alice).map((m) => m.title)).toEqual(['Costa']);
		const pin = pinsOf(getMapOfPage(costa.id)!.id, admin)[0];
		expect(pin.target).toEqual({ slug: 'tana', title: 'Tana' });
		expect(searchPages('nord', alice).map((h) => h.title)).toEqual(['Costa']);

		// Le due cronologie diventano pagine con i loro eventi; il resoconto è in quella della campagna.
		const world = getTimeline(getPageBySlug('cronologia-del-mondo')!.id)!;
		const campaign = getTimeline(getPageBySlug('cronologia-della-campagna')!.id)!;
		expect(listEvents(world, alice).map((e) => e.title)).toEqual(['Fondazione']);
		expect(listEvents(campaign, alice).map((e) => e.title).sort()).toEqual(['Alice trova una mappa', 'Sessione 1']);

		// Template preinstallati e del Master: pagine nella cartella Template; le pagine sanno da quale vengono.
		const titles = listTemplates(alice).map((t) => t.title);
		expect(titles).toEqual(expect.arrayContaining(['PNG', 'Resoconto di sessione', 'Taverna']));
		expect(getPageBySlug('taverna')!).toMatchObject({ kind: 'template', template: 'c:1', fields: [{ label: 'Oste', value: '' }] });
		expect(getPageBySlug('bartolo')!.template).toBe('png');
		expect(getPageBySlug('taverna-del-porto')!.template).toBe('taverna');
		expect(getPageBySlug('resoconto-di-sessione')!.session).toEqual({ number: null, realDate: null, world: null });
	});

	it('in una wiki nuova non crea niente: lo fa la prima configurazione, nella lingua scelta', () => {
		useMemoryDb();
		resetSettingsCache();
		expect(getSqlite().prepare('SELECT count(*) AS n FROM pages').get()).toEqual({ n: 0 });
	});
});

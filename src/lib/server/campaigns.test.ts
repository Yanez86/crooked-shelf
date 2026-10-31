import { beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, getSqlite, migrate, useMemoryDb, schema } from './db/index.ts';
import { MIGRATIONS } from './db/migrations.ts';
import { campaignsFor, currentCampaign, deleteCampaign, FIRST_CAMPAIGN, getCampaign, inCampaign, membersOf, ofCampaign, roleIn, saveCampaign, setMaster, addMember, type CampaignRow } from './campaigns.ts';
import { createInvite, activeInvites, joinInvite, redeemInvite } from './auth.ts';
import { createPage, getPageById, getPageBySlug, listPages, listTrash, deletePage, resolverFor, backlinks, updatePage } from './pages.ts';
import { filePath, getFile, saveImage } from './files.ts';
import { searchPages } from './search.ts';
import { createCategory, createDivider, deleteDivider, ensureTags, getCategory, listTags, pageTree } from './taxonomy.ts';
import { createResource, deleteResource, listResources } from './resources.ts';
import { getCalendar, resetSettingsCache } from './settings.ts';
import { homePage, newCampaign } from './templates.ts';
import { createMap, getMap, mapsForPage, savePin } from './maps.ts';
import { getTimeline, listEvents, recomputeSortKeys, saveEvent, setTimelineMode } from './timeline.ts';
import { preset } from '../calendar.ts';
import type { DocNode } from '../content/types.ts';

const admin = { id: 1, role: 'admin' as const };
const dm = { id: 2, role: 'master' as const };
const otherDm = { id: 3, role: 'master' as const };
const alice = { id: 4, role: 'player' as const };

const schemaWithCampaign = ['pages', 'categories', 'tags', 'tree_dividers', 'resources'];
const text = (t: string): DocNode => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null, content: text('testo') };

let a: CampaignRow;
let b: CampaignRow;

beforeEach(() => {
	const db = useMemoryDb();
	resetSettingsCache();
	for (const u of [admin, dm, otherDm, alice]) db.insert(schema.users).values({ ...u, username: 'u' + u.id, displayName: 'U' + u.id, passwordHash: 'x', createdAt: 0 }).run();
	a = saveCampaign(FIRST_CAMPAIGN, { name: 'Ombre', masterId: dm.id });
	b = newCampaign('Luci', otherDm, 'it');
});

describe('isolamento tra campagne', () => {
	it('gli stessi indirizzi, nomi di cartella e tag convivono', () => {
		const one = inCampaign(a, () => createPage({ ...base, title: 'Waterdeep', tags: ['Città'] }, dm));
		const two = inCampaign(b, () => createPage({ ...base, title: 'Waterdeep', tags: ['città'] }, otherDm));
		expect(one.slug).toBe('waterdeep');
		expect(two.slug).toBe('waterdeep');
		expect(inCampaign(a, () => getPageBySlug('waterdeep'))!.id).toBe(one.id);
		expect(inCampaign(b, () => getPageBySlug('waterdeep'))!.id).toBe(two.id);
		inCampaign(a, () => createCategory('Luoghi', null));
		expect(inCampaign(b, () => createCategory('Luoghi', null)).slug).toBe('luoghi');
		expect(inCampaign(a, () => listTags(dm)).map((t) => t.name)).toEqual(['Città']);
		expect(inCampaign(b, () => listTags(otherDm)).map((t) => t.name)).toEqual(['città']);
	});

	it('niente si raggiunge dall\'altra campagna, nemmeno per id', () => {
		const page = inCampaign(a, () => createPage({ ...base, title: 'Piano segreto', content: text('il drago dorme') }, dm));
		const cat = inCampaign(a, () => createCategory('Segreti', null));
		const div = inCampaign(a, () => createDivider());
		inCampaign(b, () => {
			expect(getPageById(page.id)).toBeUndefined();
			expect(getPageBySlug(page.slug)).toBeUndefined();
			expect(getCategory(cat.id)).toBeUndefined();
			expect(listPages(admin).rows.map((r) => r.title)).not.toContain('Piano segreto');
			expect(searchPages('drago', admin)).toEqual([]);
			expect(resolverFor([page.slug], admin)(page.slug)).toBeUndefined();
			expect(JSON.stringify(pageTree(admin))).not.toContain('Piano segreto');
			deleteDivider(div.id);
		});
		expect(getDb().select().from(schema.treeDividers).where(eq(schema.treeDividers.id, div.id)).get()).toBeDefined();
	});

	it('i collegamenti e i pin restano nella loro campagna', () => {
		const target = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { target: 'porto', title: 'Porto' } }] }] };
		inCampaign(a, () => createPage({ ...base, title: 'Fonte', content: target }, dm));
		inCampaign(b, () => createPage({ ...base, title: 'Porto' }, otherDm));
		expect(inCampaign(b, () => backlinks('porto', admin))).toEqual([]);
		const file = { id: 'f'.repeat(16), width: 10, height: 10 };
		getDb().insert(schema.files).values({ ...file, sha256: 'x', name: 'm', mime: 'image/png', size: 1, createdAt: 0 }).run();
		const map = inCampaign(a, () => {
			const page = createPage({ ...base, kind: 'map', title: 'Mappa' }, dm);
			const m = createMap(page, { parentId: null, scale: null, unit: '' }, file, dm.id);
			savePin(m.id, { x: 1, y: 1, label: 'P', description: '', icon: 'pin', color: 'red', pageSlug: 'porto', targetMapId: null, layerId: null, visibility: 'players' });
			return m;
		});
		expect(inCampaign(a, () => getMap(map.id))).toBeDefined();
		expect(inCampaign(b, () => getMap(map.id))).toBeUndefined();
		expect(inCampaign(b, () => mapsForPage('porto', admin))).toEqual([]);
	});

	it('resoconti e calendario non attraversano le campagne', () => {
		const session = { number: 1, realDate: '2026-01-01', world: { year: 5 } };
		inCampaign(a, () => createPage({ ...base, title: 'Sessione di Ombre', session }, dm));
		const tl = inCampaign(b, () => {
			const p = createPage({ ...base, kind: 'timeline', title: 'Diario' }, otherDm, (pg) => setTimelineMode(pg.id, 'campaign'));
			return getTimeline(p.id)!;
		});
		expect(inCampaign(b, () => listEvents(tl, otherDm))).toEqual([]);

		const before = getDb().select().from(schema.timelineEvents).get()!.sortKey;
		const cal = preset('harptos', 'it');
		inCampaign(b, () => {
			saveCampaign(b.id, { calendar: cal });
			recomputeSortKeys(cal);
			expect(getCalendar().name).toBe('Harptos');
		});
		expect(inCampaign(a, () => getCalendar()).name).not.toBe('Harptos');
		expect(getDb().select().from(schema.timelineEvents).get()!.sortKey).toBe(before);
	});

	it('risorse, cestino e home sono separati', () => {
		getDb().insert(schema.files).values({ id: 'r'.repeat(16), sha256: 'x', name: 'm', mime: 'image/png', size: 1, width: 1, height: 1, createdAt: 0 }).run();
		const res = inCampaign(a, () => createResource({ title: 'Dispensa', description: '', visibility: 'players' }, 'r'.repeat(16), dm.id));
		expect(inCampaign(b, () => listResources(admin))).toEqual([]);
		inCampaign(b, () => deleteResource(res));
		expect(inCampaign(a, () => listResources(admin))).toHaveLength(1);

		const page = inCampaign(a, () => createPage({ ...base, title: 'Via' }, dm));
		inCampaign(a, () => deletePage(page.id));
		expect(inCampaign(b, () => listTrash(admin))).toEqual([]);

		expect(inCampaign(b, () => homePage(otherDm))!.title).toBe('Luci');
		expect(inCampaign(a, () => homePage(alice))).toBeNull();
	});

	it('una scrittura senza campagna non finisce da nessuna parte', () => {
		const none = { ...a, id: 0 };
		expect(() => inCampaign(none, () => createPage({ ...base, title: 'Persa' }, dm))).toThrow();
		expect(() => inCampaign(none, () => ensureTags(['x']))).toThrow();
	});
});

describe('campagne e persone', () => {
	it('il ruolo dipende dalla campagna', () => {
		expect(roleIn(a, dm)).toBe('master');
		expect(roleIn(b, dm)).toBe('player');
		expect(roleIn(a, admin)).toBe('admin');
		expect(roleIn(a, alice)).toBe('player');
	});

	it('si entra solo nelle proprie campagne', () => {
		expect(campaignsFor(alice, false)).toEqual([]);
		addMember(b.id, alice.id);
		expect(campaignsFor(alice, false).map((c) => c.id)).toEqual([b.id]);
		expect(campaignsFor(dm, false).map((c) => c.id)).toEqual([a.id]);
		expect(campaignsFor(admin, false)).toHaveLength(2);
		expect(campaignsFor(null, false)).toEqual([]);
		expect(campaignsFor(null, true)).toHaveLength(2);
	});

	it('una campagna nuova ha le sue pagine di partenza, del suo Master', () => {
		const rows = inCampaign(b, () => listPages(otherDm, { limit: 100 }).rows);
		expect(rows.length).toBeGreaterThan(3);
		expect(getDb().select().from(schema.pages).where(eq(schema.pages.campaignId, a.id)).all()).toEqual([]);
		expect(getCampaign(b.id)!.homePageId).not.toBeNull();
		expect(inCampaign(b, () => getDb().select().from(schema.categories).where(ofCampaign(schema.categories)).all())).toHaveLength(1);
	});

	it('un altro Master: quello di prima resta come giocatore', () => {
		setMaster(a.id, otherDm.id);
		expect(getCampaign(a.id)!.masterId).toBe(otherDm.id);
		expect(membersOf(a.id).map((m) => m.id)).toEqual([dm.id]);
		expect(campaignsFor(dm, false).map((c) => c.id)).toEqual([a.id]);
	});

	it('un invito porta nella sua campagna, una volta sola', async () => {
		const token = createInvite('player', dm.id, 7, a.id);
		expect(activeInvites(b.id)).toEqual([]);
		expect(activeInvites(a.id)[0].campaign).toBe('Ombre');
		const id = (await redeemInvite(token, { username: 'nuovo', displayName: 'Nuovo', password: 'password-lunga' }))!;
		expect(campaignsFor({ id, role: 'player' }, false).map((c) => c.id)).toEqual([a.id]);
		expect(joinInvite(token, alice.id)).toBeNull();

		const again = createInvite('player', dm.id, 7, b.id);
		expect(joinInvite(again, alice.id)).toBe(b.id);
		expect(campaignsFor(alice, false).map((c) => c.id)).toEqual([b.id]);
	});

	it('fuori da una richiesta vale la prima campagna', () => {
		expect(currentCampaign().id).toBe(FIRST_CAMPAIGN);
		expect(inCampaign(b, () => currentCampaign().id)).toBe(b.id);
	});
});

describe('eliminare una campagna', () => {
	const image = () => {
		const r = saveImage(readFileSync('tests/fixtures/city.png'), 'city.png', dm.id);
		if (!r.ok) throw new Error('img');
		return r.file;
	};
	const withImage = (id: string): DocNode => ({ type: 'doc', content: [{ type: 'image', attrs: { src: `/files/${id}`, alt: '' } }] });
	const count = (t: string) => (getSqlite().prepare(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n;

	beforeEach(() => {
		process.env.CS_DATA_DIR = mkdtempSync(join(tmpdir(), 'cs-campaign-'));
	});

	it('porta via tutto ciò che è suo, file compresi, e niente delle altre', () => {
		const files = { cover: image(), text: image(), old: image(), map: image(), resource: image() };
		inCampaign(a, () => {
			const cat = createCategory('Luoghi', null);
			const page = createPage({ ...base, title: 'Antro del drago', categoryId: cat.id, tags: ['Grotte'], cover: { image: files.cover.id, color: null, y: 50 }, content: withImage(files.old.id) }, dm);
			// Il file resta solo in una versione vecchia della pagina: la cancellazione lo trova lo stesso.
			updatePage(page, { ...base, title: 'Antro del drago', categoryId: cat.id, tags: ['Grotte'], content: withImage(files.text.id) }, dm, true);
			const mapPage = createPage({ ...base, kind: 'map', title: 'Mappa' }, dm);
			savePin(createMap(mapPage, { parentId: null, scale: null, unit: '' }, files.map, dm.id).id, { x: 1, y: 1, label: 'P', description: '', icon: 'pin', color: 'red', pageSlug: null, targetMapId: null, layerId: null, visibility: 'players' });
			createResource({ title: 'Dispensa', description: '', visibility: 'players' }, files.resource.id, dm.id);
			createPage({ ...base, title: 'Sessione', session: { number: 1, realDate: '2026-01-01', world: null } }, dm);
			createDivider();
		});
		addMember(a.id, alice.id);
		createInvite('player', dm.id, 7, a.id);
		const paths = Object.values(files).map((f) => filePath(f)!);
		const kept = inCampaign(b, () => createPage({ ...base, title: 'Antro', tags: ['Grotte'], content: text('il drago di Luci') }, otherDm));
		const pagesOfB = inCampaign(b, () => listPages(otherDm, { limit: 100 }).total);

		deleteCampaign(a.id);

		expect(getCampaign(a.id)).toBeUndefined();
		for (const t of schemaWithCampaign) expect([t, (getSqlite().prepare(`SELECT count(*) AS n FROM ${t} WHERE campaign_id = ?`).get(a.id) as { n: number }).n]).toEqual([t, 0]);
		for (const t of ['maps', 'map_pins', 'timeline_events', 'campaign_members', 'invites']) expect([t, count(t)]).toEqual([t, 0]);
		expect(campaignsFor(alice, false)).toEqual([]);
		for (const f of Object.values(files)) expect(getFile(f.id)).toBeUndefined();
		expect(paths.filter((p) => existsSync(p))).toEqual([]);
		expect(getSqlite().pragma('foreign_key_check')).toEqual([]);

		inCampaign(b, () => {
			expect(listPages(otherDm, { limit: 100 }).total).toBe(pagesOfB);
			expect(getPageById(kept.id)).toBeDefined();
			expect(searchPages('drago', otherDm).map((h) => h.title)).toEqual(['Antro']);
			expect(listTags(otherDm).map((t) => t.name)).toEqual(['Grotte']);
		});
		expect(count('pages_fts')).toBe(pagesOfB);
	});

	it('lascia i file che usa anche un\'altra campagna', () => {
		const shared = image();
		inCampaign(a, () => createPage({ ...base, title: 'Qui', content: withImage(shared.id) }, dm));
		inCampaign(b, () => createPage({ ...base, title: 'Là', content: withImage(shared.id) }, otherDm));
		deleteCampaign(a.id);
		expect(getFile(shared.id)).toBeDefined();
		expect(existsSync(filePath(shared)!)).toBe(true);
	});

	it('si può eliminare anche la prima, e anche tutte', () => {
		deleteCampaign(a.id);
		deleteCampaign(b.id);
		expect(campaignsFor(admin, false)).toEqual([]);
		expect(currentCampaign().id).toBe(0);
		expect(newCampaign('Da capo', dm, 'it').id).toBeGreaterThan(b.id);
	});
});

describe('migrazione', () => {
	const last = MIGRATIONS.length - 1;

	function oldWiki() {
		useMemoryDb(last);
		const s = getSqlite();
		s.exec(`
		INSERT INTO users (id, username, display_name, password_hash, role, created_at) VALUES
			(1, 'capo', 'Capo', 'x', 'admin', 0), (2, 'dm', 'DM', 'x', 'master', 0), (3, 'dm2', 'DM2', 'x', 'master', 0), (4, 'gio', 'Gio', 'x', 'player', 0);
		INSERT INTO settings (key, value) VALUES ('siteName', '"Faerûn"'), ('homePage', '1'), ('calendar', '{"name":"Harptos"}'), ('allowVisitors', 'true');
		INSERT INTO categories (id, name, slug) VALUES (1, 'Luoghi', 'luoghi');
		INSERT INTO tags (id, name, slug) VALUES (1, 'Città', 'citta');
		INSERT INTO pages (id, slug, title, content, visibility, category_id, author_id, created_at, updated_at, parent_page_id) VALUES
			(1, 'home', 'Home', '{"type":"doc"}', 'public', 1, 2, 0, 0, NULL), (2, 'figlia', 'Figlia', '{"type":"doc"}', 'players', 1, 2, 0, 0, 1);
		INSERT INTO page_tags VALUES (2, 1);
		INSERT INTO page_links (from_page_id, target_slug) VALUES (2, 'home');
		INSERT INTO page_revisions (page_id, title, content, visibility, created_at) VALUES (2, 'Figlia', '{"type":"doc"}', 'players', 0);
		INSERT INTO timelines VALUES (2, 'world');
		INSERT INTO timeline_events (timeline_id, title, source, visibility, created_at, updated_at) VALUES (2, 'E', 'manual', 'public', 0, 0);
		INSERT INTO tree_dividers (category_id) VALUES (1);
		INSERT INTO pages_fts (rowid, title, body, secret_body) VALUES (2, 'Figlia', 'testo', '');
		INSERT INTO invites (token_hash, role, created_at, expires_at) VALUES ('a', 'player', 0, 9999999999999), ('b', 'admin', 0, 9999999999999);
		`);
		return s;
	}

	it('la wiki che c\'era diventa la prima campagna, senza perdere niente', () => {
		const s = oldWiki();
		migrate(s);
		const count = (t: string) => (s.prepare(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n;
		for (const t of ['pages', 'page_tags', 'page_links', 'page_revisions', 'timelines', 'timeline_events', 'tree_dividers']) expect([t, count(t)]).toEqual([t, t === 'pages' ? 2 : 1]);
		const c = getCampaign(FIRST_CAMPAIGN)!;
		expect(c).toMatchObject({ name: 'Faerûn', masterId: 2, homePageId: 1, calendar: { name: 'Harptos' } });
		expect(membersOf(1).map((m) => m.id).sort()).toEqual([1, 3, 4]);
		expect(getDb().select().from(schema.settings).all().map((r) => r.key).sort()).toEqual(['allowVisitors', 'siteName']);
		expect(getDb().select().from(schema.invites).all().map((i) => i.campaignId)).toEqual([1, null]);
		expect(s.pragma('foreign_keys', { simple: true })).toBe(1);
		expect(s.pragma('foreign_key_check')).toEqual([]);
		// Le relazioni funzionano ancora: eliminare una pagina porta via ciò che dipende da lei.
		s.prepare('DELETE FROM pages WHERE id = 1').run();
		expect(s.prepare('SELECT parent_page_id AS p FROM pages WHERE id = 2').get()).toEqual({ p: null });
		s.prepare('DELETE FROM pages WHERE id = 2').run();
		expect(count('page_tags') + count('page_revisions') + count('timeline_events')).toBe(0);
	});

	it('senza Master la prima campagna va all\'Admin; su un database vuoto resta senza', () => {
		let s = oldWiki();
		s.exec(`UPDATE users SET role = 'player' WHERE role = 'master'`);
		migrate(s);
		expect(getCampaign(1)!.masterId).toBe(1);
		s = useMemoryDb(last) && getSqlite();
		migrate(s);
		expect(getCampaign(1)).toMatchObject({ name: 'Crooked Shelf', masterId: null, homePageId: null, calendar: null });
	});
});

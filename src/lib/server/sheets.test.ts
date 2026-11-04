import { beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, getSqlite, migrate, schema, useMemoryDb } from './db/index.ts';
import { MIGRATIONS } from './db/migrations.ts';
import { addMember, FIRST_CAMPAIGN, getCampaign, inCampaign, removeMember, setMaster, type CampaignRow } from './campaigns.ts';
import { createPage, deletePage, getPageById, getPageBySlug, listPages, listTrash, lockedSheet, setVisibility, trashFolder, updatePage, viewContent, type PageRow } from './pages.ts';
import { createCategory, deleteCategory, getCategory, moveTreeNode, pageTree } from './taxonomy.ts';
import { resetSettingsCache } from './settings.ts';
import { newCampaign, SHEET_TEMPLATE_ORIGIN } from './templates.ts';
import { canNestIn, ensureSheets, nestTarget, setSheetTemplate, sheetInfo, sheetTemplateChoice, tableOf } from './sheets.ts';
import { exportWorld } from './worldpack.ts';
import { allowedVisibilities, canEdit, canManage, type Viewer } from '../access.ts';
import { locate, type TreeFolder, type TreePage } from '../tree.ts';
import type { DocNode } from '../content/types.ts';

const dm: Viewer = { id: 1, role: 'master' };
const alice: Viewer = { id: 2, role: 'player' };
const bob: Viewer = { id: 3, role: 'player' };
const carla: Viewer = { id: 4, role: 'player' };

const text = (t: string): DocNode => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const withSecret: DocNode = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'pubblico' }] }, { type: 'secret', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nascosto' }] }] }] };
const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null, content: text('testo') };
const names: Record<number, string> = { 1: 'Davide', 2: 'Alice', 3: 'Bruno', 4: 'Carla' };

let c: CampaignRow;
const here = <T>(fn: () => T) => inCampaign(c, fn);
const sheetOf = (u: Viewer) => getDb().select().from(schema.pages).where(and(eq(schema.pages.campaignId, c.id), eq(schema.pages.sheetOf, u.id))).get();
const countPages = () => getDb().select({ n: sql<number>`count(*)` }).from(schema.pages).get()!.n;

beforeEach(() => {
	const db = useMemoryDb();
	resetSettingsCache();
	for (const u of [dm, alice, bob, carla]) db.insert(schema.users).values({ id: u.id, role: u.role, username: names[u.id].toLowerCase(), displayName: names[u.id], passwordHash: 'x', createdAt: 0, icon: u.id === 2 ? 'bow' : null }).run();
	c = newCampaign('Ombre', dm, 'it');
	addMember(c.id, alice.id);
	addMember(c.id, bob.id);
});

describe('cartella PG e schede', () => {
	it('alla prima richiesta: la cartella PG, il template «Scheda giocatore» e una scheda per giocatore', () => {
		here(() => ensureSheets('it'));
		const camp = getCampaign(c.id)!;
		expect(here(() => getCategory(camp.pcFolderId!))?.name).toBe('PG');
		const tpl = here(() => getPageById(camp.sheetTemplateId!))!;
		expect(tpl).toMatchObject({ kind: 'template', title: 'Scheda giocatore', template: SHEET_TEMPLATE_ORIGIN, authorId: dm.id });
		// Generico: niente di un sistema di gioco, solo due sezioni.
		expect(tpl.fields).toEqual([]);
		expect(JSON.stringify(tpl.content)).toContain('Il personaggio');
		expect(JSON.stringify(tpl.content)).toContain('Appunti');

		const a = sheetOf(alice)!;
		expect(a).toMatchObject({ title: 'Alice', slug: 'alice', authorId: alice.id, visibility: 'players', categoryId: camp.pcFolderId, kind: 'page', hasSecret: false, template: tpl.slug });
		expect(JSON.stringify(a.content)).toContain('Il personaggio');
		expect(sheetOf(bob)?.title).toBe('Bruno');
		// Il Master non è un giocatore: niente scheda.
		expect(sheetOf(dm)).toBeUndefined();
		// La seconda volta non c'è niente da fare.
		const n = countPages();
		here(() => ensureSheets('it'));
		expect(countPages()).toBe(n);
	});

	it('una cartella «PG» fatta a mano prima di questa versione diventa la cartella PG', () => {
		const mine = here(() => createCategory('PG', null));
		here(() => ensureSheets('it'));
		expect(getCampaign(c.id)!.pcFolderId).toBe(mine.id);
		expect(sheetOf(alice)!.categoryId).toBe(mine.id);
	});

	it('in inglese la cartella si chiama PCs', () => {
		here(() => ensureSheets('en'));
		expect(here(() => getCategory(getCampaign(c.id)!.pcFolderId!))?.name).toBe('PCs');
	});

	it('chi entra dopo ha la sua scheda alla richiesta seguente; il Master che passa la campagna diventa un giocatore con la sua', () => {
		here(() => ensureSheets('it'));
		addMember(c.id, carla.id);
		here(() => ensureSheets('it'));
		expect(sheetOf(carla)?.title).toBe('Carla');
		setMaster(c.id, alice.id);
		c = getCampaign(c.id)!;
		here(() => ensureSheets('it'));
		expect(sheetOf(dm)?.authorId).toBe(dm.id);
		// La nuova Master ha ancora la sua scheda di prima: non è più al tavolo, quindi si può eliminare.
		expect(here(() => lockedSheet(sheetOf(alice)!))).toBe(false);
	});

	it('il template delle schede lo sceglie il Master: i segreti non passano, e le schede che ci sono restano come sono', () => {
		here(() => ensureSheets('it'));
		const tpl = here(() => createPage({ ...base, kind: 'template', title: 'Scheda D&D', content: withSecret, fields: [{ label: 'Classe', value: '' }], icon: 'swords' }, dm));
		expect(here(() => setSheetTemplate(tpl.slug, alice))).toBe(false);
		expect(here(() => setSheetTemplate('non-esiste', dm))).toBe(false);
		expect(here(() => setSheetTemplate(tpl.slug, dm))).toBe(true);
		expect(here(() => sheetTemplateChoice(dm)).current).toBe(tpl.slug);
		addMember(c.id, carla.id);
		here(() => ensureSheets('it'));
		const s = sheetOf(carla)!;
		expect(s).toMatchObject({ fields: [{ label: 'Classe', value: '' }], icon: 'swords', template: tpl.slug, hasSecret: false });
		expect(JSON.stringify(s.content)).toContain('pubblico');
		expect(JSON.stringify(s.content)).not.toContain('nascosto');
		expect(JSON.stringify(sheetOf(alice)!.content)).toContain('Il personaggio');
		// Nessun template: pagina bianca.
		expect(here(() => setSheetTemplate('', dm))).toBe(true);
		expect(here(() => sheetTemplateChoice(dm)).current).toBe('');
	});
});

describe('la scheda è protetta', () => {
	let a: PageRow;
	beforeEach(() => {
		here(() => ensureSheets('it'));
		c = getCampaign(c.id)!;
		a = sheetOf(alice)!;
	});

	it('la modificano il giocatore e il Master, non gli altri giocatori', () => {
		expect(canEdit(a, alice)).toBe(true);
		expect(canManage(a, alice)).toBe(true);
		expect(canEdit(a, dm)).toBe(true);
		expect(canEdit(a, bob)).toBe(false);
		expect(allowedVisibilities(alice, true)).toEqual(['public', 'players']);
		expect(allowedVisibilities(dm, true)).toEqual(['public', 'players']);
	});

	it('il segreto del Master sì, Solo Master o Personale no, resta una pagina della cartella PG', () => {
		const other = here(() => createCategory('Luoghi', null));
		here(() => updatePage(a, { ...base, title: 'Thalia', content: withSecret, visibility: 'master', categoryId: other.id, kind: 'template' }, dm, true));
		let after = here(() => getPageById(a.id))!;
		expect(after).toMatchObject({ title: 'Thalia', visibility: 'players', categoryId: c.pcFolderId, kind: 'page', hasSecret: true });
		expect(JSON.stringify(after.content)).toContain('nascosto');
		// Il giocatore può ancora modificarla: il segreto non gli arriva e, quando salva, resta dov'era.
		expect(canEdit(after, alice)).toBe(true);
		const mine = here(() => viewContent(after.content, alice));
		expect(JSON.stringify(mine)).not.toContain('nascosto');
		here(() => updatePage(after, { ...base, title: 'Thalia', content: { ...mine, content: [...mine.content!, ...text('mio').content!] } }, alice, canManage(after, alice)));
		after = here(() => getPageById(a.id))!;
		expect(JSON.stringify(after.content)).toMatch(/pubblico.*nascosto.*mio/);
		// Visibilità e cestino restano al Master, finché c'è il segreto.
		expect(canManage(after, alice)).toBe(false);
		here(() => updatePage(after, { ...base, title: 'Thalia', visibility: 'personal' }, alice, true));
		expect(here(() => getPageById(a.id))!.visibility).toBe('players');
		here(() => updatePage(after, { ...base, title: 'Thalia', visibility: 'public' }, alice, true));
		after = here(() => getPageById(a.id))!;
		expect(after.visibility).toBe('public');
		// Dalla barra a sinistra lo stesso.
		expect(here(() => setVisibility(a.id, 'master', dm, false))).toBeNull();
		expect(here(() => setVisibility(a.id, 'players', dm, false))).toBe(1);
	});

	it('non va nel cestino finché il giocatore è al tavolo; se rientra la ritrova', () => {
		expect(here(() => lockedSheet(a))).toBe(true);
		here(() => deletePage(a.id));
		expect(here(() => getPageById(a.id))).toBeDefined();
		const node = here(() => locate(pageTree(dm).items, `page-${a.id}`))!.node as TreePage;
		expect(node).toMatchObject({ sheet: true, canTrash: false });

		removeMember(c.id, alice.id);
		expect(here(() => lockedSheet(a))).toBe(false);
		here(() => deletePage(a.id));
		expect(here(() => getPageById(a.id))).toBeUndefined();
		expect(here(() => listTrash(dm)).map((p) => p.id)).toContain(a.id);

		addMember(c.id, alice.id);
		here(() => ensureSheets('it'));
		expect(here(() => getPageById(a.id))).toMatchObject({ categoryId: c.pcFolderId, sheetOf: alice.id });
		expect(getDb().select().from(schema.pages).where(eq(schema.pages.sheetOf, alice.id)).all()).toHaveLength(1);
	});

	it('nell\'albero si riordina dentro la cartella PG, ma non esce', () => {
		const other = here(() => createCategory('Luoghi', null));
		const b = sheetOf(bob)!;
		expect(here(() => moveTreeNode(dm, `page-${a.id}`, { parent: `folder-${other.id}`, before: null }))).toBe(false);
		expect(here(() => moveTreeNode(dm, `page-${a.id}`, { parent: null, before: null }))).toBe(false);
		expect(here(() => moveTreeNode(dm, `page-${a.id}`, { parent: `page-${b.id}`, before: null }))).toBe(false);
		expect(here(() => moveTreeNode(dm, `page-${b.id}`, { parent: `folder-${c.pcFolderId}`, before: `page-${a.id}` }))).toBe(true);
		const pc = here(() => locate(pageTree(dm).items, `folder-${c.pcFolderId}`))!.node as TreeFolder;
		expect(pc.pc).toBe(true);
		expect(pc.items.map((n) => n.id)).toEqual([b.id, a.id]);
		// La cartella PG invece si sposta.
		expect(here(() => moveTreeNode(dm, `folder-${c.pcFolderId}`, { parent: `folder-${other.id}`, before: null }))).toBe(true);
	});

	it('la cartella PG non si elimina, e se va nel cestino la cartella che la contiene lei risale alla radice', () => {
		const pcId = c.pcFolderId!;
		here(() => deleteCategory(pcId));
		here(() => trashFolder(pcId, dm));
		expect(here(() => getCategory(pcId))).toBeDefined();
		const outer = here(() => createCategory('Tavolo', null));
		here(() => moveTreeNode(dm, `folder-${pcId}`, { parent: `folder-${outer.id}`, before: null }));
		here(() => trashFolder(outer.id, dm));
		expect(here(() => getCategory(outer.id))).toBeUndefined();
		expect(here(() => getCategory(pcId))).toMatchObject({ parentId: null, deletedAt: null });
		expect(here(() => getPageById(a.id))).toBeDefined();
	});
});

describe('pagine dentro la scheda', () => {
	beforeEach(() => {
		here(() => ensureSheets('it'));
		c = getCampaign(c.id)!;
	});

	it('il giocatore nella sua, il Master in tutte; nella vista giocatore nessuno', () => {
		const a = sheetOf(alice)!;
		expect(here(() => canNestIn(a, alice))).toBe(true);
		expect(here(() => canNestIn(a, bob))).toBe(false);
		expect(here(() => canNestIn(a, dm))).toBe(true);
		expect(here(() => canNestIn(a, { ...dm, role: 'player', asPlayer: true }))).toBe(false);
		expect(here(() => canNestIn(a, null))).toBe(false);
		const plain = here(() => createPage({ ...base, title: 'Taverna' }, alice));
		expect(here(() => nestTarget(String(plain.id), alice))).toBeUndefined();
		expect(here(() => nestTarget(String(a.id), alice))?.id).toBe(a.id);
		expect(here(() => nestTarget('x', alice))).toBeUndefined();
		expect(here(() => sheetInfo(a, alice))).toMatchObject({ player: 'Alice', mine: true, canNest: true });
		expect(here(() => sheetInfo(a, bob))).toMatchObject({ player: 'Alice', mine: false, canNest: false });
		expect(here(() => sheetInfo(plain, alice))).toBeNull();
	});

	it('nasce dentro la scheda, nella cartella PG; la pagina personale non la vede neanche il Master', () => {
		const a = sheetOf(alice)!;
		const note = here(() => createPage({ ...base, title: 'Diario di Thalia', visibility: 'personal', categoryId: a.categoryId, parentPageId: a.id }, alice));
		const node = here(() => locate(pageTree(alice).items, `page-${note.id}`))!;
		expect(node.parent).toBe(`page-${a.id}`);
		expect(here(() => locate(pageTree(dm).items, `page-${note.id}`))).toBeNull();
		// Una pagina dentro la scheda è una pagina qualunque: va nel cestino.
		expect((node.node as TreePage).canTrash).toBe(true);
	});
});

describe('al tavolo', () => {
	it('il Master e i giocatori con le loro schede, solo per chi ha fatto l\'accesso', () => {
		here(() => ensureSheets('it'));
		expect(here(() => tableOf(null))).toBeNull();
		const t = here(() => tableOf(bob))!;
		expect(t.master).toEqual({ name: 'Davide', icon: null, avatar: null });
		expect(t.players).toEqual([
			{ name: 'Alice', icon: 'bow', avatar: null, sheet: { slug: 'alice', title: 'Alice' } },
			{ name: 'Bruno', icon: null, avatar: null, sheet: { slug: 'bruno', title: 'Bruno' } }
		]);
		removeMember(c.id, bob.id);
		expect(here(() => tableOf(alice))!.players.map((p) => p.name)).toEqual(['Alice']);
	});

	it('le schede non contano per la home vuota', () => {
		here(() => ensureSheets('it'));
		expect(here(() => listPages(dm, { kind: 'page', noSheets: true })).rows.map((r) => r.title)).not.toContain('Alice');
		expect(here(() => listPages(dm, { kind: 'page' })).rows.map((r) => r.title)).toContain('Alice');
	});
});

describe('pacchetto mondo', () => {
	it('le schede e le pagine dentro di loro restano nella campagna', () => {
		here(() => ensureSheets('it'));
		const a = sheetOf(alice)!;
		here(() => createPage({ ...base, title: 'Famiglia di Thalia', categoryId: a.categoryId, parentPageId: a.id }, alice));
		here(() => createPage({ ...base, title: 'Waterdeep' }, dm));
		const zip = unzipSync(here(() => exportWorld({ name: 'Mondo', allPages: true, categoryIds: [], tagIds: [], maps: true, templates: true, calendar: false, timeline: false, themes: false, secrets: false }, dm)));
		const titles = JSON.parse(strFromU8(zip['pages.json'])).map((p: { title: string }) => p.title);
		expect(titles).toContain('Waterdeep');
		expect(titles).toContain('Scheda giocatore');
		expect(titles).not.toContain('Alice');
		expect(titles).not.toContain('Famiglia di Thalia');
	});
});

describe('migrazione', () => {
	it('le campagne di prima ricevono cartella e schede alla prima richiesta', () => {
		useMemoryDb(MIGRATIONS.length - 1);
		resetSettingsCache();
		const raw = getSqlite();
		raw.prepare("INSERT INTO users (id, username, display_name, password_hash, role, created_at) VALUES (1, 'davide', 'Davide', 'x', 'master', 0), (2, 'alice', 'Alice', 'x', 'player', 0)").run();
		raw.prepare('UPDATE campaigns SET master_id = 1 WHERE id = 1').run();
		raw.prepare('INSERT INTO campaign_members (campaign_id, user_id) VALUES (1, 2)').run();
		migrate(raw);
		const old = getCampaign(FIRST_CAMPAIGN)!;
		expect(old).toMatchObject({ pcFolderId: null, sheetTemplateId: null });
		inCampaign(old, () => ensureSheets('it'));
		expect(inCampaign(old, () => getPageBySlug('alice'))).toMatchObject({ sheetOf: 2, authorId: 2, visibility: 'players' });
		expect(getCampaign(FIRST_CAMPAIGN)!.pcFolderId).not.toBeNull();
		// Due schede dello stesso giocatore nella stessa campagna non ci possono essere.
		expect(() => raw.prepare("INSERT INTO pages (campaign_id, slug, title, content, visibility, created_at, updated_at, sheet_of) VALUES (1, 'altra', 'Altra', '{}', 'players', 0, 0, 2)").run()).toThrow();
	});
});

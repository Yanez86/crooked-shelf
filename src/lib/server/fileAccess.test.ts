import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { useMemoryDb, schema } from './db/index.ts';
import { FIRST_CAMPAIGN, addMember, inCampaign, insertCampaign, saveCampaign } from './campaigns.ts';
import { createPage, purgePage, updatePage } from './pages.ts';
import { createResource } from './resources.ts';
import { addFileUses, fileUsesOf, getFile, purgeOrphanFiles, usedBy, withinQuota } from './files.ts';
import { canDownload } from './fileAccess.ts';
import { resetSettingsCache, saveSettings } from './settings.ts';
import type { DocNode } from '../content/types.ts';

const master = { id: 1, role: 'master' as const };
const alice = { id: 2, role: 'player' as const };
const base = { playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null };
const img = (id: string): DocNode => ({ type: 'doc', content: [{ type: 'image', attrs: { src: `/files/${id}`, alt: '' } }] });
const file = (id: string, uploadedBy = 1, createdAt = 0) =>
	useDb().insert(schema.files).values({ id, sha256: id, name: id + '.png', mime: 'image/png', size: 100, width: 1, height: 1, uploadedBy, createdAt }).run();
let db: ReturnType<typeof useMemoryDb>;
const useDb = () => db;
const as = (user: { id: number } | null, campaignId = FIRST_CAMPAIGN, asPlayer = false) => ({ user, campaignId, asPlayer });

beforeEach(() => {
	db = useMemoryDb();
	for (const [id, role] of [
		[1, 'master'],
		[2, 'player'],
		[3, 'player']
	] as const)
		db.insert(schema.users).values({ id, username: 'u' + id, displayName: 'U' + id, passwordHash: 'x', role, createdAt: 0 }).run();
	resetSettingsCache();
	saveCampaign(FIRST_CAMPAIGN, { name: 'A', masterId: 1 });
	addMember(FIRST_CAMPAIGN, 2);
	for (const id of ['publicimgxxx', 'masterimgxxx', 'freshimgxxxx', 'oldorphanxxx', 'resimgxxxxxx', 'otherimgxxxx']) file(id, id === 'freshimgxxxx' ? 2 : 1);
});

describe('chi scarica un file', () => {
	it('segue la visibilità della pagina che lo usa', () => {
		const pub = createPage({ ...base, title: 'Pub', content: img('publicimgxxx'), visibility: 'public' }, master);
		createPage({ ...base, title: 'Segreta', content: img('masterimgxxx'), visibility: 'master' }, master);
		expect(fileUsesOf('publicimgxxx')).toEqual([{ kind: 'page', refId: pub.id }]);
		expect(canDownload(getFile('publicimgxxx')!, as(alice))).toBe(true);
		expect(canDownload(getFile('masterimgxxx')!, as(alice))).toBe(false);
		expect(canDownload(getFile('masterimgxxx')!, as(master))).toBe(true);
		// Vista giocatore: il Master guarda come un giocatore.
		expect(canDownload(getFile('masterimgxxx')!, as(master, FIRST_CAMPAIGN, true))).toBe(false);
		// Chi non è al tavolo non vede niente, nemmeno le pagine pubbliche, finché i visitatori sono spenti.
		expect(canDownload(getFile('publicimgxxx')!, as({ id: 3 }))).toBe(false);
		expect(canDownload(getFile('publicimgxxx')!, as(null))).toBe(false);
		saveSettings({ allowVisitors: true });
		expect(canDownload(getFile('publicimgxxx')!, as(null))).toBe(true);
		expect(canDownload(getFile('masterimgxxx')!, as(null))).toBe(false);
	});

	it("un file appena caricato lo vede solo chi l'ha caricato, finché non è in una pagina", () => {
		expect(canDownload(getFile('freshimgxxxx')!, as(alice))).toBe(true);
		expect(canDownload(getFile('freshimgxxxx')!, as(master))).toBe(false);
	});

	it("un'immagine tolta dalla pagina resta sua (è nelle versioni); con la pagina eliminata per sempre sparisce", () => {
		const p = createPage({ ...base, title: 'P', content: img('publicimgxxx'), visibility: 'players' }, master);
		updatePage(p, { ...base, title: 'P', content: { type: 'doc' }, visibility: 'players' }, master, true);
		expect(canDownload(getFile('publicimgxxx')!, as(alice))).toBe(true);
		db.update(schema.pages).set({ deletedAt: 1 }).where(eq(schema.pages.id, p.id)).run();
		purgePage(p.id);
		expect(fileUsesOf('publicimgxxx')).toEqual([]);
		expect(canDownload(getFile('publicimgxxx')!, as(alice))).toBe(false);
		// Senza usi vale la regola dei file appena caricati: li vede chi li ha caricati.
		expect(canDownload(getFile('publicimgxxx')!, as(master))).toBe(true);
	});

	it('le risorse seguono la loro visibilità, i temi e gli avatar li vedono tutti', () => {
		createResource({ title: 'R', description: '', visibility: 'master' }, 'resimgxxxxxx', 1);
		expect(canDownload(getFile('resimgxxxxxx')!, as(alice))).toBe(false);
		expect(canDownload(getFile('resimgxxxxxx')!, as(master))).toBe(true);
		addFileUses('avatar', 2, ['otherimgxxxx']);
		expect(canDownload(getFile('otherimgxxxx')!, as({ id: 3 }))).toBe(true);
	});

	it('un file di un\'altra campagna si vede solo da chi ne fa parte', () => {
		const other = insertCampaign('B', 3);
		inCampaign(other, () => createPage({ ...base, title: 'Altra', content: img('otherimgxxxx'), visibility: 'players' }, { id: 3, role: 'master' }));
		expect(canDownload(getFile('otherimgxxxx')!, as(alice))).toBe(false);
		expect(canDownload(getFile('otherimgxxxx')!, as(master))).toBe(false);
		expect(canDownload(getFile('otherimgxxxx')!, as({ id: 3 }, other.id))).toBe(true);
	});
});

describe('quota e orfani', () => {
	it("chi gioca soltanto ha una quota; chi tiene una campagna e l'Admin no", () => {
		expect(usedBy(2)).toBe(100);
		expect(withinQuota({ id: 2, accountRole: 'player' }, 512 * 1024 * 1024)).toBe(false);
		expect(withinQuota({ id: 2, accountRole: 'player' }, 1000)).toBe(true);
		// L'account 1 è come gli altri, ma tiene la campagna: niente limite, in qualunque campagna carichi.
		expect(withinQuota({ id: 1, accountRole: 'player' }, 10 ** 12)).toBe(true);
		expect(withinQuota({ id: 3, accountRole: 'admin' }, 10 ** 12)).toBe(true);
		// Diventato Master di una sua campagna, anche Alice.
		insertCampaign('Di Alice', 2);
		expect(withinQuota({ id: 2, accountRole: 'player' }, 512 * 1024 * 1024)).toBe(true);
	});

	it('i file che nessuno usa da un giorno si eliminano', () => {
		createPage({ ...base, title: 'P', content: img('publicimgxxx'), visibility: 'public' }, master);
		const later = Date.now() + 2 * 24 * 60 * 60 * 1000;
		file('recentxxxxxx', 1, later - 1000);
		const n = purgeOrphanFiles(later);
		expect(n).toBe(5);
		expect(getFile('publicimgxxx')).toBeDefined();
		expect(getFile('recentxxxxxx')).toBeDefined();
		expect(getFile('oldorphanxxx')).toBeUndefined();
	});
});

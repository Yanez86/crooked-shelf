import { AsyncLocalStorage } from 'node:async_hooks';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Cookies } from '@sveltejs/kit';
import { getDb, getSqlite, schema } from './db/index.ts';
import { deleteFile } from './files.ts';
import { uploadedImages } from '../content/extract.ts';
import { isDoc, type PageField } from '../content/types.ts';
import type { Viewer } from '../access.ts';
import type { Role } from '../roles.ts';

const { campaigns, campaignMembers, categories, maps, pageRevisions, pages, resources, tags, treeDividers, users } = schema;

export type CampaignRow = typeof campaigns.$inferSelect;

export const CAMPAIGN_COOKIE = 'cs_campaign';
/** Creata dalla migrazione, così la configurazione iniziale la trova pronta; poi si può eliminare come le altre. */
export const FIRST_CAMPAIGN = 1;
/** Per chi non ha campagne: nessuna riga ha questo id, quindi non si legge niente e non si scrive niente. */
export const NO_CAMPAIGN: CampaignRow = { id: 0, name: '', masterId: null, homePageId: null, calendar: null, createdAt: 0 };

const current = new AsyncLocalStorage<CampaignRow>();

export const getCampaign = (id: number) => getDb().select().from(campaigns).where(eq(campaigns.id, id)).get();

/** Tutto ciò che legge o scrive contenuti dentro `fn` riguarda la campagna `c`. Ogni richiesta passa da qui (hooks.server.ts). */
export const inCampaign = <T>(c: CampaignRow, fn: () => T): T => current.run(c, fn);

/** La campagna della richiesta; fuori da una richiesta (es. nei test), la prima. */
export const currentCampaign = (): CampaignRow => current.getStore() ?? getCampaign(FIRST_CAMPAIGN) ?? NO_CAMPAIGN;
export const campaignId = () => currentCampaign().id;

/** Condizione SQL: righe della campagna della richiesta. */
export const ofCampaign = (t: { campaignId: SQLiteColumn }) => eq(t.campaignId, campaignId());

/** Condizione SQL per le tabelle legate a una pagina: la pagina indicata sta nella campagna della richiesta. */
export const pageInCampaign = (pageId: SQLiteColumn) => sql`${pageId} IN (SELECT ${pages.id} FROM ${pages} WHERE ${pages.campaignId} = ${campaignId()})`;

/** Le campagne in cui si può entrare: l'Admin in tutte, gli altri nelle proprie, i visitatori in tutte se sono ammessi. */
export function campaignsFor(u: Viewer | null, visitors: boolean): CampaignRow[] {
	if (!u && !visitors) return [];
	const mine =
		u && u.role !== 'admin'
			? or(eq(campaigns.masterId, u.id), sql`${campaigns.id} IN (SELECT ${campaignMembers.campaignId} FROM ${campaignMembers} WHERE ${campaignMembers.userId} = ${u.id})`)
			: undefined;
	return getDb().select().from(campaigns).where(mine).orderBy(asc(campaigns.id)).all();
}

/** Il ruolo in una campagna: l'Admin resta Admin, Master è solo chi la tiene, tutti gli altri sono giocatori. */
export const roleIn = (c: CampaignRow, u: Viewer): Role => (u.role === 'admin' ? 'admin' : c.masterId === u.id ? 'master' : 'player');

export function insertCampaign(name: string, masterId: number): CampaignRow {
	return getDb().insert(campaigns).values({ name, masterId, createdAt: Date.now() }).returning().get();
}

export function saveCampaign(id: number, patch: Partial<Omit<CampaignRow, 'id'>>): CampaignRow {
	const row = getDb().update(campaigns).set(patch).where(eq(campaigns.id, id)).returning().get();
	// Il resto della richiesta deve vedere subito la modifica (es. la home appena creata).
	const here = current.getStore();
	if (here?.id === id) Object.assign(here, row);
	return row;
}

export function addMember(id: number, userId: number) {
	getDb().insert(campaignMembers).values({ campaignId: id, userId }).onConflictDoNothing().run();
}

export function removeMember(id: number, userId: number) {
	getDb().delete(campaignMembers).where(and(eq(campaignMembers.campaignId, id), eq(campaignMembers.userId, userId))).run();
}

/** Un altro Master: quello di prima resta nella campagna, come giocatore. */
export function setMaster(id: number, masterId: number) {
	const old = getCampaign(id)?.masterId;
	getDb().transaction(() => {
		if (old && old !== masterId) addMember(id, old);
		removeMember(id, masterId);
		saveCampaign(id, { masterId });
	});
}

/** I file usati da ogni campagna: copertine, riquadri e immagini nel testo (anche di pagine nel cestino e di versioni vecchie), mappe, risorse. */
function filesByCampaign() {
	const db = getDb();
	const out = new Map<number, Set<string>>();
	const add = (c: number, id: string | null | undefined) => {
		if (!id) return;
		if (!out.has(c)) out.set(c, new Set());
		out.get(c)!.add(id);
	};
	const page = (c: number, content: unknown, fields: PageField[] | null) => {
		for (const f of fields ?? []) add(c, f.image);
		if (isDoc(content)) for (const img of uploadedImages(content)) add(c, img.id);
	};
	for (const p of db.select({ c: pages.campaignId, content: pages.content, fields: pages.fields, image: pages.imageId, cover: pages.coverImageId }).from(pages).all()) {
		page(p.c, p.content, p.fields);
		add(p.c, p.image);
		add(p.c, p.cover);
	}
	for (const r of db.select({ c: pages.campaignId, content: pageRevisions.content, fields: pageRevisions.fields }).from(pageRevisions).innerJoin(pages, eq(pages.id, pageRevisions.pageId)).all())
		page(r.c, r.content, r.fields);
	for (const m of db.select({ c: pages.campaignId, id: maps.fileId }).from(maps).innerJoin(pages, eq(pages.id, maps.pageId)).all()) add(m.c, m.id);
	for (const r of db.select({ c: resources.campaignId, id: resources.fileId }).from(resources).all()) add(r.c, r.id);
	return out;
}

/**
 * Elimina per sempre una campagna con tutto ciò che contiene. Tolte le pagine, il resto (mappe, cronologie, bacheche,
 * versioni, inviti, giocatori) se ne va da solo. I file spariscono anche dal disco, tranne quelli usati da un'altra campagna.
 */
export function deleteCampaign(id: number) {
	const db = getDb();
	const used = filesByCampaign();
	const files = used.get(id) ?? new Set<string>();
	for (const [c, ids] of used) if (c !== id) for (const f of ids) files.delete(f);
	db.transaction(() => {
		getSqlite().prepare('DELETE FROM pages_fts WHERE rowid IN (SELECT id FROM pages WHERE campaign_id = ?)').run(id);
		for (const t of [treeDividers, resources, tags, pages, categories]) db.delete(t).where(eq(t.campaignId, id)).run();
		db.delete(campaigns).where(eq(campaigns.id, id)).run();
	});
	// Dopo la transazione: un file tolto dal disco non si recupera, se qualcosa andasse storto.
	for (const f of files) deleteFile(f);
}

/** I giocatori di una campagna (il Master no). */
export function membersOf(id: number) {
	return getDb()
		.select({ id: users.id, username: users.username, displayName: users.displayName })
		.from(campaignMembers)
		.innerJoin(users, eq(users.id, campaignMembers.userId))
		.where(eq(campaignMembers.campaignId, id))
		.orderBy(asc(users.displayName))
		.all();
}

export function setCampaignCookie(cookies: Cookies, url: URL, id: number) {
	cookies.set(CAMPAIGN_COOKIE, String(id), { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 365 });
}

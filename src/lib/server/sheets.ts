import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { currentCampaign, masterOf, saveCampaign } from './campaigns.ts';
import { createPage, getPageById, isSheet, restorePage, type PageRow } from './pages.ts';
import { createCategory, getCategory, getCategoryBySlug } from './taxonomy.ts';
import { ensureSheetTemplate, getTemplatePage, listTemplates, templateCopy } from './templates.ts';
import { canView, canWrite, isMaster, type Viewer } from '../access.ts';
import { EMPTY_DOC } from '../content/types.ts';
import { translate } from '../i18n/index.ts';
import { slugify } from '../slug.ts';

/**
 * Schede giocatore. Ogni campagna ha la cartella PG e dentro una scheda per ogni giocatore, legata al suo account
 * (`pages.sheet_of`): l'autore è lui, la modificano lui e il Master, la vedono tutti i giocatori. Nasce col template
 * scelto dal Master (di partenza «Scheda giocatore») quando il giocatore entra nella campagna.
 * Le regole che la proteggono stanno con le pagine (pages.ts, taxonomy.ts, tree.ts): solo Pubblica o Giocatori, resta
 * nella cartella PG, e non va nel cestino finché il giocatore è al tavolo. I segreti del Master ci stanno come altrove:
 * il giocatore non li riceve e, quando salva, il server li rimette al loro posto (content/blocks.ts).
 */

const { campaignMembers, pages, users } = schema;

/** Chi è al tavolo e non ha ancora una scheda, e chi ce l'ha nel cestino (rientrato dopo che il Master l'aveva eliminata). */
function missingSheets(campaignId: number) {
	return getDb()
		.select({ id: users.id, name: users.displayName, trashed: sql<number | null>`(SELECT ${pages.id} FROM ${pages} WHERE ${pages.campaignId} = ${campaignId} AND ${pages.sheetOf} = ${users.id} AND ${pages.deletedAt} IS NOT NULL)` })
		.from(campaignMembers)
		.innerJoin(users, eq(users.id, campaignMembers.userId))
		.where(
			and(
				eq(campaignMembers.campaignId, campaignId),
				sql`NOT EXISTS (SELECT 1 FROM ${pages} WHERE ${pages.campaignId} = ${campaignId} AND ${pages.sheetOf} = ${users.id} AND ${pages.deletedAt} IS NULL)`
			)
		)
		.orderBy(asc(users.id))
		.all();
}

/** La cartella PG: quella che c'è con quel nome (magari fatta a mano prima di questa versione), o una nuova. */
function pcFolder(locale: string): number {
	const name = translate(locale, 'sheets.folder');
	return (getCategoryBySlug(slugify(name, 'folder')) ?? createCategory(name, null)).id;
}

/** La scheda nuova di un giocatore: la fotocopia del template delle schede, o una pagina bianca. */
function createSheet(player: { id: number; name: string }, folderId: number): PageRow {
	const u: Viewer = { id: player.id, role: 'player' };
	const id = currentCampaign().sheetTemplateId;
	const tpl = id ? getPageById(id) : undefined;
	const copy = tpl?.kind === 'template' ? templateCopy(tpl, u, new Date().toISOString().slice(0, 10)) : null;
	return createPage(
		{
			title: player.name,
			content: copy?.content ?? EMPTY_DOC,
			fields: copy?.fields ?? [],
			icon: copy?.icon ?? null,
			template: copy?.template ?? null,
			// Anche se il template è di resoconti: una scheda non lo è.
			session: null,
			visibility: 'players',
			playersCanEdit: false,
			categoryId: folderId,
			tags: [],
			sheetOf: player.id
		},
		u
	);
}

/**
 * Prepara la campagna della richiesta: la cartella PG (la prima volta anche il template «Scheda giocatore») e le schede
 * che mancano. Gira a ogni richiesta (hooks.server.ts) e costa due letture quando è tutto pronto: così valgono le
 * campagne di prima di questa versione e ogni modo di entrare in una campagna (invito, nuovo Master, pacchetto mondo).
 * `locale` è la lingua della wiki, non di chi guarda: la cartella si chiama uguale per tutti.
 */
export function ensureSheets(locale: string) {
	const c = currentCampaign();
	if (!c.id) return;
	const folderOk = !!c.pcFolderId && !!getCategory(c.pcFolderId);
	const missing = missingSheets(c.id);
	if (folderOk && !missing.length) return;
	getDb().transaction(() => {
		if (!folderOk) {
			const patch: { pcFolderId: number; sheetTemplateId?: number } = { pcFolderId: pcFolder(locale) };
			// La prima volta anche il template, fatto dal Master (senza Master la scheda parte bianca).
			if (!c.pcFolderId && c.masterId) patch.sheetTemplateId = ensureSheetTemplate(locale, { id: c.masterId, role: 'master' }).id;
			saveCampaign(c.id, patch);
		}
		const folderId = currentCampaign().pcFolderId!;
		for (const m of missing) {
			if (!m.trashed) createSheet(m, folderId);
			else {
				// Torna nella cartella PG, anche se nel frattempo è un'altra.
				restorePage(m.trashed);
				getDb().update(pages).set({ categoryId: folderId, parentPageId: null }).where(eq(pages.id, m.trashed)).run();
			}
		}
	});
}

/** Il giocatore di una scheda: chi è e se chi guarda può metterci dentro una pagina nuova. */
export function sheetInfo(page: PageRow, u: Viewer | null) {
	if (!isSheet(page)) return null;
	const player = getDb().select({ name: users.displayName }).from(users).where(eq(users.id, page.sheetOf!)).get();
	return { id: page.id, player: player?.name ?? '', mine: !!u && !u.asPlayer && u.id === page.sheetOf, canNest: canNestIn(page, u) };
}

/** Dentro una scheda si crea una pagina nuova: il suo giocatore nella sua, il Master in tutte. */
export function canNestIn(page: PageRow | undefined, u: Viewer | null): page is PageRow {
	return !!page && isSheet(page) && canWrite(u) && canView(page, u) && (isMaster(u) || page.sheetOf === u.id);
}

/** La scheda in cui nasce una pagina nuova (`?in=<id>` in /wiki/new), se si può. */
export function nestTarget(raw: unknown, u: Viewer | null): PageRow | undefined {
	const id = Number(raw);
	const page = Number.isInteger(id) && id > 0 ? getPageById(id) : undefined;
	return canNestIn(page, u) ? page : undefined;
}

/** Le schede della campagna (non nel cestino), per giocatore. */
export function sheetsByPlayer(): Map<number, PageRow> {
	const rows = getDb()
		.select()
		.from(pages)
		.where(and(eq(pages.campaignId, currentCampaign().id), sql`${pages.sheetOf} IS NOT NULL`, sql`${pages.deletedAt} IS NULL`))
		.all();
	return new Map(rows.map((p) => [p.sheetOf!, p]));
}

/**
 * Chi è al tavolo, per la colonna a destra della home: il Master e i giocatori, con la loro scheda.
 * Solo per chi ha fatto l'accesso: ai visitori non si mostrano i nomi degli account.
 */
export function tableOf(u: Viewer | null) {
	if (!u) return null;
	const c = currentCampaign();
	const db = getDb();
	const players = db
		.select({ id: users.id, name: users.displayName, icon: users.icon, avatar: users.avatar })
		.from(campaignMembers)
		.innerJoin(users, eq(users.id, campaignMembers.userId))
		.where(eq(campaignMembers.campaignId, c.id))
		.orderBy(sql`${users.displayName} COLLATE NOCASE`)
		.all();
	const sheets = sheetsByPlayer();
	return {
		master: masterOf(c),
		players: players.map(({ id, name, icon, avatar }) => {
			const sheet = sheets.get(id);
			return { name, icon, avatar, sheet: sheet && canView(sheet, u) ? { slug: sheet.slug, title: sheet.title } : null };
		})
	};
}

/** Per Impostazioni campagna › Giocatori: i template tra cui il Master sceglie quello delle schede nuove, e quello scelto. */
export function sheetTemplateChoice(u: Viewer) {
	const id = currentCampaign().sheetTemplateId;
	const current = id ? getPageById(id) : undefined;
	return {
		templates: listTemplates(u).map(({ slug, title }) => ({ slug, title })),
		current: current?.kind === 'template' ? current.slug : ''
	};
}

/** Il Master sceglie il template delle schede nuove ('' = pagina bianca). Le schede che ci sono già restano come sono. */
export function setSheetTemplate(slug: string, u: Viewer): boolean {
	if (!isMaster(u)) return false;
	if (!slug) {
		saveCampaign(currentCampaign().id, { sheetTemplateId: null });
		return true;
	}
	const tpl = getTemplatePage(slug, u);
	if (!tpl) return false;
	saveCampaign(currentCampaign().id, { sheetTemplateId: tpl.id });
	return true;
}

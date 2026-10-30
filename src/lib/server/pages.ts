import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { getDb, getSqlite, schema } from './db/index.ts';
import { slugify } from '../slug.ts';
import { extract, stripSecrets } from '../content/extract.ts';
import { renderDoc, renderInline, type LinkTarget, type RenderOptions } from '../content/render.ts';
import { EMPTY_DOC, isDoc, type DocNode, type PageField, type SessionInfo } from '../content/types.ts';
import { canView, isMaster, type Viewer } from '../access.ts';
import type { Visibility } from '../roles.ts';
import { visibleTo } from './visibility.ts';
import { ensureTags, tagsForPages } from './taxonomy.ts';
import { syncSessionEvent } from './timeline.ts';
import { hasRule } from './rules/index.ts';
import { getFile } from './files.ts';

const { pages, pageTags, pageLinks, users, categories, pageRevisions } = schema;

export type PageRow = typeof pages.$inferSelect;

export const TITLE_MAX = 200;

export function getPageBySlug(slug: string): PageRow | undefined {
	return getDb()
		.select()
		.from(pages)
		.where(and(eq(pages.slug, slug), sql`${pages.deletedAt} IS NULL`))
		.get();
}

function slugTaken(slug: string, excludeId?: number) {
	// Anche le pagine eliminate tengono il loro indirizzo, per poterle ripristinare.
	const hit = getDb().select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).get();
	return !!hit && hit.id !== excludeId;
}

export function uniquePageSlug(base: string, excludeId?: number): string {
	let slug = base;
	for (let i = 2; slugTaken(slug, excludeId); i++) slug = `${base}-${i}`;
	return slug;
}

export interface PageInput {
	title: string;
	content: unknown;
	visibility: Visibility;
	playersCanEdit: boolean;
	categoryId: number | null;
	tags: string[];
	/** Indirizzo richiesto (da un collegamento rosso); usato solo alla creazione. */
	slug?: string;
	fields: PageField[];
	/** Template usato ("b:npc", "c:3"), solo informativo. */
	template?: string | null;
	/** Dati del resoconto di sessione, se la pagina lo è. */
	session: SessionInfo | null;
	/** Icona nell'albero; undefined = lascia quella che c'è. */
	icon?: string | null;
}

function normalizeContent(raw: unknown, u: Viewer): DocNode {
	const doc = isDoc(raw) ? raw : EMPTY_DOC;
	// Solo Master e Admin scrivono blocchi segreti.
	return isMaster(u) ? doc : stripSecrets(doc);
}

/** La prima immagine della colonna a lato è l'immagine della pagina (galleria, anteprima dei collegamenti). */
function coverOf(fields: PageField[]): string | null {
	return fields.find((f) => f.image && getFile(f.image))?.image ?? null;
}

function writeIndex(id: number, title: string, doc: DocNode, fields: PageField[]) {
	const ex = extract(doc, fields);
	const db = getDb();
	db.delete(pageLinks).where(eq(pageLinks.fromPageId, id)).run();
	if (ex.links.length)
		db.insert(pageLinks)
			.values(ex.links.map((l) => ({ fromPageId: id, targetSlug: l.target, secret: l.secret })))
			.run();
	const s = getSqlite();
	s.prepare('DELETE FROM pages_fts WHERE rowid = ?').run(id);
	s.prepare('INSERT INTO pages_fts (rowid, title, body, secret_body) VALUES (?, ?, ?, ?)').run(
		id,
		title,
		ex.body,
		ex.secretBody
	);
	return ex;
}

/** Salva una versione della pagina così com'è dopo una modifica. */
function writeRevision(id: number) {
	const p = getDb().select().from(pages).where(eq(pages.id, id)).get();
	if (!p) return;
	getDb()
		.insert(pageRevisions)
		.values({
			pageId: id,
			title: p.title,
			content: p.content,
			fields: p.fields ?? [],
			visibility: p.visibility,
			hasSecret: p.hasSecret,
			editedBy: p.updatedBy,
			createdAt: p.updatedAt
		})
		.run();
}

function writeTags(id: number, names: string[]) {
	const db = getDb();
	db.delete(pageTags).where(eq(pageTags.pageId, id)).run();
	const ids = [...new Set(ensureTags(names))];
	if (ids.length) db.insert(pageTags).values(ids.map((tagId) => ({ pageId: id, tagId }))).run();
}

export function createPage(input: PageInput, u: Viewer): PageRow {
	const doc = normalizeContent(input.content, u);
	const now = Date.now();
	const base = slugify(input.slug || input.title);
	return getDb().transaction(() => {
		const row = getDb()
			.insert(pages)
			.values({
				slug: uniquePageSlug(base),
				title: input.title,
				content: doc,
				visibility: input.visibility,
				playersCanEdit: input.playersCanEdit,
				hasSecret: extract(doc).hasSecret,
				categoryId: input.categoryId,
				fields: input.fields,
				imageId: coverOf(input.fields),
				template: input.template ?? null,
				session: input.session,
				icon: input.icon ?? null,
				authorId: u.id,
				updatedBy: u.id,
				createdAt: now,
				updatedAt: now
			})
			.returning()
			.get();
		writeIndex(row.id, row.title, doc, input.fields);
		writeTags(row.id, input.tags);
		syncSessionEvent(row, input.session);
		writeRevision(row.id);
		return row;
	});
}

/** Aggiorna una pagina. `manage` = può cambiare visibilità e permessi. */
export function updatePage(page: PageRow, input: PageInput, u: Viewer, manage: boolean): void {
	const doc = normalizeContent(input.content, u);
	getDb().transaction(() => {
		getDb()
			.update(pages)
			.set({
				title: input.title,
				content: doc,
				hasSecret: extract(doc).hasSecret,
				categoryId: input.categoryId,
				fields: input.fields,
				imageId: coverOf(input.fields),
				session: input.session,
				...(input.icon !== undefined ? { icon: input.icon } : {}),
				updatedBy: u.id,
				updatedAt: Math.max(Date.now(), page.updatedAt + 1),
				...(manage ? { visibility: input.visibility, playersCanEdit: input.playersCanEdit } : {})
			})
			.where(eq(pages.id, page.id))
			.run();
		writeIndex(page.id, input.title, doc, input.fields);
		writeTags(page.id, input.tags);
		const visibility = manage ? input.visibility : page.visibility;
		syncSessionEvent({ id: page.id, title: input.title, visibility, authorId: page.authorId }, input.session);
		writeRevision(page.id);
	});
}

export function deletePage(id: number) {
	getDb().transaction(() => {
		getDb().update(pages).set({ deletedAt: Date.now() }).where(eq(pages.id, id)).run();
		getDb().delete(pageLinks).where(eq(pageLinks.fromPageId, id)).run();
		getSqlite().prepare('DELETE FROM pages_fts WHERE rowid = ?').run(id);
		syncSessionEvent({ id, title: '', visibility: 'personal', authorId: null }, null);
	});
}

/** Titoli e visibilità delle pagine collegate, per disegnare i collegamenti. */
export function linkResolver(doc: DocNode, u: Viewer | null, fields: PageField[] = []): (slug: string) => LinkTarget | undefined {
	return resolverFor(
		extract(doc, fields).links.map((l) => l.target),
		u
	);
}

/** Primi ~200 caratteri, tagliati a fine parola. */
export function excerptOf(body: string | null): string | undefined {
	const t = (body ?? '').replace(/\s+/g, ' ').trim();
	if (t.length <= 200) return t || undefined;
	return t.slice(0, 200).replace(/\s+\S*$/, '') + '…';
}

/** Come linkResolver, partendo da un elenco di indirizzi. */
export function resolverFor(slugs: string[], u: Viewer | null): (slug: string) => LinkTarget | undefined {
	const map = new Map<string, LinkTarget>();
	if (slugs.length) {
		const rows = getDb()
			.select({
				slug: pages.slug,
				title: pages.title,
				visibility: pages.visibility,
				authorId: pages.authorId,
				imageId: pages.imageId,
				// Testo pubblico dall'indice di ricerca: i segreti non ci sono.
				body: sql<string | null>`(SELECT substr(body, 1, 400) FROM pages_fts WHERE rowid = ${pages.id})`
			})
			.from(pages)
			.where(and(inArray(pages.slug, slugs), sql`${pages.deletedAt} IS NULL`))
			.all();
		for (const r of rows) {
			const visible = canView({ ...r, playersCanEdit: false, hasSecret: false }, u);
			map.set(r.slug, { title: r.title, visible, ...(visible ? { excerpt: excerptOf(r.body), image: r.imageId ?? undefined } : {}) });
		}
	}
	return (slug) => map.get(slug);
}

export function renderPage(page: PageRow, u: Viewer | null, labels: RenderOptions['labels']) {
	const doc = isDoc(page.content) ? page.content : EMPTY_DOC;
	const fields = page.fields ?? [];
	const resolve = linkResolver(doc, u, fields);
	return {
		html: renderDoc(doc, { showSecrets: isMaster(u), resolve, labels, hasRule }),
		// I riquadri immagine il cui file non c'è più (es. risorsa eliminata) non si mostrano.
		fields: fields.flatMap((f): { label: string; html: string; image?: { url: string; width: number; height: number } }[] => {
			if (f.image === undefined) return [{ label: f.label, html: renderInline(f.value, { resolve, labels, hasRule }) }];
			const file = getFile(f.image);
			return file ? [{ label: f.label, html: '', image: { url: `/files/${file.id}`, width: file.width, height: file.height } }] : [];
		})
	};
}

/** Pagine visibili che collegano a questa (i collegamenti nei segreti solo per il Master). */
export function backlinks(slug: string, u: Viewer | null) {
	const secretOk = isMaster(u) ? sql`1=1` : sql`${pageLinks.secret} = 0`;
	return getDb()
		.selectDistinct({ slug: pages.slug, title: pages.title })
		.from(pageLinks)
		.innerJoin(pages, eq(pages.id, pageLinks.fromPageId))
		.where(and(eq(pageLinks.targetSlug, slug), visibleTo(u), secretOk))
		.orderBy(pages.title)
		.all();
}

export interface ListOptions {
	categoryIds?: number[];
	tagId?: number;
	limit?: number;
	offset?: number;
	sort?: 'updated' | 'title';
}

export function listPages(u: Viewer | null, o: ListOptions = {}) {
	const db = getDb();
	const conds: SQL[] = [visibleTo(u)];
	if (o.categoryIds) conds.push(inArray(pages.categoryId, o.categoryIds.length ? o.categoryIds : [-1]));
	if (o.tagId)
		conds.push(
			sql`${pages.id} IN (SELECT ${pageTags.pageId} FROM ${pageTags} WHERE ${pageTags.tagId} = ${o.tagId})`
		);
	const where = and(...conds);
	const total = db.select({ n: sql<number>`count(*)` }).from(pages).where(where).get()?.n ?? 0;
	const rows = db
		.select({
			id: pages.id,
			slug: pages.slug,
			title: pages.title,
			visibility: pages.visibility,
			updatedAt: pages.updatedAt,
			category: categories.name,
			categorySlug: categories.slug,
			editor: users.displayName
		})
		.from(pages)
		.leftJoin(categories, eq(categories.id, pages.categoryId))
		.leftJoin(users, eq(users.id, pages.updatedBy))
		.where(where)
		.orderBy(o.sort === 'title' ? sql`${pages.title} COLLATE NOCASE` : desc(pages.updatedAt))
		.limit(o.limit ?? 50)
		.offset(o.offset ?? 0)
		.all();
	const tagMap = tagsForPages(rows.map((r) => r.id));
	return { total, rows: rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] })) };
}

/** Suggerimenti per il collegamento [[...]] mentre si scrive. */
export function suggestPages(q: string, u: Viewer | null, limit = 8) {
	const like = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
	return getDb()
		.select({ slug: pages.slug, title: pages.title })
		.from(pages)
		.where(and(visibleTo(u), sql`${pages.title} LIKE ${like} ESCAPE '\\'`))
		.orderBy(sql`CASE WHEN ${pages.title} LIKE ${q.replace(/[\\%_]/g, (c) => '\\' + c) + '%'} ESCAPE '\\' THEN 0 ELSE 1 END`, sql`${pages.title} COLLATE NOCASE`)
		.limit(limit)
		.all();
}

/**
 * Le pagine da scegliere nei campi «Pagina collegata» (pin, eventi), per titolo. Se due pagine si chiamano
 * uguale, ad esempio dopo aver importato un pacchetto mondo, si aggiunge l'indirizzo: «Elminster (elminster-2)».
 */
export function pageChoices(u: Viewer | null) {
	const rows = getDb()
		.select({ id: pages.id, slug: pages.slug, title: pages.title })
		.from(pages)
		.where(visibleTo(u))
		.orderBy(sql`${pages.title} COLLATE NOCASE`, pages.id)
		.all();
	const count = new Map<string, number>();
	for (const r of rows) count.set(r.title.toLowerCase(), (count.get(r.title.toLowerCase()) ?? 0) + 1);
	return rows.map((r) => ({ id: r.id, slug: r.slug, label: count.get(r.title.toLowerCase())! > 1 ? `${r.title} (${r.slug})` : r.title }));
}

/** La pagina scritta in un campo «Pagina collegata»: un nome dell'elenco, oppure un titolo o un indirizzo. */
export function findPageChoice(text: string, u: Viewer | null) {
	if (!text) return undefined;
	const choices = pageChoices(u);
	const key = text.toLowerCase();
	const slug = slugify(text);
	// Col solo titolo, tra due pagine omonime vince la prima (quella che ha l'indirizzo senza numero).
	return choices.find((c) => c.label.toLowerCase() === key) ?? choices.find((c) => c.slug === slug);
}

export function pageMeta(page: PageRow) {
	const db = getDb();
	const name = (id: number | null) =>
		id ? (db.select({ n: users.displayName }).from(users).where(eq(users.id, id)).get()?.n ?? null) : null;
	return {
		author: name(page.authorId),
		editor: name(page.updatedBy),
		tags: tagsForPages([page.id]).get(page.id) ?? []
	};
}

// --- Cestino ---

/** Pagine eliminate che chi guarda può recuperare: il Master tutte (tranne le personali altrui), il giocatore le sue. */
export function listTrash(u: Viewer) {
	const mine = sql`${pages.authorId} = ${u.id}`;
	const cond = isMaster(u) ? sql`(${pages.visibility} <> 'personal' OR ${mine})` : sql`(${mine} AND ${pages.hasSecret} = 0)`;
	return getDb()
		.select({ id: pages.id, slug: pages.slug, title: pages.title, deletedAt: pages.deletedAt, visibility: pages.visibility })
		.from(pages)
		.where(and(sql`${pages.deletedAt} IS NOT NULL`, cond))
		.orderBy(desc(pages.deletedAt))
		.all();
}

export function getDeletedPage(id: number) {
	return getDb()
		.select()
		.from(pages)
		.where(and(eq(pages.id, id), sql`${pages.deletedAt} IS NOT NULL`))
		.get();
}

export function restorePage(id: number) {
	const p = getDeletedPage(id);
	if (!p) return;
	getDb().transaction(() => {
		getDb().update(pages).set({ deletedAt: null }).where(eq(pages.id, id)).run();
		writeIndex(id, p.title, isDoc(p.content) ? p.content : EMPTY_DOC, p.fields ?? []);
		syncSessionEvent(p, p.session ?? null);
	});
}

/** Elimina per sempre (con versioni e collegamenti). */
export function purgePage(id: number) {
	getDb().transaction(() => {
		getSqlite().prepare('DELETE FROM pages_fts WHERE rowid = ?').run(id);
		getDb().delete(pages).where(and(eq(pages.id, id), sql`${pages.deletedAt} IS NOT NULL`)).run();
	});
}

// --- Versioni ---

export type RevisionRow = typeof pageRevisions.$inferSelect;

/** Versioni che chi guarda può vedere (non quelle di quando la pagina era nascosta per lui). */
export function listRevisions(page: PageRow, u: Viewer | null) {
	return getDb()
		.select({
			id: pageRevisions.id,
			title: pageRevisions.title,
			visibility: pageRevisions.visibility,
			createdAt: pageRevisions.createdAt,
			editor: users.displayName
		})
		.from(pageRevisions)
		.leftJoin(users, eq(users.id, pageRevisions.editedBy))
		.where(eq(pageRevisions.pageId, page.id))
		.orderBy(desc(pageRevisions.id))
		.all()
		.filter((r) => canView({ visibility: r.visibility, authorId: page.authorId, playersCanEdit: false, hasSecret: false }, u));
}

export function getRevision(page: PageRow, id: number, u: Viewer | null): RevisionRow | undefined {
	const r = getDb()
		.select()
		.from(pageRevisions)
		.where(and(eq(pageRevisions.id, id), eq(pageRevisions.pageId, page.id)))
		.get();
	return r && canView({ visibility: r.visibility, authorId: page.authorId, playersCanEdit: false, hasSecret: false }, u) ? r : undefined;
}

/** Testo di una versione per il confronto: chi non è Master non vede i segreti. */
export function revisionText(r: Pick<RevisionRow, 'title' | 'content' | 'fields'>, u: Viewer | null): string {
	const ex = extract(isDoc(r.content) ? r.content : EMPTY_DOC, r.fields ?? []);
	const parts = [r.title, '', ex.body];
	if (isMaster(u) && ex.secretBody) parts.push('', '🔒', ex.secretBody);
	return parts.join('\n');
}

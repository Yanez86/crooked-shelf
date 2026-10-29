import { and, eq, sql, type SQL } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { getCalendar } from './settings.ts';
import { dayNumber, validDate, type Calendar } from '../calendar.ts';
import { isMaster, type Viewer } from '../access.ts';
import type { SessionInfo, WorldDate } from '../content/types.ts';
import type { PageRow } from './pages.ts';

const { timelineEvents: ev, pages } = schema;

export type Timeline = 'world' | 'campaign';
export const TIMELINES: Timeline[] = ['world', 'campaign'];
export type EventVisibility = 'public' | 'players' | 'master';
export type EventRow = typeof ev.$inferSelect;

export function eventVisibleTo(u: Viewer | null): SQL {
	if (!u) return sql`${ev.visibility} = 'public'`;
	return isMaster(u) ? sql`1=1` : sql`${ev.visibility} IN ('public','players')`;
}

export const canSeeEvent = (e: { visibility: string }, u: Viewer | null) =>
	e.visibility === 'public' || (!!u && (e.visibility === 'players' || isMaster(u)));

/** Chi può modificare un evento: Master/Admin, oppure chi l'ha scritto (eventi della campagna). */
export const canEditEvent = (e: Pick<EventRow, 'createdBy' | 'source' | 'visibility'>, u: Viewer | null) =>
	!!u && e.source === 'manual' && (isMaster(u) || (e.createdBy === u.id && e.visibility !== 'master'));

/** Il Master scrive nella cronologia del mondo; in quella della campagna anche i giocatori. */
export const canAdd = (tl: Timeline, u: Viewer | null) => !!u && (tl === 'campaign' || isMaster(u));

export const sortKey = (cal: Calendar, d: WorldDate | null) => (d ? dayNumber(cal, d) : null);

export function listEvents(timeline: Timeline, u: Viewer | null) {
	const order =
		timeline === 'world'
			? [sql`${ev.sortKey}`, sql`${ev.id}`]
			: [sql`${ev.realDate} IS NULL`, sql`${ev.realDate}`, sql`${ev.sortKey} IS NULL`, sql`${ev.sortKey}`, sql`${ev.id}`];
	return getDb()
		.select({
			id: ev.id,
			title: ev.title,
			description: ev.description,
			year: ev.year,
			month: ev.month,
			day: ev.day,
			approx: ev.approx,
			realDate: ev.realDate,
			source: ev.source,
			visibility: ev.visibility,
			createdBy: ev.createdBy,
			pageSlug: pages.slug,
			pageTitle: pages.title,
			pageVisibility: pages.visibility,
			pageAuthor: pages.authorId
		})
		.from(ev)
		.leftJoin(pages, and(eq(pages.id, ev.pageId), sql`${pages.deletedAt} IS NULL`))
		.where(and(eq(ev.timeline, timeline), eventVisibleTo(u)))
		.orderBy(...order)
		.all();
}

export function getEvent(id: number) {
	return getDb().select().from(ev).where(eq(ev.id, id)).get();
}

export interface EventInput {
	timeline: Timeline;
	title: string;
	description: string;
	date: WorldDate | null;
	approx: string;
	realDate: string | null;
	pageId: number | null;
	visibility: EventVisibility;
}

export const REAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Controlla un evento; restituisce la chiave dell'errore o null. */
export function checkEvent(e: EventInput, cal: Calendar): string | null {
	if (!e.title) return 'errors.titleRequired';
	if (e.date && !validDate(cal, e.date)) return 'timeline.errDate';
	if (e.realDate && (!REAL_DATE.test(e.realDate) || Number.isNaN(Date.parse(e.realDate)))) return 'timeline.errRealDate';
	if (e.timeline === 'world' && !e.date) return 'timeline.errNeedYear';
	if (e.timeline === 'campaign' && !e.date && !e.realDate) return 'timeline.errNeedAnyDate';
	return null;
}

export function saveEvent(e: EventInput, userId: number, id?: number): number {
	const cal = getCalendar();
	const now = Date.now();
	const values = {
		timeline: e.timeline,
		title: e.title,
		description: e.description,
		year: e.date?.year ?? null,
		month: e.date?.month ?? null,
		day: e.date?.day ?? null,
		approx: e.approx,
		sortKey: sortKey(cal, e.date),
		realDate: e.realDate,
		pageId: e.pageId,
		visibility: e.visibility,
		updatedAt: now
	};
	if (id) {
		getDb().update(ev).set(values).where(eq(ev.id, id)).run();
		return id;
	}
	return getDb()
		.insert(ev)
		.values({ ...values, source: 'manual', createdBy: userId, createdAt: now })
		.returning({ id: ev.id })
		.get().id;
}

export function deleteEvent(id: number) {
	getDb().delete(ev).where(eq(ev.id, id)).run();
}

/** Il resoconto di sessione tiene aggiornata la sua voce nella cronologia della campagna. */
export function syncSessionEvent(page: Pick<PageRow, 'id' | 'title' | 'visibility' | 'authorId'>, session: SessionInfo | null) {
	const db = getDb();
	const existing = db
		.select({ id: ev.id })
		.from(ev)
		.where(and(eq(ev.pageId, page.id), eq(ev.source, 'session')))
		.get();
	if (!session || page.visibility === 'personal' || (!session.realDate && !session.world)) {
		if (existing) db.delete(ev).where(eq(ev.id, existing.id)).run();
		return;
	}
	const cal = getCalendar();
	const values = {
		title: page.title,
		description: '',
		year: session.world?.year ?? null,
		month: session.world?.month ?? null,
		day: session.world?.day ?? null,
		sortKey: sortKey(cal, session.world),
		realDate: session.realDate,
		visibility: page.visibility as EventVisibility,
		updatedAt: Date.now()
	};
	if (existing) db.update(ev).set(values).where(eq(ev.id, existing.id)).run();
	else
		db.insert(ev)
			.values({
				...values,
				timeline: 'campaign',
				approx: '',
				pageId: page.id,
				source: 'session',
				createdBy: page.authorId,
				createdAt: Date.now()
			})
			.run();
}

/** Dopo un cambio di calendario l'ordine degli eventi va ricalcolato. */
export function recomputeSortKeys(cal: Calendar) {
	const db = getDb();
	const rows = db.select({ id: ev.id, year: ev.year, month: ev.month, day: ev.day }).from(ev).all();
	db.transaction((tx) => {
		for (const r of rows) {
			const d = r.year === null ? null : { year: r.year, month: r.month, day: r.day };
			tx.update(ev).set({ sortKey: sortKey(cal, d) }).where(eq(ev.id, r.id)).run();
		}
	});
}

/** Eventi collegati a una pagina (per mostrarli nella pagina). */
export function eventsForPage(pageId: number, u: Viewer | null) {
	return getDb()
		.select({ id: ev.id, timeline: ev.timeline, title: ev.title, year: ev.year, month: ev.month, day: ev.day, approx: ev.approx, realDate: ev.realDate })
		.from(ev)
		.where(and(eq(ev.pageId, pageId), eventVisibleTo(u)))
		.orderBy(sql`${ev.sortKey}`)
		.all();
}

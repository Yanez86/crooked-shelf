import { and, asc, eq, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { getDb, schema } from './db/index.ts';
import { getCalendar } from './settings.ts';
import { visibleTo } from './visibility.ts';
import { pageInCampaign } from './campaigns.ts';
import { dayNumber, validDate, type Calendar } from '../calendar.ts';
import { canView, isMaster, type Viewer } from '../access.ts';
import type { TimelineMode } from '../pageKinds.ts';
import type { SessionInfo, WorldDate } from '../content/types.ts';
import type { PageRow } from './pages.ts';

const { timelineEvents: ev, timelines, pages } = schema;

export type EventVisibility = 'public' | 'players' | 'master';
export type EventRow = typeof ev.$inferSelect;

/** Una pagina «cronologia»: l'id della pagina e il modo (mondo o campagna). */
export interface TimelineRef {
	id: number;
	mode: TimelineMode;
}

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
export const canAdd = (mode: TimelineMode, u: Viewer | null) => !!u && (mode === 'campaign' || isMaster(u));

export const sortKey = (cal: Calendar, d: WorldDate | null) => (d ? dayNumber(cal, d) : null);

export function getTimeline(pageId: number): TimelineRef | undefined {
	const r = getDb().select().from(timelines).where(eq(timelines.pageId, pageId)).get();
	return r ? { id: r.pageId, mode: r.mode } : undefined;
}

export function setTimelineMode(pageId: number, mode: TimelineMode) {
	getDb().insert(timelines).values({ pageId, mode }).onConflictDoUpdate({ target: timelines.pageId, set: { mode } }).run();
}

/** Le pagine «cronologia» che chi guarda può vedere, per titolo (con `mode` le sole del mondo o della campagna). */
export function listTimelines(u: Viewer | null, mode?: TimelineMode) {
	return getDb()
		.select({ id: pages.id, slug: pages.slug, title: pages.title, mode: timelines.mode })
		.from(timelines)
		.innerJoin(pages, eq(pages.id, timelines.pageId))
		.where(and(visibleTo(u), mode ? eq(timelines.mode, mode) : undefined))
		.orderBy(sql`${pages.title} COLLATE NOCASE`, asc(pages.id))
		.all();
}

/** Gli eventi di una cronologia; in quelle della campagna anche le voci dei resoconti di sessione. */
const eventsOf = (tl: TimelineRef): SQL =>
	tl.mode === 'campaign' ? or(eq(ev.timelineId, tl.id), and(eq(ev.source, 'session'), pageInCampaign(ev.pageId)))! : eq(ev.timelineId, tl.id);

export function listEvents(tl: TimelineRef, u: Viewer | null) {
	const order =
		tl.mode === 'world'
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
		.where(and(eventsOf(tl), eventVisibleTo(u)))
		.orderBy(...order)
		.all();
}

export function getEvent(id: number) {
	return getDb().select().from(ev).where(eq(ev.id, id)).get();
}

export interface EventInput {
	timelineId: number;
	title: string;
	description: string;
	date: WorldDate | null;
	approx: string;
	realDate: string | null;
	pageId: number | null;
	visibility: EventVisibility;
}

export const REAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Controlla un evento della cronologia di quel modo; restituisce la chiave dell'errore o null. */
export function checkEvent(e: Omit<EventInput, 'timelineId'>, mode: TimelineMode, cal: Calendar): string | null {
	if (!e.title) return 'errors.titleRequired';
	if (e.date && !validDate(cal, e.date)) return 'timeline.errDate';
	if (e.realDate && (!REAL_DATE.test(e.realDate) || Number.isNaN(Date.parse(e.realDate)))) return 'timeline.errRealDate';
	if (mode === 'world' && !e.date) return 'timeline.errNeedYear';
	if (mode === 'campaign' && !e.date && !e.realDate) return 'timeline.errNeedAnyDate';
	return null;
}

export function saveEvent(e: EventInput, userId: number, id?: number): number {
	const cal = getCalendar();
	const now = Date.now();
	const values = {
		timelineId: e.timelineId,
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

/** Il resoconto di sessione tiene aggiornata la sua voce, che compare nelle cronologie della campagna. */
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
				timelineId: null,
				approx: '',
				pageId: page.id,
				source: 'session',
				createdBy: page.authorId,
				createdAt: Date.now()
			})
			.run();
}

/** Dopo un cambio di calendario l'ordine degli eventi della campagna va ricalcolato. */
export function recomputeSortKeys(cal: Calendar) {
	const db = getDb();
	const rows = db.select({ id: ev.id, year: ev.year, month: ev.month, day: ev.day }).from(ev).where(or(pageInCampaign(ev.timelineId), pageInCampaign(ev.pageId))).all();
	db.transaction((tx) => {
		for (const r of rows) {
			const d = r.year === null ? null : { year: r.year, month: r.month, day: r.day };
			tx.update(ev).set({ sortKey: sortKey(cal, d) }).where(eq(ev.id, r.id)).run();
		}
	});
}

/**
 * Eventi collegati a una pagina (per mostrarli nella pagina), con la cronologia dove si trovano.
 * Le voci dei resoconti portano alla prima cronologia della campagna che chi guarda può vedere.
 */
export function eventsForPage(pageId: number, u: Viewer | null) {
	const tl = alias(pages, 'tl');
	const rows = getDb()
		.select({
			id: ev.id,
			title: ev.title,
			year: ev.year,
			month: ev.month,
			day: ev.day,
			approx: ev.approx,
			realDate: ev.realDate,
			source: ev.source,
			tlSlug: tl.slug,
			tlTitle: tl.title,
			tlVisibility: tl.visibility,
			tlAuthor: tl.authorId,
			tlDeleted: tl.deletedAt
		})
		.from(ev)
		.leftJoin(tl, eq(tl.id, ev.timelineId))
		.where(and(eq(ev.pageId, pageId), eventVisibleTo(u)))
		.orderBy(sql`${ev.sortKey}`)
		.all();
	const campaign = rows.some((r) => r.source === 'session') ? listTimelines(u, 'campaign')[0] : undefined;
	return rows.flatMap((r) => {
		const where =
			r.source === 'session'
				? campaign && { slug: campaign.slug, title: campaign.title }
				: r.tlSlug && r.tlDeleted === null && canView({ visibility: r.tlVisibility!, authorId: r.tlAuthor, playersCanEdit: false, hasSecret: false }, u)
					? { slug: r.tlSlug, title: r.tlTitle! }
					: undefined;
		return where ? [{ id: r.id, title: r.title, year: r.year, month: r.month, day: r.day, approx: r.approx, realDate: r.realDate, timeline: where }] : [];
	});
}

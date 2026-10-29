import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';
import { str } from './forms.ts';
import { readWorldDate } from './pageForm.ts';
import { checkEvent, type EventInput, type EventVisibility, type Timeline } from './timeline.ts';
import { canView, isMaster, type Viewer } from '../access.ts';
import { slugify } from '../slug.ts';
import type { Calendar } from '../calendar.ts';

/** Pagina collegata a un evento: si scrive il titolo, si cerca tra quelle visibili. */
export function findPageByTitle(title: string, u: Viewer | null) {
	if (!title) return null;
	const { pages } = schema;
	const row = getDb()
		.select()
		.from(pages)
		.where(and(sql`${pages.deletedAt} IS NULL`, sql`(${pages.title} = ${title} COLLATE NOCASE OR ${pages.slug} = ${slugify(title)})`))
		.get();
	return row && canView(row, u) ? row : null;
}

export function eventVisibilities(u: Viewer | null): EventVisibility[] {
	return isMaster(u) ? ['public', 'players', 'master'] : ['public', 'players'];
}

export function readEventForm(f: FormData, timeline: Timeline, u: Viewer, cal: Calendar) {
	const date = readWorldDate(f, 'date', cal);
	const pageTitle = str(f, 'page', 200);
	const page = findPageByTitle(pageTitle, u);
	const vis = str(f, 'visibility') as EventVisibility;
	const input: EventInput = {
		timeline,
		title: str(f, 'title', 200),
		description: str(f, 'description', 2000),
		date: date ?? null,
		approx: str(f, 'approx', 100),
		realDate: timeline === 'campaign' ? str(f, 'realDate', 10) || null : null,
		pageId: page?.id ?? null,
		visibility: eventVisibilities(u).includes(vis) ? vis : 'players'
	};
	const values = { ...input, page: pageTitle };
	let error: string | null = date === undefined ? 'timeline.errDate' : checkEvent(input, cal);
	if (!error && pageTitle && !page) error = 'timeline.errPage';
	return { input, values, error };
}

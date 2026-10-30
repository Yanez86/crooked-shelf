import { fail } from '@sveltejs/kit';
import { canView, type Viewer } from '../access.ts';
import { canAdd, canEditEvent, getTimeline, listEvents, saveEvent } from './timeline.ts';
import { getCalendar } from './settings.ts';
import { eventVisibilities, readEventForm } from './eventForm.ts';
import { pageChoices, resolverFor, type PageRow } from './pages.ts';
import { renderInline } from '../content/render.ts';
import { inlineLinks } from '../content/extract.ts';
import { contentLabels } from './pageForm.ts';
import { formatDate, weekday } from '../calendar.ts';
import { hasRule } from './rules/index.ts';

/** Quello che serve per mostrare gli eventi di una pagina «cronologia». */
export function timelineView(page: PageRow, u: Viewer | null, locale: string, url: URL) {
	const tl = getTimeline(page.id);
	if (!tl) return null;
	const cal = getCalendar();
	const rows = listEvents(tl, u);
	const resolve = resolverFor(rows.flatMap((r) => inlineLinks(r.description)), u);
	const labels = contentLabels(locale);
	const events = rows.map((r) => {
		const d = r.year !== null ? { year: r.year, month: r.month, day: r.day } : null;
		const pageOk = r.pageSlug && canView({ visibility: r.pageVisibility!, authorId: r.pageAuthor, playersCanEdit: false, hasSecret: false }, u);
		return {
			id: r.id,
			title: r.title,
			html: renderInline(r.description, { resolve, labels, hasRule }),
			when: d ? formatDate(cal, d) : null,
			weekday: d ? weekday(cal, d) : null,
			year: d?.year ?? null,
			yearLabel: d ? formatDate(cal, { year: d.year }) : '',
			ago: d && cal.today ? cal.today.year - d.year : null,
			approx: r.approx,
			realDate: r.realDate,
			page: pageOk ? { slug: r.pageSlug!, title: r.pageTitle! } : null,
			visibility: r.visibility,
			session: r.source === 'session',
			canEdit: canEditEvent(r, u)
		};
	});
	return {
		mode: tl.mode,
		view: url.searchParams.get('view') === 'line' ? ('line' as const) : ('list' as const),
		events,
		calendarName: cal.name,
		months: cal.months,
		today: cal.today ? formatDate(cal, cal.today) : null,
		canAdd: canAdd(tl.mode, u),
		visibilities: eventVisibilities(u),
		pageTitles: u ? pageChoices(u).slice(0, 500).map((c) => c.label) : []
	};
}

/** Nuovo evento: nelle cronologie del mondo il Master, in quelle della campagna anche i giocatori. */
export function addEvent(page: PageRow | undefined, u: Viewer | null, f: FormData) {
	const tl = page?.kind === 'timeline' ? getTimeline(page.id) : undefined;
	if (!tl || !u || !canAdd(tl.mode, u)) return fail(403, { error: 'errors.forbidden', values: null });
	const r = readEventForm(f, tl, u, getCalendar());
	if (r.error) return fail(400, { error: r.error, values: r.values });
	const id = saveEvent(r.input, u.id);
	return { ok: 'timeline.added', id };
}

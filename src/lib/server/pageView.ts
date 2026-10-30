import type { Viewer } from '../access.ts';
import { formatDate } from '../calendar.ts';
import { contentLabels } from './pageForm.ts';
import { renderPage, type PageRow } from './pages.ts';
import { getCalendar } from './settings.ts';

/** Quello che si legge di una pagina: colonna a lato e testo. I segreti restano solo per il Master. */
export function pageView(page: PageRow, u: Viewer | null, locale: string) {
	const rendered = renderPage(page, u, contentLabels(locale));
	const cal = getCalendar();
	return {
		html: rendered.html,
		// Nessun testo (solo paragrafi vuoti): nelle mappe e nelle cronologie il corpo non si mostra.
		blank: !rendered.html.replace(/<p><\/p>/g, '').trim(),
		fields: rendered.fields,
		session: page.session
			? {
					number: page.session.number,
					realDate: page.session.realDate,
					world: page.session.world ? formatDate(cal, page.session.world) : null
				}
			: null
	};
}

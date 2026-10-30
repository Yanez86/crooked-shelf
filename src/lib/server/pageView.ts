import type { Viewer } from '../access.ts';
import { formatDate } from '../calendar.ts';
import { getFile } from './files.ts';
import { contentLabels } from './pageForm.ts';
import { renderPage, type PageRow } from './pages.ts';
import { getCalendar } from './settings.ts';

/** Quello che si legge di una pagina: immagine, scheda e testo. I segreti restano solo per il Master. */
export function pageView(page: PageRow, u: Viewer | null, locale: string) {
	const f = page.imageId ? getFile(page.imageId) : undefined;
	const rendered = renderPage(page, u, contentLabels(locale));
	const cal = getCalendar();
	return {
		image: f ? { url: `/files/${f.id}`, width: f.width, height: f.height } : null,
		html: rendered.html,
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

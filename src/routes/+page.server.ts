import type { PageServerLoad } from './$types';
import { canEdit, canView } from '#lib/access.ts';
import { listPages, pageCover } from '#lib/server/pages.ts';
import { pageView } from '#lib/server/pageView.ts';
import { homePage } from '#lib/server/templates.ts';
import { listMaps } from '#lib/server/maps.ts';
import { listTimelines } from '#lib/server/timeline.ts';
import { tableOf } from '#lib/server/sheets.ts';
import { upcoming } from '#lib/server/schedule.ts';

export const load: PageServerLoad = ({ locals }) => {
	const u = locals.user;
	const found = homePage(u);
	const home = found && canView(found, u) ? found : null;
	// Le ultime pagine: niente template, e niente home, che è già qui.
	const recent = { limit: 5, noTemplates: true, exclude: found?.id };
	const { total, rows } = listPages(u, recent);
	return {
		home: home && {
			page: { slug: home.slug, title: home.title, icon: home.icon, cover: pageCover(home) },
			...pageView(home, u, locals.locale),
			canEdit: canEdit(home, u)
		},
		total,
		// Nessuna pagina scritta: la home, le cronologie preparate alla creazione della wiki e le schede giocatore non contano.
		empty: listPages(u, { kind: 'page', limit: 1, exclude: found?.id, noSheets: true }).total === 0,
		// Chi è al tavolo: il Master e i giocatori, con le loro schede (non per i visitatori).
		table: tableOf(u),
		// Gli appuntamenti, come la pagina Appuntamenti: per chi ha un account nella campagna.
		schedule: u && locals.campaign ? upcoming(u.id) : null,
		recent: rows,
		added: listPages(u, { ...recent, sort: 'created' }).rows,
		world: [
			...listMaps(u).filter((m) => m.parentId === null).map(({ slug, title }) => ({ slug, title, kind: 'map' })),
			...listTimelines(u).map(({ slug, title }) => ({ slug, title, kind: 'timeline' }))
		]
	};
};

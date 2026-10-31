import type { LayoutServerLoad } from './$types';
import { getSettings } from '#lib/server/settings.ts';
import { extraThemes } from '#lib/server/plugins.ts';
import { pageTree } from '#lib/server/taxonomy.ts';
import { listResources } from '#lib/server/resources.ts';
import { extraLocale } from '#lib/i18n/index.ts';
import { themeCss } from '#lib/themes.ts';
import { SIDE_COOKIE, TREE_COOKIE } from '#lib/prefs.ts';

export const load: LayoutServerLoad = ({ locals, cookies, request, depends }) => {
	depends('app:layout');
	const u = locals.user;
	const s = getSettings();
	// Barra a sinistra (pagine, risorse e sezioni): niente titoli a chi non può ancora leggere la wiki (es. nella pagina di accesso).
	const tree = !!u || s.allowVisitors;
	return {
		user: u ? { id: u.id, username: u.username, displayName: u.displayName, role: u.role, icon: u.icon } : null,
		prefs: locals.prefs,
		treeHidden: cookies.get(TREE_COOKIE) === '1',
		sideHidden: cookies.get(SIDE_COOKIE) === '1',
		framed: request.headers.get('sec-fetch-dest') === 'iframe',
		locale: locals.locale,
		siteName: s.siteName,
		campaign: locals.campaign && { id: locals.campaign.id, name: locals.campaign.name },
		campaigns: locals.campaigns.map(({ id, name }) => ({ id, name })),
		version: __APP_VERSION__,
		themeCss: themeCss(extraThemes()),
		// Traduzioni dei plugin per la lingua in uso (il browser non le ha nel pacchetto).
		localeExtra: extraLocale(locals.locale),
		tree: tree ? pageTree(u) : null,
		resources: tree ? listResources(u).map(({ id, title, kind }) => ({ id, title, kind })) : null
	};
};

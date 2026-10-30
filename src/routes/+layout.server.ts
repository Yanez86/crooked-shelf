import type { LayoutServerLoad } from './$types';
import { getSettings } from '#lib/server/settings.ts';
import { extraThemes } from '#lib/server/plugins.ts';
import { pageTree } from '#lib/server/taxonomy.ts';
import { listResources } from '#lib/server/resources.ts';
import { extraLocale } from '#lib/i18n/index.ts';
import { themeCss } from '#lib/themes.ts';

export const load: LayoutServerLoad = ({ locals }) => {
	const u = locals.user;
	const s = getSettings();
	// Albero a sinistra: niente titoli a chi non può ancora leggere la wiki (es. nella pagina di accesso).
	const tree = locals.prefs.tree === 'show' && (u || s.allowVisitors);
	return {
		user: u ? { id: u.id, username: u.username, displayName: u.displayName, role: u.role, icon: u.icon } : null,
		prefs: locals.prefs,
		locale: locals.locale,
		siteName: s.siteName,
		version: __APP_VERSION__,
		themeCss: themeCss(extraThemes()),
		// Traduzioni dei plugin per la lingua in uso (il browser non le ha nel pacchetto).
		localeExtra: extraLocale(locals.locale),
		tree: tree ? pageTree(u) : null,
		resources: tree ? listResources(u).map(({ id, title, kind }) => ({ id, title, kind })) : null
	};
};

import type { LayoutServerLoad } from './$types';
import { getSettings } from '#lib/server/settings.ts';
import { extraThemes } from '#lib/server/plugins.ts';
import { extraLocale } from '#lib/i18n/index.ts';
import { themeCss } from '#lib/themes.ts';

export const load: LayoutServerLoad = ({ locals }) => {
	const u = locals.user;
	const s = getSettings();
	return {
		user: u ? { id: u.id, username: u.username, displayName: u.displayName, role: u.role } : null,
		prefs: locals.prefs,
		locale: locals.locale,
		siteName: s.siteName,
		version: __APP_VERSION__,
		themeCss: themeCss(extraThemes()),
		// Traduzioni dei plugin per la lingua in uso (il browser non le ha nel pacchetto).
		localeExtra: extraLocale(locals.locale)
	};
};

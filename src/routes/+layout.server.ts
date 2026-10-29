import type { LayoutServerLoad } from './$types';
import { customThemes, getSettings } from '#lib/server/settings.ts';
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
		themeCss: themeCss(customThemes())
	};
};

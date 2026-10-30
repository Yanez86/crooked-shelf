import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSession, createUser, findUserByName, hasUsers, setSessionCookie } from '#lib/server/auth.ts';
import { saveSettings } from '#lib/server/settings.ts';
import { checkCredentials, str } from '#lib/server/forms.ts';
import { isLocale, localeNames } from '#lib/i18n/index.ts';
import { seedWiki } from '#lib/server/templates.ts';

export const load: PageServerLoad = ({ locals }) => ({ locales: localeNames(), suggested: locals.locale });

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (hasUsers()) redirect(303, '/');
		const f = await request.formData();
		const siteName = str(f, 'siteName', 80) || 'Crooked Shelf';
		const locale = str(f, 'locale');
		const username = str(f, 'username', 32);
		const displayName = str(f, 'displayName', 60);
		const password = String(f.get('password') ?? '');
		const values = { siteName, locale, username, displayName };

		const err = checkCredentials(username, password, String(f.get('confirm') ?? ''));
		if (err) return fail(400, { error: err, values });
		if (!isLocale(locale)) return fail(400, { error: 'errors.generic', values });
		if (findUserByName(username)) return fail(400, { error: 'errors.usernameTaken', values });

		const id = await createUser({ username, displayName, password, role: 'admin' });
		saveSettings({ siteName, defaultLocale: locale, allowVisitors: false });
		// Template preinstallati e cronologie, nella lingua scelta.
		seedWiki(locale, { id, role: 'admin' });
		const s = createSession(id);
		setSessionCookie(cookies, url, s.token, s.expires);
		redirect(303, '/');
	}
};

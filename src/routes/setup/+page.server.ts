import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSession, countUsers, findUserByName, hashPassword, hasUsers, insertUser, setSessionCookie } from '#lib/server/auth.ts';
import { getDb } from '#lib/server/db/index.ts';
import { checkSetupToken } from '#lib/server/setup.ts';
import { saveSettings } from '#lib/server/settings.ts';
import { FIRST_CAMPAIGN, inCampaign, saveCampaign } from '#lib/server/campaigns.ts';
import { checkCredentials, str } from '#lib/server/forms.ts';
import { hashSlot } from '#lib/server/ratelimit.ts';
import { audit } from '#lib/server/audit.ts';
import { isLocale, localeNames } from '#lib/i18n/index.ts';
import { seedWiki } from '#lib/server/templates.ts';

export const load: PageServerLoad = ({ locals }) => ({ locales: localeNames(), suggested: locals.locale });

export const actions: Actions = {
	default: async ({ request, cookies, url, locals }) => {
		if (hasUsers()) redirect(303, '/');
		const f = await request.formData();
		const siteName = str(f, 'siteName', 80) || 'Crooked Shelf';
		const locale = str(f, 'locale');
		const username = str(f, 'username', 32);
		const displayName = str(f, 'displayName', 60);
		const password = String(f.get('password') ?? '');
		const values = { siteName, locale, username, displayName };

		if (!checkSetupToken(str(f, 'token', 80))) return fail(400, { error: 'setup.badToken', values });
		if (!hashSlot()) return fail(429, { error: 'errors.busy', values });
		const err = checkCredentials(username, password, String(f.get('confirm') ?? ''));
		if (err) return fail(400, { error: err, values });
		if (!isLocale(locale)) return fail(400, { error: 'errors.generic', values });
		if (findUserByName(username)) return fail(400, { error: 'errors.usernameTaken', values });

		// L'hash prima, poi tutto in una transazione: due richieste insieme non creano due amministratori.
		const passwordHash = await hashPassword(password);
		const id = getDb().transaction(() => {
			if (countUsers() > 0) return null;
			const id = insertUser({ username, displayName, role: 'admin' }, passwordHash);
			saveSettings({ siteName, defaultLocale: locale, allowVisitors: false });
			// La prima campagna è di chi installa: template preinstallati e cronologie, nella lingua scelta.
			inCampaign(saveCampaign(FIRST_CAMPAIGN, { name: siteName, masterId: id }), () => seedWiki(locale, { id, role: 'master', admin: true }));
			return id;
		});
		if (id === null) redirect(303, '/');
		audit('setup', { userId: id, ip: locals.ip }, username);
		const s = createSession(id);
		setSessionCookie(cookies, url, s.token, s.expires);
		redirect(303, '/');
	}
};

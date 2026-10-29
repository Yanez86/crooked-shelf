import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { cleanPrefs, PREFS_COOKIE, PREF_OPTIONS } from '#lib/prefs.ts';
import { isLocale, localeNames } from '#lib/i18n/index.ts';
import { getDb, schema } from '#lib/server/db/index.ts';
import { PASSWORD_MIN, deleteUserSessions, createSession, hashPassword, setSessionCookie, verifyPassword } from '#lib/server/auth.ts';
import { str } from '#lib/server/forms.ts';
import { extraThemes } from '#lib/server/plugins.ts';

export const load: PageServerLoad = ({ locals }) => ({
	options: PREF_OPTIONS,
	custom: extraThemes().map(({ id, name, scheme, colors }) => ({ id, name: name ?? id, scheme, colors })),
	locales: localeNames(),
	current: { ...locals.prefs, locale: locals.prefs.locale ?? '' }
});

export const actions: Actions = {
	prefs: async ({ request, locals, cookies, url }) => {
		const f = await request.formData();
		const raw = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
		const prefs = cleanPrefs(raw, isLocale, extraThemes().map((t) => t.id));
		if (!isLocale(raw.locale)) delete prefs.locale;
		if (locals.user) {
			getDb()
				.update(schema.users)
				.set({ prefs: prefs as unknown as Record<string, string> })
				.where(eq(schema.users.id, locals.user.id))
				.run();
		} else {
			cookies.set(PREFS_COOKIE, JSON.stringify(prefs), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: url.protocol === 'https:',
				maxAge: 60 * 60 * 24 * 365
			});
		}
		return { ok: 'prefs.saved', section: 'prefs' };
	},
	profile: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden', section: 'profile' });
		const displayName = str(await request.formData(), 'displayName', 60);
		if (!displayName) return fail(400, { error: 'errors.nameRequired', section: 'profile' });
		getDb().update(schema.users).set({ displayName }).where(eq(schema.users.id, locals.user.id)).run();
		return { ok: 'common.saved', section: 'profile' };
	},
	password: async ({ request, locals, cookies, url }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden', section: 'password' });
		const f = await request.formData();
		const current = String(f.get('current') ?? '');
		const next = String(f.get('password') ?? '');
		const row = getDb().select().from(schema.users).where(eq(schema.users.id, locals.user.id)).get();
		if (!row || !(await verifyPassword(row.passwordHash, current)))
			return fail(400, { error: 'errors.currentPassword', section: 'password' });
		if (next.length < PASSWORD_MIN) return fail(400, { error: 'errors.passwordShort', section: 'password' });
		if (next.length > 256) return fail(400, { error: 'errors.passwordLong', section: 'password' });
		if (next !== String(f.get('confirm') ?? '')) return fail(400, { error: 'errors.passwordMismatch', section: 'password' });
		getDb()
			.update(schema.users)
			.set({ passwordHash: await hashPassword(next) })
			.where(eq(schema.users.id, row.id))
			.run();
		// Chiude le sessioni sugli altri dispositivi.
		deleteUserSessions(row.id);
		const s = createSession(row.id);
		setSessionCookie(cookies, url, s.token, s.expires);
		return { ok: 'prefs.passwordChanged', section: 'password' };
	}
};

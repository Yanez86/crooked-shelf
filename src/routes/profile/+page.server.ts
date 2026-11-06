import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { cleanPrefs, PREFS_COOKIE, PREF_OPTIONS } from '#lib/prefs.ts';
import { isLocale, localeNames } from '#lib/i18n/index.ts';
import { getDb, schema } from '#lib/server/db/index.ts';
import { PASSWORD_MIN, countSessions, deleteOtherSessions, deleteUserSessions, createSession, hashPassword, sessionCookie, setSessionCookie, verifyPassword } from '#lib/server/auth.ts';
import { audit } from '#lib/server/audit.ts';
import { commonPassword } from '#lib/server/forms.ts';
import { str } from '#lib/server/forms.ts';
import { hashSlot } from '#lib/server/ratelimit.ts';
import { addFileUses, deleteFile, saveImage, withinQuota } from '#lib/server/files.ts';
import { extraThemes } from '#lib/server/plugins.ts';
import { PAGE_ICONS } from '#lib/pageIcons.ts';

// Claude si collega da Impostazioni campagna › Claude: è del Master, una campagna per volta.
export const load: PageServerLoad = ({ locals }) => ({
	// Le sessioni aperte (dispositivi e browser), per chiuderle tutte tranne questa.
	sessions: locals.user ? countSessions(locals.user.id) : 0,
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
		const f = await request.formData();
		const displayName = str(f, 'displayName', 60);
		if (!displayName) return fail(400, { error: 'errors.nameRequired', section: 'profile' });
		// Solo le icone che conosciamo; le altre tornano alla sagoma di una persona.
		const icon = String(f.get('icon') ?? '');
		// L'immagine: una nuova sostituisce la vecchia, «togli» torna all'icona; senza nessuna delle due resta com'è.
		const old = locals.user.avatar;
		let avatar = f.get('removeAvatar') ? null : old;
		const file = f.get('avatar');
		if (file instanceof File && file.size > 0) {
			if (!withinQuota(locals.user, file.size)) return fail(400, { error: 'files.quota', section: 'profile' });
			const r = saveImage(Buffer.from(await file.arrayBuffer()), file.name, locals.user.id);
			if (!r.ok) return fail(400, { error: r.error, section: 'profile' });
			avatar = r.file.id;
			addFileUses('avatar', locals.user.id, [avatar]);
		}
		getDb()
			.update(schema.users)
			.set({ displayName, icon: Object.hasOwn(PAGE_ICONS, icon) ? icon : null, avatar })
			.where(eq(schema.users.id, locals.user.id))
			.run();
		if (old && old !== avatar) deleteFile(old);
		return { ok: 'common.saved', section: 'profile' };
	},
	password: async ({ request, locals, cookies, url }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden', section: 'password' });
		const f = await request.formData();
		const current = String(f.get('current') ?? '');
		const next = String(f.get('password') ?? '');
		if (!hashSlot()) return fail(429, { error: 'errors.busy', section: 'password' });
		const row = getDb().select().from(schema.users).where(eq(schema.users.id, locals.user.id)).get();
		if (!row || !(await verifyPassword(row.passwordHash, current)))
			return fail(400, { error: 'errors.currentPassword', section: 'password' });
		if (next.length < PASSWORD_MIN) return fail(400, { error: 'errors.passwordShort', section: 'password' });
		if (next.length > 256) return fail(400, { error: 'errors.passwordLong', section: 'password' });
		if (next !== String(f.get('confirm') ?? '')) return fail(400, { error: 'errors.passwordMismatch', section: 'password' });
		if (commonPassword(next, row.username)) return fail(400, { error: 'errors.passwordCommon', section: 'password' });
		getDb()
			.update(schema.users)
			.set({ passwordHash: await hashPassword(next) })
			.where(eq(schema.users.id, row.id))
			.run();
		// Chiude le sessioni sugli altri dispositivi.
		deleteUserSessions(row.id);
		audit('password_changed', { userId: row.id, ip: locals.ip });
		const s = createSession(row.id);
		setSessionCookie(cookies, url, s.token, s.expires);
		return { ok: 'prefs.passwordChanged', section: 'password' };
	},
	logoutOthers: async ({ locals, cookies, url }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden', section: 'password' });
		const token = cookies.get(sessionCookie(url));
		if (token) deleteOtherSessions(locals.user.id, token);
		audit('sessions_closed', { userId: locals.user.id, ip: locals.ip });
		return { ok: 'prefs.othersClosed', section: 'password' };
	}
};

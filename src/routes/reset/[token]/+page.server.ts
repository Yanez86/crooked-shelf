import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PASSWORD_MIN, createSession, findPasswordReset, redeemPasswordReset, setSessionCookie } from '#lib/server/auth.ts';
import { commonPassword } from '#lib/server/forms.ts';
import { hashSlot } from '#lib/server/ratelimit.ts';
import { audit } from '#lib/server/audit.ts';

/** Nuova password dal link che l'Admin ha dato a chi l'ha dimenticata (Amministrazione › Utenti). */
export const load: PageServerLoad = ({ params }) => {
	const r = findPasswordReset(params.token);
	return { valid: !!r, username: r?.username ?? null };
};

export const actions: Actions = {
	default: async ({ params, request, cookies, url, locals }) => {
		const r = findPasswordReset(params.token);
		if (!r) return fail(400, { error: 'reset.invalid' });
		const f = await request.formData();
		const password = String(f.get('password') ?? '');
		if (password.length < PASSWORD_MIN) return fail(400, { error: 'errors.passwordShort' });
		if (password.length > 256) return fail(400, { error: 'errors.passwordLong' });
		if (password !== String(f.get('confirm') ?? '')) return fail(400, { error: 'errors.passwordMismatch' });
		if (commonPassword(password, r.username)) return fail(400, { error: 'errors.passwordCommon' });
		if (!hashSlot()) return fail(429, { error: 'errors.busy' });
		const id = await redeemPasswordReset(params.token, password);
		if (!id) return fail(400, { error: 'reset.invalid' });
		audit('password_reset', { userId: id, ip: locals.ip });
		const s = createSession(id);
		setSessionCookie(cookies, url, s.token, s.expires);
		redirect(303, '/');
	}
};

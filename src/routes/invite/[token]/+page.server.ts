import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSession, findInvite, findUserByName, redeemInvite, setSessionCookie } from '#lib/server/auth.ts';
import { checkCredentials, str } from '#lib/server/forms.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	if (locals.user) redirect(303, '/');
	const inv = findInvite(params.token);
	return { valid: !!inv, role: inv?.role ?? null };
};

export const actions: Actions = {
	default: async ({ params, request, cookies, url }) => {
		if (!findInvite(params.token)) return fail(400, { error: 'invite.invalid', values: null });
		const f = await request.formData();
		const username = str(f, 'username', 32);
		const displayName = str(f, 'displayName', 60);
		const values = { username, displayName };
		const err = checkCredentials(username, String(f.get('password') ?? ''), String(f.get('confirm') ?? ''));
		if (err) return fail(400, { error: err, values });
		if (findUserByName(username)) return fail(400, { error: 'errors.usernameTaken', values });

		const id = await redeemInvite(params.token, { username, displayName, password: String(f.get('password')) });
		if (!id) return fail(400, { error: 'invite.invalid', values });
		const s = createSession(id);
		setSessionCookie(cookies, url, s.token, s.expires);
		redirect(303, '/');
	}
};

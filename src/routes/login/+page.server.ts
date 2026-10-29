import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	burnTime,
	clearFailures,
	createSession,
	findUserByName,
	isLimited,
	recordFailure,
	setSessionCookie,
	verifyPassword
} from '#lib/server/auth.ts';
import { safeNext, str } from '#lib/server/forms.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const f = await request.formData();
		const username = str(f, 'username', 64);
		const password = String(f.get('password') ?? '');
		const key = `${getClientAddress()}|${username.toLowerCase()}`;

		if (isLimited(key)) return fail(429, { error: 'errors.tooMany', username });
		const user = findUserByName(username);
		const ok = user ? await verifyPassword(user.passwordHash, password) : (await burnTime(password), false);
		if (!user || !ok || user.disabled) {
			recordFailure(key);
			return fail(400, { error: 'errors.login', username });
		}
		clearFailures(key);
		const s = createSession(user.id);
		setSessionCookie(cookies, url, s.token, s.expires);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};

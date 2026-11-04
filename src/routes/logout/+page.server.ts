import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { clearSessionCookie, deleteSession, sessionCookie } from '#lib/server/auth.ts';
import { audit } from '#lib/server/audit.ts';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: ({ cookies, url, locals }) => {
		const token = cookies.get(sessionCookie(url));
		if (token) deleteSession(token);
		clearSessionCookie(cookies, url);
		if (locals.user) audit('logout', { userId: locals.user.id, ip: locals.ip });
		redirect(303, '/login');
	}
};

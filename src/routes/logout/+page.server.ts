import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { SESSION_COOKIE, clearSessionCookie, deleteSession } from '#lib/server/auth.ts';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: ({ cookies }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (token) deleteSession(token);
		clearSessionCookie(cookies);
		redirect(303, '/login');
	}
};

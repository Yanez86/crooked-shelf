import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { createBoard, listBoards } from '#lib/server/boards.ts';
import { str } from '#lib/server/forms.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	const all = listBoards(locals.user);
	return {
		mine: all.filter((b) => b.ownerId === locals.user!.id),
		shared: all.filter((b) => b.ownerId === null),
		canShare: isMaster(locals.user)
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden' });
		const f = await request.formData();
		const title = str(f, 'title', 80);
		if (!title) return fail(400, { error: 'errors.titleRequired' });
		const shared = f.get('kind') === 'shared' && isMaster(locals.user);
		const columns = String(f.get('columns') ?? '')
			.split('\n')
			.map((c) => c.trim().slice(0, 60))
			.filter(Boolean)
			.slice(0, 12);
		const id = createBoard(title, !shared, str(f, 'visibility') === 'master' ? 'master' : 'players', columns.length ? columns : ['—'], locals.user);
		redirect(303, `/boards/${id}`);
	}
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDeletedPage, listTrash, purgePage, restorePage } from '#lib/server/pages.ts';

function allowed(id: number, u: NonNullable<App.Locals['user']>) {
	return listTrash(u).some((p) => p.id === id) ? getDeletedPage(id) : undefined;
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	return { pages: listTrash(locals.user) };
};

export const actions: Actions = {
	restore: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden' });
		const p = allowed(Number((await request.formData()).get('id')), locals.user);
		if (!p) return fail(404, { error: 'errors.generic' });
		restorePage(p.id);
		redirect(303, `/wiki/${p.slug}?restored=1`);
	},
	purge: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden' });
		const f = await request.formData();
		const p = allowed(Number(f.get('id')), locals.user);
		if (!p) return fail(404, { error: 'errors.generic' });
		if (f.get('confirm') !== 'on') return fail(400, { error: 'errors.confirm' });
		purgePage(p.id);
		return { ok: 'trash.purged' };
	}
};

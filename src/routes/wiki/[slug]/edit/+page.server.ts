import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { allowedVisibilities, canEdit, canManage, isMaster } from '#lib/access.ts';
import { deletePage, getPageBySlug, pageCover, pageMeta, updatePage } from '#lib/server/pages.ts';
import { readPageForm } from '#lib/server/pageForm.ts';
import { categoryTree, listTags } from '#lib/server/taxonomy.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { getFile } from '#lib/server/files.ts';

function editable(slug: string, u: App.Locals['user']) {
	const page = getPageBySlug(slug);
	if (!page || !canEdit(page, u)) error(404, 'Not found');
	return page;
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	const page = editable(params.slug, locals.user);
	return {
		page: {
			slug: page.slug,
			title: page.title,
			content: page.content,
			visibility: page.visibility,
			playersCanEdit: page.playersCanEdit,
			categoryId: page.categoryId,
			updatedAt: page.updatedAt,
			tags: pageMeta(page).tags.map((t) => t.name).join(', '),
			// Un riquadro immagine il cui file non c'è più si toglie anche qui.
			fields: (page.fields ?? []).filter((f) => !f.image || getFile(f.image)),
			template: page.template,
			session: page.session ?? null,
			icon: page.icon,
			cover: pageCover(page)
		},
		months: getCalendar().months,
		categories: categoryTree(locals.user).flat.map(({ id, label }) => ({ id, label })),
		visibilities: allowedVisibilities(locals.user),
		canManage: canManage(page, locals.user),
		canSecret: isMaster(locals.user),
		knownTags: listTags(locals.user, true).map((t) => t.name)
	};
};

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden', values: null });
		const page = editable(params.slug, locals.user);
		const f = await request.formData();
		const r = readPageForm(f, locals.user, getCalendar());
		if (!r.ok) return fail(400, { error: r.error, values: r.values });
		// Qualcun altro ha salvato nel frattempo: non sovrascriviamo il suo lavoro.
		if (Number(f.get('updatedAt')) !== page.updatedAt) {
			return fail(409, { error: 'errors.conflict', values: { ...r.input, tags: r.input.tags.join(', '), slug: '', template: r.input.template ?? null } });
		}
		updatePage(page, r.input, locals.user, canManage(page, locals.user));
		redirect(303, `/wiki/${page.slug}`);
	},
	delete: async ({ params, request, locals }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden', values: null });
		const page = editable(params.slug, locals.user);
		if (!canManage(page, locals.user)) return fail(403, { error: 'errors.forbidden', values: null });
		if ((await request.formData()).get('confirm') !== 'on') return fail(400, { error: 'errors.confirm', values: null });
		deletePage(page.id);
		redirect(303, '/wiki?deleted=1');
	}
};

import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { allowedVisibilities, canEdit, canManage, isMaster } from '#lib/access.ts';
import { deletePage, getPageBySlug, pageMeta, setPageImage, updatePage } from '#lib/server/pages.ts';
import { readPageForm } from '#lib/server/pageForm.ts';
import { categoryTree, listTags } from '#lib/server/taxonomy.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { getFile, saveImage } from '#lib/server/files.ts';

function editable(slug: string, u: App.Locals['user']) {
	const page = getPageBySlug(slug);
	if (!page || !canEdit(page, u)) error(404, 'Not found');
	return page;
}

function pageImage(id: string | null) {
	const f = id ? getFile(id) : undefined;
	return f ? { url: `/files/${f.id}`, width: f.width, height: f.height } : null;
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
			fields: page.fields ?? [],
			template: page.template,
			session: page.session ?? null,
			icon: page.icon
		},
		image: pageImage(page.imageId),
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
	},
	// L'immagine si salva subito, senza versione né data di modifica: non va in conflitto con il testo in modifica.
	image: async ({ params, request, locals }) => {
		if (!locals.user) return fail(401, { imageError: 'errors.forbidden' });
		const page = editable(params.slug, locals.user);
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { imageError: 'files.empty' });
		const r = saveImage(Buffer.from(await file.arrayBuffer()), file.name, locals.user.id);
		if (!r.ok) return fail(400, { imageError: r.error });
		setPageImage(page.id, r.file.id);
		return { imageOk: 'pageImage.saved', image: pageImage(r.file.id) };
	},
	removeImage: async ({ params, locals }) => {
		if (!locals.user) return fail(401, { imageError: 'errors.forbidden' });
		const page = editable(params.slug, locals.user);
		setPageImage(page.id, null);
		return { imageOk: 'pageImage.removed', image: null };
	}
};

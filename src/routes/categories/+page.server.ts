import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import {
	categoryTree,
	createCategory,
	deleteCategory,
	getCategory,
	updateCategory,
	validParent
} from '#lib/server/taxonomy.ts';
import { str } from '#lib/server/forms.ts';

export const load: PageServerLoad = ({ locals }) => ({
	categories: categoryTree(locals.user).flat.map(({ id, name, label, slug, depth, count, description, parentId }) => ({
		id,
		name,
		label,
		slug,
		depth,
		count,
		description,
		parentId
	})),
	canManage: isMaster(locals.user)
});

function parent(f: FormData): number | null {
	const n = Number(f.get('parentId'));
	return Number.isInteger(n) && n > 0 && getCategory(n) ? n : null;
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!isMaster(locals.user)) return fail(403, { error: 'errors.forbidden' });
		const f = await request.formData();
		const name = str(f, 'name', 80);
		if (!name) return fail(400, { error: 'errors.nameRequired' });
		createCategory(name, parent(f), str(f, 'description', 500));
		return { ok: 'categories.created' };
	},
	update: async ({ request, locals }) => {
		if (!isMaster(locals.user)) return fail(403, { error: 'errors.forbidden' });
		const f = await request.formData();
		const id = Number(f.get('id'));
		const name = str(f, 'name', 80);
		if (!getCategory(id)) return fail(404, { error: 'errors.generic' });
		if (!name) return fail(400, { error: 'errors.nameRequired' });
		const p = parent(f);
		if (!validParent(id, p)) return fail(400, { error: 'errors.categoryLoop' });
		updateCategory(id, name, p, str(f, 'description', 500));
		return { ok: 'common.saved' };
	},
	delete: async ({ request, locals }) => {
		if (!isMaster(locals.user)) return fail(403, { error: 'errors.forbidden' });
		const f = await request.formData();
		deleteCategory(Number(f.get('id')));
		return { ok: 'categories.deleted' };
	}
};

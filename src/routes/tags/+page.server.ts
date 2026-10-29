import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { deleteTag, isTagColor, listTags, updateTag } from '#lib/server/taxonomy.ts';
import { str } from '#lib/server/forms.ts';
import { TAG_COLORS } from '#lib/roles.ts';

export const load: PageServerLoad = ({ locals }) => {
	const manage = isMaster(locals.user);
	return { tags: listTags(locals.user, manage), canManage: manage, colors: [...TAG_COLORS] };
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		if (!isMaster(locals.user)) return fail(403, { error: 'errors.forbidden' });
		const f = await request.formData();
		const name = str(f, 'name', 40);
		const color = str(f, 'color');
		if (!name) return fail(400, { error: 'errors.nameRequired' });
		if (!isTagColor(color)) return fail(400, { error: 'errors.generic' });
		try {
			updateTag(Number(f.get('id')), name, color);
		} catch {
			return fail(400, { error: 'errors.tagTaken' });
		}
		return { ok: 'common.saved' };
	},
	delete: async ({ request, locals }) => {
		if (!isMaster(locals.user)) return fail(403, { error: 'errors.forbidden' });
		deleteTag(Number((await request.formData()).get('id')));
		return { ok: 'tags.deleted' };
	}
};

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { allowedVisibilities, isMaster } from '#lib/access.ts';
import { createPage } from '#lib/server/pages.ts';
import { readPageForm } from '#lib/server/pageForm.ts';
import { categoryTree, listTags } from '#lib/server/taxonomy.ts';
import { slugify } from '#lib/slug.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	const title = (url.searchParams.get('title') ?? '').slice(0, 200);
	const slug = slugify(url.searchParams.get('slug') ?? '', '');
	const cat = Number(url.searchParams.get('category'));
	return {
		title,
		slug,
		categoryId: Number.isInteger(cat) && cat > 0 ? cat : null,
		categories: categoryTree(locals.user).flat.map(({ id, label }) => ({ id, label })),
		visibilities: allowedVisibilities(locals.user),
		canSecret: isMaster(locals.user),
		knownTags: listTags(locals.user, true).map((t) => t.name)
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden', values: null });
		const r = readPageForm(await request.formData(), locals.user);
		if (!r.ok) return fail(400, { error: r.error, values: r.values });
		const page = createPage(r.input, locals.user);
		redirect(303, `/wiki/${page.slug}`);
	}
};

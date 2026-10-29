import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { allowedVisibilities, isMaster } from '#lib/access.ts';
import { createPage } from '#lib/server/pages.ts';
import { readPageForm } from '#lib/server/pageForm.ts';
import { categoryTree, listTags } from '#lib/server/taxonomy.ts';
import { getTemplate, listTemplates } from '#lib/server/templates.ts';
import { getCalendar } from '#lib/server/settings.ts';
import { slugify } from '#lib/slug.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	const title = (url.searchParams.get('title') ?? '').slice(0, 200);
	const slug = slugify(url.searchParams.get('slug') ?? '', '');
	const cat = Number(url.searchParams.get('category'));
	const key = url.searchParams.get('template');
	const template = key && key !== 'none' ? getTemplate(key, locals.locale) : undefined;
	const chosen = key === 'none' || !!template;

	return {
		title,
		slug,
		categoryId: Number.isInteger(cat) && cat > 0 ? cat : null,
		chosen,
		templates: chosen ? [] : listTemplates(locals.locale).map(({ key, name, description, builtin }) => ({ key, name, description, builtin })),
		template: template
			? {
					key: template.key,
					name: template.name,
					content: template.content,
					fields: template.fields.map((label) => ({ label, value: '' })),
					session: template.session
				}
			: null,
		today: new Date().toISOString().slice(0, 10),
		months: getCalendar().months,
		categories: categoryTree(locals.user).flat.map(({ id, label }) => ({ id, label })),
		visibilities: allowedVisibilities(locals.user),
		canSecret: isMaster(locals.user),
		knownTags: listTags(locals.user, true).map((t) => t.name)
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'errors.forbidden', values: null });
		const r = readPageForm(await request.formData(), locals.user, getCalendar());
		if (!r.ok) return fail(400, { error: r.error, values: r.values });
		const page = createPage(r.input, locals.user);
		redirect(303, `/wiki/${page.slug}`);
	}
};

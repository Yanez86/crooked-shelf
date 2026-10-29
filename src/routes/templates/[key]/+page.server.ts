import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { deleteTemplate, getTemplate, parseFieldNames, saveTemplate } from '#lib/server/templates.ts';
import { str } from '#lib/server/forms.ts';
import { EMPTY_DOC, isDoc } from '#lib/content/types.ts';

/** "new" oppure "c:<id>" (i template preinstallati non si modificano). */
function customId(key: string): number | null {
	if (key === 'new') return null;
	const m = /^c:(\d+)$/.exec(key);
	if (!m) error(404, 'Not found');
	return Number(m[1]);
}

export const load: PageServerLoad = ({ params, locals }) => {
	if (!isMaster(locals.user)) error(404, 'Not found');
	const id = customId(params.key);
	const tpl = id ? getTemplate(params.key, locals.locale) : undefined;
	if (id && !tpl) error(404, 'Not found');
	return {
		isNew: !id,
		values: tpl
			? { name: tpl.name, description: tpl.description, fields: tpl.fields.join('\n'), session: tpl.session, content: tpl.content }
			: { name: '', description: '', fields: '', session: false, content: EMPTY_DOC }
	};
};

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		if (!isMaster(locals.user)) error(404, 'Not found');
		const id = customId(params.key);
		const f = await request.formData();
		let content: unknown = null;
		try {
			content = JSON.parse(String(f.get('content') ?? ''));
		} catch {
			content = null;
		}
		const values = {
			name: str(f, 'name', 80),
			description: str(f, 'description', 300),
			fields: parseFieldNames(String(f.get('fieldNames') ?? '')),
			session: f.get('session') === 'on',
			content: isDoc(content) ? content : EMPTY_DOC
		};
		if (!values.name) return fail(400, { error: 'errors.nameRequired', values: { ...values, fields: values.fields.join('\n') } });
		saveTemplate(values, locals.user!.id, id ?? undefined);
		redirect(303, '/templates?ok=saved');
	},
	delete: async ({ params, locals }) => {
		if (!isMaster(locals.user)) error(404, 'Not found');
		const id = customId(params.key);
		if (id) deleteTemplate(id);
		redirect(303, '/templates?ok=deleted');
	}
};

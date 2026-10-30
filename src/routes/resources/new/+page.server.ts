import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { saveResourceFile } from '#lib/server/files.ts';
import { createResource, readResourceForm } from '#lib/server/resources.ts';

export const load: PageServerLoad = ({ locals }) => {
	if (!isMaster(locals.user)) error(404, 'Not found');
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!isMaster(locals.user)) error(404, 'Not found');
		const f = await request.formData();
		const file = f.get('file');
		const name = file instanceof File ? file.name : '';
		const { input, error: invalid } = readResourceForm(f, name);
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'files.empty', values: input });
		if (invalid) return fail(400, { error: invalid, values: input });
		const saved = saveResourceFile(Buffer.from(await file.arrayBuffer()), name, locals.user!.id);
		if (!saved.ok) return fail(400, { error: saved.error, values: input });
		redirect(303, `/resources/${createResource(input, saved.file.id, locals.user!.id)}`);
	}
};

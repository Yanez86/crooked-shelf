import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { saveResourceFile } from '#lib/server/files.ts';
import { deleteResource, getResource, readResourceForm, updateResource } from '#lib/server/resources.ts';

function masterResource(id: string, u: App.Locals['user']) {
	const r = isMaster(u) ? getResource(Number(id), u) : undefined;
	if (!r) error(404, 'Not found');
	return r;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const r = masterResource(params.id, locals.user);
	return { id: r.id, values: { title: r.title, description: r.description, visibility: r.visibility } };
};

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const r = masterResource(params.id, locals.user);
		const f = await request.formData();
		const { input, error: invalid } = readResourceForm(f);
		if (invalid) return fail(400, { error: invalid, values: input });
		const file = f.get('file');
		let fileId: string | undefined;
		if (file instanceof File && file.size > 0) {
			const saved = saveResourceFile(Buffer.from(await file.arrayBuffer()), file.name, locals.user!.id);
			if (!saved.ok) return fail(400, { error: saved.error, values: input });
			fileId = saved.file.id;
		}
		updateResource(r.id, input, fileId);
		redirect(303, `/resources/${r.id}`);
	},
	delete: async ({ params, request, locals }) => {
		const r = masterResource(params.id, locals.user);
		if ((await request.formData()).get('confirm') !== 'on') return fail(400, { error: 'errors.confirm', values: null });
		deleteResource(r.id);
		redirect(303, '/resources?deleted=1');
	}
};

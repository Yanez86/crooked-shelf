import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { renameFile, saveResourceFile } from '#lib/server/files.ts';
import { resourceEntry } from '#lib/server/gallery.ts';
import { deleteResource, readResourceForm, updateResource } from '#lib/server/resources.ts';

function masterResource(id: string, u: App.Locals['user']) {
	const r = isMaster(u) ? resourceEntry(id, u) : undefined;
	if (!r) error(404, 'Not found');
	return r;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const r = masterResource(params.id, locals.user);
	return { id: r.id, wikiImage: typeof r.id === 'string', values: { title: r.title, description: r.description, visibility: r.visibility } };
};

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const r = masterResource(params.id, locals.user);
		const f = await request.formData();
		const { input, error: invalid } = readResourceForm(f);
		if (invalid) return fail(400, { error: invalid, values: input });
		// Un'immagine della wiki non ha una riga tra le risorse: il suo titolo è il nome del file.
		if (typeof r.id === 'string') {
			renameFile(r.id, input.title);
			redirect(303, `/resources/${r.id}`);
		}
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
		// Il file di un'immagine della wiki serve alle pagine che lo usano.
		if (typeof r.id === 'string') error(404, 'Not found');
		if ((await request.formData()).get('confirm') !== 'on') return fail(400, { error: 'errors.confirm', values: null });
		deleteResource(r.id);
		redirect(303, '/resources?deleted=1');
	}
};

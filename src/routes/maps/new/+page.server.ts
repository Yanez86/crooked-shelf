import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { createMap, listMaps } from '#lib/server/maps.ts';
import { readMapForm } from '#lib/server/mapForm.ts';
import { saveImage } from '#lib/server/files.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!isMaster(locals.user)) error(404, 'Not found');
	const parent = Number(url.searchParams.get('parent'));
	return {
		parents: listMaps(locals.user).map(({ id, title }) => ({ id, title })),
		parentId: Number.isInteger(parent) && parent > 0 ? parent : null
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		if (!isMaster(locals.user)) error(404, 'Not found');
		const f = await request.formData();
		const image = f.get('image');
		const probe = readMapForm(f, null);
		if (!(image instanceof File) || image.size === 0) return fail(400, { error: 'files.empty', values: probe.values });
		if (probe.error) return fail(400, { error: probe.error, values: probe.values });
		const saved = saveImage(Buffer.from(await image.arrayBuffer()), image.name, locals.user!.id);
		if (!saved.ok) return fail(400, { error: saved.error, values: probe.values });
		const { input } = readMapForm(f, saved.file.width);
		const map = createMap(input, saved.file, locals.user!.id);
		redirect(303, `/maps/${map.slug}`);
	}
};

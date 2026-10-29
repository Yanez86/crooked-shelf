import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { deleteMap, getMapBySlug, listMaps, updateMap } from '#lib/server/maps.ts';
import { readMapForm } from '#lib/server/mapForm.ts';
import { saveImage } from '#lib/server/files.ts';

function masterMap(slug: string, u: App.Locals['user']) {
	const m = getMapBySlug(slug);
	if (!m || !isMaster(u)) error(404, 'Not found');
	return m;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const m = masterMap(params.slug, locals.user);
	return {
		slug: m.slug,
		values: {
			title: m.title,
			description: m.description,
			visibility: m.visibility,
			parentId: m.parentId,
			across: m.scale ? String(Math.round(m.scale * m.width * 100) / 100) : '',
			unit: m.unit
		},
		parents: listMaps(locals.user)
			.filter((x) => x.id !== m.id)
			.map(({ id, title }) => ({ id, title }))
	};
};

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const m = masterMap(params.slug, locals.user);
		const f = await request.formData();
		const image = f.get('image');
		let file: { id: string; width: number; height: number } | undefined;
		if (image instanceof File && image.size > 0) {
			const saved = saveImage(Buffer.from(await image.arrayBuffer()), image.name, locals.user!.id);
			if (!saved.ok) return fail(400, { error: saved.error, values: readMapForm(f, m.width, m.id).values });
			file = saved.file;
		}
		const r = readMapForm(f, file?.width ?? m.width, m.id);
		if (r.error) return fail(400, { error: r.error, values: r.values });
		updateMap(m.id, r.input, file);
		redirect(303, `/maps/${m.slug}`);
	},
	delete: async ({ params, request, locals }) => {
		const m = masterMap(params.slug, locals.user);
		if ((await request.formData()).get('confirm') !== 'on') return fail(400, { error: 'errors.confirm', values: null });
		deleteMap(m.id);
		redirect(303, '/maps?deleted=1');
	}
};

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { resourceEntry } from '#lib/server/gallery.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	const resource = resourceEntry(params.id, locals.user);
	if (!resource) error(404, 'Not found');
	return { resource, canEdit: isMaster(locals.user) };
};

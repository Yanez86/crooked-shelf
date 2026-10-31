import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { getResource } from '#lib/server/resources.ts';
import { resourceEntries, type ResourceEntry } from '#lib/server/gallery.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	const resource: ResourceEntry | undefined = getResource(Number(params.id), locals.user) ?? resourceEntries(locals.user).find((r) => r.id === params.id);
	if (!resource) error(404, 'Not found');
	return { resource, canEdit: isMaster(locals.user) && !resource.sources };
};

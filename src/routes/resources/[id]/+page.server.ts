import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { getResource } from '#lib/server/resources.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	const resource = getResource(Number(params.id), locals.user);
	if (!resource) error(404, 'Not found');
	return { resource, canEdit: isMaster(locals.user) };
};

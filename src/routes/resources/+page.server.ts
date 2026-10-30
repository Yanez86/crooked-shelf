import type { PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { listResources } from '#lib/server/resources.ts';

export const load: PageServerLoad = ({ locals }) => ({
	resources: listResources(locals.user),
	canCreate: isMaster(locals.user)
});

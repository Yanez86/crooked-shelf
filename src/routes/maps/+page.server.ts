import type { PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { listMaps } from '#lib/server/maps.ts';

export const load: PageServerLoad = ({ locals }) => ({
	maps: listMaps(locals.user),
	canCreate: isMaster(locals.user)
});

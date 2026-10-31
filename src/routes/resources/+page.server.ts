import type { PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { resourceEntries } from '#lib/server/gallery.ts';

export const load: PageServerLoad = ({ locals }) => ({
	resources: resourceEntries(locals.user),
	canCreate: isMaster(locals.user)
});

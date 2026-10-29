import type { PageServerLoad } from './$types';
import { isMaster } from '#lib/access.ts';
import { listTemplates } from '#lib/server/templates.ts';

export const load: PageServerLoad = ({ locals }) => ({
	templates: listTemplates(locals.locale).map(({ key, name, description, fields, builtin, session }) => ({ key, name, description, fields, builtin, session })),
	canManage: isMaster(locals.user)
});

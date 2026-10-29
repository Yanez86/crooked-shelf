import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isAdmin } from '#lib/access.ts';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!isAdmin(locals.user)) error(404, 'Not found');
};

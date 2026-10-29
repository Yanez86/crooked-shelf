import { error } from '@sveltejs/kit';
import { isAdmin } from '../access.ts';

/** Le azioni non passano dal layout: ogni azione dell'amministrazione controlla da sé. */
export function requireAdmin(u: App.Locals['user']) {
	if (!isAdmin(u)) error(404, 'Not found');
	return u!;
}

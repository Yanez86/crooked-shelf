import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { allowedVisibilities, isMaster } from '#lib/access.ts';
import { setVisibility } from '#lib/server/pages.ts';
import type { Visibility } from '#lib/roles.ts';

/** Chi può vedere una pagina, dalla barra a sinistra: `node` (page-<id>), `visibility`, e `branch` per tutto ciò che contiene. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const u = locals.user;
	if (!isMaster(u)) error(403, 'Forbidden');
	const body = await request.json().catch(() => ({}));
	const id = Number(/^page-(\d+)$/.exec(typeof body.node === 'string' ? body.node : '')?.[1]);
	const visibility = body.visibility as Visibility;
	if (!id || !allowedVisibilities(u).includes(visibility)) return json({ error: 'errors.generic' }, { status: 400 });
	const changed = setVisibility(id, visibility, u!, body.branch === true);
	if (changed === null) error(403, 'Forbidden');
	return json({ changed });
};

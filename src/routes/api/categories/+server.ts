import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isMaster } from '#lib/access.ts';
import { createCategory, getCategory } from '#lib/server/taxonomy.ts';

/** Nuova cartella dalla barra a sinistra: nasce già col nome scritto nell'albero. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!isMaster(locals.user)) error(403, 'Forbidden');
	const body = await request.json().catch(() => ({}));
	const name = String(body.name ?? '').trim().slice(0, 80);
	if (!name) return json({ error: 'errors.nameRequired' }, { status: 400 });
	const parent = Number(body.parentId);
	const parentId = Number.isInteger(parent) && parent > 0 && getCategory(parent) ? parent : null;
	const c = createCategory(name, parentId);
	return json({ id: c.id, slug: c.slug });
};

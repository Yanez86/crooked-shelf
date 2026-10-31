import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canEdit, canManage, isMaster } from '#lib/access.ts';
import { deletePage, getPageById, trashFolder } from '#lib/server/pages.ts';
import { isHomePage } from '#lib/server/settings.ts';
import { createDivider, deleteDivider, moveTreeNode } from '#lib/server/taxonomy.ts';
import { nodeKey } from '#lib/tree.ts';

const keyOf = (v: unknown) => (typeof v === 'string' ? v : null);

/** Nuovo divisorio dalla barra a sinistra. */
export const POST: RequestHandler = ({ locals }) => {
	if (!isMaster(locals.user)) error(403, 'Forbidden');
	return json({ key: nodeKey({ type: 'divider', id: createDivider().id }) });
};

/** Sposta una voce dell'albero: `node`, dentro `parent`, prima di `before`. */
export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!isMaster(locals.user)) error(403, 'Forbidden');
	const body = await request.json().catch(() => ({}));
	const node = keyOf(body.node);
	if (!node || !moveTreeNode(locals.user!, node, { parent: keyOf(body.parent), before: keyOf(body.before) })) return json({ error: 'errors.generic' }, { status: 400 });
	return json({ ok: true });
};

/** Le pagine e le cartelle vanno nel cestino, i divisori spariscono. */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const u = locals.user;
	if (!u) error(403, 'Forbidden');
	const body = await request.json().catch(() => ({}));
	const [, type, raw] = /^(folder|page|divider)-(\d+)$/.exec(keyOf(body.node) ?? '') ?? [];
	const id = Number(raw);
	if (type === 'page') {
		const page = getPageById(id);
		if (!page || !canEdit(page, u) || !canManage(page, u) || isHomePage(page.id)) error(403, 'Forbidden');
		deletePage(page.id);
	} else {
		if (!isMaster(u)) error(403, 'Forbidden');
		if (type === 'folder') trashFolder(id, u);
		else if (type === 'divider') deleteDivider(id);
	}
	return json({ ok: true });
};

import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { canView } from '#lib/access.ts';
import { getDb, schema } from '#lib/server/db/index.ts';

/** Gli indirizzi delle bacheche della 0.10 e precedenti: ora le bacheche sono pagine. */
export const GET: RequestHandler = ({ params, locals }) => {
	const id = Number(params.path.split('/')[0]);
	if (!params.path) redirect(308, '/wiki?kind=board');
	const p = Number.isInteger(id)
		? getDb()
				.select({ slug: schema.pages.slug, visibility: schema.pages.visibility, authorId: schema.pages.authorId, deletedAt: schema.pages.deletedAt })
				.from(schema.boards)
				.innerJoin(schema.pages, eq(schema.pages.id, schema.boards.pageId))
				.where(eq(schema.boards.id, id))
				.get()
		: undefined;
	if (!p || p.deletedAt !== null || !canView({ ...p, playersCanEdit: false, hasSecret: false }, locals.user)) error(404, 'Not found');
	redirect(308, `/wiki/${p.slug}`);
};

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPageBySlug } from '#lib/server/pages.ts';
import { applyHexOp, masterHexMap } from '#lib/server/hexPage.ts';

/** Una modifica agli esagoni della mappa (solo il Master): dipingere, togliere, scoprire, spostare il gruppo. */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const map = masterHexMap(getPageBySlug(params.slug), locals.user);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Bad request');
	const r = applyHexOp(map, body as Record<string, unknown>);
	if ('error' in r) return json(r, { status: 400 });
	return json(r);
};

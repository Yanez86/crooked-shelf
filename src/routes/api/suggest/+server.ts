import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { suggestPages } from '#lib/server/pages.ts';

export const GET: RequestHandler = ({ url, locals }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	return json(q ? suggestPages(q, locals.user) : []);
};

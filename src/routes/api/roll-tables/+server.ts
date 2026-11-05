import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { suggestRollTables } from '#lib/server/rollTables.ts';

/** Le tabelle di tiro per il «/» dell'editor (solo quelle che chi scrive può tirare). */
export const GET: RequestHandler = ({ url, locals }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	return json(suggestRollTables(q, locals.user));
};

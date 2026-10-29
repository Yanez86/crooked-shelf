import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchRules } from '#lib/server/rules/index.ts';
import { parseRuleKind } from '#lib/rules/index.ts';

/** Suggerimenti per @ nell'editor. */
export const GET: RequestHandler = ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').slice(0, 80);
	const kind = parseRuleKind(url.searchParams.get('kind') ?? '');
	return json(searchRules(q, kind, 8).map((e) => ({ kind: e.k, key: e.i, name: e.n, summary: e.s })));
};

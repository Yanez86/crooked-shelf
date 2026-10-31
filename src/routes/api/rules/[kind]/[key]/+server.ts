import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRule, ruleHtml } from '#lib/server/rules/index.ts';
import { ruleLinks, ruleTarget } from '#lib/rules/index.ts';
import { backlinks } from '#lib/server/pages.ts';

/** Anteprima di una regola: testo SRD e regole della casa che la citano. */
export const GET: RequestHandler = ({ params, locals }) => {
	const e = getRule(params.kind, params.key);
	if (!e) error(404, 'Not found');
	return json({
		kind: e.k,
		key: e.i,
		name: e.n,
		summary: e.s,
		html: ruleHtml(e),
		links: ruleLinks(e.n),
		pages: backlinks(ruleTarget(e.k, e.n), locals.user)
	});
};

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRule, ruleHtml } from '#lib/server/rules/index.ts';
import { ruleLinks, ruleTarget } from '#lib/rules/index.ts';
import { backlinks } from '#lib/server/pages.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	const e = getRule(params.kind, params.key);
	if (!e) error(404, 'Not found');
	return {
		kind: e.k,
		name: e.n,
		summary: e.s,
		html: ruleHtml(e),
		links: ruleLinks(e.n),
		syntax: `@${e.k}[${e.n}]`,
		pages: backlinks(ruleTarget(e.k, e.n), locals.user)
	};
};

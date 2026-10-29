import type { PageServerLoad } from './$types';
import { ruleCount, searchRules } from '#lib/server/rules/index.ts';
import { parseRuleKind, RULE_KINDS } from '#lib/rules/index.ts';

export const load: PageServerLoad = ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	const kind = parseRuleKind(url.searchParams.get('kind') ?? '');
	const searched = !!q || !!kind;
	return {
		q,
		kind,
		kinds: RULE_KINDS.filter((k) => k !== 'rule'),
		total: ruleCount(),
		results: searched ? searchRules(q, kind, 200).map((e) => ({ kind: e.k, key: e.i, name: e.n, summary: e.s })) : []
	};
};

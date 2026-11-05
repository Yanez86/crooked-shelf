import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rollOnTable } from '#lib/server/rollTables.ts';
import { linkResolver } from '#lib/server/pages.ts';
import { contentLabels } from '#lib/server/pageForm.ts';
import { hasRule } from '#lib/server/rules/index.ts';
import { renderDoc } from '#lib/content/render.ts';
import { isBlockId } from '#lib/content/blocks.ts';
import type { DocNode } from '#lib/content/types.ts';

/**
 * Un tiro su una tabella di tiro, come la vede chi tira. Il risultato arriva come testo dell'editor (`content`, per
 * il «/» e il 🎲) e come HTML (per il pulsante «Tira» nella pagina). Una tabella che non va bene risponde 422 col problema.
 */
export const POST: RequestHandler = ({ params, locals }) => {
	const page = Number(params.page);
	if (!Number.isInteger(page) || !isBlockId(params.block)) error(404, 'Not found');
	const r = rollOnTable(page, params.block, locals.user);
	if (!r) error(404, 'Not found');
	if (!r.ok) return json({ name: r.name, problem: r.problem }, { status: 422 });
	const p: DocNode = { type: 'paragraph', content: r.outcome.content };
	const html = renderDoc(p, { sees: () => true, resolve: linkResolver(p, locals.user), labels: contentLabels(locals.locale), hasRule }).replace(/^<p>|<\/p>$/g, '');
	return json({ name: r.name, ...r.outcome, html });
};

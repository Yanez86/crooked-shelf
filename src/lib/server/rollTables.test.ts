import { beforeEach, describe, expect, it } from 'vitest';
import { useMemoryDb, schema, getDb } from './db/index.ts';
import { createPage, deletePage, getPageById, renderPage, restorePage, updatePage, viewContent } from './pages.ts';
import { rollOnTable, suggestRollTables } from './rollTables.ts';
import type { DocNode } from '../content/types.ts';

const master = { id: 1, role: 'master' as const };
const alice = { id: 2, role: 'player' as const };
const labels = { secret: 'S', note: 'N', tip: 'T', warning: 'W', missing: 'M', roll: 'Tira', rollOn: 'Tira su «{name}»' };

const text = (t: string): DocNode => ({ type: 'text', text: t });
const cell = (type: string, t: string): DocNode => ({ type, content: [t ? { type: 'paragraph', content: [text(t)] } : { type: 'paragraph' }] });
const p = (t: string): DocNode => ({ type: 'paragraph', content: [text(t)] });

function rollTable(name: string, rows: [string, string][], attrs: Record<string, unknown> = {}): DocNode {
	return {
		type: 'table',
		attrs: { roll: true, ...attrs },
		content: [
			{ type: 'tableRow', content: [cell('tableHeader', `d${rows.length}`), cell('tableHeader', name)] },
			...rows.map(([n, r]) => ({ type: 'tableRow', content: [cell('tableCell', n), cell('tableCell', r)] }))
		]
	};
}

const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });
const base = { visibility: 'players' as const, playersCanEdit: false, categoryId: null, tags: [], fields: [], session: null };

const shops = rollTable('Bottega povera', [['1', 'Rigattiere'], ['2', 'Ciabattino']]);
const fences = rollTable('Ricettatori', [['1', 'Il Gobbo'], ['2', 'Mamma Rospo']], { visibility: 'master' });

/** L'id del blocco della tabella `name` nella pagina. */
const blockOf = (pageId: number, name: string) =>
	getDb()
		.select()
		.from(schema.rollTables)
		.all()
		.find((r) => r.pageId === pageId && r.name === name)!.blockId;

beforeEach(() => {
	const db = useMemoryDb();
	for (const [id, role] of [
		[1, 'master'],
		[2, 'player']
	] as const)
		db.insert(schema.users)
			.values({ id, username: 'u' + id, displayName: 'U' + id, passwordHash: 'x', role, createdAt: 0 })
			.run();
});

describe('tabelle di tiro', () => {
	it('il «/» trova le tabelle delle pagine che si vedono; quelle oscurate solo il Master', () => {
		const page = createPage({ ...base, title: 'Porto Grigio', content: doc(p('Le botteghe del porto.'), shops, fences) }, master);
		createPage({ ...base, visibility: 'master', title: 'Appunti', content: doc(rollTable('Bottega del Master', [['1', 'x']])) }, master);

		const names = (q: string, u: typeof master | typeof alice) => suggestRollTables(q, u).map((c) => c.name);
		expect(names('', master)).toEqual(['Bottega del Master', 'Bottega povera', 'Ricettatori']);
		expect(names('', alice)).toEqual(['Bottega povera']);
		expect(names('bottegapovera', alice)).toEqual(['Bottega povera']);
		expect(names('bottega-p', alice)).toEqual(['Bottega povera']);
		// Prima quelle che cominciano con ciò che si è scritto.
		expect(names('r', master)).toEqual(['Ricettatori', 'Bottega del Master', 'Bottega povera']);
		expect(suggestRollTables('', alice)[0]).toEqual({ page: page.id, block: blockOf(page.id, 'Bottega povera'), name: 'Bottega povera', pageTitle: 'Porto Grigio' });
		expect(suggestRollTables('', null)).toEqual([]);
	});

	it('si tira sulla pagina come la vede chi tira', () => {
		const page = createPage({ ...base, title: 'Porto Grigio', content: doc(shops, fences) }, master);
		const shop = blockOf(page.id, 'Bottega povera');
		const fence = blockOf(page.id, 'Ricettatori');
		expect(rollOnTable(page.id, shop, alice, () => 1)).toEqual({
			ok: true,
			name: 'Bottega povera',
			outcome: { value: 2, dice: [2], die: 'd2', row: 2, content: [text('Ciabattino')] }
		});
		expect(rollOnTable(page.id, fence, alice)).toBeNull();
		expect(rollOnTable(page.id, fence, master, () => 0)).toMatchObject({ ok: true, outcome: { content: [text('Il Gobbo')] } });
		expect(rollOnTable(page.id, shop, null)).toBeNull();
		expect(rollOnTable(page.id + 1, shop, master)).toBeNull();
	});

	it('una tabella che non va bene dice perché', () => {
		const broken = rollTable('Rotta', [['1', 'x'], ['1', 'y']]);
		const page = createPage({ ...base, title: 'Rotta', content: doc(broken) }, master);
		expect(rollOnTable(page.id, blockOf(page.id, 'Rotta'), master)).toEqual({ ok: false, name: 'Rotta', problem: { code: 'overlap', value: 1 } });
	});

	it("l'indice segue la pagina: modifiche, cestino e ripristino", () => {
		const page = createPage({ ...base, title: 'Porto Grigio', content: doc(shops) }, master);
		expect(suggestRollTables('', master)).toHaveLength(1);
		updatePage(getPageById(page.id)!, { ...base, title: 'Porto Grigio', content: doc(p('Niente tabelle')) }, master, true);
		expect(suggestRollTables('', master)).toHaveLength(0);
		updatePage(getPageById(page.id)!, { ...base, title: 'Porto Grigio', content: doc(shops) }, master, true);
		deletePage(page.id);
		expect(suggestRollTables('', master)).toHaveLength(0);
		restorePage(page.id);
		expect(suggestRollTables('', master)).toHaveLength(1);
	});

	it('un giocatore che modifica la pagina non porta via la tabella oscurata', () => {
		const page = createPage({ ...base, playersCanEdit: true, title: 'Porto Grigio', content: doc(shops, fences) }, master);
		const seen = viewContent(getPageById(page.id)!.content, alice);
		expect(seen.content!.map((b) => b.type)).toEqual(['table']);
		updatePage(getPageById(page.id)!, { ...base, playersCanEdit: true, title: 'Porto Grigio', content: { ...seen, content: [...seen.content!, p('Aggiunto da Alice')] } }, alice, false);
		expect(suggestRollTables('', master).map((c) => c.name)).toEqual(['Bottega povera', 'Ricettatori']);
		expect(rollOnTable(page.id, blockOf(page.id, 'Ricettatori'), master)).toMatchObject({ ok: true });
	});

	it('nella pagina il pulsante «Tira», solo sulle tabelle che chi legge vede', () => {
		const page = createPage({ ...base, title: 'Porto Grigio', content: doc(shops, fences, { type: 'table', content: shops.content }) }, master);
		const shop = blockOf(page.id, 'Bottega povera');
		const forAlice = renderPage(getPageById(page.id)!, alice, labels).html;
		expect(forAlice.match(/roll-button/g)).toHaveLength(1);
		expect(forAlice).toContain(`data-roll-page="${page.id}" data-roll-block="${shop}" aria-label="Tira su «Bottega povera»"`);
		expect(forAlice).toContain('<output class="roll-out" aria-live="polite"></output>');
		expect(renderPage(getPageById(page.id)!, master, labels).html.match(/roll-button/g)).toHaveLength(2);
		// Senza il testo del pulsante (es. le versioni vecchie) la tabella è una tabella e basta.
		expect(renderPage(getPageById(page.id)!, master, { ...labels, roll: undefined }).html).not.toContain('roll-button');
	});
});

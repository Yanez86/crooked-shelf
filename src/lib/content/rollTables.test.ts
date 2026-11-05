import { describe, expect, it } from 'vitest';
import type { DocNode } from './types.ts';
import {
	findRollTable,
	nameKey,
	newRollTable,
	outcomes,
	parseDie,
	parseRange,
	randomBelow,
	readRollTable,
	rollDie,
	rollTable,
	rollTablesIn,
	type ReadResult
} from './rollTables.ts';

const text = (t: string): DocNode => ({ type: 'text', text: t });
const cell = (type: string, ...content: DocNode[]): DocNode => ({ type, content: [{ type: 'paragraph', content: content.length ? content : undefined }] });
const td = (s: string | DocNode[]) => (typeof s === 'string' ? (s ? cell('tableCell', text(s)) : cell('tableCell')) : cell('tableCell', ...s));
const th = (s: string) => (s ? cell('tableHeader', text(s)) : cell('tableHeader'));

/** Una tabella di tiro: la prima riga è l'intestazione, le altre [numeri, risultato…]. */
function table(head: string[], rows: (string | DocNode[])[][], attrs: Record<string, unknown> = { roll: true }): DocNode {
	return {
		type: 'table',
		attrs,
		content: [{ type: 'tableRow', content: head.map(th) }, ...rows.map((r) => ({ type: 'tableRow', content: r.map(td) }))]
	};
}

/** Un generatore che restituisce i valori indicati (da 0), uno dopo l'altro. */
const seq = (...values: number[]) => {
	let i = 0;
	return () => values[i++ % values.length];
};

const ok = (r: ReadResult) => {
	if (!r.ok) throw new Error(JSON.stringify(r.problem));
	return r.table;
};

describe('dadi delle tabelle', () => {
	it('legge i dadi poliedrici, il d%, il d66 e più dadi sommati', () => {
		expect(parseDie('d20')).toEqual({ count: 1, sides: 20 });
		expect(parseDie(' 1D10 ')).toEqual({ count: 1, sides: 10 });
		expect(parseDie('2d6')).toEqual({ count: 2, sides: 6 });
		expect(parseDie('d%')).toEqual({ count: 1, sides: 100 });
		expect(parseDie('d66')).toBe('d66');
		for (const bad of ['', 'd', 'd1', '0d6', '21d6', 'd1001', '2d6+1', 'tabella']) expect(parseDie(bad), bad).toBeNull();
	});

	it('conosce i risultati possibili', () => {
		expect(outcomes({ count: 2, sides: 6 })).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
		const d66 = outcomes('d66');
		expect(d66).toHaveLength(36);
		expect(d66.slice(0, 7)).toEqual([11, 12, 13, 14, 15, 16, 21]);
		expect(d66.at(-1)).toBe(66);
	});

	it('tira e somma; il d66 fa decine e unità', () => {
		expect(rollDie({ count: 3, sides: 6 }, seq(0, 5, 2))).toEqual({ value: 10, dice: [1, 6, 3] });
		expect(rollDie('d66', seq(2, 4))).toEqual({ value: 35, dice: [3, 5] });
	});

	it('il generatore resta tra 0 e n-1 e fa uscire tutte le facce', () => {
		const seen = new Set<number>();
		for (let i = 0; i < 2000; i++) {
			const v = randomBelow(6);
			expect(v >= 0 && v < 6 && Number.isInteger(v)).toBe(true);
			seen.add(v);
		}
		expect(seen.size).toBe(6);
	});

	it('legge i numeri delle righe', () => {
		const d10 = { count: 1, sides: 10 };
		const d100 = { count: 1, sides: 100 };
		expect(parseRange('4', d10)).toEqual([4, 4]);
		expect(parseRange('2-3', d10)).toEqual([2, 3]);
		expect(parseRange('9 – 0', d10)).toEqual([9, 10]);
		expect(parseRange('01—05', d100)).toEqual([1, 5]);
		expect(parseRange('96-00', d100)).toEqual([96, 100]);
		expect(parseRange('00', { count: 2, sides: 6 })).toEqual([0, 0]);
		expect(parseRange('5-3', d10)).toEqual([3, 5]);
		for (const bad of ['', 'a', '1-', '1-2-3', '1,2']) expect(parseRange(bad, d10), bad).toBeNull();
	});
});

describe('tabelle di tiro', () => {
	const shops = table(['d6', 'Bottega povera'], [['1-2', 'Rigattiere'], ['3', 'Ciabattino'], ['4-6', 'Cerusico']]);

	it('legge nome, dado e righe, e tira sulla riga giusta', () => {
		const t = ok(readRollTable(shops));
		expect(t.name).toBe('Bottega povera');
		expect(t.rows.map((r) => [r.from, r.to])).toEqual([[1, 2], [3, 3], [4, 6]]);
		expect(rollTable(t, seq(1))).toMatchObject({ value: 2, die: 'd6', row: 1, content: [text('Rigattiere')] });
		expect(rollTable(t, seq(4))).toMatchObject({ value: 5, row: 3, content: [text('Cerusico')] });
	});

	it('dice cosa non va', () => {
		const problem = (t: DocNode) => {
			const r = readRollTable(t);
			return r.ok ? null : r.problem;
		};
		expect(problem(table(['d6'], [['1']]))).toEqual({ code: 'columns' });
		expect(problem(table(['d6', ''], [['1', 'x']]))).toEqual({ code: 'name' });
		expect(problem(table(['d6', 'Vuota'], []))).toEqual({ code: 'rows' });
		expect(problem(table(['dado', 'T'], [['1', 'x']]))).toEqual({ code: 'die' });
		expect(problem(table(['d6', 'T'], [['1-3', 'x'], ['tanti', 'y']]))).toEqual({ code: 'range', row: 2 });
		expect(problem(table(['d6', 'T'], [['1-3', 'x'], ['', 'y']]))).toEqual({ code: 'range', row: 2 });
		expect(problem(table(['d6', 'T'], [['1-3', 'x'], ['4-7', 'y']]))).toEqual({ code: 'outside', row: 2 });
		expect(problem(table(['d6', 'T'], [['1-3', 'x'], ['5-6', 'y']]))).toEqual({ code: 'gap', value: 4 });
		expect(problem(table(['d6', 'T'], [['1-4', 'x'], ['4-6', 'y']]))).toEqual({ code: 'overlap', value: 4 });
		expect(readRollTable(table(['d6', 'Nome'], [['x', 'y']]))).toMatchObject({ ok: false, name: 'Nome' });
	});

	it('2d6, d100 con 00 e d66 con le cifre che mancano', () => {
		ok(readRollTable(table(['2d6', 'Reazione'], [['2', 'Ostile'], ['3-5', 'Diffidente'], ['6-8', 'Neutrale'], ['9-11', 'Amichevole'], ['12', 'Entusiasta']])));
		ok(readRollTable(table(['d%', 'Tesoro'], [['01-50', 'Niente'], ['51-00', 'Monete']])));
		const d66 = ok(readRollTable(table(['d66', 'Voci'], [['11-36', 'Falsa'], ['41-66', 'Vera']])));
		expect(rollTable(d66, seq(3, 0))).toMatchObject({ value: 41, row: 2 });
	});

	it('senza numeri ogni riga ha la stessa probabilità', () => {
		const t = ok(readRollTable(table(['', 'Nomi'], [['', 'Anselmo'], ['', 'Brunilde'], ['', 'Corrado']])));
		expect(t.die).toEqual({ count: 1, sides: 3 });
		expect(rollTable(t, seq(1))).toMatchObject({ value: 2, die: 'd3', content: [text('Brunilde')] });
	});

	it('il risultato tiene grassetti, collegamenti e regole; più colonne sono separate da un trattino', () => {
		const bold: DocNode = { type: 'text', text: 'Brunilde', marks: [{ type: 'bold' }] };
		const link: DocNode = { type: 'wikiLink', attrs: { target: 'porto', title: 'Porto' } };
		const t: DocNode = {
			type: 'table',
			attrs: { roll: true },
			content: [
				{ type: 'tableRow', content: [th('d2'), th('Locandiera'), th('Dove')] },
				{
					type: 'tableRow',
					content: [
						td('1'),
						{ type: 'tableCell', content: [{ type: 'paragraph', content: [bold, { type: 'hardBreak' }, text('la rossa')] }, { type: 'paragraph', content: [text('(nana)')] }] },
						td([text('al '), link])
					]
				},
				{ type: 'tableRow', content: [td('2'), td('Oste'), td('')] }
			]
		};
		const r = rollTable(ok(readRollTable(t)), seq(0));
		expect(r.content).toEqual([bold, text(' '), text('la rossa'), text(' '), text('(nana)'), text(' — '), text('al '), link]);
		expect(rollTable(ok(readRollTable(t)), seq(1)).content).toEqual([text('Oste')]);
	});

	it("l'indice: solo le tabelle di tiro del primo livello con un nome, e se sono oscurate", () => {
		const doc: DocNode = {
			type: 'doc',
			content: [
				{ ...shops, attrs: { roll: true, id: 'aaaaaaaaaa' } },
				{ ...table(['d4', 'Segreta'], [['1-4', 'x']]), attrs: { roll: true, id: 'bbbbbbbbbb', visibility: 'master' } },
				{ ...table(['d4', 'Normale'], [['1-4', 'x']], {}), attrs: { id: 'cccccccccc' } },
				{ ...table(['d4', ''], [['1-4', 'x']]), attrs: { roll: true, id: 'dddddddddd' } },
				{ type: 'callout', attrs: { id: 'eeeeeeeeee' }, content: [table(['d4', 'Dentro'], [['1-4', 'x']])] }
			]
		};
		expect(rollTablesIn(doc)).toEqual([
			{ block: 'aaaaaaaaaa', name: 'Bottega povera', secret: false },
			{ block: 'bbbbbbbbbb', name: 'Segreta', secret: true }
		]);
		expect(findRollTable(doc, 'bbbbbbbbbb')).toBe(doc.content![1]);
		expect(findRollTable(doc, 'cccccccccc')).toBeUndefined();
	});

	it('una tabella nuova è già pronta da tirare', () => {
		const t = newRollTable('Nome della tabella');
		expect(ok(readRollTable(t)).rows).toHaveLength(6);
		// Le righe sono ancora vuote: il risultato è vuoto, ma il tiro funziona.
		expect(rollTable(ok(readRollTable(t)), seq(2))).toMatchObject({ value: 3, content: [] });
	});

	it('i nomi si cercano senza badare a maiuscole, spazi, trattini e accenti', () => {
		expect(nameKey('Bottega povera')).toBe('bottegapovera');
		expect(nameKey('/bottega-povera'.slice(1))).toBe('bottegapovera');
		expect(nameKey('Città')).toBe('citta');
	});
});

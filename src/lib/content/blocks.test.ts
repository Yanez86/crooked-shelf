import { describe, expect, it } from 'vitest';
import { blockVisibility, idsToRenew, isBlockId, liftBlocks, mergeBlocks, visibleBlocks } from './blocks.ts';
import type { DocNode } from './types.ts';
import type { Visibility } from '../roles.ts';

const player = (v: Visibility) => v === 'public' || v === 'players';
const master = () => true;

/** Un paragrafo con il suo id (ripetuto fino a 8 caratteri) e, se serve, oscurato. */
const p = (id: string, text: string, hidden = false): DocNode => ({
	type: 'paragraph',
	attrs: { id: id.repeat(8).slice(0, 8), ...(hidden ? { visibility: 'master' } : {}) },
	content: [{ type: 'text', text }]
});
const doc = (...content: DocNode[]): DocNode => ({ type: 'doc', content });
const texts = (d: DocNode) => (d.content ?? []).map((b) => (b.content ?? []).map((c) => c.text ?? '').join(''));
const ids = (d: DocNode) => (d.content ?? []).map((b) => b.attrs?.id);

describe('blocchi', () => {
	it('il vecchio riquadro del segreto diventa i suoi blocchi, oscurati', () => {
		const old = doc(p('a', 'Pubblico'), { type: 'secret', content: [p('b', 'Uno'), { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Due' }] }] });
		const d = liftBlocks(old);
		expect(texts(d)).toEqual(['Pubblico', 'Uno', 'Due']);
		expect(d.content!.map(blockVisibility)).toEqual([null, 'master', 'master']);
		expect(d.content![2].attrs).toEqual({ level: 2, visibility: 'master' });
	});

	it('un pezzo nascosto dentro un blocco nasconde tutto il blocco, e dentro non restano id né visibilità', () => {
		const d = liftBlocks(
			doc({
				type: 'callout',
				attrs: { kind: 'note', id: 'cccccccc' },
				content: [p('x', 'Visibile'), { type: 'secret', content: [p('y', 'Segreto')] }, p('z', 'Altro', true)]
			})
		);
		expect(d.content).toEqual([
			{
				type: 'callout',
				attrs: { kind: 'note', id: 'cccccccc', visibility: 'master' },
				content: [
					{ type: 'paragraph', content: [{ type: 'text', text: 'Visibile' }] },
					{ type: 'paragraph', content: [{ type: 'text', text: 'Segreto' }] },
					{ type: 'paragraph', content: [{ type: 'text', text: 'Altro' }] }
				]
			}
		]);
	});

	it('visibleBlocks: il giocatore non riceve i blocchi oscurati, e una pagina tutta segreta resta con un paragrafo vuoto', () => {
		const d = doc(p('a', 'A'), p('b', 'B', true), p('c', 'C'));
		expect(texts(visibleBlocks(d, player))).toEqual(['A', 'C']);
		expect(texts(visibleBlocks(d, master))).toEqual(['A', 'B', 'C']);
		expect(visibleBlocks(doc(p('b', 'B', true)), player).content).toEqual([{ type: 'paragraph' }]);
	});

	it('idsToRenew: mancanti, sbagliati, riservati e, tra due uguali, il primo', () => {
		expect([...idsToRenew(['aaaaaaaa', undefined, 'aaaaaaaa', 'corto', 'bbbbbbbb'], new Set(['bbbbbbbb']))].sort()).toEqual([0, 1, 3, 4]);
		expect(isBlockId('k3j4h5g6f7')).toBe(true);
		expect(isBlockId('ABCDEFGH')).toBe(false);
	});
});

describe('mergeBlocks', () => {
	const stored = doc(p('a', 'A'), p('s', 'Segreto 1', true), p('b', 'B'), p('c', 'C'), p('t', 'Segreto 2', true), p('u', 'Segreto 3', true));

	it('il Master salva quello che manda: niente da rimettere', () => {
		const d = mergeBlocks(doc(p('a', 'A'), p('b', 'B nuovo', true)), stored, master);
		expect(texts(d)).toEqual(['A', 'B nuovo']);
		expect(d.content!.map(blockVisibility)).toEqual([null, 'master']);
	});

	it('i segreti tornano dopo il blocco che li precedeva, anche se il giocatore lo cambia o aggiunge blocchi', () => {
		const mine = visibleBlocks(stored, player);
		expect(texts(mine)).toEqual(['A', 'B', 'C']);
		const edited = doc(p('n', 'Nuovo in cima'), p('a', 'A cambiato'), p('b', 'B'), p('m', 'Nuovo in mezzo'), p('c', 'C'), p('o', 'In fondo'));
		const d = mergeBlocks(edited, stored, player);
		expect(texts(d)).toEqual(['Nuovo in cima', 'A cambiato', 'Segreto 1', 'B', 'Nuovo in mezzo', 'C', 'Segreto 2', 'Segreto 3', 'In fondo']);
		expect(ids(d)).toEqual(['nnnnnnnn', 'aaaaaaaa', 'ssssssss', 'bbbbbbbb', 'mmmmmmmm', 'cccccccc', 'tttttttt', 'uuuuuuuu', 'oooooooo']);
	});

	it('se il giocatore elimina il blocco prima di un segreto, il segreto va dopo il primo che c\'è ancora; senza nessuno, in cima', () => {
		expect(texts(mergeBlocks(doc(p('b', 'B'), p('c', 'C')), stored, player))).toEqual(['Segreto 1', 'B', 'C', 'Segreto 2', 'Segreto 3']);
		expect(texts(mergeBlocks(doc(p('a', 'A'), p('b', 'B')), stored, player))).toEqual(['A', 'Segreto 1', 'B', 'Segreto 2', 'Segreto 3']);
		const empty = mergeBlocks(doc({ type: 'paragraph' }), stored, player);
		expect(texts(empty)).toEqual(['Segreto 1', 'Segreto 2', 'Segreto 3', '']);
		expect(new Set(ids(empty)).size).toBe(4);
	});

	it('dividendo un blocco, il segreto che lo seguiva resta dopo la seconda parte', () => {
		// L'editor copia l'id in entrambe le parti: lo tiene la seconda.
		const split = doc(p('a', 'Prima metà'), p('a', 'seconda metà'), p('b', 'B'), p('c', 'C'));
		const d = mergeBlocks(split, stored, player);
		expect(texts(d)).toEqual(['Prima metà', 'seconda metà', 'Segreto 1', 'B', 'C', 'Segreto 2', 'Segreto 3']);
		expect(ids(d)[0]).not.toBe('aaaaaaaa');
		expect(ids(d)[1]).toBe('aaaaaaaa');
	});

	it('il giocatore non scrive segreti, non tocca quelli del Master e non ne prende l\'id', () => {
		const sneaky = doc(
			p('a', 'A'),
			p('x', 'Finto segreto', true),
			{ type: 'secret', content: [p('y', 'Vecchio stile')] },
			p('s', 'Al posto del segreto'),
			{ type: 'paragraph', attrs: { id: 'zzzzzzzz', visibility: 'players' }, content: [{ type: 'text', text: 'Solo giocatori' }] }
		);
		const d = mergeBlocks(sneaky, stored, player);
		// B e C non ci sono più: tutti i segreti tornano dopo A.
		expect(texts(d)).toEqual(['A', 'Segreto 1', 'Segreto 2', 'Segreto 3', 'Al posto del segreto']);
		expect(d.content!.map(blockVisibility)).toEqual([null, 'master', 'master', 'master', null]);
		// Il blocco del giocatore con l'id del segreto ne ha uno nuovo; il segreto resta il suo.
		expect(ids(d)[1]).toBe('ssssssss');
		expect(ids(d)[4]).not.toBe('ssssssss');
		expect(new Set(ids(d)).size).toBe(5);
	});

	it('ripristinando una versione vecchia, il giocatore non ne tira fuori i segreti', () => {
		const old = doc(p('a', 'A'), p('v', 'Segreto di allora', true), p('b', 'B'));
		const d = mergeBlocks(old, stored, player);
		expect(texts(d)).toEqual(['A', 'Segreto 1', 'B', 'Segreto 2', 'Segreto 3']);
	});

	it('ogni blocco ha un id, e le visibilità che un blocco non può avere diventano segreto', () => {
		const d = mergeBlocks(
			doc({ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }, { type: 'paragraph', attrs: { visibility: 'players' } }, { type: 'paragraph', attrs: { visibility: 'public' } }),
			null,
			master
		);
		expect(d.content!.every((b) => isBlockId(b.attrs?.id))).toBe(true);
		expect(d.content!.map(blockVisibility)).toEqual([null, 'master', null]);
	});
});

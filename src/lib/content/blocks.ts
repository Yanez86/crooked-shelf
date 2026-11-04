import type { DocNode } from './types.ts';
import { BLOCK_VISIBILITIES, VISIBILITIES, type Visibility } from '../roles.ts';

/**
 * I blocchi di una pagina: i nodi di primo livello del documento (paragrafo, titolo, immagine, tabella, riquadro…).
 * Ognuno ha due attributi:
 * - `id`, casuale e stabile, per riconoscerlo da un salvataggio all'altro;
 * - `visibility`, assente se lo vede chi vede la pagina, oppure più stretta: «master» è il segreto del Master.
 * Chi non vede un blocco non lo riceve mai, neanche nell'editor: quando salva, il server lo rimette al suo posto (mergeBlocks).
 * La visibilità sta solo nel primo livello: un pezzo nascosto più in basso nasconde tutto il blocco che lo contiene.
 */

/** Tipi di blocco che stanno nel primo livello e hanno id e visibilità (anche nell'editor). */
export const BLOCK_TYPES = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'codeBlock', 'horizontalRule', 'image', 'table', 'callout'];

const ID = /^[a-z0-9]{8,24}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export const isBlockId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

/** Un id nuovo per un blocco (10 caratteri, circa 50 bit: tra i blocchi di una pagina non si ripete). */
export function newBlockId(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const blockId = (n: DocNode): string | null => (isBlockId(n.attrs?.id) ? n.attrs.id : null);

/**
 * La visibilità propria di un nodo, o null se è quella della pagina. Il vecchio riquadro «secret» vale «master»;
 * un valore che non si capisce vale «master» anche lui: nel dubbio il blocco resta nascosto.
 */
export function blockVisibility(n: DocNode): Visibility | null {
	if (n.type === 'secret') return 'master';
	const v = n.attrs?.visibility;
	if (v === undefined || v === null || v === '') return null;
	return VISIBILITIES.includes(v as Visibility) ? (v as Visibility) : 'master';
}

const RANK: Record<Visibility, number> = { public: 0, players: 1, master: 2, personal: 3 };

/** Tra due visibilità, quella che fa vedere a meno persone. */
const stricter = (a: Visibility | null, b: Visibility | null) => (a === null ? b : b === null ? a : RANK[b] > RANK[a] ? b : a);

/** Il nodo con questi attributi cambiati; null li toglie. */
function withAttrs(n: DocNode, patch: Record<string, unknown>): DocNode {
	const attrs = { ...n.attrs };
	for (const [k, v] of Object.entries(patch)) {
		if (v === null || v === undefined) delete attrs[k];
		else attrs[k] = v;
	}
	const { attrs: _, ...rest } = n;
	return Object.keys(attrs).length ? { ...rest, attrs } : rest;
}

/** I nodi dentro un blocco senza id né visibilità (e senza vecchi riquadri «secret»), con la visibilità più stretta che avevano. */
function inner(nodes: DocNode[] | undefined): { content: DocNode[] | undefined; vis: Visibility | null } {
	if (!nodes) return { content: undefined, vis: null };
	let vis: Visibility | null = null;
	const content: DocNode[] = [];
	for (const c of nodes) {
		const sub = inner(c.content);
		vis = stricter(stricter(vis, blockVisibility(c)), sub.vis);
		if (c.type === 'secret') content.push(...(sub.content ?? []));
		else content.push(withAttrs(sub.content ? { ...c, content: sub.content } : c, { id: null, visibility: null }));
	}
	return { content, vis };
}

function lift(nodes: DocNode[], outer: Visibility | null, out: DocNode[]) {
	for (const b of nodes) {
		if (b.type === 'secret') {
			lift(b.content ?? [], stricter(outer, 'master'), out);
			continue;
		}
		const sub = inner(b.content);
		const vis = stricter(stricter(outer, blockVisibility(b)), sub.vis);
		out.push(withAttrs(sub.content ? { ...b, content: sub.content } : b, { visibility: vis }));
	}
}

/**
 * Il documento con la visibilità solo sui blocchi di primo livello: i vecchi riquadri «secret» diventano i blocchi
 * che contenevano, oscurati; un nodo nascosto dentro un blocco nasconde il blocco intero. Gli id restano quelli che sono.
 */
export function liftBlocks(doc: DocNode): DocNode {
	const out: DocNode[] = [];
	lift(doc.content ?? [], null, out);
	return { ...doc, type: 'doc', content: out.length ? out : [{ type: 'paragraph' }] };
}

/** Il blocco è nascosto a chi ha questa regola? */
const hiddenBy = (sees: (v: Visibility) => boolean) => (b: DocNode) => {
	const v = blockVisibility(b);
	return v !== null && !sees(v);
};

/** Il documento senza i blocchi che chi guarda non vede (`sees`: vede i blocchi con questa visibilità?). */
export function visibleBlocks(doc: DocNode, sees: (v: Visibility) => boolean): DocNode {
	const hidden = hiddenBy(sees);
	const lifted = liftBlocks(doc);
	const content = lifted.content!.filter((b) => !hidden(b));
	return { ...lifted, content: content.length ? content : [{ type: 'paragraph' }] };
}

/**
 * Quali posizioni di un elenco di id devono averne uno nuovo: quelli che mancano o non vanno bene, quelli in `reserved`
 * e, tra due uguali, il primo. Dividendo un blocco in due l'editor copia l'id in entrambi: lo tiene la parte con la fine
 * del blocco, così quello che veniva dopo resta dopo.
 */
export function idsToRenew(ids: unknown[], reserved: ReadonlySet<string> = new Set()): Set<number> {
	const seen = new Set(reserved);
	const out = new Set<number>();
	for (let i = ids.length - 1; i >= 0; i--) {
		const id = ids[i];
		if (!isBlockId(id) || seen.has(id)) out.add(i);
		else seen.add(id);
	}
	return out;
}

/**
 * La visibilità che un blocco può avere davvero: «public» non toglie niente a nessuno, le altre che un blocco non può
 * avere diventano la prima più stretta tra quelle che può avere (nel dubbio il blocco resta nascosto).
 */
function settable(v: Visibility | null): Visibility | null {
	if (v === null || v === 'public') return null;
	if (BLOCK_VISIBILITIES.includes(v)) return v;
	return [...BLOCK_VISIBILITIES].sort((a, b) => RANK[a] - RANK[b]).find((b) => RANK[b] >= RANK[v]) ?? 'master';
}

/**
 * Il documento da salvare. `incoming` è quello che manda chi scrive, `stored` la pagina com'era (null se è nuova),
 * `sees` dice quali blocchi chi scrive può vedere.
 * - Un blocco che chi scrive non può vedere, se lo manda, non entra: non è suo da scrivere (un giocatore non crea segreti,
 *   e ripristinando una versione vecchia non ne tira fuori).
 * - I blocchi della pagina che non vede tornano ognuno dopo il blocco visibile che lo precedeva; se l'ha eliminato,
 *   dopo il primo blocco prima di quello che c'è ancora; se non ce n'è nessuno, in cima. Restano com'erano.
 * - Ogni blocco ha un id suo: se ne manca uno, o è doppio, o è quello di un blocco che chi scrive non vede, è nuovo.
 */
export function mergeBlocks(incoming: DocNode, stored: DocNode | null, sees: (v: Visibility) => boolean): DocNode {
	const hidden = hiddenBy(sees);
	const old = stored ? liftBlocks(stored).content! : [];
	const kept = old.filter(hidden);
	const reserved = new Set(kept.map(blockId).filter((id): id is string => id !== null));

	const blocks = liftBlocks(incoming)
		.content!.map((b) => withAttrs(b, { visibility: settable(blockVisibility(b)) }))
		.filter((b) => !hidden(b));
	const renew = idsToRenew(blocks.map((b) => b.attrs?.id), reserved);
	const mine = blocks.map((b, i) => (renew.has(i) ? withAttrs(b, { id: newBlockId() }) : b));

	// I blocchi nascosti, per il blocco visibile dopo cui tornano (null = in cima).
	const present = new Set(mine.map(blockId));
	const used = new Set(present);
	const after = new Map<string | null, DocNode[]>();
	let anchor: string | null = null;
	for (const b of old) {
		const id = blockId(b);
		if (hidden(b)) {
			const own = id && !used.has(id) ? id : newBlockId();
			used.add(own);
			after.set(anchor, [...(after.get(anchor) ?? []), withAttrs(b, { id: own })]);
		} else if (id && present.has(id)) anchor = id;
	}
	const content = [...(after.get(null) ?? [])];
	for (const b of mine) content.push(b, ...(after.get(blockId(b)) ?? []));
	return { type: 'doc', content: content.length ? content : [{ type: 'paragraph', attrs: { id: newBlockId() } }] };
}

import { Extension, InputRule, Mark, Node, getMarkRange, mergeAttributes, type Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Focus } from '@tiptap/extensions';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import { slugify } from '../slug.ts';
import { safeHref, safeImageSrc } from '../content/render.ts';
import { CALLOUT_KINDS } from '../content/types.ts';
import { BLOCK_TYPES, idsToRenew, newBlockId } from '../content/blocks.ts';
import { parseRuleKind } from '../rules/index.ts';
import type { DocNode } from '../content/types.ts';
import type { RollProblem } from '../content/rollTables.ts';

export interface EditorLabels {
	note: string;
	tip: string;
	warning: string;
	secret: string;
	suggestions: string;
	createLink: string;
	noResults: string;
	rules: string;
	/** Nome di ogni tipo di regola nella lingua dell'interfaccia. */
	kinds: Record<string, string>;
	/** L'elenco delle tabelle di tiro del «/». */
	rollTables: string;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		wikiLink: {
			insertWikiLink: (attrs: { target: string; title: string; label?: string | null }) => ReturnType;
		};
		ruleRef: {
			insertRuleRef: (attrs: { kind: string; name: string; label?: string | null }) => ReturnType;
		};
		blocks: {
			/** Oscura i blocchi (quelli della selezione, o quello in `pos`), o li mostra se lo sono già tutti. */
			toggleHidden: (pos?: number) => ReturnType;
			/** Un paragrafo nuovo dopo il blocco in `pos`, nascosto se lo è lui, col cursore dentro. */
			insertBlockAfter: (pos: number) => ReturnType;
		};
	}
}

/** Riquadro: nota, consiglio o attenzione. */
const Callout = Node.create<{ labels: EditorLabels }>({
	name: 'callout',
	group: 'block',
	content: 'block+',
	defining: true,
	addOptions: () => ({ labels: {} as EditorLabels }),
	addAttributes: () => ({
		kind: {
			default: 'note',
			parseHTML: (el) => {
				const k = el.getAttribute('data-callout');
				return CALLOUT_KINDS.includes(k as never) ? k : 'note';
			}
		}
	}),
	parseHTML: () => [{ tag: 'aside[data-callout]' }],
	renderHTML({ node, HTMLAttributes }) {
		const kind = node.attrs.kind as 'note' | 'tip' | 'warning';
		return [
			'aside',
			mergeAttributes(HTMLAttributes, {
				'data-callout': kind,
				'data-label': this.options.labels[kind],
				class: `callout callout-${kind}`
			}),
			0
		];
	}
});

/** Un blocco di primo livello: il nodo e la posizione dove comincia. */
export interface TopBlock {
	node: PmNode;
	pos: number;
}

/** Il blocco di primo livello che contiene `pos` (un'immagine o una linea non hanno interno: `pos` è subito prima). */
export function blockAt(doc: PmNode, pos: number): TopBlock | null {
	const at = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
	const i = at.index(0);
	if (i >= doc.childCount) return null;
	return { node: doc.child(i), pos: at.posAtIndex(i, 0) };
}

/** I blocchi di primo livello toccati dalla selezione. */
export function selectedBlocks(state: EditorState): TopBlock[] {
	const { from, to } = state.selection;
	const out: TopBlock[] = [];
	state.doc.forEach((node, pos) => {
		const end = pos + node.nodeSize;
		if (from === to ? pos < from && from < end : pos < to && end > from) out.push({ node, pos });
	});
	const at = from === to && !out.length ? blockAt(state.doc, from) : null;
	return at ? [at] : out;
}

/**
 * Id e visibilità dei blocchi (vedi content/blocks.ts). L'id non si vede nell'HTML: copiando un blocco, la copia ne ha
 * uno nuovo. La visibilità sì (`data-visibility`): un segreto copiato e incollato resta un segreto.
 * Un blocco nuovo nasce nascosto se il cursore era in un blocco nascosto (scrivendo, inserendo un'immagine o una tabella,
 * incollando), come prima dentro il riquadro del segreto; e un pezzo nascosto dentro un blocco nasconde il blocco intero.
 * Il blocco nascosto ha in cima il nome «Segreto del Master» (per i lettori di schermo, e per le immagini, che non hanno ::before).
 */
const Blocks = Extension.create<{ canSecret: boolean; labels: EditorLabels }>({
	name: 'blocks',
	addOptions: () => ({ canSecret: false, labels: {} as EditorLabels }),
	addGlobalAttributes() {
		return [
			{
				types: BLOCK_TYPES,
				attributes: {
					id: { default: null, keepOnSplit: false, rendered: false, parseHTML: () => null },
					...(this.options.canSecret
						? {
								visibility: {
									default: null,
									parseHTML: (el: HTMLElement) => (el.getAttribute('data-visibility') === 'master' ? 'master' : null),
									renderHTML: (a: Record<string, unknown>) => (a.visibility ? { 'data-visibility': a.visibility } : {})
								}
							}
						: {})
				}
			}
		];
	},
	addCommands() {
		return {
			toggleHidden:
				(pos?: number) =>
				({ state, tr, dispatch }) => {
					const at = pos === undefined ? selectedBlocks(state) : [blockAt(state.doc, pos)].filter((b): b is TopBlock => !!b);
					const items = at.filter((b) => 'visibility' in b.node.attrs);
					if (!items.length) return false;
					const hide = items.some((b) => !b.node.attrs.visibility);
					if (dispatch) for (const b of items) tr.setNodeAttribute(b.pos, 'visibility', hide ? 'master' : null);
					return true;
				},
			insertBlockAfter:
				(pos: number) =>
				({ state, chain }) => {
					const b = blockAt(state.doc, pos);
					if (!b) return false;
					const end = b.pos + b.node.nodeSize;
					const visibility = this.options.canSecret ? (b.node.attrs.visibility ?? null) : undefined;
					return chain()
						.insertContentAt(end, { type: 'paragraph', attrs: { id: newBlockId(), ...(visibility !== undefined ? { visibility } : {}) } })
						.setTextSelection(end + 1)
						.run();
				}
		};
	},
	addProseMirrorPlugins() {
		const { canSecret, labels } = this.options;
		const keep = new Plugin({
			key: new PluginKey('blockIds'),
			appendTransaction(trs, old, state) {
				if (!trs.some((t) => t.docChanged)) return null;
				const items: TopBlock[] = [];
				state.doc.forEach((node, pos) => items.push({ node, pos }));
				const renew = idsToRenew(items.map((b) => b.node.attrs.id));
				// Dove si stava scrivendo: i blocchi nuovi prendono la sua visibilità.
				const was = canSecret ? (blockAt(old.doc, old.selection.from)?.node.attrs.visibility ?? null) : null;
				const tr = state.tr;
				items.forEach(({ node, pos }, i) => {
					if (!('id' in node.attrs)) return;
					if (renew.has(i)) tr.setNodeAttribute(pos, 'id', newBlockId());
					let vis = canSecret ? (node.attrs.visibility ?? null) : null;
					if (canSecret && renew.has(i) && !vis) vis = was;
					// Dentro un blocco (un paragrafo in un elenco) niente id né visibilità: valgono quelli del blocco.
					node.descendants((d, p) => {
						if (d.attrs.id) tr.setNodeAttribute(pos + 1 + p, 'id', null);
						if (d.attrs.visibility) {
							vis = vis ?? d.attrs.visibility;
							tr.setNodeAttribute(pos + 1 + p, 'visibility', null);
						}
					});
					if (canSecret && vis !== (node.attrs.visibility ?? null)) tr.setNodeAttribute(pos, 'visibility', vis);
				});
				return tr.docChanged ? tr : null;
			}
		});
		if (!canSecret) return [keep];
		const label = () => {
			const el = document.createElement('div');
			el.className = 'hidden-label';
			el.contentEditable = 'false';
			el.textContent = labels.secret;
			return el;
		};
		const marks = new Plugin({
			key: new PluginKey('hiddenBlocks'),
			props: {
				decorations(state) {
					const out: Decoration[] = [];
					let before = false;
					state.doc.forEach((node, pos) => {
						const hidden = !!node.attrs.visibility;
						if (hidden && !before) out.push(Decoration.widget(pos, label, { side: -1, key: 'hidden-label', ignoreSelection: true }));
						before = hidden;
					});
					return DecorationSet.create(state.doc, out);
				}
			}
		});
		return [keep, marks];
	}
});

// [[Titolo]] oppure [[Titolo|testo mostrato]]
const WIKI_RE = /\[\[([^[\]|\n]{1,200})(?:\|([^[\]\n]{1,200}))?\]\]$/;

interface SuggestItem {
	slug: string;
	title: string;
	create?: boolean;
}

export interface RuleItem {
	kind: string;
	key: string;
	name: string;
	summary: string;
}

const wikiKey = new PluginKey('wikiLinkSuggestion');

/** Collegamento a un'altra pagina della wiki. */
const WikiLink = Node.create<{ labels: EditorLabels; suggest: (q: string, signal: AbortSignal) => Promise<SuggestItem[]> }>({
	name: 'wikiLink',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addOptions: () => ({ labels: {} as EditorLabels, suggest: async () => [] }),
	addAttributes: () => ({
		target: { default: '' },
		title: { default: '' },
		label: { default: null }
	}),
	parseHTML: () => [
		{
			tag: 'a[data-wikilink]',
			getAttrs: (el) => ({
				target: el.getAttribute('data-wikilink'),
				title: el.getAttribute('data-title') ?? el.textContent,
				label: el.getAttribute('data-label')
			})
		}
	],
	renderHTML({ node }) {
		const { target, title, label } = node.attrs;
		return [
			'a',
			{
				'data-wikilink': target,
				'data-title': title,
				...(label ? { 'data-label': label } : {}),
				href: `/wiki/${encodeURIComponent(target)}`,
				class: 'wikilink'
			},
			label || title || target
		];
	},
	renderText: ({ node }) => node.attrs.label || node.attrs.title || node.attrs.target,

	addCommands() {
		return {
			insertWikiLink:
				(attrs) =>
				({ commands }) =>
					commands.insertContent([{ type: this.name, attrs }, { type: 'text', text: ' ' }])
		};
	},

	addInputRules() {
		return [
			new InputRule({
				find: WIKI_RE,
				handler: ({ state, range, match }) => {
					const title = match[1].trim();
					if (!title) return null;
					state.tr.replaceWith(
						range.from,
						range.to,
						this.type.create({ target: slugify(title), title, label: match[2]?.trim() || null })
					);
				}
			})
		];
	},

	addProseMirrorPlugins() {
		const labels = this.options.labels;
		const suggest = this.options.suggest;
		return [
			Suggestion<SuggestItem, SuggestItem>({
				editor: this.editor,
				pluginKey: wikiKey,
				char: '[[',
				allowSpaces: true,
				allowedPrefixes: null,
				debounce: 120,
				items: async ({ query, signal }) => {
					const q = query.replace(/\]+$/, '').trim();
					const found = q ? await suggest(q, signal).catch(() => []) : [];
					if (q && !found.some((f) => f.title.toLowerCase() === q.toLowerCase()))
						found.push({ slug: slugify(q), title: q, create: true });
					return found;
				},
				command: ({ editor, range, props }) => {
					editor
						.chain()
						.focus()
						.deleteRange(range)
						.insertWikiLink({ target: props.slug, title: props.title })
						.run();
				},
				render: () =>
					suggestionPopup<SuggestItem>(labels.suggestions, labels.noResults, (i) =>
						i.create ? { text: labels.createLink.replace('{title}', i.title), className: 'create' } : { text: i.title }
					)
			})
		];
	}
});

const ruleKeyPlugin = new PluginKey('ruleSuggestion');
const RULE_INPUT = /@([a-zA-Z]+)\[([^[\]|\n]{1,80})(?:\|([^[\]\n]{1,80}))?\]$/;

/** Riferimento a una regola: @incantesimo[Fireball|Palla di fuoco]. */
const RuleRef = Node.create<{ labels: EditorLabels; search: (q: string, signal: AbortSignal) => Promise<RuleItem[]> }>({
	name: 'ruleRef',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,
	addOptions: () => ({ labels: {} as EditorLabels, search: async () => [] }),
	addAttributes: () => ({
		kind: { default: 'rule' },
		name: { default: '' },
		label: { default: null }
	}),
	parseHTML: () => [
		{
			tag: 'span[data-rule-kind]',
			getAttrs: (el) => ({
				kind: el.getAttribute('data-rule-kind'),
				name: el.getAttribute('data-rule-name'),
				label: el.getAttribute('data-label')
			})
		}
	],
	renderHTML({ node }) {
		const { kind, name, label } = node.attrs;
		return [
			'span',
			{ class: 'ruleref', 'data-rule-kind': kind, 'data-rule-name': name, ...(label ? { 'data-label': label } : {}), title: this.options.labels.kinds[kind] ?? kind },
			label || name
		];
	},
	renderText: ({ node }) => `@${node.attrs.kind}[${node.attrs.name}${node.attrs.label ? '|' + node.attrs.label : ''}]`,

	addCommands() {
		return {
			insertRuleRef:
				(attrs) =>
				({ commands }) =>
					commands.insertContent([{ type: this.name, attrs }, { type: 'text', text: ' ' }])
		};
	},

	addInputRules() {
		return [
			new InputRule({
				find: RULE_INPUT,
				handler: ({ state, range, match }) => {
					const kind = parseRuleKind(match[1]);
					if (!kind) return null;
					state.tr.replaceWith(range.from, range.to, this.type.create({ kind, name: match[2].trim(), label: match[3]?.trim() || null }));
				}
			})
		];
	},

	addProseMirrorPlugins() {
		const { labels, search } = this.options;
		return [
			Suggestion<RuleItem, RuleItem>({
				editor: this.editor,
				pluginKey: ruleKeyPlugin,
				char: '@',
				allowSpaces: true,
				debounce: 120,
				minQueryLength: 2,
				// "@incantesimo[" si scrive a mano: niente suggerimenti dopo un tipo seguito da [.
				allow: ({ state, range }) => {
					const text = state.doc.textBetween(range.from, range.to);
					return !/^@[a-zA-Z]+\[/.test(text);
				},
				items: async ({ query, signal }) => (query.trim().length >= 2 && !query.includes('[') ? search(query.trim(), signal).catch(() => []) : []),
				command: ({ editor, range, props }) => {
					editor.chain().focus().deleteRange(range).insertRuleRef({ kind: props.kind, name: props.name }).run();
				},
				render: () =>
					suggestionPopup<RuleItem>(labels.rules, labels.noResults, (i) => ({ text: `${i.name} — ${labels.kinds[i.kind] ?? i.kind}`, detail: i.summary }))
			})
		];
	}
});

/** Una tabella di tiro da scegliere col «/» (vedi server/rollTables.ts). */
export interface RollChoice {
	page: number;
	block: string;
	name: string;
	pageTitle: string;
}

/** Da quale tabella viene un tiro; `roll` distingue due tiri di fila sulla stessa tabella. */
export interface RollSource {
	page: number;
	block: string;
	roll?: string;
}

/** La risposta del server a un tiro; null = la tabella non c'è più, o chi scrive non la vede. */
export type RollAnswer =
	| { ok: true; name: string; value: number; die: string; content: DocNode[] }
	| { ok: false; name: string; problem: RollProblem }
	| null;

export interface RollDeps {
	roll: (page: number, block: string) => Promise<RollAnswer>;
	/** Dice com'è andata (nel messaggio sotto la barra). */
	notify: (answer: RollAnswer) => void;
}

/**
 * Il risultato di un tiro su una tabella (vedi content/rollTables.ts): testo come un altro, che ricorda la tabella da
 * cui viene, così nell'editor si può ritirare. Nella pagina è solo testo: chi legge non sa da dove viene.
 */
const RollResult = Mark.create({
	name: 'rollResult',
	inclusive: false,
	addAttributes: () => ({
		roll: { default: null, rendered: false, parseHTML: (el) => el.getAttribute('data-roll') },
		page: { default: null, rendered: false, parseHTML: (el) => Number(el.getAttribute('data-roll-page')) || null },
		block: { default: null, rendered: false, parseHTML: (el) => el.getAttribute('data-roll-block') }
	}),
	parseHTML: () => [{ tag: 'span[data-roll]' }],
	renderHTML: ({ mark }) => [
		'span',
		{ class: 'roll-result', 'data-roll': mark.attrs.roll, 'data-roll-page': mark.attrs.page, 'data-roll-block': mark.attrs.block },
		0
	]
});

/** Il tiro dove sta il cursore (anche subito dopo): dove comincia, dove finisce e da quale tabella viene. */
export function rollAt(state: EditorState): { from: number; to: number; src: RollSource } | null {
	const type = state.schema.marks.rollResult;
	const range = type && getMarkRange(state.selection.$from, type);
	if (!range) return null;
	const mark = state.doc.nodeAt(range.from)?.marks.find((m) => m.type === type);
	if (!mark?.attrs.page || !mark.attrs.block) return null;
	return { ...range, src: { page: mark.attrs.page, block: mark.attrs.block, roll: mark.attrs.roll ?? undefined } };
}

/** Dove sta adesso il tiro `roll` (il testo può essere cambiato mentre si aspettava il server). */
function findRoll(state: EditorState, roll: string): { from: number; to: number } | null {
	const type = state.schema.marks.rollResult;
	let found: { from: number; to: number } | null = null;
	state.doc.descendants((node, pos) => {
		if (found) return false;
		const mark = node.marks.find((m) => m.type === type && m.attrs.roll === roll);
		if (mark) found = getMarkRange(state.doc.resolve(pos), type, mark.attrs) ?? null;
	});
	return found;
}

/**
 * Tira e mette il risultato al posto di `range`: col «/» dov'era il comando, col 🎲 al posto del tiro di prima.
 * Il cursore resta subito dopo il risultato: «Ritira» è già nella barra, e quello che si scrive dopo è testo normale.
 */
async function rollInto(editor: Editor, range: { from: number; to: number }, src: RollSource, deps: RollDeps) {
	const before = editor.state.doc;
	const answer = await deps.roll(src.page, src.block);
	if (editor.isDestroyed) return;
	deps.notify(answer);
	if (!answer?.ok || !answer.content.length) return;
	let at = range;
	if (editor.state.doc !== before) {
		const here = editor.state.selection.from;
		at = (src.roll && findRoll(editor.state, src.roll)) || { from: here, to: here };
	}
	const mark = { type: 'rollResult', attrs: { roll: src.roll ?? newBlockId(), page: src.page, block: src.block } };
	const nodes = answer.content.map((n) => ({ ...n, marks: [...(n.marks ?? []).filter((m) => m.type !== 'rollResult'), mark] }));
	editor.chain().focus().insertContentAt(at, nodes).run();
}

/** Ritira il tiro dove sta il cursore. */
export function reroll(editor: Editor, deps: RollDeps) {
	const r = rollAt(editor.state);
	if (r) void rollInto(editor, r, r.src, deps);
}

/** Il tiro dove sta il cursore diventa testo normale: non si ritira più. */
export function unlinkRoll(editor: Editor) {
	const r = rollAt(editor.state);
	const type = editor.schema.marks.rollResult;
	if (!r || !type) return;
	editor
		.chain()
		.focus()
		.command(({ tr }) => {
			tr.removeMark(r.from, r.to, type);
			return true;
		})
		.run();
}

const rollKeyPlugin = new PluginKey('rollSuggestion');

/** «/» e il nome di una tabella di tiro: tira e scrive il risultato. Senza tabelle che corrispondono non compare niente. */
const RollCommand = Extension.create<{ labels: EditorLabels; search: (q: string, signal: AbortSignal) => Promise<RollChoice[]>; deps: RollDeps }>({
	name: 'rollCommand',
	addOptions: () => ({ labels: {} as EditorLabels, search: async () => [], deps: { roll: async () => null, notify: () => {} } }),
	addProseMirrorPlugins() {
		const { labels, search, deps } = this.options;
		return [
			Suggestion<RollChoice, RollChoice>({
				editor: this.editor,
				pluginKey: rollKeyPlugin,
				char: '/',
				debounce: 120,
				// Nel codice «/» resta una barra.
				allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
				items: async ({ query, signal }) => search(query, signal).catch(() => []),
				command: ({ editor, range, props }) => {
					editor.chain().focus().deleteRange(range).run();
					const at = editor.state.selection.from;
					void rollInto(editor, { from: at, to: at }, { page: props.page, block: props.block }, deps);
				},
				render: () => suggestionPopup<RollChoice>(labels.rollTables, labels.noResults, (i) => ({ text: i.name, detail: i.pageTitle }), true)
			})
		];
	}
});

let popupSeq = 0;

/**
 * Elenco dei suggerimenti accessibile (listbox con aria-activedescendant), per pagine, regole e tabelle di tiro.
 * `hideEmpty`: senza niente da suggerire l'elenco non si vede e i tasti vanno all'editor (il «/» è anche una barra).
 */
function suggestionPopup<I>(
	listLabel: string,
	emptyText: string,
	show: (item: I) => { text: string; detail?: string; className?: string },
	hideEmpty = false
) {
	let el: HTMLDivElement;
	let unmount: (() => void) | undefined;
	let props: SuggestionProps<I, I>;
	let active = 0;
	const id = `suggest-${++popupSeq}`;

	const host = () => props.editor.view.dom as HTMLElement;

	const hidden = () => hideEmpty && !props.items.length;

	/**
	 * Senza elenco l'editor torna una casella di testo qualunque. Niente aria-expanded="false": su una casella di testo
	 * non è ammesso (axe lo segnala), e chiuso è come non averlo.
	 */
	function idle() {
		const dom = host();
		dom.removeAttribute('aria-controls');
		dom.removeAttribute('aria-activedescendant');
		dom.removeAttribute('aria-expanded');
	}

	function draw() {
		const items = props.items;
		el.replaceChildren();
		el.hidden = hidden();
		if (el.hidden) {
			idle();
			return;
		}
		const list = document.createElement('ul');
		list.id = id;
		list.setAttribute('role', 'listbox');
		list.setAttribute('aria-label', listLabel);
		if (!items.length) {
			const li = document.createElement('li');
			li.className = 'empty';
			li.textContent = props.loading ? '…' : emptyText;
			list.append(li);
		}
		items.forEach((item, i) => {
			const s = show(item);
			const li = document.createElement('li');
			li.id = `${id}-${i}`;
			li.setAttribute('role', 'option');
			li.setAttribute('aria-selected', String(i === active));
			li.textContent = s.text;
			if (s.detail) {
				const d = document.createElement('span');
				d.className = 'detail';
				d.textContent = s.detail;
				li.append(d);
			}
			if (s.className) li.className = s.className;
			li.addEventListener('mousedown', (e) => {
				e.preventDefault();
				props.command(item);
			});
			list.append(li);
		});
		el.append(list);
		const dom = host();
		dom.setAttribute('aria-controls', id);
		dom.setAttribute('aria-expanded', 'true');
		if (items.length) dom.setAttribute('aria-activedescendant', `${id}-${active}`);
		else dom.removeAttribute('aria-activedescendant');
	}

	function close() {
		idle();
		unmount?.();
		unmount = undefined;
	}

	return {
		onStart(p: SuggestionProps<I, I>) {
			props = p;
			active = 0;
			el = document.createElement('div');
			el.className = 'suggest-popup';
			draw();
			unmount = p.mount(el);
		},
		onUpdate(p: SuggestionProps<I, I>) {
			props = p;
			if (active >= p.items.length) active = 0;
			draw();
		},
		onKeyDown({ event }: SuggestionKeyDownProps) {
			const n = props.items.length;
			if (hidden()) return false;
			if (event.key === 'Escape') {
				close();
				return true;
			}
			if (!n) return false;
			if (event.key === 'ArrowDown') active = (active + 1) % n;
			else if (event.key === 'ArrowUp') active = (active - 1 + n) % n;
			else if (event.key === 'Enter' || event.key === 'Tab') {
				props.command(props.items[active]);
				return true;
			} else return false;
			draw();
			return true;
		},
		onExit() {
			close();
		}
	};
}

/** Esc esce dall'editor, così chi usa la tastiera non resta bloccato dentro. */
const EscapeLeaves = Extension.create({
	name: 'escapeLeaves',
	addKeyboardShortcuts: () => ({
		Escape: ({ editor }) => {
			(editor.view.dom as HTMLElement).blur();
			return true;
		}
	})
});

export function buildExtensions(opts: {
	labels: EditorLabels;
	canSecret: boolean;
	suggest: (q: string, signal: AbortSignal) => Promise<SuggestItem[]>;
	searchRules: (q: string, signal: AbortSignal) => Promise<RuleItem[]>;
	searchRollTables: (q: string, signal: AbortSignal) => Promise<RollChoice[]>;
	rollDeps: RollDeps;
}) {
	return [
		StarterKit.configure({
			heading: { levels: [2, 3, 4] },
			link: {
				openOnClick: false,
				autolink: true,
				defaultProtocol: 'https',
				isAllowedUri: (url) => safeHref(url) !== null
			}
		}),
		Image.configure({ inline: false, allowBase64: false }).extend({
			// Solo immagini caricate nella wiki o in https.
			parseHTML: () => [{ tag: 'img[src]', getAttrs: (el) => (safeImageSrc((el as HTMLElement).getAttribute('src')) ? null : false) }]
		}),
		Table.configure({ resizable: false }).extend({
			addAttributes() {
				return {
					...this.parent?.(),
					// Tabella di tiro (vedi content/rollTables.ts). C'è per tutti, anche per chi non la può creare: salvando resta.
					roll: {
						default: false,
						parseHTML: (el) => el.hasAttribute('data-roll-table'),
						renderHTML: (a) => (a.roll ? { 'data-roll-table': '' } : {})
					}
				};
			}
		}),
		TableRow,
		TableHeader,
		TableCell,
		Callout.configure({ labels: opts.labels }),
		Blocks.configure({ canSecret: opts.canSecret, labels: opts.labels }),
		WikiLink.configure({ labels: opts.labels, suggest: opts.suggest }),
		RuleRef.configure({ labels: opts.labels, search: opts.searchRules }),
		RollResult,
		RollCommand.configure({ labels: opts.labels, search: opts.searchRollTables, deps: opts.rollDeps }),
		// Il blocco in cui si sta scrivendo: nella modifica sul posto è evidenziato.
		Focus.configure({ mode: 'shallowest' }),
		EscapeLeaves
	];
}

export type { Editor, SuggestItem };

/** La tabella dove sta il cursore, se c'è. */
export function tableAt(state: EditorState): PmNode | null {
	const $from = state.selection.$from;
	for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') return $from.node(d);
	return null;
}

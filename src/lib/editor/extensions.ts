import { Extension, InputRule, Node, mergeAttributes, type Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { slugify } from '../slug.ts';
import { safeHref, safeImageSrc } from '../content/render.ts';
import { CALLOUT_KINDS } from '../content/types.ts';
import { parseRuleKind } from '../rules/index.ts';

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
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		wikiLink: {
			insertWikiLink: (attrs: { target: string; title: string; label?: string | null }) => ReturnType;
		};
		ruleRef: {
			insertRuleRef: (attrs: { kind: string; name: string; label?: string | null }) => ReturnType;
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

/** Blocco segreto: visibile solo a Master e Admin. */
const Secret = Node.create<{ labels: EditorLabels }>({
	name: 'secret',
	group: 'block',
	content: 'block+',
	defining: true,
	addOptions: () => ({ labels: {} as EditorLabels }),
	parseHTML: () => [{ tag: 'aside[data-secret]' }],
	renderHTML({ HTMLAttributes }) {
		return [
			'aside',
			mergeAttributes(HTMLAttributes, { 'data-secret': '', 'data-label': this.options.labels.secret, class: 'secret' }),
			0
		];
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
			`📖 ${label || name}`
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

let popupSeq = 0;

/** Elenco dei suggerimenti accessibile (listbox con aria-activedescendant), per pagine e regole. */
function suggestionPopup<I>(
	listLabel: string,
	emptyText: string,
	show: (item: I) => { text: string; detail?: string; className?: string }
) {
	let el: HTMLDivElement;
	let unmount: (() => void) | undefined;
	let props: SuggestionProps<I, I>;
	let active = 0;
	const id = `suggest-${++popupSeq}`;

	const host = () => props.editor.view.dom as HTMLElement;

	function draw() {
		const items = props.items;
		el.replaceChildren();
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
		const dom = host();
		dom.removeAttribute('aria-controls');
		dom.removeAttribute('aria-activedescendant');
		dom.setAttribute('aria-expanded', 'false');
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
		Table.configure({ resizable: false }),
		TableRow,
		TableHeader,
		TableCell,
		Callout.configure({ labels: opts.labels }),
		...(opts.canSecret ? [Secret.configure({ labels: opts.labels })] : []),
		WikiLink.configure({ labels: opts.labels, suggest: opts.suggest }),
		RuleRef.configure({ labels: opts.labels, search: opts.searchRules }),
		EscapeLeaves
	];
}

export type { Editor, SuggestItem };

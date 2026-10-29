import { CALLOUT_KINDS, type DocNode } from './types.ts';
import { INLINE_LINK } from './extract.ts';
import { slugify } from '../slug.ts';
import { ddbUrl, parseRuleKind, ruleKey, type RuleKind } from '../rules/index.ts';

export interface LinkTarget {
	title: string;
	/** false = la pagina esiste ma chi legge non può vederla. */
	visible: boolean;
}

export interface RenderOptions {
	showSecrets: boolean;
	resolve: (slug: string) => LinkTarget | undefined;
	/** Testi dell'interfaccia (già tradotti). `preview` contiene {name}. */
	labels: { secret: string; note: string; tip: string; warning: string; missing: string; preview?: string; external?: string };
	/** C'è un'anteprima del testo della regola (SRD)? */
	hasRule?: (kind: RuleKind, key: string) => boolean;
}

export const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Immagini: solo file caricati nella wiki o indirizzi https. */
export function safeImageSrc(src: unknown): string | null {
	if (typeof src !== 'string') return null;
	if (/^\/files\/[\w-]+$/.test(src)) return src;
	if (/^https:\/\/[^\s"'<>]+$/i.test(src)) return src;
	return null;
}

/** Solo indirizzi sicuri: http(s), mailto e percorsi interni. */
export function safeHref(href: unknown): string | null {
	if (typeof href !== 'string') return null;
	const h = href.trim();
	if (/^(https?:|mailto:)/i.test(h)) return h;
	if (/^\/(?!\/)/.test(h) || h.startsWith('#')) return h;
	return null;
}

function marks(text: string, list: DocNode['marks']): string {
	let html = esc(text);
	for (const m of list ?? []) {
		switch (m.type) {
			case 'bold':
				html = `<strong>${html}</strong>`;
				break;
			case 'italic':
				html = `<em>${html}</em>`;
				break;
			case 'underline':
				html = `<u>${html}</u>`;
				break;
			case 'strike':
				html = `<s>${html}</s>`;
				break;
			case 'code':
				html = `<code>${html}</code>`;
				break;
			case 'link': {
				const href = safeHref(m.attrs?.href);
				if (href) {
					const ext = /^https?:/i.test(href);
					html = `<a href="${esc(href)}"${ext ? ' rel="noopener noreferrer nofollow" target="_blank"' : ''}>${html}</a>`;
				}
				break;
			}
		}
	}
	return html;
}

function cellAttrs(n: DocNode): string {
	const a: string[] = [];
	const cs = Number(n.attrs?.colspan ?? 1);
	const rs = Number(n.attrs?.rowspan ?? 1);
	if (Number.isInteger(cs) && cs > 1 && cs < 100) a.push(` colspan="${cs}"`);
	if (Number.isInteger(rs) && rs > 1 && rs < 100) a.push(` rowspan="${rs}"`);
	return a.join('');
}

/** Trasforma il documento in HTML. Tutto ciò che non è riconosciuto viene ignorato. */
export function renderDoc(doc: DocNode, opt: RenderOptions): string {
	const kids = (n: DocNode) => (n.content ?? []).map(node).join('');

	function node(n: DocNode): string {
		switch (n.type) {
			case 'doc':
				return kids(n);
			case 'text':
				return marks(n.text ?? '', n.marks);
			case 'paragraph':
				return `<p>${kids(n)}</p>`;
			case 'heading': {
				const l = Math.min(4, Math.max(2, Number(n.attrs?.level) || 2));
				return `<h${l}>${kids(n)}</h${l}>`;
			}
			case 'bulletList':
				return `<ul>${kids(n)}</ul>`;
			case 'orderedList': {
				const start = Number(n.attrs?.start ?? 1);
				return `<ol${Number.isInteger(start) && start !== 1 ? ` start="${start}"` : ''}>${kids(n)}</ol>`;
			}
			case 'listItem':
				return `<li>${kids(n)}</li>`;
			case 'blockquote':
				return `<blockquote>${kids(n)}</blockquote>`;
			case 'codeBlock':
				return `<pre><code>${(n.content ?? []).map((c) => esc(c.text ?? '')).join('')}</code></pre>`;
			case 'horizontalRule':
				return '<hr>';
			case 'hardBreak':
				return '<br>';
			case 'image': {
				const src = safeImageSrc(n.attrs?.src);
				if (!src) return '';
				const alt = esc(String(n.attrs?.alt ?? ''));
				const title = n.attrs?.title ? ` title="${esc(String(n.attrs.title))}"` : '';
				return `<img src="${esc(src)}" alt="${alt}"${title} loading="lazy">`;
			}
			case 'table':
				return `<div class="table-wrap" tabindex="0"><table><tbody>${kids(n)}</tbody></table></div>`;
			case 'tableRow':
				return `<tr>${kids(n)}</tr>`;
			case 'tableHeader':
				return `<th scope="col"${cellAttrs(n)}>${kids(n)}</th>`;
			case 'tableCell':
				return `<td${cellAttrs(n)}>${kids(n)}</td>`;
			case 'callout': {
				const k = CALLOUT_KINDS.includes(n.attrs?.kind as never) ? (n.attrs!.kind as string) : 'note';
				const label = opt.labels[k as 'note' | 'tip' | 'warning'];
				return `<aside class="callout callout-${k}" aria-label="${esc(label)}"><p class="callout-title">${esc(label)}</p>${kids(n)}</aside>`;
			}
			case 'secret':
				if (!opt.showSecrets) return '';
				return `<aside class="secret" aria-label="${esc(opt.labels.secret)}"><p class="secret-title">${esc(opt.labels.secret)}</p>${kids(n)}</aside>`;
			case 'ruleRef': {
				const kind = parseRuleKind(String(n.attrs?.kind ?? ''));
				const name = String(n.attrs?.name ?? '');
				if (!kind || !name) return '';
				return ruleRefHtml(kind, name, n.attrs?.label ? String(n.attrs.label) : null, opt);
			}
			case 'wikiLink':
				return wikiLinkHtml(
					String(n.attrs?.target ?? ''),
					String(n.attrs?.title ?? n.attrs?.target ?? ''),
					n.attrs?.label ? String(n.attrs.label) : null,
					opt
				);
			default:
				return '';
		}
	}
	return node(doc);
}

type LinkOpts = Pick<RenderOptions, 'resolve' | 'labels' | 'hasRule'>;

/** Riferimento a una regola: link a D&D Beyond e, se c'è il testo SRD, il pulsante dell'anteprima. */
function ruleRefHtml(kind: RuleKind, name: string, label: string | null, opt: LinkOpts): string {
	const key = ruleKey(name);
	const ext = opt.labels.external ? `<span class="visually-hidden"> ${esc(opt.labels.external)}</span>` : '';
	const link = `<a class="ruleref-link" href="${esc(ddbUrl(kind, name))}" rel="noopener noreferrer nofollow" target="_blank">${esc(label ?? name)}${ext}</a>`;
	const info =
		opt.hasRule?.(kind, key) && opt.labels.preview
			? `<button type="button" class="rule-info" data-rule="${kind}/${esc(key)}" aria-label="${esc(opt.labels.preview.replace('{name}', label ?? name))}" aria-expanded="false" aria-haspopup="dialog">i</button>`
			: '';
	return `<span class="ruleref">${link}${info}</span>`;
}

function wikiLinkHtml(target: string, fallback: string, label: string | null, opt: LinkOpts): string {
	const page = target ? opt.resolve(target) : undefined;
	if (page?.visible) {
		return `<a class="wikilink" href="/wiki/${encodeURIComponent(target)}">${esc(label ?? page.title)}</a>`;
	}
	if (page) return `<span class="wikilink-hidden">${esc(label ?? fallback)}</span>`;
	const q = new URLSearchParams({ title: fallback, slug: target });
	return `<a class="wikilink missing" href="/wiki/new?${esc(q.toString())}" title="${esc(opt.labels.missing)}">${esc(label ?? fallback)}<span class="visually-hidden"> (${esc(opt.labels.missing)})</span></a>`;
}

/** Testo semplice con [[collegamenti]] (campi della scheda, descrizioni di eventi e pin). */
export function renderInline(text: string, opt: LinkOpts): string {
	let out = '';
	let last = 0;
	for (const m of text.matchAll(INLINE_LINK)) {
		out += esc(text.slice(last, m.index));
		if (m[1]) {
			const title = m[1].trim();
			out += wikiLinkHtml(slugify(title), title, m[2]?.trim() || null, opt);
		} else {
			const kind = parseRuleKind(m[3]);
			out += kind ? ruleRefHtml(kind, m[4].trim(), m[5]?.trim() || null, opt) : esc(m[0]);
		}
		last = m.index! + m[0].length;
	}
	return out + esc(text.slice(last));
}

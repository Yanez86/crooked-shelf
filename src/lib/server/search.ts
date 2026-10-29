import { getSqlite } from './db/index.ts';
import { isMaster, type Viewer } from '../access.ts';

/** Trasforma il testo cercato in una query FTS5 sicura: ogni parola è un prefisso, tutte obbligatorie. */
export function ftsQuery(q: string, columns: string[]): string | null {
	const terms = q
		.normalize('NFC')
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean)
		.slice(0, 12);
	if (!terms.length) return null;
	const cols = `{${columns.join(' ')}}`;
	return terms.map((t) => `${cols} : "${t.replace(/"/g, '""')}"*`).join(' AND ');
}

export interface SearchHit {
	slug: string;
	title: string;
	snippet: string;
}

const MARK_OPEN = '\u0001';
const MARK_CLOSE = '\u0002';

/** Ricerca nel testo; chi non è Master non cerca nei segreti. */
export function searchPages(q: string, u: Viewer | null, limit = 30): SearchHit[] {
	const master = isMaster(u);
	const match = ftsQuery(q, master ? ['title', 'body', 'secret_body'] : ['title', 'body']);
	if (!match) return [];
	const vis = !u
		? `p.visibility = 'public'`
		: `(p.visibility IN (${master ? `'public','players','master'` : `'public','players'`}) OR (p.visibility = 'personal' AND p.author_id = @uid))`;
	const rows = getSqlite()
		.prepare(
			`SELECT p.slug, p.title,
				snippet(pages_fts, 1, @o, @c, '…', 24) AS body_snip
				${master ? `, snippet(pages_fts, 2, @o, @c, '…', 24) AS secret_snip` : ''}
			FROM pages_fts JOIN pages p ON p.id = pages_fts.rowid
			WHERE pages_fts MATCH @match AND p.deleted_at IS NULL AND ${vis}
			ORDER BY bm25(pages_fts, 10.0, 1.0, 1.0)
			LIMIT @limit`
		)
		.all({ match, o: MARK_OPEN, c: MARK_CLOSE, uid: u?.id ?? 0, limit }) as {
		slug: string;
		title: string;
		body_snip: string;
		secret_snip?: string;
	}[];
	return rows.map((r) => ({
		slug: r.slug,
		title: r.title,
		snippet: r.body_snip.includes(MARK_OPEN) || !r.secret_snip?.includes(MARK_OPEN) ? r.body_snip : r.secret_snip
	}));
}

/** Evidenzia i termini trovati in HTML sicuro. */
export function snippetHtml(s: string): string {
	const esc = s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
	return esc.replaceAll(MARK_OPEN, '<mark>').replaceAll(MARK_CLOSE, '</mark>');
}

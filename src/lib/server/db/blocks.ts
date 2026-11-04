import type Database from 'better-sqlite3';
import { idsToRenew, liftBlocks, newBlockId } from '../../content/blocks.ts';
import { extract } from '../../content/extract.ts';
import { isDoc, type DocNode, type PageField } from '../../content/types.ts';

/**
 * Migrazione dopo la 0.13: il segreto del Master diventa la visibilità di un blocco (vedi content/blocks.ts).
 * - I riquadri «secret» diventano i blocchi che contenevano, oscurati uno per uno; un segreto dentro un altro blocco
 *   (un riquadro, un elenco) oscura tutto quel blocco: nel dubbio si nasconde di più, mai di meno.
 * - Ogni blocco di primo livello delle pagine riceve il suo id.
 * - Nelle versioni i blocchi uguali a uno della pagina prendono il suo id: ripristinando una versione recente
 *   i segreti tornano dove erano. Gli altri restano senza: lo riceveranno al salvataggio.
 * Le pagine con un segreto hanno di nuovo indice di ricerca e collegamenti: un riquadro diventato segreto non si trova più.
 */
export function blocksMigration(db: Database.Database) {
	const parse = (raw: string): DocNode | null => {
		try {
			const d = JSON.parse(raw);
			return isDoc(d) ? d : null;
		} catch {
			return null;
		}
	};
	const parseFields = (raw: string): PageField[] => {
		try {
			const f = JSON.parse(raw);
			return Array.isArray(f) ? f : [];
		} catch {
			return [];
		}
	};
	// Un blocco senza il suo id, per riconoscerlo nelle versioni.
	const key = (b: DocNode) => {
		const { id: _, ...attrs } = b.attrs ?? {};
		return JSON.stringify({ ...b, attrs: Object.keys(attrs).length ? attrs : undefined });
	};

	const setPage = db.prepare('UPDATE pages SET content = ?, has_secret = ? WHERE id = ?');
	const clearFts = db.prepare('DELETE FROM pages_fts WHERE rowid = ?');
	const addFts = db.prepare('INSERT INTO pages_fts (rowid, title, body, secret_body) VALUES (?, ?, ?, ?)');
	const clearLinks = db.prepare('DELETE FROM page_links WHERE from_page_id = ?');
	const addLink = db.prepare('INSERT INTO page_links (from_page_id, target_slug, secret) VALUES (?, ?, ?)');
	const idsOf = new Map<number, Map<string, string>>();

	const rows = db.prepare('SELECT id, title, content, fields, deleted_at FROM pages').all() as { id: number; title: string; content: string; fields: string; deleted_at: number | null }[];
	for (const p of rows) {
		const doc = parse(p.content);
		if (!doc) continue;
		const lifted = liftBlocks(doc);
		const blocks = lifted.content!;
		const renew = idsToRenew(blocks.map((b) => b.attrs?.id));
		const content = blocks.map((b, i) => (renew.has(i) ? { ...b, attrs: { ...b.attrs, id: newBlockId() } } : b));
		const next: DocNode = { ...lifted, content };
		idsOf.set(p.id, new Map(content.map((b) => [key(b), String(b.attrs!.id)])));
		const ex = extract(next, parseFields(p.fields));
		setPage.run(JSON.stringify(next), ex.hasSecret ? 1 : 0, p.id);
		// Le pagine nel cestino non hanno indice né collegamenti: li riavranno se tornano.
		if (!p.content.includes('"secret"') || p.deleted_at !== null) continue;
		clearFts.run(p.id);
		addFts.run(p.id, p.title, ex.body, ex.secretBody);
		clearLinks.run(p.id);
		for (const l of ex.links) addLink.run(p.id, l.target, l.secret ? 1 : 0);
	}

	const setRevision = db.prepare('UPDATE page_revisions SET content = ? WHERE id = ?');
	const revisions = db.prepare('SELECT id, page_id, content FROM page_revisions').all() as { id: number; page_id: number; content: string }[];
	for (const r of revisions) {
		const doc = parse(r.content);
		if (!doc) continue;
		const ids = idsOf.get(r.page_id);
		const used = new Set<string>();
		const content = liftBlocks(doc).content!.map((b) => {
			const id = ids?.get(key(b));
			if (!id || used.has(id)) return b;
			used.add(id);
			return { ...b, attrs: { ...b.attrs, id } };
		});
		setRevision.run(JSON.stringify({ ...doc, content }), r.id);
	}
}

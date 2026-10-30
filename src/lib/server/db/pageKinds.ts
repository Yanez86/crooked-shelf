import type Database from 'better-sqlite3';
import { extract } from '../../content/extract.ts';
import type { DocNode, PageField, SessionInfo } from '../../content/types.ts';
import { translate, DEFAULT_LOCALE } from '../../i18n/index.ts';
import { slugify } from '../../slug.ts';
import { BUILTIN_TEMPLATES, builtinTemplate } from '../../templates.ts';

/**
 * Migrazione dopo la 0.10: template, mappe e cronologie diventano tipi di pagina.
 * - ogni mappa diventa una pagina «mappa» (la descrizione è il testo della pagina), nella cartella Mappe;
 * - le due cronologie (mondo e campagna) diventano due pagine «cronologia» con i loro eventi;
 * - i template creati dal Master e quelli preinstallati diventano pagine «template» nella cartella Template.
 * Scrive direttamente nel database (come le migrazioni SQL), così non cambia se cambiano le funzioni delle pagine.
 */
export function pageKindsMigration(db: Database.Database) {
	db.exec(`
	ALTER TABLE pages ADD COLUMN kind TEXT NOT NULL DEFAULT 'page' CHECK (kind IN ('page','template','map','timeline'));
	CREATE INDEX pages_kind ON pages(kind);
	ALTER TABLE maps ADD COLUMN page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE;
	CREATE TABLE timelines (
		page_id INTEGER PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
		mode TEXT NOT NULL CHECK (mode IN ('world','campaign'))
	);
	`);

	const one = <T>(q: string, ...p: unknown[]) => db.prepare(q).get(...p) as T | undefined;
	const all = <T>(q: string, ...p: unknown[]) => db.prepare(q).all(...p) as T[];

	const rawLocale = one<{ value: string }>(`SELECT value FROM settings WHERE key = 'defaultLocale'`)?.value;
	let locale = DEFAULT_LOCALE;
	try {
		if (rawLocale) locale = String(JSON.parse(rawLocale));
	} catch {
		/* resta l'inglese */
	}
	const t = (k: string) => translate(locale, k);
	const hasWiki = (one<{ n: number }>('SELECT count(*) AS n FROM users')?.n ?? 0) > 0;
	const author = one<{ id: number }>(`SELECT id FROM users ORDER BY CASE role WHEN 'admin' THEN 0 WHEN 'master' THEN 1 ELSE 2 END, id LIMIT 1`)?.id ?? null;
	const now = Date.now();

	const uniqueSlug = (base: string) => {
		let slug = base;
		for (let i = 2; one('SELECT 1 FROM pages WHERE slug = ?', slug); i++) slug = `${base}-${i}`;
		return slug;
	};

	const folder = (name: string) => {
		const slug = slugify(name, 'folder');
		const hit = one<{ id: number }>('SELECT id FROM categories WHERE slug = ?', slug);
		if (hit) return hit.id;
		return Number(db.prepare(`INSERT INTO categories (name, slug, parent_id, description) VALUES (?, ?, NULL, '')`).run(name, slug).lastInsertRowid);
	};

	const insertPage = (p: {
		slug: string;
		title: string;
		content: DocNode;
		kind: 'template' | 'map' | 'timeline';
		visibility: string;
		categoryId: number | null;
		fields?: PageField[];
		session?: SessionInfo | null;
		template?: string | null;
		icon?: string | null;
		authorId: number | null;
		createdAt: number;
		updatedAt: number;
	}): number => {
		const fields = p.fields ?? [];
		const ex = extract(p.content, fields);
		const id = Number(
			db
				.prepare(
					`INSERT INTO pages (slug, title, content, visibility, players_can_edit, has_secret, category_id, author_id, updated_by, created_at, updated_at, fields, template, session, icon, kind)
					VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					p.slug,
					p.title,
					JSON.stringify(p.content),
					p.visibility,
					ex.hasSecret ? 1 : 0,
					p.categoryId,
					p.authorId,
					p.authorId,
					p.createdAt,
					p.updatedAt,
					JSON.stringify(fields),
					p.template ?? null,
					p.session ? JSON.stringify(p.session) : null,
					p.icon ?? null,
					p.kind
				).lastInsertRowid
		);
		for (const l of ex.links) db.prepare('INSERT INTO page_links (from_page_id, target_slug, secret) VALUES (?, ?, ?)').run(id, l.target, l.secret ? 1 : 0);
		db.prepare('INSERT INTO pages_fts (rowid, title, body, secret_body) VALUES (?, ?, ?, ?)').run(id, p.title, ex.body, ex.secretBody);
		db.prepare(
			`INSERT INTO page_revisions (page_id, title, content, fields, visibility, has_secret, edited_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		).run(id, p.title, JSON.stringify(p.content), JSON.stringify(fields), p.visibility, ex.hasSecret ? 1 : 0, p.authorId, p.updatedAt);
		return id;
	};

	const paragraphs = (text: string): DocNode => {
		const parts = text
			.split(/\n\s*\n/)
			.map((s) => s.replace(/\s*\n\s*/g, ' ').trim())
			.filter(Boolean);
		return { type: 'doc', content: parts.length ? parts.map((s) => ({ type: 'paragraph', content: [{ type: 'text', text: s }] })) : [{ type: 'paragraph' }] };
	};

	// Mappe: una pagina per mappa, con lo stesso indirizzo se è libero.
	const maps = all<{ id: number; slug: string; title: string; description: string; visibility: string; created_by: number | null; created_at: number; updated_at: number }>(
		'SELECT id, slug, title, description, visibility, created_by, created_at, updated_at FROM maps ORDER BY id'
	);
	const mapsFolder = maps.length ? folder(t('kinds.folder.map')) : null;
	for (const m of maps) {
		const pageId = insertPage({
			slug: uniqueSlug(m.slug),
			title: m.title,
			content: paragraphs(m.description),
			kind: 'map',
			visibility: m.visibility,
			categoryId: mapsFolder,
			authorId: m.created_by,
			createdAt: m.created_at,
			updatedAt: m.updated_at
		});
		db.prepare('UPDATE maps SET page_id = ? WHERE id = ?').run(pageId, m.id);
	}
	db.exec('CREATE UNIQUE INDEX maps_page ON maps(page_id)');

	// Cronologie: le due di prima diventano pagine; gli eventi passano alla loro pagina.
	// Quelli dei resoconti di sessione non hanno una pagina: compaiono in tutte le cronologie della campagna.
	const events = one<{ n: number }>('SELECT count(*) AS n FROM timeline_events')?.n ?? 0;
	let world: number | null = null;
	let campaign: number | null = null;
	if (hasWiki || events) {
		const timeline = (mode: 'world' | 'campaign') => {
			const title = t(`timeline.${mode}`);
			const id = insertPage({
				slug: uniqueSlug(slugify(title, 'timeline')),
				title,
				content: paragraphs(t(`timeline.${mode}Intro`)),
				kind: 'timeline',
				visibility: 'public',
				categoryId: null,
				authorId: author,
				createdAt: now,
				updatedAt: now
			});
			db.prepare('INSERT INTO timelines (page_id, mode) VALUES (?, ?)').run(id, mode);
			return id;
		};
		world = timeline('world');
		campaign = timeline('campaign');
	}
	db.exec(`
	CREATE TABLE timeline_events_new (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timeline_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		year INTEGER,
		month INTEGER,
		day INTEGER,
		approx TEXT NOT NULL DEFAULT '',
		sort_key INTEGER,
		real_date TEXT,
		page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
		source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','session')),
		visibility TEXT NOT NULL CHECK (visibility IN ('public','players','master')),
		created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		CHECK ((source = 'session') = (timeline_id IS NULL))
	);
	`);
	db.prepare(
		`INSERT INTO timeline_events_new (id, timeline_id, title, description, year, month, day, approx, sort_key, real_date, page_id, source, visibility, created_by, created_at, updated_at)
		SELECT id, CASE WHEN source = 'session' THEN NULL WHEN timeline = 'world' THEN ? ELSE ? END,
			title, description, year, month, day, approx, sort_key, real_date, page_id, source, visibility, created_by, created_at, updated_at
		FROM timeline_events`
	).run(world, campaign);
	db.exec(`
	DROP TABLE timeline_events;
	ALTER TABLE timeline_events_new RENAME TO timeline_events;
	CREATE INDEX timeline_events_sort ON timeline_events(timeline_id, sort_key);
	CREATE INDEX timeline_events_page ON timeline_events(page_id);
	CREATE UNIQUE INDEX timeline_events_session ON timeline_events(page_id) WHERE source = 'session';
	`);

	// Template: quelli preinstallati (se la wiki c'è già) e quelli creati dal Master.
	// `template` di una pagina diceva da quale template veniva ("b:npc", "c:3"): ora è l'indirizzo della pagina template.
	const custom = all<{ id: number; name: string; fields: string; content: string; session: number; created_by: number | null; created_at: number; updated_at: number }>(
		'SELECT id, name, fields, content, session, created_by, created_at, updated_at FROM templates ORDER BY id'
	);
	const origin = new Map<string, string>();
	if (hasWiki || custom.length) {
		const tplFolder = folder(t('kinds.folder.template'));
		const add = (key: string, tp: { name: string; fields: string[]; content: DocNode; session: boolean; icon?: string | null }, by: number | null, created: number, updated: number) => {
			const slug = uniqueSlug(slugify(tp.name, 'template'));
			insertPage({
				slug,
				title: tp.name,
				content: tp.content,
				kind: 'template',
				visibility: 'players',
				categoryId: tplFolder,
				fields: tp.fields.map((label) => ({ label, value: '' })),
				session: tp.session ? { number: null, realDate: null, world: null } : null,
				template: key,
				icon: tp.icon ?? null,
				authorId: by,
				createdAt: created,
				updatedAt: updated
			});
			origin.set(key, slug);
		};
		if (hasWiki) for (const id of BUILTIN_TEMPLATES) add(`b:${id}`, builtinTemplate(id, locale), author, now, now);
		for (const r of custom) {
			let content: DocNode = { type: 'doc', content: [{ type: 'paragraph' }] };
			let fields: string[] = [];
			try {
				const c = JSON.parse(r.content);
				if (c?.type === 'doc') content = c;
				const f = JSON.parse(r.fields);
				if (Array.isArray(f)) fields = f.map(String);
			} catch {
				/* template rovinato: resta vuoto */
			}
			add(`c:${r.id}`, { name: r.name, fields, content, session: !!r.session }, r.created_by, r.created_at, r.updated_at);
		}
	}
	const remap = db.prepare(`UPDATE pages SET template = ? WHERE template = ? AND kind = 'page'`);
	for (const [key, slug] of origin) remap.run(slug, key);
	db.exec('DROP TABLE templates');
}

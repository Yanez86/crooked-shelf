import type Database from 'better-sqlite3';

/** Copia i dati nella tabella `<t>_new` (tutti nella prima campagna) e la mette al posto di `<t>`. */
function replaceTable(db: Database.Database, t: string) {
	const cols = (db.pragma(`table_info(${t})`) as { name: string }[]).map((c) => c.name).join(', ');
	db.exec(`
	INSERT INTO ${t}_new (campaign_id, ${cols}) SELECT 1, ${cols} FROM ${t};
	DROP TABLE ${t};
	ALTER TABLE ${t}_new RENAME TO ${t};
	`);
}

/**
 * Una installazione contiene più campagne, ognuna col suo Master.
 * La wiki che c'era diventa la campagna 1, creata anche su un database vuoto per la configurazione iniziale: la tiene
 * il primo Master attivo, o in mancanza il primo Admin; tutti gli altri utenti ne fanno parte.
 * Home e calendario passano dalle impostazioni alla campagna. Pagine, cartelle e tag si rifanno perché
 * l'indirizzo (e il nome del tag) ora è unico nella campagna: SQLite non sa togliere un UNIQUE.
 * Gira a chiavi esterne spente (vedi `migrate`): altrimenti DROP TABLE cancellerebbe tutto ciò che dipende dalla tabella.
 */
export function campaignsMigration(db: Database.Database) {
	const orphans = () => (db.pragma('foreign_key_check') as unknown[]).length;
	const before = orphans();
	const setting = (key: string) => (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? 'null';
	const master = db.prepare(`SELECT id FROM users WHERE role IN ('master','admin') ORDER BY disabled, role = 'admin', id LIMIT 1`).get() as { id: number } | undefined;

	db.exec(`
	CREATE TABLE campaigns (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		master_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		home_page_id INTEGER,
		calendar TEXT,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE campaign_members (
		campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		PRIMARY KEY (campaign_id, user_id)
	);
	CREATE INDEX campaign_members_user ON campaign_members(user_id);
	ALTER TABLE invites ADD COLUMN campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE;
	`);
	db.prepare('INSERT INTO campaigns (id, name, master_id, home_page_id, calendar, created_at) VALUES (1, ?, ?, ?, ?, ?)').run(
		JSON.parse(setting('siteName')) ?? 'Crooked Shelf',
		master?.id ?? null,
		JSON.parse(setting('homePage')),
		setting('calendar') === 'null' ? null : setting('calendar'),
		Date.now()
	);
	db.prepare('INSERT INTO campaign_members (campaign_id, user_id) SELECT 1, id FROM users WHERE id IS NOT ?').run(master?.id ?? null);
	db.exec(`
	UPDATE invites SET campaign_id = 1 WHERE role <> 'admin';
	DELETE FROM settings WHERE key IN ('homePage', 'calendar');

	CREATE TABLE pages_new (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
		slug TEXT NOT NULL,
		title TEXT NOT NULL,
		content TEXT NOT NULL,
		visibility TEXT NOT NULL CHECK (visibility IN ('public','players','master','personal')),
		players_can_edit INTEGER NOT NULL DEFAULT 0,
		has_secret INTEGER NOT NULL DEFAULT 0,
		category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
		author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
		updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		deleted_at INTEGER,
		fields TEXT NOT NULL DEFAULT '[]',
		template TEXT,
		session TEXT,
		image_id TEXT REFERENCES files(id) ON DELETE SET NULL,
		icon TEXT,
		cover_image_id TEXT REFERENCES files(id) ON DELETE SET NULL,
		cover_color TEXT,
		cover_y INTEGER NOT NULL DEFAULT 50,
		kind TEXT NOT NULL DEFAULT 'page' CHECK (kind IN ('page','template','map','timeline','board')),
		parent_page_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
		sort INTEGER,
		UNIQUE (campaign_id, slug)
	);
	CREATE TABLE categories_new (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
		name TEXT NOT NULL,
		slug TEXT NOT NULL,
		parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
		description TEXT NOT NULL DEFAULT '',
		parent_page_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
		sort INTEGER,
		deleted_at INTEGER,
		UNIQUE (campaign_id, slug)
	);
	CREATE TABLE tags_new (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
		name TEXT NOT NULL COLLATE NOCASE,
		slug TEXT NOT NULL,
		color TEXT NOT NULL DEFAULT 'gray',
		UNIQUE (campaign_id, name),
		UNIQUE (campaign_id, slug)
	);
	CREATE TABLE tree_dividers_new (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
		category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
		parent_page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
		sort INTEGER
	);
	CREATE TABLE resources_new (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		file_id TEXT NOT NULL REFERENCES files(id),
		visibility TEXT NOT NULL CHECK (visibility IN ('public','players','master')),
		created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	`);
	for (const t of ['pages', 'categories', 'tags', 'tree_dividers', 'resources']) replaceTable(db, t);
	db.exec(`
	CREATE INDEX pages_category ON pages(category_id);
	CREATE INDEX pages_updated ON pages(updated_at);
	CREATE INDEX pages_kind ON pages(kind);
	`);
	if (orphans() > before) throw new Error('campaignsMigration: chiavi esterne rotte');
}

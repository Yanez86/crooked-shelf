// Migrazioni SQL in ordine. Non modificare quelle già pubblicate: aggiungine una nuova in fondo.
export const MIGRATIONS: string[] = [
	`
	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE COLLATE NOCASE,
		display_name TEXT NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL CHECK (role IN ('admin','master','player')),
		disabled INTEGER NOT NULL DEFAULT 0,
		prefs TEXT NOT NULL DEFAULT '{}',
		created_at INTEGER NOT NULL
	);
	CREATE TABLE sessions (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		expires_at INTEGER NOT NULL
	);
	CREATE INDEX sessions_user ON sessions(user_id);
	CREATE TABLE invites (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		token_hash TEXT NOT NULL UNIQUE,
		role TEXT NOT NULL CHECK (role IN ('admin','master','player')),
		created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL,
		expires_at INTEGER NOT NULL,
		used_at INTEGER,
		used_by INTEGER REFERENCES users(id) ON DELETE SET NULL
	);
	CREATE TABLE settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	CREATE TABLE categories (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
		description TEXT NOT NULL DEFAULT ''
	);
	CREATE TABLE tags (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE COLLATE NOCASE,
		slug TEXT NOT NULL UNIQUE,
		color TEXT NOT NULL DEFAULT 'gray'
	);
	CREATE TABLE pages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		slug TEXT NOT NULL UNIQUE,
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
		deleted_at INTEGER
	);
	CREATE INDEX pages_category ON pages(category_id);
	CREATE INDEX pages_updated ON pages(updated_at);
	CREATE TABLE page_tags (
		page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
		tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
		PRIMARY KEY (page_id, tag_id)
	);
	CREATE TABLE page_links (
		from_page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
		target_slug TEXT NOT NULL,
		secret INTEGER NOT NULL DEFAULT 0
	);
	CREATE INDEX page_links_target ON page_links(target_slug);
	CREATE INDEX page_links_from ON page_links(from_page_id);
	CREATE VIRTUAL TABLE pages_fts USING fts5(
		title, body, secret_body,
		tokenize = 'unicode61 remove_diacritics 2'
	);
	`
];

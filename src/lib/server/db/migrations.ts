import type Database from 'better-sqlite3';
import { pageKindsMigration } from './pageKinds.ts';

// Migrazioni in ordine: SQL, oppure una funzione per quelle che devono anche tradurre o convertire dati.
// Non modificare quelle già pubblicate: aggiungine una nuova in fondo.
export const MIGRATIONS: (string | ((db: Database.Database) => void))[] = [
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
	`,
	// Fase 2: campi delle pagine, resoconti di sessione, file, template, mappe, cronologie.
	`
	ALTER TABLE pages ADD COLUMN fields TEXT NOT NULL DEFAULT '[]';
	ALTER TABLE pages ADD COLUMN template TEXT;
	ALTER TABLE pages ADD COLUMN session TEXT;
	CREATE TABLE files (
		id TEXT PRIMARY KEY,
		sha256 TEXT NOT NULL,
		name TEXT NOT NULL,
		mime TEXT NOT NULL,
		size INTEGER NOT NULL,
		width INTEGER NOT NULL,
		height INTEGER NOT NULL,
		uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX files_sha ON files(sha256);
	CREATE TABLE templates (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		fields TEXT NOT NULL DEFAULT '[]',
		content TEXT NOT NULL,
		session INTEGER NOT NULL DEFAULT 0,
		created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE TABLE maps (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		slug TEXT NOT NULL UNIQUE,
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		file_id TEXT NOT NULL REFERENCES files(id),
		width INTEGER NOT NULL,
		height INTEGER NOT NULL,
		visibility TEXT NOT NULL CHECK (visibility IN ('public','players','master')),
		parent_id INTEGER REFERENCES maps(id) ON DELETE SET NULL,
		scale REAL,
		unit TEXT NOT NULL DEFAULT '',
		created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE TABLE map_layers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		map_id INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		visibility TEXT NOT NULL CHECK (visibility IN ('players','master')),
		sort INTEGER NOT NULL DEFAULT 0
	);
	CREATE TABLE map_pins (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		map_id INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
		layer_id INTEGER REFERENCES map_layers(id) ON DELETE SET NULL,
		x REAL NOT NULL,
		y REAL NOT NULL,
		label TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		icon TEXT NOT NULL DEFAULT 'pin',
		color TEXT NOT NULL DEFAULT 'red',
		page_slug TEXT,
		target_map_id INTEGER REFERENCES maps(id) ON DELETE SET NULL,
		visibility TEXT NOT NULL CHECK (visibility IN ('players','master'))
	);
	CREATE INDEX map_pins_map ON map_pins(map_id);
	CREATE INDEX map_pins_page ON map_pins(page_slug);
	CREATE TABLE timeline_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timeline TEXT NOT NULL CHECK (timeline IN ('world','campaign')),
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
		updated_at INTEGER NOT NULL
	);
	CREATE INDEX timeline_events_sort ON timeline_events(timeline, sort_key);
	CREATE UNIQUE INDEX timeline_events_session ON timeline_events(page_id) WHERE source = 'session';
	`,
	// Fase 3: versioni delle pagine, bacheche.
	`
	CREATE TABLE page_revisions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		content TEXT NOT NULL,
		fields TEXT NOT NULL DEFAULT '[]',
		visibility TEXT NOT NULL,
		has_secret INTEGER NOT NULL DEFAULT 0,
		edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL
	);
	CREATE INDEX page_revisions_page ON page_revisions(page_id, id);
	INSERT INTO page_revisions (page_id, title, content, fields, visibility, has_secret, edited_by, created_at)
		SELECT id, title, content, fields, visibility, has_secret, updated_by, updated_at FROM pages;
	CREATE TABLE boards (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
		visibility TEXT NOT NULL CHECK (visibility IN ('players','master')),
		created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE board_columns (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		sort INTEGER NOT NULL DEFAULT 0
	);
	CREATE TABLE board_cards (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		column_id INTEGER NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		body TEXT NOT NULL DEFAULT '',
		color TEXT NOT NULL DEFAULT 'yellow',
		sort INTEGER NOT NULL DEFAULT 0,
		created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	CREATE INDEX board_cards_column ON board_cards(column_id, sort);
	`,
	// Immagine della pagina (riquadro in alto a destra).
	`
	ALTER TABLE pages ADD COLUMN image_id TEXT REFERENCES files(id) ON DELETE SET NULL;
	`,
	// Icona della pagina (nell'albero a sinistra).
	`
	ALTER TABLE pages ADD COLUMN icon TEXT;
	`,
	// Icone della pagina: dalle emoji ai disegni a tratto (si salva il nome).
	`
	UPDATE pages SET icon = CASE icon
		WHEN '📜' THEN 'scroll'
		WHEN '📖' THEN 'book'
		WHEN '👤' THEN 'person'
		WHEN '👑' THEN 'crown'
		WHEN '🧙' THEN 'hat'
		WHEN '🧝' THEN 'leaf'
		WHEN '⚔️' THEN 'swords'
		WHEN '🛡️' THEN 'shield'
		WHEN '🏹' THEN 'bow'
		WHEN '🐉' THEN 'claws'
		WHEN '👹' THEN 'horns'
		WHEN '💀' THEN 'skull'
		WHEN '🏰' THEN 'castle'
		WHEN '🏘️' THEN 'house'
		WHEN '🍺' THEN 'mug'
		WHEN '⛪' THEN 'temple'
		WHEN '🌲' THEN 'tree'
		WHEN '⛰️' THEN 'mountain'
		WHEN '🌊' THEN 'wave'
		WHEN '🗺️' THEN 'map'
		WHEN '🕯️' THEN 'candle'
		WHEN '💰' THEN 'coins'
		WHEN '💎' THEN 'gem'
		WHEN '🗝️' THEN 'key'
		WHEN '⭐' THEN 'star'
		WHEN '⚠️' THEN 'warning'
		WHEN '🌀' THEN 'spiral'
		WHEN '🔥' THEN 'flame'
		WHEN '🌙' THEN 'moon'
		WHEN '⚙️' THEN 'cog'
	END
	WHERE icon IS NOT NULL;
	`,
	// Risorse: immagini, audio e altri file della campagna, nella seconda linguetta dell'albero.
	`
	CREATE TABLE resources (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		file_id TEXT NOT NULL REFERENCES files(id),
		visibility TEXT NOT NULL CHECK (visibility IN ('public','players','master')),
		created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);
	`,
	// L'immagine della pagina diventa il primo riquadro della colonna a lato.
	`
	UPDATE pages SET fields = CASE
		WHEN json_array_length(fields) = 0 THEN json_array(json_object('label', '', 'value', '', 'image', image_id))
		ELSE '[' || json_object('label', '', 'value', '', 'image', image_id) || ',' || substr(json(fields), 2)
	END
	WHERE image_id IS NOT NULL AND json_valid(fields) AND json_type(fields) = 'array';
	`,
	// Icona dell'utente (nel profilo in alto a destra): il nome di un'icona delle pagine.
	`
	ALTER TABLE users ADD COLUMN icon TEXT;
	`,
	// Template, mappe e cronologie diventano tipi di pagina.
	pageKindsMigration
];

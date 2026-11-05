import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

import { ROLES, VISIBILITIES } from '../../roles.ts';
import { PAGE_KINDS, TIMELINE_MODES } from '../../pageKinds.ts';
import type { PageField, SessionInfo } from '../../content/types.ts';
import type { Calendar } from '../../calendar.ts';
import { ANSWERS, MODES, REPEATS } from '../../schedule.ts';

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	displayName: text('display_name').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ROLES }).notNull(),
	disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
	prefs: text('prefs', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
	icon: text('icon'),
	/** Immagine caricata dall'utente: se c'è, prende il posto dell'icona. Il tipo esplicito rompe il giro users → files → users. */
	avatar: text('avatar').references((): AnySQLiteColumn => files.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull()
});

/** Una campagna: la sua wiki (pagine, cartelle, tag, risorse) sta tutta dietro `campaignId`, le righe legate a una pagina dietro la pagina. */
export const campaigns = sqliteTable('campaigns', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	/** Il Master: uno solo per campagna. */
	masterId: integer('master_id').references(() => users.id, { onDelete: 'set null' }),
	/** La pagina che fa da home. */
	homePageId: integer('home_page_id'),
	/** Calendario del mondo; finché non viene scelto si usa il gregoriano. */
	calendar: text('calendar', { mode: 'json' }).$type<Calendar | null>(),
	createdAt: integer('created_at').notNull(),
	/** La cartella PG, con le schede dei giocatori: non si elimina. Null = non ancora preparata (vedi sheets.ts). */
	pcFolderId: integer('pc_folder_id'),
	/** Il template delle schede nuove; null = pagina bianca. */
	sheetTemplateId: integer('sheet_template_id'),
	/** Appuntamenti (calendario delle sessioni, remoto, regola del minimo, Stars & Wishes): un'opzione che il Master accende. Spenta, i dati restano. */
	schedule: integer('schedule', { mode: 'boolean' }).notNull().default(false),
	/** Appuntamenti: il link per giocare da remoto (Discord o altro), se l'appuntamento non ne ha uno suo. */
	remoteLink: text('remote_link'),
	/** Sotto questi giocatori confermati la sessione salta (0 = nessuna regola)… */
	minPlayers: integer('min_players').notNull().default(0),
	/** …quando mancano queste ore all'inizio. */
	quorumHours: integer('quorum_hours').notNull().default(24),
	/** Stars & Wishes: dopo ogni sessione, due domande a chi è venuto (vedi schedule.ts). */
	starWishes: integer('star_wishes', { mode: 'boolean' }).notNull().default(false)
});

/** I giocatori di una campagna. */
export const campaignMembers = sqliteTable(
	'campaign_members',
	{
		campaignId: integer('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.campaignId, t.userId] })]
);

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull(),
	/** Inizio: oltre SESSION_MAX_DAYS da qui la sessione scade comunque, anche se usata. */
	createdAt: integer('created_at').notNull().default(0)
});

/** Link per reimpostare la password, creato dall'Admin per chi l'ha dimenticata: una volta sola, pochi giorni. */
export const passwordResets = sqliteTable('password_resets', {
	tokenHash: text('token_hash').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
	expiresAt: integer('expires_at').notNull()
});

/** Registro delle azioni che contano per la sicurezza (vedi audit.ts). */
export const auditLog = sqliteTable(
	'audit_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		at: integer('at').notNull(),
		userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
		ip: text('ip').notNull().default(''),
		action: text('action').notNull(),
		detail: text('detail').notNull().default('')
	},
	(t) => [index('audit_log_at').on(t.at)]
);

/** Il token con cui Claude legge una campagna (/mcp), coi permessi di chi l'ha creato. */
export const apiTokens = sqliteTable(
	'api_tokens',
	{
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		campaignId: integer('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		/** '' per il token creato nel profilo; per il connettore (OAuth), il sito a cui è andato, es. claude.ai. */
		client: text('client').notNull().default(''),
		tokenHash: text('token_hash').notNull().unique(),
		canWrite: integer('can_write', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at').notNull().default(0),
		/** Ultimo uso (aggiornato al più una volta all'ora); un token fermo da TOKEN_IDLE_DAYS smette di valere. */
		lastUsedAt: integer('last_used_at')
	},
	(t) => [primaryKey({ columns: [t.userId, t.campaignId, t.client] })]
);

export const invites = sqliteTable('invites', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	tokenHash: text('token_hash').notNull().unique(),
	role: text('role', { enum: ROLES }).notNull(),
	createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull(),
	expiresAt: integer('expires_at').notNull(),
	usedAt: integer('used_at'),
	usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' }),
	/** Dove entra chi lo usa; null per gli inviti da Master o Admin, che non stanno in una campagna. */
	campaignId: integer('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' })
});

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull()
});

export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id),
	name: text('name').notNull(),
	slug: text('slug').notNull(),
	parentId: integer('parent_id'),
	description: text('description').notNull().default(''),
	/** La pagina che la contiene nell'albero; intanto `parentId` è null. */
	parentPageId: integer('parent_page_id'),
	/** Posizione nell'albero; null = mai spostata. */
	sort: integer('sort'),
	/** Nel cestino, insieme a ciò che conteneva: cartelle e pagine di quel momento hanno lo stesso `deletedAt`. */
	deletedAt: integer('deleted_at')
}, (t) => [uniqueIndex('categories_slug').on(t.campaignId, t.slug)]);

/** Le righe che separano le voci dell'albero. Senza `categoryId` e `parentPageId` stanno alla radice. */
export const treeDividers = sqliteTable('tree_dividers', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id),
	categoryId: integer('category_id'),
	parentPageId: integer('parent_page_id'),
	sort: integer('sort')
});

export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id),
	name: text('name').notNull(),
	slug: text('slug').notNull(),
	color: text('color').notNull().default('gray')
}, (t) => [uniqueIndex('tags_name').on(t.campaignId, t.name), uniqueIndex('tags_slug').on(t.campaignId, t.slug)]);

export const pages = sqliteTable(
	'pages',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		campaignId: integer('campaign_id')
			.notNull()
			.references(() => campaigns.id),
		slug: text('slug').notNull(),
		title: text('title').notNull(),
		content: text('content', { mode: 'json' }).notNull(),
		visibility: text('visibility', { enum: VISIBILITIES }).notNull(),
		playersCanEdit: integer('players_can_edit', { mode: 'boolean' }).notNull().default(false),
		hasSecret: integer('has_secret', { mode: 'boolean' }).notNull().default(false),
		categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
		authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
		updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull(),
		deletedAt: integer('deleted_at'),
		fields: text('fields', { mode: 'json' }).$type<PageField[]>().notNull().default([]),
		/**
		 * Da dove viene la pagina: per una pagina, l'indirizzo del template da cui è stata fotocopiata;
		 * per un template, la sua origine ("b:npc" preinstallato, "p:<plugin>:<n>" da un plugin). Solo informativo.
		 */
		template: text('template'),
		/** Resoconto di sessione; in un template: le pagine fatte con lui sono resoconti. */
		session: text('session', { mode: 'json' }).$type<SessionInfo | null>(),
		imageId: text('image_id').references(() => files.id, { onDelete: 'set null' }),
		icon: text('icon'),
		kind: text('kind', { enum: PAGE_KINDS }).notNull().default('page'),
		coverImageId: text('cover_image_id').references(() => files.id, { onDelete: 'set null' }),
		coverColor: text('cover_color'),
		coverY: integer('cover_y').notNull().default(50),
		/** La pagina che la contiene nell'albero: `categoryId` resta quello della pagina che la contiene. */
		parentPageId: integer('parent_page_id'),
		/** Posizione nell'albero; null = mai spostata. */
		sort: integer('sort'),
		/** La scheda di questo giocatore (una per campagna): sta nella cartella PG, non si elimina, non ha segreti. */
		sheetOf: integer('sheet_of').references(() => users.id, { onDelete: 'set null' })
	},
	(t) => [uniqueIndex('pages_slug').on(t.campaignId, t.slug), index('pages_category').on(t.categoryId), index('pages_updated').on(t.updatedAt), index('pages_kind').on(t.kind)]
);

export const pageTags = sqliteTable(
	'page_tags',
	{
		pageId: integer('page_id')
			.notNull()
			.references(() => pages.id, { onDelete: 'cascade' }),
		tagId: integer('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.pageId, t.tagId] })]
);

export const pageLinks = sqliteTable(
	'page_links',
	{
		fromPageId: integer('from_page_id')
			.notNull()
			.references(() => pages.id, { onDelete: 'cascade' }),
		targetSlug: text('target_slug').notNull(),
		secret: integer('secret', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [index('page_links_target').on(t.targetSlug)]
);

/** Le tabelle di tiro delle pagine (vedi content/rollTables.ts), per trovarle col «/» nell'editor. Come i collegamenti, si rifanno a ogni salvataggio. */
export const rollTables = sqliteTable(
	'roll_tables',
	{
		pageId: integer('page_id')
			.notNull()
			.references(() => pages.id, { onDelete: 'cascade' }),
		blockId: text('block_id').notNull(),
		name: text('name').notNull(),
		/** In un blocco oscurato: la trova e la tira solo il Master. */
		secret: integer('secret', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [primaryKey({ columns: [t.pageId, t.blockId] })]
);

export const files = sqliteTable('files', {
	id: text('id').primaryKey(),
	sha256: text('sha256').notNull(),
	name: text('name').notNull(),
	mime: text('mime').notNull(),
	size: integer('size').notNull(),
	width: integer('width').notNull(),
	height: integer('height').notNull(),
	uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull()
});

/** Dove è usato un file: decide chi lo può scaricare (vedi files.ts). `refId`: id della pagina, mappa, risorsa o utente; 0 per i temi. */
export const fileUses = sqliteTable(
	'file_uses',
	{
		fileId: text('file_id')
			.notNull()
			.references(() => files.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['page', 'map', 'resource', 'theme', 'avatar'] }).notNull(),
		refId: integer('ref_id').notNull()
	},
	(t) => [primaryKey({ columns: [t.fileId, t.kind, t.refId] }), index('file_uses_ref').on(t.kind, t.refId)]
);

/**
 * La mappa di una pagina «mappa». Titolo, testo e visibilità sono quelli della pagina; `slug`, `title`,
 * `description` e `visibility` restano dalla 0.10, quando la mappa era a sé (`slug` serve ai vecchi indirizzi /maps/…).
 */
export const maps = sqliteTable('maps', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	pageId: integer('page_id')
		.notNull()
		.unique()
		.references(() => pages.id, { onDelete: 'cascade' }),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	fileId: text('file_id')
		.notNull()
		.references(() => files.id),
	width: integer('width').notNull(),
	height: integer('height').notNull(),
	visibility: text('visibility', { enum: ['public', 'players', 'master'] }).notNull(),
	parentId: integer('parent_id'),
	scale: real('scale'),
	unit: text('unit').notNull().default(''),
	createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const mapLayers = sqliteTable('map_layers', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	mapId: integer('map_id')
		.notNull()
		.references(() => maps.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	visibility: text('visibility', { enum: ['players', 'master'] }).notNull(),
	sort: integer('sort').notNull().default(0)
});

export const mapPins = sqliteTable('map_pins', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	mapId: integer('map_id')
		.notNull()
		.references(() => maps.id, { onDelete: 'cascade' }),
	layerId: integer('layer_id').references(() => mapLayers.id, { onDelete: 'set null' }),
	x: real('x').notNull(),
	y: real('y').notNull(),
	label: text('label').notNull(),
	description: text('description').notNull().default(''),
	icon: text('icon').notNull().default('pin'),
	color: text('color').notNull().default('red'),
	pageSlug: text('page_slug'),
	targetMapId: integer('target_map_id'),
	visibility: text('visibility', { enum: ['players', 'master'] }).notNull()
});

/** Una pagina «cronologia»: del mondo o della campagna. */
export const timelines = sqliteTable('timelines', {
	pageId: integer('page_id')
		.primaryKey()
		.references(() => pages.id, { onDelete: 'cascade' }),
	mode: text('mode', { enum: TIMELINE_MODES }).notNull()
});

export const timelineEvents = sqliteTable('timeline_events', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	/** La pagina della cronologia; null per le voci dei resoconti di sessione (sono in tutte quelle della campagna). */
	timelineId: integer('timeline_id').references(() => pages.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	year: integer('year'),
	month: integer('month'),
	day: integer('day'),
	approx: text('approx').notNull().default(''),
	sortKey: integer('sort_key'),
	realDate: text('real_date'),
	pageId: integer('page_id').references(() => pages.id, { onDelete: 'cascade' }),
	source: text('source', { enum: ['manual', 'session'] }).notNull().default('manual'),
	visibility: text('visibility', { enum: ['public', 'players', 'master'] }).notNull(),
	createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const pageRevisions = sqliteTable('page_revisions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	pageId: integer('page_id')
		.notNull()
		.references(() => pages.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	content: text('content', { mode: 'json' }).notNull(),
	fields: text('fields', { mode: 'json' }).$type<PageField[]>().notNull().default([]),
	visibility: text('visibility', { enum: VISIBILITIES }).notNull(),
	hasSecret: integer('has_secret', { mode: 'boolean' }).notNull().default(false),
	editedBy: integer('edited_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull()
});

export const boards = sqliteTable('boards', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	/** null = bacheca condivisa del gruppo. */
	ownerId: integer('owner_id').references(() => users.id, { onDelete: 'cascade' }),
	visibility: text('visibility', { enum: ['players', 'master'] }).notNull(),
	createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull(),
	/** La pagina «bacheca» (dalla 0.11): visibilità e permessi sono quelli della pagina. */
	pageId: integer('page_id').references(() => pages.id, { onDelete: 'cascade' })
});

export const boardColumns = sqliteTable('board_columns', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	boardId: integer('board_id')
		.notNull()
		.references(() => boards.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	sort: integer('sort').notNull().default(0)
});

export const boardCards = sqliteTable('board_cards', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	columnId: integer('column_id')
		.notNull()
		.references(() => boardColumns.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	body: text('body').notNull().default(''),
	color: text('color').notNull().default('yellow'),
	sort: integer('sort').notNull().default(0),
	createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const resources = sqliteTable('resources', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	fileId: text('file_id')
		.notNull()
		.references(() => files.id),
	visibility: text('visibility', { enum: ['public', 'players', 'master'] }).notNull(),
	createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

/** Un appuntamento del calendario della campagna; se si ripete, le date si calcolano (vedi schedule.ts). */
export const appointments = sqliteTable(
	'appointments',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		campaignId: integer('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		/** La prima data, `YYYY-MM-DD`. */
		date: text('date').notNull(),
		/** `HH:MM`; se `ends` viene prima di `starts` si finisce dopo mezzanotte. */
		starts: text('starts').notNull(),
		ends: text('ends').notNull(),
		inPerson: integer('in_person', { mode: 'boolean' }).notNull(),
		remote: integer('remote', { mode: 'boolean' }).notNull(),
		/** Come gioca il Master che prepara l'appuntamento: uno dei modi ammessi. */
		masterMode: text('master_mode', { enum: MODES }).notNull().default('in_person'),
		/** Dove ci si trova, in presenza. */
		place: text('place').notNull().default(''),
		/** Il link per il remoto; null = quello della campagna. */
		link: text('link'),
		repeat: text('repeat', { enum: REPEATS }).notNull().default('none'),
		until: text('until'),
		/** Le date della serie annullate dal Master. */
		skips: text('skips', { mode: 'json' }).$type<string[]>().notNull().default([]),
		createdAt: integer('created_at').notNull()
	},
	(t) => [index('appointments_campaign').on(t.campaignId)]
);

/** La risposta di un giocatore per una data di un appuntamento. */
export const appointmentAnswers = sqliteTable(
	'appointment_answers',
	{
		appointmentId: integer('appointment_id')
			.notNull()
			.references(() => appointments.id, { onDelete: 'cascade' }),
		date: text('date').notNull(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		answer: text('answer', { enum: ANSWERS }).notNull()
	},
	(t) => [primaryKey({ columns: [t.appointmentId, t.date, t.userId] })]
);

/** Stars & Wishes: che cosa è piaciuto di una sessione e che cosa esplorare nella prossima. Una risposta sola, che non si cambia. */
export const starWishes = sqliteTable(
	'star_wishes',
	{
		appointmentId: integer('appointment_id')
			.notNull()
			.references(() => appointments.id, { onDelete: 'cascade' }),
		date: text('date').notNull(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		star: text('star').notNull(),
		wish: text('wish').notNull(),
		createdAt: integer('created_at').notNull()
	},
	(t) => [primaryKey({ columns: [t.appointmentId, t.date, t.userId] })]
);

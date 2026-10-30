import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

import { ROLES, VISIBILITIES } from '../../roles.ts';
import { PAGE_KINDS, TIMELINE_MODES } from '../../pageKinds.ts';
import type { PageField, SessionInfo } from '../../content/types.ts';

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	displayName: text('display_name').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ROLES }).notNull(),
	disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
	prefs: text('prefs', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
	icon: text('icon'),
	createdAt: integer('created_at').notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull()
});

export const invites = sqliteTable('invites', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	tokenHash: text('token_hash').notNull().unique(),
	role: text('role', { enum: ROLES }).notNull(),
	createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull(),
	expiresAt: integer('expires_at').notNull(),
	usedAt: integer('used_at'),
	usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' })
});

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull()
});

export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	parentId: integer('parent_id'),
	description: text('description').notNull().default('')
});

export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	slug: text('slug').notNull().unique(),
	color: text('color').notNull().default('gray')
});

export const pages = sqliteTable(
	'pages',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		slug: text('slug').notNull().unique(),
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
		kind: text('kind', { enum: PAGE_KINDS }).notNull().default('page')
	},
	(t) => [index('pages_category').on(t.categoryId), index('pages_updated').on(t.updatedAt), index('pages_kind').on(t.kind)]
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
	createdAt: integer('created_at').notNull()
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

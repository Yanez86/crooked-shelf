import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

import { ROLES, VISIBILITIES } from '../../roles.ts';

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	displayName: text('display_name').notNull(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ROLES }).notNull(),
	disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
	prefs: text('prefs', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
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
		deletedAt: integer('deleted_at')
	},
	(t) => [index('pages_category').on(t.categoryId), index('pages_updated').on(t.updatedAt)]
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

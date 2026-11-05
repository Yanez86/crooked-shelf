import { describe, expect, it } from 'vitest';
import { getSqlite, migrate, useMemoryDb } from './index.ts';
import { MIGRATIONS, themesRemovedMigration } from './migrations.ts';
import { THEME_IDS } from '../../themes.ts';

describe('migrazione: temi Lago e Lago di notte tolti', () => {
	it('chi li usava passa ad Aria, chiara o scura come prima; gli altri restano come sono', () => {
		useMemoryDb(MIGRATIONS.indexOf(themesRemovedMigration));
		const db = getSqlite();
		const user = (id: number, prefs: string) =>
			db.prepare(`INSERT INTO users (id, username, display_name, password_hash, role, created_at, prefs) VALUES (?, ?, 'U', 'x', 'player', 0, ?)`).run(id, `u${id}`, prefs);
		user(1, '{"theme":"lake","fontSize":"125"}');
		user(2, '{"theme":"lake-dark"}');
		user(3, '{"theme":"neon"}');
		user(4, '{}');
		user(5, 'non è JSON');
		migrate(db);
		const prefs = (id: number) => (db.prepare('SELECT prefs FROM users WHERE id = ?').get(id) as { prefs: string }).prefs;
		expect(JSON.parse(prefs(1))).toEqual({ theme: 'aria', fontSize: '125' });
		expect(JSON.parse(prefs(2))).toEqual({ theme: 'aria-dark' });
		expect(JSON.parse(prefs(3))).toEqual({ theme: 'neon' });
		expect(JSON.parse(prefs(4))).toEqual({});
		expect(prefs(5)).toBe('non è JSON');
	});
	it('i temi tolti non ci sono più, quelli di arrivo sì', () => {
		expect(THEME_IDS).not.toContain('lake');
		expect(THEME_IDS).not.toContain('lake-dark');
		expect(THEME_IDS).toEqual(expect.arrayContaining(['auto', 'aria', 'aria-dark', 'neon', 'light', 'dark']));
	});
});

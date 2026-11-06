import { describe, expect, it } from 'vitest';
import { getSqlite, migrate, useMemoryDb } from './index.ts';
import { MIGRATIONS, oneAdminMigration } from './migrations.ts';

describe('migrazione: un solo Admin, niente Master negli account', () => {
	const setup = () => {
		useMemoryDb(MIGRATIONS.indexOf(oneAdminMigration));
		const db = getSqlite();
		const user = (id: number, role: string, disabled = 0) =>
			db.prepare(`INSERT INTO users (id, username, display_name, password_hash, role, disabled, created_at) VALUES (?, ?, 'U', 'x', ?, ?, 0)`).run(id, `u${id}`, role, disabled);
		return { db, user };
	};
	const roles = (db: ReturnType<typeof getSqlite>) => Object.fromEntries((db.prepare('SELECT id, role FROM users').all() as { id: number; role: string }[]).map((r) => [r.id, r.role]));

	it("resta Admin il più vecchio tra quelli attivi; gli altri, e i Master, diventano account normali, e il registro lo dice", () => {
		const { db, user } = setup();
		user(1, 'admin', 1);
		user(2, 'admin');
		user(3, 'admin');
		user(4, 'master');
		user(5, 'player');
		db.prepare(`INSERT INTO invites (token_hash, role, created_at, expires_at) VALUES ('a', 'admin', 0, 1), ('m', 'master', 0, 1), ('p', 'player', 0, 1)`).run();
		migrate(db);
		expect(roles(db)).toEqual({ 1: 'player', 2: 'admin', 3: 'player', 4: 'player', 5: 'player' });
		expect((db.prepare('SELECT DISTINCT role FROM invites').all() as { role: string }[]).map((r) => r.role)).toEqual(['player']);
		expect((db.prepare(`SELECT detail FROM audit_log WHERE action = 'user_updated' ORDER BY detail`).all() as { detail: string }[]).map((r) => r.detail)).toEqual([
			'u1: admin → player (one admin)',
			'u3: admin → player (one admin)'
		]);
	});

	it('con un solo Admin non cambia niente per lui; un secondo Admin il database non lo accetta', () => {
		const { db, user } = setup();
		user(1, 'admin');
		user(2, 'master');
		migrate(db);
		expect(roles(db)).toEqual({ 1: 'admin', 2: 'player' });
		expect(db.prepare(`SELECT count(*) AS n FROM audit_log`).get()).toEqual({ n: 0 });
		expect(() => db.prepare(`UPDATE users SET role = 'admin' WHERE id = 2`).run()).toThrow(/UNIQUE/);
	});
});

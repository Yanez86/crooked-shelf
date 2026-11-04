import { desc, eq, lt } from 'drizzle-orm';
import { getDb, schema } from './db/index.ts';

/**
 * Registro delle azioni che contano per la sicurezza: accessi (riusciti e no), cambi di ruolo e password, inviti, token di
 * Claude, backup. Lo legge l'Admin in Amministrazione. Niente contenuti delle pagine.
 */
export type AuditAction =
	| 'login'
	| 'login_failed'
	| 'logout'
	| 'setup'
	| 'register'
	| 'password_changed'
	| 'password_reset_link'
	| 'password_reset'
	| 'user_updated'
	| 'invite_created'
	| 'invite_revoked'
	| 'campaign_master'
	| 'campaign_deleted'
	| 'token_created'
	| 'token_revoked'
	| 'oauth_consent'
	| 'backup_downloaded'
	| 'export_downloaded'
	| 'world_imported'
	| 'settings_changed'
	| 'sessions_closed';

const KEEP_DAYS = 180;

export function audit(action: AuditAction, who: { userId?: number | null; ip?: string }, detail = '') {
	try {
		getDb()
			.insert(schema.auditLog)
			.values({ at: Date.now(), userId: who.userId ?? null, ip: (who.ip ?? '').slice(0, 64), action, detail: detail.slice(0, 500) })
			.run();
	} catch (e) {
		console.error('Registro:', e);
	}
}

export function listAudit(limit = 200) {
	const { auditLog, users } = schema;
	return getDb()
		.select({ id: auditLog.id, at: auditLog.at, ip: auditLog.ip, action: auditLog.action, detail: auditLog.detail, user: users.username })
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.userId))
		.orderBy(desc(auditLog.id))
		.limit(limit)
		.all();
}

export function pruneAuditLog(now = Date.now()) {
	getDb().delete(schema.auditLog).where(lt(schema.auditLog.at, now - KEEP_DAYS * 24 * 60 * 60 * 1000)).run();
}

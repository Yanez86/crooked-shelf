import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { getDb, schema } from './db/index.ts';
import type { Role } from '../roles.ts';

const { users, sessions, invites } = schema;

export const SESSION_COOKIE = 'cs_session';
const DAY = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 30;

export const PASSWORD_MIN = 10;
export const USERNAME_RE = /^[\p{L}\p{N}._-]{3,32}$/u;

export interface SessionUser {
	id: number;
	username: string;
	displayName: string;
	role: Role;
	prefs: Record<string, string>;
	/** Nome di un'icona delle pagine; senza, la sagoma di una persona. */
	icon: string | null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export const hashPassword = (p: string) => hash(p);
export const verifyPassword = (h: string, p: string) => verify(h, p).catch(() => false);

// Usato per i nomi utente inesistenti, così il tempo di risposta non rivela chi esiste.
let dummyHash: string | undefined;
export async function burnTime(p: string) {
	dummyHash ??= await hash('crooked-shelf-dummy-password');
	await verifyPassword(dummyHash, p);
}

export function countUsers(): number {
	const r = getDb().select({ n: sql<number>`count(*)` }).from(users).get();
	return r?.n ?? 0;
}

let usersExist = false;
/** Esiste almeno un utente? (finché no, si va alla configurazione iniziale) */
export const hasUsers = () => (usersExist ||= countUsers() > 0);

export function findUserByName(username: string) {
	return getDb().select().from(users).where(sql`${users.username} = ${username} COLLATE NOCASE`).get();
}

export interface NewUser {
	username: string;
	displayName: string;
	role: Role;
}

/** Inserisce un utente con la password già cifrata (sincrono, utilizzabile in una transazione). */
export function insertUser(input: NewUser, passwordHash: string): number {
	const r = getDb()
		.insert(users)
		.values({
			username: input.username,
			displayName: input.displayName || input.username,
			passwordHash,
			role: input.role,
			createdAt: Date.now()
		})
		.returning({ id: users.id })
		.get();
	usersExist = true;
	return r.id;
}

export async function createUser(input: NewUser & { password: string }): Promise<number> {
	return insertUser(input, await hashPassword(input.password));
}

/** Registra un utente da invito: invito controllato e consumato nello stesso passaggio. */
export async function redeemInvite(token: string, input: Omit<NewUser, 'role'> & { password: string }): Promise<number | null> {
	const passwordHash = await hashPassword(input.password);
	return getDb().transaction(() => {
		const inv = findInvite(token);
		if (!inv) return null;
		const id = insertUser({ ...input, role: inv.role }, passwordHash);
		markInviteUsed(inv.id, id);
		return id;
	});
}

export function createSession(userId: number): { token: string; expires: Date } {
	const token = newToken();
	const expiresAt = Date.now() + SESSION_DAYS * DAY;
	getDb().insert(sessions).values({ id: sha256(token), userId, expiresAt }).run();
	return { token, expires: new Date(expiresAt) };
}

/** Restituisce l'utente della sessione e allunga la scadenza se è a metà. */
export function validateSession(token: string): { user: SessionUser; expires?: Date } | null {
	const db = getDb();
	const id = sha256(token);
	const row = db
		.select({ s: sessions, u: users })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return null;
	const now = Date.now();
	if (row.s.expiresAt < now || row.u.disabled) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}
	let expires: Date | undefined;
	if (row.s.expiresAt - now < (SESSION_DAYS / 2) * DAY) {
		const expiresAt = now + SESSION_DAYS * DAY;
		db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
		expires = new Date(expiresAt);
	}
	const { id: uid, username, displayName, role, prefs, icon } = row.u;
	return { user: { id: uid, username, displayName, role, prefs: prefs ?? {}, icon }, expires };
}

export function deleteSession(token: string) {
	getDb().delete(sessions).where(eq(sessions.id, sha256(token))).run();
}

export function deleteUserSessions(userId: number) {
	getDb().delete(sessions).where(eq(sessions.userId, userId)).run();
}

export function purgeExpiredSessions() {
	getDb().delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();
}

export function setSessionCookie(cookies: Cookies, url: URL, token: string, expires: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		// In rete locale senza HTTPS il cookie "secure" non verrebbe salvato.
		secure: url.protocol === 'https:',
		expires
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

// --- Inviti ---

export function createInvite(role: Role, createdBy: number, days: number): string {
	const token = newToken();
	const now = Date.now();
	getDb()
		.insert(invites)
		.values({ tokenHash: sha256(token), role, createdBy, createdAt: now, expiresAt: now + days * DAY })
		.run();
	return token;
}

export function findInvite(token: string) {
	return getDb()
		.select()
		.from(invites)
		.where(and(eq(invites.tokenHash, sha256(token)), isNull(invites.usedAt), gt(invites.expiresAt, Date.now())))
		.get();
}

export function markInviteUsed(id: number, userId: number) {
	getDb().update(invites).set({ usedAt: Date.now(), usedBy: userId }).where(eq(invites.id, id)).run();
}

// --- Limite ai tentativi di accesso (in memoria) ---

const attempts = new Map<string, { n: number; until: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW = 15 * 60 * 1000;

export function isLimited(key: string): boolean {
	const a = attempts.get(key);
	if (!a) return false;
	if (a.until < Date.now()) {
		attempts.delete(key);
		return false;
	}
	return a.n >= MAX_ATTEMPTS;
}

export function recordFailure(key: string) {
	const a = attempts.get(key);
	if (!a || a.until < Date.now()) attempts.set(key, { n: 1, until: Date.now() + WINDOW });
	else a.n++;
}

export const clearFailures = (key: string) => attempts.delete(key);

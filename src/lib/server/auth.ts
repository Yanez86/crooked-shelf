import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull, lt, ne, sql } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { getDb, schema } from './db/index.ts';
import { addMember } from './campaigns.ts';
import type { Role } from '../roles.ts';

const { users, sessions, invites, campaigns, apiTokens, passwordResets } = schema;

/** In HTTPS il cookie ha il prefisso __Host-: il browser lo accetta solo sicuro, su tutto il sito e senza dominio. */
export const sessionCookie = (url: URL) => (url.protocol === 'https:' ? '__Host-cs_session' : 'cs_session');
const DAY = 24 * 60 * 60 * 1000;
/** Senza visite la sessione scade dopo questi giorni (la scadenza si allunga a ogni visita)… */
const SESSION_DAYS = 30;
/** …ma mai oltre questi dall'accesso: dopo si rifà il login. */
export const SESSION_MAX_DAYS = 90;
/** Un token di Claude non usato da questi giorni smette di valere. */
export const TOKEN_IDLE_DAYS = 90;

export const PASSWORD_MIN = 10;
export const USERNAME_RE = /^[\p{L}\p{N}._-]{3,32}$/u;

export interface SessionUser {
	id: number;
	username: string;
	displayName: string;
	/** Il ruolo dell'account; hooks.server.ts lo sostituisce col ruolo nella campagna (vedi roleIn). */
	role: Role;
	/** L'account è Admin: resta vero anche quando `role` diventa il ruolo nella campagna. */
	admin: boolean;
	/** Il ruolo dell'account (admin, master, player), che non cambia con la campagna: decide la quota di spazio. */
	accountRole: Role;
	prefs: Record<string, string>;
	/** Nome di un'icona delle pagine; senza, la sagoma di una persona. */
	icon: string | null;
	/** Id del file dell'immagine caricata, che prende il posto dell'icona. */
	avatar: string | null;
	/** Vista giocatore (la imposta hooks.server.ts): vedi Viewer. */
	asPlayer?: boolean;
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
		if (inv.campaignId) addMember(inv.campaignId, id);
		markInviteUsed(inv.id, id);
		return id;
	});
}

/** Chi ha già un account entra nella campagna dell'invito, col ruolo di giocatore. Restituisce la campagna. */
export function joinInvite(token: string, userId: number): number | null {
	return getDb().transaction(() => {
		const inv = findInvite(token);
		if (!inv?.campaignId) return null;
		addMember(inv.campaignId, userId);
		markInviteUsed(inv.id, userId);
		return inv.campaignId;
	});
}

export function createSession(userId: number): { token: string; expires: Date } {
	const token = newToken();
	const now = Date.now();
	const expiresAt = now + SESSION_DAYS * DAY;
	getDb().insert(sessions).values({ id: sha256(token), userId, expiresAt, createdAt: now }).run();
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
	const end = row.s.createdAt + SESSION_MAX_DAYS * DAY;
	if (row.s.expiresAt < now || end < now || row.u.disabled) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}
	let expires: Date | undefined;
	if (row.s.expiresAt - now < (SESSION_DAYS / 2) * DAY && row.s.expiresAt < end) {
		const expiresAt = Math.min(end, now + SESSION_DAYS * DAY);
		db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
		expires = new Date(expiresAt);
	}
	return { user: sessionUser(row.u), expires };
}

function sessionUser({ id, username, displayName, role, prefs, icon, avatar }: typeof users.$inferSelect): SessionUser {
	return { id, username, displayName, role, admin: role === 'admin', accountRole: role, prefs: prefs ?? {}, icon, avatar };
}

export function deleteSession(token: string) {
	getDb().delete(sessions).where(eq(sessions.id, sha256(token))).run();
}

/** Chiude tutti gli accessi di una persona, compresi i token: chi ha rubato la password non deve poter restare. */
export function deleteUserSessions(userId: number) {
	getDb().delete(sessions).where(eq(sessions.userId, userId)).run();
	getDb().delete(apiTokens).where(eq(apiTokens.userId, userId)).run();
}

export function purgeExpiredSessions(now = Date.now()) {
	getDb()
		.delete(sessions)
		.where(sql`${sessions.expiresAt} < ${now} OR ${sessions.createdAt} < ${now - SESSION_MAX_DAYS * DAY}`)
		.run();
}

/** Quante sessioni aperte ha una persona (dispositivi e browser). */
export function countSessions(userId: number): number {
	return getDb().select({ n: sql<number>`count(*)` }).from(sessions).where(eq(sessions.userId, userId)).get()?.n ?? 0;
}

/** Chiude le sessioni di una persona tranne quella in uso. */
export function deleteOtherSessions(userId: number, token: string) {
	getDb().delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, sha256(token)))).run();
}

export function setSessionCookie(cookies: Cookies, url: URL, token: string, expires: Date) {
	cookies.set(sessionCookie(url), token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		// In rete locale senza HTTPS il cookie "secure" non verrebbe salvato.
		secure: url.protocol === 'https:',
		expires
	});
}

export function clearSessionCookie(cookies: Cookies, url: URL) {
	cookies.delete(sessionCookie(url), { path: '/' });
}

// --- Reimpostazione della password (link creato dall'Admin) ---

const RESET_DAYS = 2;

export function createPasswordReset(userId: number, createdBy: number): string {
	const token = newToken();
	getDb().delete(passwordResets).where(eq(passwordResets.userId, userId)).run();
	getDb().insert(passwordResets).values({ tokenHash: sha256(token), userId, createdBy, expiresAt: Date.now() + RESET_DAYS * DAY }).run();
	return token;
}

export function findPasswordReset(token: string) {
	return getDb()
		.select({ userId: passwordResets.userId, username: users.username })
		.from(passwordResets)
		.innerJoin(users, eq(users.id, passwordResets.userId))
		.where(and(eq(passwordResets.tokenHash, sha256(token)), gt(passwordResets.expiresAt, Date.now()), eq(users.disabled, false)))
		.get();
}

/** Nuova password dal link: il link si consuma e tutte le sessioni e i token di prima si chiudono. */
export async function redeemPasswordReset(token: string, password: string): Promise<number | null> {
	const r = findPasswordReset(token);
	if (!r) return null;
	const passwordHash = await hashPassword(password);
	return getDb().transaction(() => {
		if (!findPasswordReset(token)) return null;
		getDb().update(users).set({ passwordHash }).where(eq(users.id, r.userId)).run();
		getDb().delete(passwordResets).where(eq(passwordResets.userId, r.userId)).run();
		deleteUserSessions(r.userId);
		return r.userId;
	});
}

export function purgeExpiredResets(now = Date.now()) {
	getDb().delete(passwordResets).where(lt(passwordResets.expiresAt, now)).run();
}

// --- Token per Claude ---

/** Si vede una volta sola e sostituisce quello di prima dello stesso client: nel database c'è solo l'impronta. */
export function createApiToken(userId: number, campaignId: number, canWrite = false, client = ''): string {
	const token = newToken();
	const tokenHash = sha256(token);
	const createdAt = Date.now();
	getDb()
		.insert(apiTokens)
		.values({ userId, campaignId, client, tokenHash, canWrite, createdAt, lastUsedAt: null })
		.onConflictDoUpdate({ target: [apiTokens.userId, apiTokens.campaignId, apiTokens.client], set: { tokenHash, canWrite, createdAt, lastUsedAt: null } })
		.run();
	return token;
}

/** Cosa può fare il token del profilo di una persona in una campagna; null se non ne ha uno. */
export function apiTokenAccess(userId: number, campaignId: number): 'read' | 'write' | null {
	const row = getDb()
		.select()
		.from(apiTokens)
		.where(and(eq(apiTokens.userId, userId), eq(apiTokens.campaignId, campaignId), eq(apiTokens.client, '')))
		.get();
	return row ? (row.canWrite ? 'write' : 'read') : null;
}

/** I siti collegati col connettore (OAuth) a una campagna, es. claude.ai, con quando e quanto scrivono. */
export function apiTokenClients(userId: number, campaignId: number) {
	return getDb()
		.select({ client: apiTokens.client, canWrite: apiTokens.canWrite, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt })
		.from(apiTokens)
		.where(and(eq(apiTokens.userId, userId), eq(apiTokens.campaignId, campaignId), ne(apiTokens.client, '')))
		.all();
}

/** Il token del profilo di una persona in una campagna: quando è nato e quando è stato usato. */
export function apiTokenInfo(userId: number, campaignId: number) {
	return getDb()
		.select({ canWrite: apiTokens.canWrite, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt })
		.from(apiTokens)
		.where(and(eq(apiTokens.userId, userId), eq(apiTokens.campaignId, campaignId), eq(apiTokens.client, '')))
		.get();
}

/** I token fermi da troppo smettono di valere. */
export function purgeIdleApiTokens(now = Date.now()) {
	getDb()
		.delete(apiTokens)
		.where(lt(sql`coalesce(${apiTokens.lastUsedAt}, ${apiTokens.createdAt})`, now - TOKEN_IDLE_DAYS * DAY))
		.run();
}

/** Revoca tutti i token di una persona in una campagna: quello del profilo e quelli del connettore. */
export function revokeApiToken(userId: number, campaignId: number) {
	getDb().delete(apiTokens).where(and(eq(apiTokens.userId, userId), eq(apiTokens.campaignId, campaignId))).run();
}

/** Dall'intestazione `Authorization: Bearer …`: chi è, per quale campagna vale e se può scrivere. */
export function validateApiToken(header: string | null): { user: SessionUser; campaignId: number; canWrite: boolean } | null {
	const [, token] = /^Bearer (\S+)$/i.exec(header ?? '') ?? [];
	if (!token) return null;
	const hash = sha256(token);
	const row = getDb()
		.select({ t: apiTokens, u: users })
		.from(apiTokens)
		.innerJoin(users, eq(users.id, apiTokens.userId))
		.where(eq(apiTokens.tokenHash, hash))
		.get();
	if (!row || row.u.disabled) return null;
	const now = Date.now();
	if ((row.t.lastUsedAt ?? row.t.createdAt) < now - TOKEN_IDLE_DAYS * DAY) {
		getDb().delete(apiTokens).where(eq(apiTokens.tokenHash, hash)).run();
		return null;
	}
	if (!row.t.lastUsedAt || now - row.t.lastUsedAt > 60 * 60 * 1000) getDb().update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.tokenHash, hash)).run();
	return { user: sessionUser(row.u), campaignId: row.t.campaignId, canWrite: row.t.canWrite };
}

// --- Inviti ---

export function createInvite(role: Role, createdBy: number, days: number, campaignId: number | null): string {
	const token = newToken();
	const now = Date.now();
	getDb()
		.insert(invites)
		.values({ tokenHash: sha256(token), role, createdBy, createdAt: now, expiresAt: now + days * DAY, campaignId })
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

/** Gli inviti ancora validi: tutti, o quelli di una campagna. */
export function activeInvites(campaignId?: number) {
	return getDb()
		.select({
			id: invites.id,
			role: invites.role,
			createdAt: invites.createdAt,
			expiresAt: invites.expiresAt,
			by: users.displayName,
			campaign: campaigns.name
		})
		.from(invites)
		.leftJoin(users, eq(users.id, invites.createdBy))
		.leftJoin(campaigns, eq(campaigns.id, invites.campaignId))
		.where(and(isNull(invites.usedAt), gt(invites.expiresAt, Date.now()), campaignId ? eq(invites.campaignId, campaignId) : undefined))
		.orderBy(desc(invites.createdAt))
		.all();
}

export function revokeInvite(id: number, campaignId?: number) {
	getDb()
		.delete(invites)
		.where(and(eq(invites.id, id), isNull(invites.usedAt), campaignId ? eq(invites.campaignId, campaignId) : undefined))
		.run();
}

export function markInviteUsed(id: number, userId: number) {
	getDb().update(invites).set({ usedAt: Date.now(), usedBy: userId }).where(eq(invites.id, id)).run();
}

// --- Limite ai tentativi di accesso (in memoria) ---

const attempts = new Map<string, { n: number; until: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW = 15 * 60 * 1000;

/** Troppi tentativi falliti per questa chiave (IP e nome utente: 5; `max` più alto per il solo IP). */
export function isLimited(key: string, max = MAX_ATTEMPTS): boolean {
	const a = attempts.get(key);
	if (!a) return false;
	if (a.until < Date.now()) {
		attempts.delete(key);
		return false;
	}
	return a.n >= max;
}

/** Tentativi falliti da un indirizzo, con qualsiasi nome: oltre questi, l'indirizzo aspetta. */
export const MAX_ATTEMPTS_PER_IP = 20;

export function recordFailure(key: string) {
	const a = attempts.get(key);
	if (!a || a.until < Date.now()) attempts.set(key, { n: 1, until: Date.now() + WINDOW });
	else a.n++;
}

export const clearFailures = (key: string) => attempts.delete(key);

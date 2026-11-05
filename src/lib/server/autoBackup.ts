import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { eq } from 'drizzle-orm';
import { getDb, schema, dataDir } from './db/index.ts';
import { createBackup } from './backup.ts';
import { audit } from './audit.ts';
import { encryptStream, type BackupKey } from '../../../tools/backup-crypto.mjs';

/**
 * Backup automatico: una volta al giorno, all'ora scelta dall'Admin, un backup completo in una cartella. Se è la
 * cartella di OneDrive, Google Drive o Dropbox, il loro programma lo porta in cloud: la wiki non parla con nessun servizio.
 *
 * La cartella la sceglie chi installa la wiki (CS_BACKUP_DIR), non l'Admin dal browser: dalla pagina web non si scrivono
 * file in giro per il computer. Senza CS_BACKUP_DIR i backup vanno in <cartella dei dati>/backups.
 * Il file nasce con un nome provvisorio e prende il nome vero solo a lavoro finito: chi sincronizza non carica mai un
 * backup a metà. Si cancellano solo i backup automatici più vecchi, riconosciuti dal nome: gli altri file restano.
 */

export interface AutoBackupConfig {
	enabled: boolean;
	/** Ora del giorno (0-23), nel fuso orario del server. */
	hour: number;
	/** Quanti backup automatici tenere. */
	keep: number;
	/** Quando è stato acceso: il primo backup è al primo orario dopo. */
	since: number;
	/** Con la cifratura accesa: la chiave pubblica nata dalla password (la password non si conserva). */
	key: BackupKey | null;
}

export interface AutoBackupStatus {
	/** Ultimo tentativo, riuscito o no. */
	lastAt: number;
	lastOk: boolean;
	lastFile: string;
	lastSize: number;
	/** Chiave di traduzione dell'errore e messaggio del sistema. */
	lastError: string;
	lastDetail: string;
	/** Ultimo backup riuscito. */
	okAt: number;
}

export const KEEP_MAX = 90;
const HOUR = 60 * 60 * 1000;
const CONFIG_KEY = 'autoBackup';
const STATUS_KEY = 'autoBackupStatus';
const DEFAULT_CONFIG: AutoBackupConfig = { enabled: false, hour: 3, keep: 7, since: 0, key: null };
const DEFAULT_STATUS: AutoBackupStatus = { lastAt: 0, lastOk: false, lastFile: '', lastSize: 0, lastError: '', lastDetail: '', okAt: 0 };
/** I backup automatici, gli unici che la pulizia cancella. */
const NAME = /^crooked-shelf-backup-\d{4}-\d{2}-\d{2}-\d{6}\.zip(\.enc)?$/;
const PARTIAL = /^~crooked-shelf-backup-.*\.tmp$/;

function read<T extends object>(key: string, fallback: T): T {
	const row = getDb().select().from(schema.settings).where(eq(schema.settings.key, key)).get();
	return row && typeof row.value === 'object' && row.value ? { ...fallback, ...(row.value as Partial<T>) } : { ...fallback };
}

function write(key: string, value: object) {
	getDb()
		.insert(schema.settings)
		.values({ key, value })
		.onConflictDoUpdate({ target: schema.settings.key, set: { value } })
		.run();
}

export const getAutoBackup = (): AutoBackupConfig => read(CONFIG_KEY, DEFAULT_CONFIG);
export const getAutoBackupStatus = (): AutoBackupStatus => read(STATUS_KEY, DEFAULT_STATUS);

export function saveAutoBackup(patch: Partial<AutoBackupConfig>, now = Date.now()) {
	const before = getAutoBackup();
	const next = { ...before, ...patch };
	if (next.enabled && !before.enabled) next.since = now;
	write(CONFIG_KEY, next);
}

/** La cartella dei backup automatici, e se l'ha scelta chi ha installato la wiki. */
export function backupDir(): { dir: string; custom: boolean } {
	const custom = process.env.CS_BACKUP_DIR?.trim();
	return custom ? { dir: resolve(custom), custom: true } : { dir: join(dataDir(), 'backups'), custom: false };
}

/** L'orario del backup più recente già passato: oggi all'ora scelta, o ieri se non è ancora arrivata. */
export function lastSlot(now: number, hour: number): number {
	const d = new Date(now);
	d.setHours(hour, 0, 0, 0);
	if (d.getTime() > now) {
		// Di nuovo l'ora dopo il giorno: nei giorni del cambio dell'ora un giorno non dura 24 ore.
		d.setDate(d.getDate() - 1);
		d.setHours(hour, 0, 0, 0);
	}
	return d.getTime();
}

/** Il prossimo orario del backup. */
export function nextSlot(now: number, hour: number): number {
	const d = new Date(lastSlot(now, hour));
	d.setDate(d.getDate() + 1);
	d.setHours(hour, 0, 0, 0);
	return d.getTime();
}

/**
 * Va fatto ora? Una volta per orario: all'ora scelta o, se il computer era spento, appena si riaccende. Dopo un errore
 * si riprova ogni ora. Un backup fatto a mano dopo l'orario vale per quel giorno.
 */
export function isDue(cfg: AutoBackupConfig, st: AutoBackupStatus, now: number): boolean {
	if (!cfg.enabled) return false;
	const slot = lastSlot(now, cfg.hour);
	if (slot < cfg.since || st.okAt >= slot) return false;
	return st.lastAt < slot || now - st.lastAt >= HOUR;
}

/** Quando ci sarà il prossimo tentativo (null se è spento): adesso, tra un'ora dopo un errore, o al prossimo orario. */
export function nextRun(cfg: AutoBackupConfig, st: AutoBackupStatus, now: number): number | null {
	if (!cfg.enabled) return null;
	if (isDue(cfg, st, now)) return now;
	const slot = lastSlot(now, cfg.hour);
	if (slot >= cfg.since && st.okAt < slot) return st.lastAt + HOUR;
	return nextSlot(now, cfg.hour);
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
/** 2026-11-05-030000, nell'ora del server: i nomi in ordine alfabetico sono in ordine di tempo. */
export function stamp(now: number): string {
	const d = new Date(now);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Tiene i `keep` backup automatici più recenti e cancella gli altri; non tocca nessun altro file. */
export function prune(dir: string, keep: number): string[] {
	const old = readdirSync(dir)
		.filter((n) => NAME.test(n))
		.sort()
		.reverse()
		.slice(Math.max(1, keep));
	for (const n of old) rmSync(join(dir, n), { force: true });
	return old;
}

/** La chiave di traduzione per un errore del disco. */
function errorKey(e: unknown): string {
	const code = (e as NodeJS.ErrnoException)?.code;
	if (code === 'ENOENT' || code === 'ENOTDIR') return 'backup.errNoDir';
	if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return 'backup.errDenied';
	if (code === 'ENOSPC' || code === 'EDQUOT') return 'backup.errFull';
	return 'backup.errOther';
}

async function writeBackup(now: number, key: BackupKey | null): Promise<{ file: string; size: number }> {
	const { dir, custom } = backupDir();
	// Una cartella scelta che non c'è (disco staccato, cartella del cloud non collegata a Docker) è un errore: crearla
	// vorrebbe dire salvare i backup dove nessuno li cerca.
	if (custom && !existsSync(dir)) throw Object.assign(new Error(dir), { code: 'ENOENT' });
	if (!custom) mkdirSync(dir, { recursive: true });
	for (const n of readdirSync(dir)) if (PARTIAL.test(n)) rmSync(join(dir, n), { force: true });
	const file = `crooked-shelf-backup-${stamp(now)}.zip${key ? '.enc' : ''}`;
	const partial = join(dir, `~${file}.tmp`);
	try {
		const source = Readable.fromWeb((await createBackup()) as NodeReadableStream<Uint8Array>);
		// Leggibile solo da chi fa girare la wiki: dentro c'è tutto.
		const out = createWriteStream(partial, { flush: true, mode: 0o600 });
		if (key) await pipeline(source, encryptStream(key), out);
		else await pipeline(source, out);
		renameSync(partial, join(dir, file));
	} catch (e) {
		rmSync(partial, { force: true });
		throw e;
	}
	return { file, size: statSync(join(dir, file)).size };
}

export interface BackupResult {
	ok: boolean;
	file?: string;
	error?: string;
}

let running: Promise<BackupResult> | null = null;

export const backupRunning = () => running !== null;

/** Fa un backup adesso, nella cartella dei backup automatici. Uno alla volta: chi arriva mentre è in corso aspetta quello. */
export function runAutoBackup(who: { userId?: number | null; ip?: string } = {}, now = Date.now()): Promise<BackupResult> {
	running ??= (async (): Promise<BackupResult> => {
		const cfg = getAutoBackup();
		const st = getAutoBackupStatus();
		try {
			const r = await writeBackup(now, cfg.key);
			try {
				prune(backupDir().dir, cfg.keep);
			} catch (e) {
				// Il backup c'è: se le copie vecchie non si cancellano, si riprova la volta dopo.
				console.error('Crooked Shelf: pulizia dei backup automatici:', e);
			}
			write(STATUS_KEY, { ...st, lastAt: now, lastOk: true, lastFile: r.file, lastSize: r.size, lastError: '', lastDetail: '', okAt: now });
			audit('backup_auto', who, r.file);
			console.log(`Crooked Shelf: backup automatico salvato in ${join(backupDir().dir, r.file)}`);
			return { ok: true, file: r.file };
		} catch (e) {
			const error = errorKey(e);
			const detail = e instanceof Error ? e.message : String(e);
			write(STATUS_KEY, { ...st, lastAt: now, lastOk: false, lastFile: '', lastSize: 0, lastError: error, lastDetail: detail.slice(0, 300) });
			audit('backup_auto_failed', who, detail);
			console.error('Crooked Shelf: backup automatico non riuscito:', e);
			return { ok: false, error };
		}
	})().finally(() => (running = null));
	return running;
}

const STARTED = Symbol.for('crooked-shelf.autoBackup');

/** Controlla ogni minuto se è l'ora del backup. Il timer non tiene acceso il processo; parte una volta sola. */
export function startAutoBackup() {
	const g = globalThis as { [STARTED]?: boolean };
	if (g[STARTED]) return;
	g[STARTED] = true;
	const tick = () => {
		try {
			if (!running && isDue(getAutoBackup(), getAutoBackupStatus(), Date.now())) void runAutoBackup();
		} catch (e) {
			console.error('Crooked Shelf: controllo del backup automatico:', e);
		}
	};
	setInterval(tick, 60_000).unref();
}

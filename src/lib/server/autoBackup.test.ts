import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';
import { useMemoryDb, schema } from './db/index.ts';
import { listAudit } from './audit.ts';
import {
	backupDir,
	getAutoBackup,
	getAutoBackupStatus,
	isDue,
	lastSlot,
	nextRun,
	nextSlot,
	prune,
	runAutoBackup,
	saveAutoBackup,
	stamp,
	type AutoBackupConfig,
	type AutoBackupStatus
} from './autoBackup.ts';
import { BackupError, checkBackupPassword, createBackupKey, decryptFile, isEncryptedBackup } from '../../../tools/backup-crypto.mjs';

const PASSWORD = 'quattro parole a caso per il drago';
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const HOUR = 60 * 60 * 1000;
const cfg = (c: Partial<AutoBackupConfig> = {}): AutoBackupConfig => ({ enabled: true, hour: 3, keep: 7, since: 0, key: null, ...c });
const st = (s: Partial<AutoBackupStatus> = {}): AutoBackupStatus => ({ lastAt: 0, lastOk: false, lastFile: '', lastSize: 0, lastError: '', lastDetail: '', okAt: 0, ...s });

describe('orario del backup automatico', () => {
	it("l'ultimo orario passato è oggi o ieri", () => {
		expect(lastSlot(at(5, 10), 3)).toBe(at(5, 3));
		expect(lastSlot(at(5, 2, 59), 3)).toBe(at(4, 3));
		expect(lastSlot(at(5, 3), 3)).toBe(at(5, 3));
		expect(nextSlot(at(5, 10), 3)).toBe(at(6, 3));
		expect(nextSlot(at(5, 2), 3)).toBe(at(5, 3));
	});

	it('una volta per orario, anche a computer riacceso; dopo un errore riprova ogni ora', () => {
		expect(isDue(cfg({ enabled: false }), st(), at(5, 10))).toBe(false);
		// Mai fatto: all'orario, o appena si riaccende il computer.
		expect(isDue(cfg(), st(), at(5, 3))).toBe(true);
		expect(isDue(cfg(), st({ okAt: at(4, 3), lastAt: at(4, 3), lastOk: true }), at(5, 9))).toBe(true);
		// Fatto per questo orario (anche a mano, dopo l'orario): niente fino a domani.
		expect(isDue(cfg(), st({ okAt: at(5, 3), lastAt: at(5, 3), lastOk: true }), at(5, 23))).toBe(false);
		expect(isDue(cfg(), st({ okAt: at(5, 9), lastAt: at(5, 9), lastOk: true }), at(6, 2))).toBe(false);
		expect(isDue(cfg(), st({ okAt: at(5, 9), lastAt: at(5, 9), lastOk: true }), at(6, 3))).toBe(true);
		// Dopo un errore: non subito, un'ora dopo.
		const failed = st({ okAt: at(4, 3), lastAt: at(5, 3), lastOk: false });
		expect(isDue(cfg(), failed, at(5, 3, 30))).toBe(false);
		expect(isDue(cfg(), failed, at(5, 4))).toBe(true);
		expect(nextRun(cfg(), failed, at(5, 3, 30))).toBe(at(5, 4));
	});

	it("acceso dopo l'orario di oggi, il primo backup è domani", () => {
		const c = cfg({ since: at(5, 10) });
		expect(isDue(c, st(), at(5, 10, 1))).toBe(false);
		expect(nextRun(c, st(), at(5, 10, 1))).toBe(at(6, 3));
		expect(isDue(c, st(), at(6, 3))).toBe(true);
		expect(nextRun(cfg({ enabled: false }), st(), at(5, 10))).toBe(null);
	});

	it("il nome porta data e ora: in ordine alfabetico è in ordine di tempo", () => {
		expect(stamp(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe('2026-01-02-030405');
	});
});

describe('pulizia dei backup vecchi', () => {
	it('tiene gli ultimi N backup automatici e non tocca nient\'altro', () => {
		const dir = mkdtempSync(join(tmpdir(), 'cs-prune-'));
		try {
			const auto = ['2026-11-01-030000', '2026-11-02-030000', '2026-11-03-030000', '2026-11-04-030000'].map((s, i) => `crooked-shelf-backup-${s}.zip${i % 2 ? '.enc' : ''}`);
			const others = ['crooked-shelf-backup-2026-10-29.zip', 'appunti.txt', 'crooked-shelf-backup-2026-11-01-030000.zip.bak'];
			for (const n of [...auto, ...others]) writeFileSync(join(dir, n), 'x');
			expect(prune(dir, 2).sort()).toEqual(auto.slice(0, 2).sort());
			expect(readdirSync(dir).sort()).toEqual([...auto.slice(2), ...others].sort());
			// Almeno uno resta sempre.
			prune(dir, 0);
			expect(readdirSync(dir).filter((n) => n.includes('-030000')).sort()).toEqual([auto[3], others[2]].sort());
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe('backup automatico', () => {
	let data: string;
	let out: string;
	beforeEach(() => {
		data = mkdtempSync(join(tmpdir(), 'cs-data-'));
		out = mkdtempSync(join(tmpdir(), 'cs-out-'));
		process.env.CS_DATA_DIR = data;
		process.env.CS_BACKUP_DIR = out;
		useMemoryDb().insert(schema.users).values({ id: 1, username: 'dm', displayName: 'DM', passwordHash: 'x', role: 'admin', createdAt: 0 }).run();
		mkdirSync(join(data, 'uploads', 'ab'), { recursive: true });
		writeFileSync(join(data, 'uploads', 'ab', 'abc.png'), 'immagine');
	});
	afterEach(() => {
		delete process.env.CS_DATA_DIR;
		delete process.env.CS_BACKUP_DIR;
		delete process.env.CS_BACKUP_PASSWORD;
		rmSync(data, { recursive: true, force: true });
		rmSync(out, { recursive: true, force: true });
	});

	it('senza CS_BACKUP_DIR la cartella è dentro i dati', () => {
		delete process.env.CS_BACKUP_DIR;
		expect(backupDir()).toEqual({ dir: join(data, 'backups'), custom: false });
	});

	it('salva uno zip completo nella cartella, senza file a metà, e lo scrive nel registro', async () => {
		saveAutoBackup({ enabled: true, keep: 3 });
		const r = await runAutoBackup({ userId: 1 }, at(5, 3));
		expect(r).toEqual({ ok: true, file: 'crooked-shelf-backup-2026-11-05-030000.zip' });
		expect(readdirSync(out)).toEqual([r.file]);
		const zip = unzipSync(readFileSync(join(out, r.file!)));
		expect(Object.keys(zip).sort()).toEqual(['BACKUP.txt', 'crooked-shelf.db', 'uploads/ab/abc.png']);
		const s = getAutoBackupStatus();
		expect(s).toMatchObject({ lastOk: true, lastAt: at(5, 3), okAt: at(5, 3), lastFile: r.file });
		expect(s.lastSize).toBeGreaterThan(0);
		expect(listAudit(1)[0]).toMatchObject({ action: 'backup_auto', detail: r.file, user: 'dm' });
	});

	it('con la password il file è cifrato e si apre solo con quella', async () => {
		const key = await createBackupKey(PASSWORD);
		expect(await checkBackupPassword(key, PASSWORD)).toBe(true);
		expect(await checkBackupPassword(key, 'un\'altra frase qualunque')).toBe(false);
		saveAutoBackup({ enabled: true, key });
		// Nel database c'è solo la chiave pubblica: niente password.
		expect(JSON.stringify(getAutoBackup())).not.toContain(PASSWORD);
		const r = await runAutoBackup({}, at(5, 3));
		expect(r.file).toBe('crooked-shelf-backup-2026-11-05-030000.zip.enc');
		const file = join(out, r.file!);
		expect(isEncryptedBackup(file)).toBe(true);
		expect(readFileSync(file).includes(Buffer.from('SQLite format 3'))).toBe(false);

		await expect(decryptFile(file, join(out, 'no.zip'), 'password sbagliata davvero')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
		expect(existsSync(join(out, 'no.zip'))).toBe(false);

		await decryptFile(file, join(out, 'si.zip'), PASSWORD);
		expect(Object.keys(unzipSync(readFileSync(join(out, 'si.zip'))))).toContain('crooked-shelf.db');

		// Un byte cambiato: il file non si apre, e non resta niente a metà.
		const bytes = readFileSync(file);
		bytes[bytes.length - 40] ^= 1;
		writeFileSync(join(out, 'rotto.enc'), bytes);
		await expect(decryptFile(join(out, 'rotto.enc'), join(out, 'rotto.zip'), PASSWORD)).rejects.toBeInstanceOf(BackupError);
		expect(existsSync(join(out, 'rotto.zip'))).toBe(false);
	});

	it('lo strumento di ripristino apre i backup cifrati con la password', async () => {
		saveAutoBackup({ enabled: true, key: await createBackupKey(PASSWORD) });
		const r = await runAutoBackup({}, at(5, 3));
		const target = join(out, 'ripristino');
		const restore = (password: string) =>
			spawnSync(process.execPath, ['tools/restore.mjs', join(out, r.file!), target], { env: { ...process.env, CS_BACKUP_PASSWORD: password }, encoding: 'utf8' });
		const wrong = restore('password sbagliata davvero');
		expect(wrong.status).toBe(1);
		expect(wrong.stderr).toContain('Password sbagliata');
		expect(existsSync(join(target, 'crooked-shelf.db'))).toBe(false);
		const ok = restore(PASSWORD);
		expect(ok.status, ok.stderr).toBe(0);
		expect(readFileSync(join(target, 'uploads', 'ab', 'abc.png'), 'utf8')).toBe('immagine');
		expect(readFileSync(join(target, 'crooked-shelf.db')).subarray(0, 15).toString()).toBe('SQLite format 3');
	});

	it('tiene solo gli ultimi backup automatici', async () => {
		saveAutoBackup({ enabled: true, keep: 2 });
		for (const d of [1, 2, 3, 4]) await runAutoBackup({}, at(d, 3));
		expect(readdirSync(out).sort()).toEqual(['crooked-shelf-backup-2026-11-03-030000.zip', 'crooked-shelf-backup-2026-11-04-030000.zip']);
	});

	it('una cartella scelta che non esiste è un errore, e non viene creata', async () => {
		const missing = join(out, 'OneDrive-non-collegato');
		process.env.CS_BACKUP_DIR = missing;
		saveAutoBackup({ enabled: true });
		const r = await runAutoBackup({}, at(5, 3));
		expect(r).toEqual({ ok: false, error: 'backup.errNoDir' });
		expect(existsSync(missing)).toBe(false);
		expect(getAutoBackupStatus()).toMatchObject({ lastOk: false, lastAt: at(5, 3), okAt: 0, lastError: 'backup.errNoDir' });
		expect(listAudit(1)[0]).toMatchObject({ action: 'backup_auto_failed' });
	});

	it('due richieste insieme fanno un solo backup', async () => {
		saveAutoBackup({ enabled: true });
		const [a, b] = await Promise.all([runAutoBackup({}, at(5, 3)), runAutoBackup({}, at(5, 3))]);
		expect(a).toEqual(b);
		expect(readdirSync(out)).toHaveLength(1);
	});

	it("accendendolo il primo backup è al prossimo orario", () => {
		saveAutoBackup({ enabled: true, hour: 3 }, at(5, 10));
		expect(getAutoBackup().since).toBe(at(5, 10));
		expect(isDue(getAutoBackup(), getAutoBackupStatus(), at(5, 10) + HOUR)).toBe(false);
		// Cambiare l'ora non lo fa ripartire da capo.
		saveAutoBackup({ hour: 4 }, at(5, 12));
		expect(getAutoBackup().since).toBe(at(5, 10));
	});
});

// Cifratura dei backup automatici: un file che si apre solo con la password scelta dall'Admin.
// La usano la wiki (per chiudere i file) e gli strumenti tools/restore.mjs e tools/decrypt-backup.mjs (per aprirli).
//
// La wiki non conserva la password né niente che basti ad aprire i file. Dalla password (scrypt) nasce una coppia di
// chiavi X25519 e la wiki tiene solo la metà pubblica, che serve a chiudere. Ogni backup ha una sua chiave usa e getta
// (X25519 + HKDF) e il contenuto è cifrato con AES-256-GCM: chi cambia anche un solo byte viene scoperto.
//
// Formato, versione 1:
//   "CSBACKUP" (8) | versione (1) | scrypt: log2 N (1), r (1), p (1) | sale (16)
//   | chiave pubblica della password (32) | chiave pubblica usa e getta (32) | iv (12) | dati cifrati | tag (16)
// L'intestazione (i primi 104 byte) è protetta insieme ai dati.
import {
	createCipheriv,
	createDecipheriv,
	createPrivateKey,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	hkdfSync,
	randomBytes,
	scrypt,
	timingSafeEqual
} from 'node:crypto';
import { closeSync, createReadStream, createWriteStream, fstatSync, openSync, readSync, rmSync } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * La chiave che la wiki conserva: solo la metà pubblica, più sale e parametri per ricavarla di nuovo dalla password.
 * @typedef {{ salt: string, logN: number, r: number, p: number, publicKey: string }} BackupKey
 */
/** @typedef {{ logN: number, r: number, p: number }} KdfParams */

export const MAGIC = Buffer.from('CSBACKUP', 'ascii');
export const HEADER_SIZE = 104;
const VERSION = 1;
const TAG_SIZE = 16;
const INFO = Buffer.from('crooked-shelf backup v1', 'ascii');
/** scrypt con circa 128 MB di memoria: ogni tentativo di indovinare la password costa tempo e memoria. */
export const KDF = Object.freeze({ logN: 17, r: 8, p: 1 });

// Intestazioni DER fisse di una chiave X25519 (PKCS#8 privata, SPKI pubblica): dopo vengono i 32 byte della chiave.
const PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex');
const SPKI = Buffer.from('302a300506032b656e032100', 'hex');

/** Errore con un codice: NOT_ENCRYPTED, VERSION, WRONG_PASSWORD, DAMAGED. */
export class BackupError extends Error {
	/** @param {'NOT_ENCRYPTED' | 'VERSION' | 'WRONG_PASSWORD' | 'DAMAGED'} code */
	constructor(code) {
		super(code);
		this.code = code;
	}
}

/** @param {Buffer} seed @returns {import('node:crypto').KeyObject} */
const privateKey = (seed) => createPrivateKey({ key: Buffer.concat([PKCS8, seed]), format: 'der', type: 'pkcs8' });
/** @param {Buffer} raw @returns {import('node:crypto').KeyObject} */
const publicKey = (raw) => createPublicKey({ key: Buffer.concat([SPKI, raw]), format: 'der', type: 'spki' });
/** I 32 byte della chiave pubblica (di una chiave pubblica, o di quella che nasce da una privata). @param {import('node:crypto').KeyObject} key @returns {Buffer} */
const rawPublic = (key) => (key.type === 'public' ? key : createPublicKey(key)).export({ format: 'der', type: 'spki' }).subarray(SPKI.length);

/** Parametri plausibili: un file preparato apposta non deve chiedere gigabyte di memoria. @param {KdfParams} k */
const validKdf = (k) => k.logN >= 10 && k.logN <= 20 && k.r >= 1 && k.r <= 16 && k.p >= 1 && k.p <= 4;

/** @param {string} password @param {Buffer} salt @param {KdfParams} kdf @returns {Promise<Buffer>} */
function stretch(password, salt, kdf) {
	const N = 2 ** kdf.logN;
	return new Promise((ok, ko) =>
		scrypt(password.normalize('NFC'), salt, 32, { N, r: kdf.r, p: kdf.p, maxmem: 256 * N * kdf.r * kdf.p }, (e, key) => (e ? ko(e) : ok(key)))
	);
}

/** @param {Buffer} shared @param {Buffer} ephemeral @param {Buffer} recipient @returns {Buffer} */
const fileKey = (shared, ephemeral, recipient) => Buffer.from(hkdfSync('sha256', shared, Buffer.concat([ephemeral, recipient]), INFO, 32));

/** La chiave da conservare, ricavata dalla password. @param {string} password @returns {Promise<BackupKey>} */
export async function createBackupKey(password) {
	const salt = randomBytes(16);
	const seed = await stretch(password, salt, KDF);
	return { salt: salt.toString('base64'), ...KDF, publicKey: rawPublic(privateKey(seed)).toString('base64') };
}

/** Vero se la chiave è nata da questa password. @param {BackupKey} key @param {string} password @returns {Promise<boolean>} */
export async function checkBackupPassword(key, password) {
	const stored = Buffer.from(key.publicKey, 'base64');
	if (stored.length !== 32 || !validKdf(key)) return false;
	const seed = await stretch(password, Buffer.from(key.salt, 'base64'), key);
	return timingSafeEqual(rawPublic(privateKey(seed)), stored);
}

/**
 * Uno stream che cifra per questa chiave: escono intestazione, dati cifrati e tag.
 * @param {BackupKey} key
 * @returns {Transform}
 */
export function encryptStream(key) {
	const salt = Buffer.from(key.salt, 'base64');
	const recipient = Buffer.from(key.publicKey, 'base64');
	if (salt.length !== 16 || recipient.length !== 32 || !validKdf(key)) throw new Error('Chiave dei backup non valida');
	const once = generateKeyPairSync('x25519');
	const ephemeral = rawPublic(once.publicKey);
	const iv = randomBytes(12);
	const header = Buffer.concat([MAGIC, Buffer.from([VERSION, key.logN, key.r, key.p]), salt, recipient, ephemeral, iv]);
	const cipher = createCipheriv('aes-256-gcm', fileKey(diffieHellman({ privateKey: once.privateKey, publicKey: publicKey(recipient) }), ephemeral, recipient), iv);
	cipher.setAAD(header);
	let started = false;
	return new Transform({
		transform(chunk, _encoding, done) {
			if (!started) {
				started = true;
				this.push(header);
			}
			done(null, cipher.update(chunk));
		},
		flush(done) {
			if (!started) this.push(header);
			this.push(cipher.final());
			done(null, cipher.getAuthTag());
		}
	});
}

/** Vero se il file inizia come un backup cifrato. @param {string} path */
export function isEncryptedBackup(path) {
	const fd = openSync(path, 'r');
	try {
		const head = Buffer.alloc(MAGIC.length);
		return readSync(fd, head, 0, head.length, 0) === head.length && head.equals(MAGIC);
	} finally {
		closeSync(fd);
	}
}

/**
 * Apre un backup cifrato e scrive lo zip in `output`. Controlla la password prima di leggere i dati; se il file è stato
 * cambiato o è incompleto, `output` viene cancellato.
 * @param {string} input
 * @param {string} output
 * @param {string} password
 */
export async function decryptFile(input, output, password) {
	const fd = openSync(input, 'r');
	const header = Buffer.alloc(HEADER_SIZE);
	const tag = Buffer.alloc(TAG_SIZE);
	let size = 0;
	try {
		size = fstatSync(fd).size;
		if (readSync(fd, header, 0, HEADER_SIZE, 0) < HEADER_SIZE || !header.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupError('NOT_ENCRYPTED');
		if (size <= HEADER_SIZE + TAG_SIZE) throw new BackupError('DAMAGED');
		readSync(fd, tag, 0, TAG_SIZE, size - TAG_SIZE);
	} finally {
		closeSync(fd);
	}
	if (header[8] !== VERSION) throw new BackupError('VERSION');
	const kdf = { logN: header[9], r: header[10], p: header[11] };
	if (!validKdf(kdf)) throw new BackupError('DAMAGED');
	const salt = header.subarray(12, 28);
	const recipient = header.subarray(28, 60);
	const ephemeral = header.subarray(60, 92);
	const iv = header.subarray(92, HEADER_SIZE);
	const mine = privateKey(await stretch(password, salt, kdf));
	if (!timingSafeEqual(rawPublic(mine), recipient)) throw new BackupError('WRONG_PASSWORD');
	const decipher = createDecipheriv('aes-256-gcm', fileKey(diffieHellman({ privateKey: mine, publicKey: publicKey(ephemeral) }), ephemeral, recipient), iv);
	decipher.setAAD(header);
	decipher.setAuthTag(tag);
	try {
		await pipeline(createReadStream(input, { start: HEADER_SIZE, end: size - TAG_SIZE - 1 }), decipher, createWriteStream(output));
	} catch {
		rmSync(output, { force: true });
		throw new BackupError('DAMAGED');
	}
}

/** Messaggio per chi usa gli strumenti da terminale. @param {unknown} e */
export function backupErrorMessage(e) {
	const code = e instanceof BackupError ? e.code : '';
	if (code === 'WRONG_PASSWORD') return 'Password sbagliata: non è quella con cui è stato cifrato questo backup.';
	if (code === 'DAMAGED') return 'Il file è danneggiato o incompleto (per esempio non ancora scaricato del tutto dal cloud).';
	if (code === 'VERSION') return 'Questo backup è stato cifrato da una versione più recente di Crooked Shelf: aggiorna gli strumenti.';
	if (code === 'NOT_ENCRYPTED') return 'Il file non è un backup cifrato di Crooked Shelf.';
	return String(e instanceof Error ? e.message : e);
}

/**
 * Chiede la password nel terminale senza mostrarla. Con CS_BACKUP_PASSWORD la prende da lì; senza terminale (es. da
 * una pipe) legge la prima riga.
 * @param {string} question
 * @returns {Promise<string>}
 */
export function readPassword(question) {
	const fromEnv = process.env.CS_BACKUP_PASSWORD;
	if (fromEnv) return Promise.resolve(fromEnv);
	const stdin = process.stdin;
	process.stderr.write(question);
	stdin.setEncoding('utf8');
	if (!stdin.isTTY) {
		return new Promise((ok) => {
			let text = '';
			/** @param {string} d */
			const onData = (d) => {
				text += d;
				const end = text.search(/\r?\n/);
				if (end >= 0) {
					stdin.off('data', onData);
					stdin.pause();
					ok(text.slice(0, end));
				}
			};
			stdin.on('data', onData);
			stdin.once('end', () => ok(text));
		});
	}
	return new Promise((ok, ko) => {
		/** @type {string[]} */
		let typed = [];
		const finish = () => {
			stdin.off('data', onData);
			stdin.setRawMode(false);
			stdin.pause();
			process.stderr.write('\n');
		};
		/** @param {string} chunk */
		const onData = (chunk) => {
			for (const ch of chunk) {
				if (ch === '\r' || ch === '\n') {
					finish();
					ok(typed.join(''));
					return;
				}
				if (ch === '\u0003') {
					finish();
					ko(new Error('Annullato.'));
					return;
				}
				if (ch === '\u007f' || ch === '\b') typed = typed.slice(0, -1);
				else if (ch >= ' ') typed.push(ch);
			}
		};
		stdin.setRawMode(true);
		stdin.resume();
		stdin.on('data', onData);
	});
}

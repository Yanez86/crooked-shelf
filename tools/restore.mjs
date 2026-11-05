// Ripristina un backup completo di Crooked Shelf.
//
//   node tools/restore.mjs crooked-shelf-backup.zip ./data
//
// Ferma la wiki prima di ripristinare. Se nella cartella c'è già un database, serve --force
// (il database attuale viene rinominato, non cancellato).
// Un backup cifrato (.zip.enc) chiede la password, oppure la prende da CS_BACKUP_PASSWORD.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, sep } from 'node:path';
import { unzipSync } from 'fflate';
import { backupErrorMessage, decryptFile, isEncryptedBackup, readPassword } from './backup-crypto.mjs';

const [file, target = 'data', flag] = process.argv.slice(2);
if (!file) {
	console.error('Uso: node tools/restore.mjs <backup.zip | backup.zip.enc> [cartella dei dati] [--force]');
	process.exit(1);
}
const dir = normalize(target);
const db = join(dir, 'crooked-shelf.db');
if (existsSync(db) && flag !== '--force' && target !== '--force') {
	console.error(`C'è già un database in ${db}. Ferma la wiki e riprova con --force: quello attuale verrà rinominato.`);
	process.exit(1);
}
if (!existsSync(file)) {
	console.error(`Il file ${file} non esiste.`);
	process.exit(1);
}

/** Il contenuto dello zip: se il backup è cifrato, prima lo si apre con la password in una cartella temporanea. */
async function readBackup() {
	if (!isEncryptedBackup(file)) return readFileSync(file);
	const password = await readPassword('Password del backup: ');
	const tmp = mkdtempSync(join(tmpdir(), 'cs-restore-'));
	try {
		const zip = join(tmp, 'backup.zip');
		await decryptFile(file, zip, password);
		return readFileSync(zip);
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

let data;
try {
	data = await readBackup();
} catch (e) {
	console.error(backupErrorMessage(e));
	process.exit(1);
}
let entries;
try {
	entries = unzipSync(data);
} catch {
	entries = {};
}
if (!entries['crooked-shelf.db']) {
	console.error('Il file non sembra un backup di Crooked Shelf (manca crooked-shelf.db).');
	process.exit(1);
}
if (existsSync(db)) {
	const old = `${db}.prima-del-ripristino-${Date.now()}`;
	renameSync(db, old);
	for (const ext of ['-wal', '-shm']) if (existsSync(db + ext)) renameSync(db + ext, old + ext);
	console.log(`Database attuale spostato in ${old}`);
}
let n = 0;
for (const [name, content] of Object.entries(entries)) {
	if (name.endsWith('/')) continue;
	const out = normalize(join(dir, name));
	if (!out.startsWith(normalize(dir) + sep)) continue; // niente percorsi che escono dalla cartella
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, content);
	n++;
}
console.log(`Ripristinati ${n} file in ${dir}. Ora puoi riavviare la wiki.`);

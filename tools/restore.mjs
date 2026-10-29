// Ripristina un backup completo di Crooked Shelf.
//
//   node tools/restore.mjs crooked-shelf-backup.zip ./data
//
// Ferma la wiki prima di ripristinare. Se nella cartella c'è già un database, serve --force
// (il database attuale viene rinominato, non cancellato).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { unzipSync } from 'fflate';

const [file, target = 'data', flag] = process.argv.slice(2);
if (!file) {
	console.error('Uso: node tools/restore.mjs <backup.zip> [cartella dei dati] [--force]');
	process.exit(1);
}
const dir = normalize(target);
const db = join(dir, 'crooked-shelf.db');
if (existsSync(db) && flag !== '--force' && target !== '--force') {
	console.error(`C'è già un database in ${db}. Ferma la wiki e riprova con --force: quello attuale verrà rinominato.`);
	process.exit(1);
}
const entries = unzipSync(readFileSync(file));
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
for (const [name, data] of Object.entries(entries)) {
	if (name.endsWith('/')) continue;
	const out = normalize(join(dir, name));
	if (!out.startsWith(normalize(dir) + sep)) continue; // niente percorsi che escono dalla cartella
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, data);
	n++;
}
console.log(`Ripristinati ${n} file in ${dir}. Ora puoi riavviare la wiki.`);

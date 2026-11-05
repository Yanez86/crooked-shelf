// Apre un backup cifrato di Crooked Shelf e ne scrive lo zip in chiaro, per guardarci dentro o conservarlo altrove.
//
//   node tools/decrypt-backup.mjs crooked-shelf-backup-2026-11-05-030000.zip.enc [crooked-shelf-backup.zip]
//
// Chiede la password, oppure la prende da CS_BACKUP_PASSWORD. Per ripristinare non serve: tools/restore.mjs apre da sé
// i backup cifrati. Lo zip in chiaro contiene tutto: tienilo al sicuro e cancellalo quando non serve più.
import { existsSync } from 'node:fs';
import { backupErrorMessage, decryptFile, isEncryptedBackup, readPassword } from './backup-crypto.mjs';

const [input, given] = process.argv.slice(2);
if (!input) {
	console.error('Uso: node tools/decrypt-backup.mjs <backup.zip.enc> [backup.zip]');
	process.exit(1);
}
if (!existsSync(input)) {
	console.error(`Il file ${input} non esiste.`);
	process.exit(1);
}
const output = given ?? (input.endsWith('.enc') ? input.slice(0, -4) : `${input}.zip`);
if (existsSync(output)) {
	console.error(`Il file ${output} esiste già: scegli un altro nome come secondo argomento.`);
	process.exit(1);
}
if (!isEncryptedBackup(input)) {
	console.error('Il file non è un backup cifrato di Crooked Shelf: se è uno zip, si apre già così.');
	process.exit(1);
}
try {
	await decryptFile(input, output, await readPassword('Password del backup: '));
} catch (e) {
	console.error(backupErrorMessage(e));
	process.exit(1);
}
console.log(`Backup aperto: ${output}. Contiene tutto in chiaro, tienilo al sicuro.`);

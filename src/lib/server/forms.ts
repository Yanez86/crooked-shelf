import { PASSWORD_MIN, USERNAME_RE } from './auth.ts';

export const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').trim().slice(0, max);

// Le password lunghe almeno 10 caratteri che ricorrono di più nelle liste pubbliche, più quelle legate al programma.
const COMMON = new Set([
	'1234567890', '12345678910', '0123456789', '1234567891', '1234512345', '1122334455', '0987654321', '1q2w3e4r5t', '1qaz2wsx3edc',
	'qwertyuiop', 'qwerty1234', 'qwerty12345', 'asdfghjkl1', 'zxcvbnm123', 'q1w2e3r4t5', 'qwertyuiop1',
	'password12', 'password123', 'password1234', 'password12345', 'password!1', 'passw0rd12', 'passwordpassword',
	'iloveyou12', 'iloveyou123', 'welcome123', 'letmein123', 'trustno1234', 'sunshine12', 'princess12', 'football12', 'baseball12',
	'administrator', 'admin12345', 'adminadmin', 'changeme123', 'temporary1', 'supersecret', 'secretsecret',
	'crookedshelf', 'crooked-shelf', 'dungeonsdragons', 'dungeonmaster', 'gamemaster1'
]);
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Una password troppo comune, o che contiene il nome utente. */
export function commonPassword(password: string, username = ''): boolean {
	const p = squash(password);
	if (COMMON.has(password.toLowerCase()) || COMMON.has(p)) return true;
	if (/^(.)\1+$/.test(p) || /^(0123456789|1234567890|abcdefghij)/.test(p)) return true;
	const u = squash(username);
	return u.length >= 3 && p.includes(u);
}

/** Controlla nome utente e password; restituisce la chiave di traduzione dell'errore. */
export function checkCredentials(username: string, password: string, confirm: string): string | null {
	if (!USERNAME_RE.test(username)) return 'errors.username';
	if (password.length < PASSWORD_MIN) return 'errors.passwordShort';
	if (password.length > 256) return 'errors.passwordLong';
	if (password !== confirm) return 'errors.passwordMismatch';
	if (commonPassword(password, username)) return 'errors.passwordCommon';
	return null;
}

/**
 * Percorso interno sicuro per il ritorno dopo l'accesso. Solo un percorso che inizia con una barra sola: `//host` e
 * `/\\host` il browser li legge come un altro sito (la barra rovesciata vale come barra), e `/%5C` non va lasciato
 * decodificare a lui. Resta solo percorso e query, letti dal parser degli URL: nessun host, nessuno schema.
 */
export function safeNext(next: string | null): string {
	if (!next || !/^\/(?![/\\])/.test(next) || next.includes('\\') || next.startsWith('/login')) return '/';
	try {
		const u = new URL(next, 'http://cs.invalid');
		if (u.host !== 'cs.invalid' || /[\\]/.test(u.pathname) || u.pathname.includes('%5C') || u.pathname.includes('%5c')) return '/';
		return u.pathname + u.search;
	} catch {
		return '/';
	}
}

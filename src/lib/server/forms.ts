import { PASSWORD_MIN, USERNAME_RE } from './auth.ts';

export const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').trim().slice(0, max);

/** Controlla nome utente e password; restituisce la chiave di traduzione dell'errore. */
export function checkCredentials(username: string, password: string, confirm: string): string | null {
	if (!USERNAME_RE.test(username)) return 'errors.username';
	if (password.length < PASSWORD_MIN) return 'errors.passwordShort';
	if (password.length > 256) return 'errors.passwordLong';
	if (password !== confirm) return 'errors.passwordMismatch';
	return null;
}

/** Percorso interno sicuro per il ritorno dopo l'accesso. */
export function safeNext(next: string | null): string {
	return next && /^\/(?!\/)/.test(next) && !next.startsWith('/login') ? next : '/';
}

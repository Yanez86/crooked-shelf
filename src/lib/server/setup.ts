import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Codice della prima configurazione. Finché non esiste un utente, chiunque raggiunga la wiki potrebbe crearne
 * l'amministratore: la pagina /setup chiede un codice che sta solo nei log del server (o in CS_SETUP_TOKEN,
 * per chi installa in automatico). Così la wiki la configura chi ha il server, non chi arriva prima.
 */
let token: string | undefined;
let announced = false;

export function setupToken(): string {
	token ??= process.env.CS_SETUP_TOKEN?.trim() || randomBytes(6).toString('hex');
	return token;
}

/** Scrive il codice nei log, una volta: alla prima richiesta che trova la wiki senza utenti. */
export function announceSetupToken() {
	if (announced) return;
	announced = true;
	const t = setupToken();
	console.log(
		process.env.CS_SETUP_TOKEN
			? 'Crooked Shelf: prima configurazione in /setup, col codice di CS_SETUP_TOKEN.'
			: `Crooked Shelf: prima configurazione in /setup. Codice di configurazione: ${t}`
	);
}

export function checkSetupToken(given: string): boolean {
	const a = Buffer.from(given.trim());
	const b = Buffer.from(setupToken());
	return a.length === b.length && timingSafeEqual(a, b);
}

/** Solo per i test. */
export const resetSetupToken = () => {
	token = undefined;
	announced = false;
};

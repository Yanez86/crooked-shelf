/**
 * Limiti di frequenza, in memoria (un processo). Due strumenti:
 * - `limited(name, key, max, windowMs)`: al massimo `max` colpi per chiave (di solito l'IP) in una finestra;
 * - `hashSlot()`: un budget globale per le operazioni costose (argon2), così un'ondata di accessi da nomi utente
 *   sempre diversi non satura la CPU: oltre il budget si risponde subito 429 senza calcolare niente.
 */
const buckets = new Map<string, { n: number; until: number }>();
let sweep = 0;

export function limited(name: string, key: string, max: number, windowMs: number): boolean {
	const now = Date.now();
	if (++sweep % 1000 === 0) for (const [k, b] of buckets) if (b.until < now) buckets.delete(k);
	const id = `${name}|${key}`;
	const b = buckets.get(id);
	if (!b || b.until < now) {
		buckets.set(id, { n: 1, until: now + windowMs });
		return false;
	}
	b.n++;
	return b.n > max;
}

// Token bucket: fino a HASH_BURST hash di fila, poi HASH_PER_SEC al secondo.
const HASH_BURST = 30;
const HASH_PER_SEC = 10;
let tokens = HASH_BURST;
let refilled = Date.now();

/** Un posto per un hash di password: false = troppi insieme, riprovare tra poco. */
export function hashSlot(): boolean {
	const now = Date.now();
	tokens = Math.min(HASH_BURST, tokens + ((now - refilled) / 1000) * HASH_PER_SEC);
	refilled = now;
	if (tokens < 1) return false;
	tokens--;
	return true;
}

/** Solo per i test. */
export function resetLimits() {
	buckets.clear();
	tokens = HASH_BURST;
	refilled = Date.now();
}

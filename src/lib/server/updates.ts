import { REPO, compareVersions } from '../version.ts';

/**
 * Controllo degli aggiornamenti, per la pagina Amministrazione: confronta la versione installata
 * con quella del package.json sul ramo main del repository (il progetto non pubblica release su GitHub).
 * Con CS_UPDATE_CHECK=0 la wiki non contatta GitHub.
 */
export type UpdateStatus = 'current' | 'outdated' | 'unknown' | 'off';

export interface UpdateCheck {
	status: UpdateStatus;
	/** L'ultima versione su GitHub, se la si conosce. */
	latest?: string;
}

export const UPDATE_SOURCE = REPO.replace('https://github.com/', 'https://raw.githubusercontent.com/') + '/main/package.json';

const TTL_OK = 60 * 60_000;
// Se GitHub non risponde si riprova prima, ma non a ogni visita della pagina.
const TTL_FAIL = 10 * 60_000;
const TIMEOUT = 5_000;

let cache: { at: number; ttl: number; latest: Promise<string | null> } | undefined;

async function fetchLatest(): Promise<string | null> {
	try {
		const res = await fetch(UPDATE_SOURCE, { signal: AbortSignal.timeout(TIMEOUT), headers: { accept: 'application/json' } });
		if (!res.ok) return null;
		const v: unknown = (await res.json())?.version;
		return typeof v === 'string' && compareVersions(v, v) !== null ? v : null;
	} catch {
		return null;
	}
}

/** L'ultima versione su GitHub, ricordata per un'ora; null se GitHub non risponde. Le visite insieme fanno una sola richiesta. */
export function latestVersion(now = Date.now()): Promise<string | null> {
	if (!cache || now - cache.at >= cache.ttl) {
		const entry = { at: now, ttl: TTL_OK, latest: fetchLatest() };
		entry.latest.then((v) => v === null && (entry.ttl = TTL_FAIL));
		cache = entry;
	}
	return cache.latest;
}

export async function checkUpdate(installed: string = __APP_VERSION__): Promise<UpdateCheck> {
	if (process.env.CS_UPDATE_CHECK === '0') return { status: 'off' };
	const latest = await latestVersion();
	const cmp = latest === null ? null : compareVersions(installed, latest);
	if (latest === null || cmp === null) return { status: 'unknown' };
	return { status: cmp < 0 ? 'outdated' : 'current', latest };
}

export const resetUpdateCache = () => (cache = undefined);

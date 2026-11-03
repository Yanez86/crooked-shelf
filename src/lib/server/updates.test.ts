import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UPDATE_SOURCE, checkUpdate, latestVersion, resetUpdateCache } from './updates.ts';

const github = (body: unknown, status = 200) =>
	vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

describe('controllo della versione su GitHub', () => {
	beforeEach(() => {
		resetUpdateCache();
		delete process.env.CS_UPDATE_CHECK;
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		delete process.env.CS_UPDATE_CHECK;
	});

	it('legge il package.json del ramo main', async () => {
		const f = github({ version: '0.11.0' });
		vi.stubGlobal('fetch', f);
		await checkUpdate('0.11.0');
		expect(f).toHaveBeenCalledWith(UPDATE_SOURCE, expect.anything());
		expect(UPDATE_SOURCE).toBe('https://raw.githubusercontent.com/yanez86/crooked-shelf/main/package.json');
	});

	it('aggiornata se la versione installata è la stessa o più nuova', async () => {
		vi.stubGlobal('fetch', github({ version: '0.11.0' }));
		expect(await checkUpdate('0.11.0')).toEqual({ status: 'current', latest: '0.11.0' });
		expect(await checkUpdate('0.12.0')).toEqual({ status: 'current', latest: '0.11.0' });
	});

	it('non aggiornata se su GitHub ce n\'è una più nuova', async () => {
		vi.stubGlobal('fetch', github({ version: '0.12.1' }));
		expect(await checkUpdate('0.11.0')).toEqual({ status: 'outdated', latest: '0.12.1' });
	});

	it('sconosciuta se GitHub non risponde o risponde male', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
		expect(await checkUpdate('0.11.0')).toEqual({ status: 'unknown' });
		for (const [body, status] of [['', 404], ['<html>', 200], [{ version: 12 }, 200], [{ version: 'ultima' }, 200]] as const) {
			resetUpdateCache();
			vi.stubGlobal('fetch', github(body, status));
			expect(await checkUpdate('0.11.0')).toEqual({ status: 'unknown' });
		}
	});

	it('spento con CS_UPDATE_CHECK=0: non contatta GitHub', async () => {
		const f = github({ version: '9.0.0' });
		vi.stubGlobal('fetch', f);
		process.env.CS_UPDATE_CHECK = '0';
		expect(await checkUpdate('0.11.0')).toEqual({ status: 'off' });
		expect(f).not.toHaveBeenCalled();
	});

	it('ricorda la risposta per un\'ora, e un errore per dieci minuti', async () => {
		const ok = github({ version: '0.11.0' });
		vi.stubGlobal('fetch', ok);
		const t0 = 1_000_000;
		await Promise.all([latestVersion(t0), latestVersion(t0)]);
		expect(await latestVersion(t0 + 59 * 60_000)).toBe('0.11.0');
		expect(ok).toHaveBeenCalledTimes(1);
		await latestVersion(t0 + 60 * 60_000);
		expect(ok).toHaveBeenCalledTimes(2);

		resetUpdateCache();
		const down = vi.fn(async () => { throw new TypeError('fetch failed'); });
		vi.stubGlobal('fetch', down);
		expect(await latestVersion(t0)).toBeNull();
		await latestVersion(t0 + 9 * 60_000);
		expect(down).toHaveBeenCalledTimes(1);
		await latestVersion(t0 + 10 * 60_000);
		expect(down).toHaveBeenCalledTimes(2);
	});
});

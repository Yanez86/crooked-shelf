import { getDb, schema } from './db/index.ts';
import { DEFAULT_LOCALE } from '../i18n/index.ts';

export interface SiteSettings {
	siteName: string;
	defaultLocale: string;
	/** Visitori senza account: spento di default. */
	allowVisitors: boolean;
}

const DEFAULTS: SiteSettings = {
	siteName: 'Crooked Shelf',
	defaultLocale: DEFAULT_LOCALE,
	allowVisitors: false
};

let cache: SiteSettings | undefined;

export function getSettings(): SiteSettings {
	if (cache) return cache;
	const rows = getDb().select().from(schema.settings).all();
	const out: Record<string, unknown> = { ...DEFAULTS };
	for (const r of rows) if (r.key in DEFAULTS) out[r.key] = r.value;
	return (cache = out as unknown as SiteSettings);
}

export function saveSettings(patch: Partial<SiteSettings>) {
	const db = getDb();
	db.transaction((tx) => {
		for (const [key, value] of Object.entries(patch)) {
			if (!(key in DEFAULTS) || value === undefined) continue;
			tx.insert(schema.settings)
				.values({ key, value })
				.onConflictDoUpdate({ target: schema.settings.key, set: { value } })
				.run();
		}
	});
	cache = undefined;
}

export const resetSettingsCache = () => (cache = undefined);

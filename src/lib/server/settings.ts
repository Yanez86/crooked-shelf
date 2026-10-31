import { getDb, schema } from './db/index.ts';
import { currentCampaign } from './campaigns.ts';
import { DEFAULT_LOCALE } from '../i18n/index.ts';
import { isCalendar, preset, type Calendar } from '../calendar.ts';
import type { Theme } from '../themes.ts';

export interface SiteSettings {
	siteName: string;
	defaultLocale: string;
	/** Visitori senza account: spento di default. */
	allowVisitors: boolean;
	/** Temi creati dall'Admin (id "custom-N"). */
	themes: Theme[];
	/** Id dei plugin accesi. */
	plugins: string[];
}

const DEFAULTS: SiteSettings = {
	siteName: 'Crooked Shelf',
	defaultLocale: DEFAULT_LOCALE,
	allowVisitors: false,
	themes: [],
	plugins: []
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

export const isHomePage = (id: number) => currentCampaign().homePageId === id;

/** Calendario del mondo di gioco della campagna. */
export function getCalendar(): Calendar {
	const cal = currentCampaign().calendar;
	return isCalendar(cal) ? cal : preset('gregorian', getSettings().defaultLocale);
}

export const customThemes = (): Theme[] => (Array.isArray(getSettings().themes) ? getSettings().themes : []);

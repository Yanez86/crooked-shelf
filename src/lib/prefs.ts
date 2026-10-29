import { THEME_IDS } from './themes.ts';

export const PREFS_COOKIE = 'cs_prefs';

/** Preferenze di lettura: nel profilo per chi ha fatto l'accesso, nel cookie per gli altri. */
export interface Prefs {
	theme: string;
	fontSize: string;
	font: string;
	spacing: string;
	motion: string;
	locale?: string;
}

export const PREF_OPTIONS = {
	theme: THEME_IDS,
	fontSize: ['100', '112', '125', '150', '175', '200'],
	font: ['default', 'atkinson', 'opendyslexic'],
	spacing: ['normal', 'wide'],
	motion: ['auto', 'reduce']
} as const;

export const DEFAULT_PREFS: Prefs = {
	theme: 'auto',
	fontSize: '100',
	font: 'default',
	spacing: 'normal',
	motion: 'auto'
};

/** Tiene solo i valori validi. `extraThemes` = temi creati dall'Admin. */
export function cleanPrefs(raw: Record<string, unknown> | null | undefined, isLocale: (l: unknown) => boolean, extraThemes: string[] = []): Prefs {
	const out: Prefs = { ...DEFAULT_PREFS };
	if (!raw) return out;
	for (const k of Object.keys(PREF_OPTIONS) as (keyof typeof PREF_OPTIONS)[]) {
		const v = raw[k];
		const allowed: readonly string[] = k === 'theme' ? [...PREF_OPTIONS.theme, ...extraThemes] : PREF_OPTIONS[k];
		if (typeof v === 'string' && allowed.includes(v)) out[k] = v;
	}
	if (isLocale(raw.locale)) out.locale = raw.locale as string;
	return out;
}

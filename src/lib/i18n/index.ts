import { getContext, setContext } from 'svelte';

export type Dict = { [k: string]: string | Dict };
export type Params = Record<string, string | number>;
export type T = (key: string, params?: Params) => string;

// Ogni file in ./locales è una lingua: per aggiungerne una basta un nuovo file JSON.
const files = import.meta.glob<Dict>('./locales/*.json', { eager: true, import: 'default' });

export const DEFAULT_LOCALE = 'en';

export const LOCALES: Record<string, Dict> = Object.fromEntries(
	Object.entries(files).map(([path, dict]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), dict])
);

/** Traduzioni portate dai plugin: completano o sostituiscono quelle incluse. */
const EXTRA: Record<string, Dict> = {};

export function setExtraLocales(extra: Record<string, Dict>) {
	for (const k of Object.keys(EXTRA)) delete EXTRA[k];
	Object.assign(EXTRA, extra);
}

/** Nel browser: aggiunge le traduzioni del plugin per la lingua in uso (arrivano dal server). */
export function registerLocale(code: string, dict: Dict | null | undefined) {
	if (dict) EXTRA[code] = dict;
}

const nameOf = (code: string) => String(((EXTRA[code]?._meta ?? LOCALES[code]?._meta) as Dict)?.name ?? code);

export const localeNames = (): { code: string; name: string }[] =>
	[...new Set([...Object.keys(LOCALES), ...Object.keys(EXTRA)])]
		.map((code) => ({ code, name: nameOf(code) }))
		.sort((a, b) => a.name.localeCompare(b.name));

export const isLocale = (l: unknown): l is string => typeof l === 'string' && (l in LOCALES || l in EXTRA);

export const extraLocale = (code: string): Dict | null => EXTRA[code] ?? null;

/** Sceglie la lingua migliore da un'intestazione Accept-Language. */
export function fromAcceptLanguage(header: string | null): string | null {
	if (!header) return null;
	for (const part of header.split(',')) {
		const code = part.split(';')[0].trim().toLowerCase().split('-')[0];
		if (isLocale(code)) return code;
	}
	return null;
}

function lookup(d: Dict | undefined, key: string): string | undefined {
	let cur: string | Dict | undefined = d;
	for (const k of key.split('.')) {
		if (!cur || typeof cur === 'string') return undefined;
		cur = cur[k];
	}
	return typeof cur === 'string' ? cur : undefined;
}

/** Traduce una chiave; se manca nella lingua scelta usa l'inglese, poi la chiave stessa. */
export function translate(locale: string, key: string, params?: Params): string {
	const s = lookup(EXTRA[locale], key) ?? lookup(LOCALES[locale], key) ?? lookup(LOCALES[DEFAULT_LOCALE], key) ?? key;
	return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s;
}

const KEY = Symbol('i18n');

export function setI18n(getLocale: () => string) {
	setContext<T>(KEY, (key, params) => translate(getLocale(), key, params));
}

export const getT = () => getContext<T>(KEY);

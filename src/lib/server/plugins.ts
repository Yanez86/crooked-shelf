import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';
import { dataDir } from './db/index.ts';
import { customThemes, getSettings, saveSettings } from './settings.ts';
import { checkTheme, type Theme } from '../themes.ts';
import { fromText, isCalendar, toText, type Calendar } from '../calendar.ts';
import { isDoc, type DocNode } from '../content/types.ts';
import { setExtraLocales, type Dict } from '../i18n/index.ts';
import { RULE_KINDS, type RuleKind } from '../rules/index.ts';

/**
 * Plugin: cartelle con un plugin.json e file JSON (temi, template, calendari, lingue, regole).
 * Solo dati, nessun codice: installarli non dà accesso al server. Si accendono da Amministrazione › Plugin.
 *
 * Cartelle lette: `plugins/` accanto al programma (esempi inclusi) e `<CS_DATA_DIR>/plugins` (quelli installati).
 */
export interface PluginTemplate {
	name: string;
	description: string;
	fields: string[];
	content: DocNode;
	session: boolean;
}

export interface PluginRule {
	k: RuleKind;
	i: string;
	n: string;
	s: string;
	t: string;
}

export interface Plugin {
	id: string;
	name: string;
	version: string;
	description: string;
	author: string;
	license: string;
	dir: string;
	themes: Theme[];
	templates: PluginTemplate[];
	calendars: { name: string; calendar: Calendar }[];
	locales: Record<string, Dict>;
	rules: PluginRule[];
	/** Problemi trovati nei file (il resto del plugin funziona). */
	warnings: string[];
}

const ID = /^[a-z0-9][a-z0-9-]{1,40}$/;
let cache: Plugin[] | null = null;
let version = 0;

export const pluginDirs = () => [resolve(process.env.CS_PLUGINS_BUNDLED ?? 'plugins'), join(dataDir(), 'plugins')];

/** Legge un file dentro la cartella del plugin (niente "../" per uscire). */
function readJson(dir: string, rel: unknown): unknown {
	if (typeof rel !== 'string') throw new Error('path');
	const full = normalize(join(dir, rel));
	if (!full.startsWith(dir + sep)) throw new Error('path');
	const st = statSync(full);
	if (st.size > 5_000_000) throw new Error('size');
	return JSON.parse(readFileSync(full, 'utf8'));
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, max: number) => String(v ?? '').slice(0, max);

function loadOne(dir: string): Plugin | null {
	const manifestPath = join(dir, 'plugin.json');
	if (!existsSync(manifestPath)) return null;
	let m: Record<string, unknown>;
	try {
		m = JSON.parse(readFileSync(manifestPath, 'utf8'));
	} catch {
		return null;
	}
	const id = String(m.id ?? '');
	if (!ID.test(id)) return null;
	const c = (m.contributes ?? {}) as Record<string, unknown>;
	const p: Plugin = {
		id,
		name: text(m.name || id, 80),
		version: text(m.version, 20),
		description: text(m.description, 500),
		author: text(m.author, 80),
		license: text(m.license, 40),
		dir,
		themes: [],
		templates: [],
		calendars: [],
		locales: {},
		rules: [],
		warnings: []
	};
	const each = (key: string, fn: (data: unknown, file: string) => void) => {
		for (const file of list(c[key])) {
			try {
				fn(readJson(dir, file), String(file));
			} catch (e) {
				p.warnings.push(`${key}: ${String(file)} (${(e as Error).message})`);
			}
		}
	};

	each('themes', (data, file) => {
		const r = checkTheme(data);
		if (!r.ok) throw new Error(r.problems?.join('; ') || r.error);
		p.themes.push({ ...r.theme, id: `plugin-${id}-${p.themes.length + 1}` });
		void file;
	});
	each('templates', (data) => {
		const t = data as Record<string, unknown>;
		if (!t.name || !isDoc(t.content)) throw new Error('invalid template');
		p.templates.push({
			name: text(t.name, 80),
			description: text(t.description, 300),
			fields: list(t.fields).map((f) => text(f, 60)).filter(Boolean).slice(0, 30),
			content: t.content,
			session: t.session === true
		});
	});
	each('calendars', (data) => {
		if (!isCalendar(data)) throw new Error('invalid calendar');
		// Passa dal formato testo: così vale la stessa validazione dell'editor del calendario.
		const r = fromText(toText(data));
		if (!r.ok) throw new Error(r.error);
		p.calendars.push({ name: r.cal.name, calendar: { ...r.cal, today: (data as Calendar).today ?? null } });
	});
	for (const [code, file] of Object.entries((c.locales ?? {}) as Record<string, unknown>)) {
		try {
			if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(code)) throw new Error('code');
			const d = readJson(dir, file);
			if (!d || typeof d !== 'object') throw new Error('invalid');
			p.locales[code] = d as Dict;
		} catch (e) {
			p.warnings.push(`locales: ${code} (${(e as Error).message})`);
		}
	}
	each('rules', (data) => {
		for (const r of list(data)) {
			const e = r as Record<string, unknown>;
			const k = String(e.kind ?? e.k);
			const name = text(e.name ?? e.n, 120);
			if (!RULE_KINDS.includes(k as RuleKind) || !name) continue;
			p.rules.push({ k: k as RuleKind, i: text(e.key ?? e.i, 120) || name, n: name, s: text(e.summary ?? e.s, 300), t: text(e.text ?? e.t, 20000) });
		}
	});
	return p;
}

/** Tutti i plugin trovati (accesi e spenti). */
export function allPlugins(): Plugin[] {
	if (cache) return cache;
	const found = new Map<string, Plugin>();
	for (const base of pluginDirs()) {
		if (!existsSync(base)) continue;
		for (const name of readdirSync(base)) {
			const dir = join(base, name);
			if (!statSync(dir).isDirectory()) continue;
			const p = loadOne(dir);
			// Un plugin installato nella cartella dei dati sostituisce quello incluso con lo stesso id.
			if (p) found.set(p.id, p);
		}
	}
	cache = [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
	setExtraLocales(mergeLocales(enabledPlugins()));
	return cache;
}

function mergeLocales(list: Plugin[]): Record<string, Dict> {
	const out: Record<string, Dict> = {};
	for (const p of list) for (const [code, d] of Object.entries(p.locales)) out[code] = { ...(out[code] ?? {}), ...d };
	return out;
}

const enabledIds = () => (Array.isArray(getSettings().plugins) ? getSettings().plugins : []);

export function enabledPlugins(): Plugin[] {
	const on = new Set(enabledIds());
	return (cache ?? allPlugins()).filter((p) => on.has(p.id));
}

export function setPluginEnabled(id: string, on: boolean) {
	const ids = new Set(enabledIds());
	if (on) ids.add(id);
	else ids.delete(id);
	saveSettings({ plugins: [...ids] });
	reloadPlugins();
}

/** Rilegge le cartelle (dopo aver aggiunto o tolto un plugin, o acceso/spento). */
export function reloadPlugins() {
	cache = null;
	version++;
	allPlugins();
}

/** Cambia ogni volta che i plugin accesi cambiano (per ricostruire gli indici). */
export const pluginsVersion = () => version;

export const pluginThemes = () => enabledPlugins().flatMap((p) => p.themes);
export const pluginTemplates = () => enabledPlugins().flatMap((p) => p.templates.map((t, i) => ({ ...t, key: `p:${p.id}:${i}`, plugin: p.name })));
export const pluginCalendars = () => enabledPlugins().flatMap((p) => p.calendars.map((c, i) => ({ ...c, key: `p:${p.id}:${i}` })));
export const pluginRules = () => enabledPlugins().flatMap((p) => p.rules.map((r) => ({ ...r, src: p.name })));

/** Temi oltre a quelli inclusi: creati dall'Admin e portati dai plugin accesi. */
export const extraThemes = (): Theme[] => [...customThemes(), ...pluginThemes()];

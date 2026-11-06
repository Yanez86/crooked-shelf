/**
 * Set di tasselli delle mappe esagonali: per ogni terreno un colore, il colore del tratto e un motivo.
 *
 * Il motivo è un tracciato SVG su una griglia 24 × 24, come le icone (`icons.ts`): la wiki lo ripete dentro l'esagono.
 * Così il terreno non si riconosce solo dal colore, e un set dei plugin resta dati: un tracciato non esegue niente,
 * e il server accetta solo i comandi dei tracciati e dei numeri (`PATH_DATA`). Niente file SVG.
 *
 * Gli esagoni ricordano l'id del terreno (`forest`, `hills`…), non il disegno: cambiando set la mappa resta com'è.
 * Un terreno che il set non ha prende il disegno del set incluso con lo stesso id, altrimenti colore di riserva e nome.
 */
export interface HexTerrain {
	id: string;
	/** Nome nella lingua di chi guarda (quelli del set incluso vengono dalle traduzioni). */
	name: string;
	fill: string;
	ink: string;
	/** Tracciato del motivo su 24 × 24; vuoto: solo il colore (il nome resta nel suggerimento e nell'elenco). */
	glyph: string;
}

export interface HexTileset {
	id: string;
	name: string;
	/** Da dove viene: vuoto per il set incluso, altrimenti il nome del plugin. */
	source: string;
	license: string;
	terrains: HexTerrain[];
}

export const BUILTIN_TILESET = 'tratto';

/** Il set incluso, «Tratto»: colori tenui e motivi a tratto, come le icone della wiki. I nomi sono in `hex.terrains.<id>`. */
export const BUILTIN_TERRAINS: Omit<HexTerrain, 'name'>[] = [
	{ id: 'plains', fill: '#e4ecc4', ink: '#5b6b2a', glyph: 'M5 17L8 8M12 17V6M19 17l-3-9' },
	{ id: 'forest', fill: '#9cc49a', ink: '#1f4d2b', glyph: 'M12 3l7 13H5zM12 16v5' },
	{ id: 'hills', fill: '#e3cf9f', ink: '#6b4f1d', glyph: 'M2 17Q12 1 22 17' },
	{ id: 'mountains', fill: '#c9c2b8', ink: '#463d33', glyph: 'M2 19L12 3l10 16M8 10l4 3 4-3' },
	{ id: 'swamp', fill: '#b9c3a0', ink: '#3f4a2a', glyph: 'M4 17h16M7 21h10M8 17L6 9M12 17V7M16 17l2-8' },
	{ id: 'water', fill: '#a9cbe8', ink: '#1f4f7d', glyph: 'M2 10q3-4 6 0t6 0 6 0M4 17q3-4 6 0t6 0 6 0' },
	{ id: 'desert', fill: '#f1deb0', ink: '#7a5a17', glyph: 'M2 17q6-9 12 0M12 13q5-6 10 2' },
	{ id: 'tundra', fill: '#e8eef2', ink: '#4d5c68', glyph: 'M5 12h14M8.5 6l7 12M15.5 6l-7 12' },
	{ id: 'jungle', fill: '#7fb07a', ink: '#163d1f', glyph: 'M12 21V9M12 9C9 5 5 6 4 8M12 9c3-4 7-3 8-1M12 12c-3-1-6 1-6 3M12 12c3-1 6 1 6 3' },
	{ id: 'badlands', fill: '#d8b49a', ink: '#6a3b22', glyph: 'M2 18h20M4 18l2-7h4l1 7M13 18l1-10h5l1 10' }
];

/** Senza un disegno: un grigio chiaro, il bordo tratteggiato e il nome (`fallback` nella vista). */
export const FALLBACK_TERRAIN = { fill: '#dcdfe5', ink: '#3d4350' };

export const TERRAIN_ID = /^[a-z][a-z0-9-]{0,30}$/;
export const TILESET_ID = /^[a-z][a-z0-9-]{0,40}$/;
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
/** Solo comandi dei tracciati SVG, numeri, spazi e virgole: niente che possa diventare codice o un collegamento. */
export const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]*$/;
export const PATH_MAX = 2000;

/** Il terreno di un set dei plugin come lo scrive il plugin, già controllato (vedi plugins.ts). */
export interface PluginTerrain {
	id: string;
	/** Il nome in una o più lingue: `{ "it": "Brughiera", "en": "Moor" }`, oppure un testo solo. */
	name: Record<string, string>;
	fill: string;
	ink: string;
	glyph: string;
}

export interface PluginTileset {
	id: string;
	name: string;
	terrains: PluginTerrain[];
}

/** Controlla un set di tasselli di un plugin. Un terreno scritto male si salta, e lo dice. */
export function checkTileset(data: unknown): { ok: true; tileset: PluginTileset; problems: string[] } | { ok: false; error: string } {
	if (!data || typeof data !== 'object') return { ok: false, error: 'invalid tileset' };
	const d = data as Record<string, unknown>;
	const id = String(d.id ?? '');
	if (!TILESET_ID.test(id) || id === BUILTIN_TILESET) return { ok: false, error: 'id' };
	const name = String(d.name ?? '').slice(0, 60).trim();
	if (!name) return { ok: false, error: 'name' };
	const problems: string[] = [];
	const seen = new Set<string>();
	const terrains: PluginTerrain[] = [];
	for (const raw of Array.isArray(d.terrains) ? d.terrains.slice(0, 40) : []) {
		const t = (raw ?? {}) as Record<string, unknown>;
		const tid = String(t.id ?? '');
		const fill = String(t.fill ?? '');
		const ink = String(t.ink ?? '');
		const glyph = String(t.glyph ?? '');
		const names: Record<string, string> =
			typeof t.name === 'string'
				? { '': t.name.slice(0, 40) }
				: Object.fromEntries(
						Object.entries((t.name ?? {}) as Record<string, unknown>)
							.filter(([k, v]) => /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(k) && typeof v === 'string' && v.trim())
							.map(([k, v]) => [k, String(v).slice(0, 40)])
					);
		if (!TERRAIN_ID.test(tid) || seen.has(tid)) problems.push(`terrain ${tid || '?'}: id`);
		else if (!HEX_COLOR.test(fill) || !HEX_COLOR.test(ink)) problems.push(`terrain ${tid}: color`);
		else if (glyph.length > PATH_MAX || !PATH_DATA.test(glyph)) problems.push(`terrain ${tid}: glyph`);
		else if (!Object.keys(names).length) problems.push(`terrain ${tid}: name`);
		else {
			seen.add(tid);
			terrains.push({ id: tid, name: names, fill: fill.toLowerCase(), ink: ink.toLowerCase(), glyph: glyph.trim() });
		}
	}
	if (!terrains.length) return { ok: false, error: 'terrains' };
	return { ok: true, tileset: { id, name, terrains }, problems };
}

/** Il nome di un terreno di un plugin nella lingua di chi guarda: la sua, poi l'inglese, poi il primo che c'è. */
export function terrainName(names: Record<string, string>, locale: string): string {
	return names[locale] ?? names[locale.split('-')[0]] ?? names.en ?? names[''] ?? Object.values(names)[0] ?? '';
}

/**
 * Icone che si possono dare a una pagina (mostrate nell'albero a sinistra, accanto al nome).
 * Disegni a tratto su una griglia 24×24, in un solo colore (`currentColor`): il colore lo decide il tema.
 */
export const PAGE_ICONS: Record<string, string> = {
	scroll: 'M19 17V5a2 2 0 0 0-2-2H4M15 8h-5M15 12h-5M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3',
	book: 'M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5zM12 6.5v13',
	person: 'M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0zM4.5 20.5a7.5 7.5 0 0 1 15 0',
	crown: 'M3 7.5l4.5 4.5L12 5l4.5 7L21 7.5 19 17H5zM5 20.5h14',
	hat: 'M14.5 2.5C11 4 9 10 7.5 16.5h10L15.5 9l2.5-2zM3 17.5c0 1.6 4 2.5 9 2.5s9-.9 9-2.5c0-.9-1.3-1.5-3.5-1M6.5 16.5C4.3 16.9 3 17.3 3 17.5',
	leaf: 'M5 19C5 9 10 4 20 4c0 10-5 15-15 15zM5 19l8-8M3 21l2-2',
	swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5 13 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2',
	shield: 'M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z',
	bow: 'M6 3c7 3.5 7 14.5 0 18M6 3v18M3 12h16M16.5 9.5 19 12l-2.5 2.5M3 12l-1-1.5M3 12l-1 1.5',
	claws: 'M5 3c1.5 6 4.5 12 10 18M10 3c1.5 5 4 10 9 15M4 9c1 4.5 3 8.5 6 12',
	horns: 'M7.5 9.5C5.5 8.5 4 6 4.5 3 6 5 7.5 6 9.5 6.5M16.5 9.5c2-1 3.5-3.5 3-6.5-1.5 2-3 3-5 3.5M5.5 14.5a6.5 6.5 0 1 0 13 0 6.5 6.5 0 1 0-13 0zM9.5 13.5l1.5 1M14.5 13.5l-1.5 1M10 18h4',
	skull: 'M12 3a8 8 0 0 0-5 14.2V21h10v-3.8A8 8 0 0 0 12 3zM7.5 11.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM13.5 11.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0zM10 21v-2.5M14 21v-2.5M12 21v-2.5',
	castle: 'M3 21V5h1.75v2h1.5V5H8v16M16 21V5h1.75v2h1.5V5H21v16M8 10h1.5v2H11v-2h2v2h1.5v-2H16M2 21h20M10.5 21v-3a1.5 1.5 0 0 1 3 0v3',
	house: 'M3 11l9-7.5 9 7.5M5 9.5V21h14V9.5M10 21v-6h4v6',
	mug: 'M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM15 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M5 8a2.5 2.5 0 0 1 3-2.5 3 3 0 0 1 5 0A2.5 2.5 0 0 1 15 8M8.5 11.5v6M11.5 11.5v6',
	temple: 'M3 9l9-6 9 6zM5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 18h18M2 21h20',
	tree: 'M12 2.5 6 10h3l-4 6h14l-4-6h3zM12 16v5',
	mountain: 'M2 20 9 7l4.5 7.5L16 10.5 22 20z',
	wave: 'M2 7c1.7-1.3 3.3-1.3 5 0s3.3 1.3 5 0 3.3-1.3 5 0 3.3 1.3 5 0M2 12c1.7-1.3 3.3-1.3 5 0s3.3 1.3 5 0 3.3-1.3 5 0 3.3 1.3 5 0M2 17c1.7-1.3 3.3-1.3 5 0s3.3 1.3 5 0 3.3-1.3 5 0 3.3 1.3 5 0',
	map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
	candle: 'M9 11h6v10H9zM12 11V9M12 2.5c1 1.5 2 2.7 2 4a2 2 0 0 1-4 0c0-1.3 1-2.5 2-4zM6 21h12',
	coins: 'M5 6a7 2.5 0 1 0 14 0 7 2.5 0 1 0-14 0zM5 6v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 10v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4M5 14v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4',
	gem: 'M6 4h12l4 5-10 12L2 9zM2 9h20M9.5 4 8 9l4 12 4-12-1.5-5',
	key: 'M3 15.5a4 4 0 1 0 8 0 4 4 0 1 0-8 0zM9.9 12.6 19.5 3M15.5 7l2.5 2.5M18 4.5 20.5 7',
	star: 'M12 3.3l2.35 6.26 6.68.3-5.23 4.18 1.78 6.45L12 16.8l-5.58 3.69 1.78-6.45-5.23-4.18 6.68-.3z',
	warning: 'M12 3 2 20.5h20zM12 9.5v5M12 17.5v.01',
	spiral: 'M11.25 12a1.5 1.5 0 0 1 3 0 3 3 0 0 1-6 0 4.5 4.5 0 0 1 9 0 6 6 0 0 1-12 0',
	flame: 'M12 21.5c-3.9 0-6.5-2.7-6.5-6.2 0-3.3 2.4-5.3 3.5-8.3 1 1.5 1.5 3 1.5 4.5 1.5-1 2.5-4 2-8.5 3.5 2.5 6 7 6 12 0 3.7-2.6 6.5-6.5 6.5z',
	moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
	cog: 'M9.93 5.31 10.39 2.64h3.22l.46 2.67a7 7 0 0 1 1.2.5l2.21-1.57 2.28 2.28-1.57 2.21a7 7 0 0 1 .5 1.2l2.67.46v3.22l-2.67.46a7 7 0 0 1-.5 1.2l1.57 2.21-2.28 2.28-2.21-1.57a7 7 0 0 1-1.2.5l-.46 2.67h-3.22l-.46-2.67a7 7 0 0 1-1.2-.5l-2.21 1.57-2.28-2.28 1.57-2.21a7 7 0 0 1-.5-1.2l-2.67-.46v-3.22l2.67-.46a7 7 0 0 1 .5-1.2L4.24 6.52l2.28-2.28 2.21 1.57a7 7 0 0 1 1.2-.5zM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0z'
};

/** Le emoji usate fino alla 0.10 (nel database e nei pacchetti mondo di allora). */
export const LEGACY_ICONS: Record<string, string> = {
	'📜': 'scroll', '📖': 'book', '👤': 'person', '👑': 'crown', '🧙': 'hat', '🧝': 'leaf', '⚔️': 'swords', '🛡️': 'shield',
	'🏹': 'bow', '🐉': 'claws', '👹': 'horns', '💀': 'skull', '🏰': 'castle', '🏘️': 'house', '🍺': 'mug', '⛪': 'temple',
	'🌲': 'tree', '⛰️': 'mountain', '🌊': 'wave', '🗺️': 'map', '🕯️': 'candle', '💰': 'coins', '💎': 'gem', '🗝️': 'key',
	'⭐': 'star', '⚠️': 'warning', '🌀': 'spiral', '🔥': 'flame', '🌙': 'moon', '⚙️': 'cog'
};

/** Il nome dell'icona se è una di quelle ammesse (o una vecchia emoji), altrimenti nessuna. */
export const pageIcon = (v: unknown): string | null =>
	typeof v !== 'string' ? null : Object.hasOwn(PAGE_ICONS, v) ? v : Object.hasOwn(LEGACY_ICONS, v) ? LEGACY_ICONS[v] : null;

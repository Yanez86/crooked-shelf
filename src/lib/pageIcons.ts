/** Icone che si possono dare a una pagina (mostrate nell'albero a sinistra, accanto al nome). */
export const PAGE_ICONS = [
	'📜', '📖', '👤', '👑', '🧙', '🧝', '⚔️', '🛡️', '🏹', '🐉', '👹', '💀',
	'🏰', '🏘️', '🍺', '⛪', '🌲', '⛰️', '🌊', '🗺️', '🕯️', '💰', '💎', '🗝️',
	'⭐', '⚠️', '🌀', '🔥', '🌙', '⚙️'
];

/** L'icona se è una di quelle ammesse, altrimenti nessuna. */
export const pageIcon = (v: unknown): string | null => (typeof v === 'string' && PAGE_ICONS.includes(v) ? v : null);

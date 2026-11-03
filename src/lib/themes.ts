/** Temi preinstallati. Ogni colore diventa una variabile CSS (--c-<nome>). */
export interface ThemeColors {
	bg: string;
	surface: string;
	surface2: string;
	text: string;
	muted: string;
	border: string;
	/** Bordo dei campi e dei controlli: almeno 3:1 sullo sfondo. */
	control: string;
	primary: string;
	onPrimary: string;
	link: string;
	missing: string;
	focus: string;
	danger: string;
	success: string;
	secretBg: string;
	secretText: string;
	secretBorder: string;
	noteBorder: string;
	tipBorder: string;
	warningBorder: string;
	codeBg: string;
}

export interface Theme {
	id: string;
	/** Solo per i temi creati dall'Admin (quelli preinstallati hanno il nome tradotto). */
	name?: string;
	scheme: 'light' | 'dark';
	colors: ThemeColors;
	/** Immagine di sfondo: id del file caricato. Finisce nel CSS, quindi la mette solo il server: checkTheme non la fa passare. */
	background?: string;
}

export const THEMES: Theme[] = [
	{
		id: 'light',
		scheme: 'light',
		colors: {
			bg: '#fbfaf8',
			surface: '#ffffff',
			surface2: '#f0eee9',
			text: '#1d1b18',
			muted: '#5a5650',
			border: '#d6d2ca',
			control: '#77726a',
			primary: '#7a2e1c',
			onPrimary: '#ffffff',
			link: '#7a2e1c',
			missing: '#b00020',
			focus: '#1a56db',
			danger: '#a1101e',
			success: '#1b6b33',
			secretBg: '#f6eefc',
			secretText: '#3d1859',
			secretBorder: '#7b3fa7',
			noteBorder: '#2f6db5',
			tipBorder: '#2f7d47',
			warningBorder: '#a35f00',
			codeBg: '#f0eee9'
		}
	},
	{
		id: 'dark',
		scheme: 'dark',
		colors: {
			bg: '#16171b',
			surface: '#1f2026',
			surface2: '#2a2c33',
			text: '#ecebe8',
			muted: '#b4b1aa',
			border: '#3a3c44',
			control: '#8d8a84',
			primary: '#f0a080',
			onPrimary: '#1a0d08',
			link: '#f0a080',
			missing: '#ff8a8a',
			focus: '#ffd166',
			danger: '#ff8a8a',
			success: '#7fd99a',
			secretBg: '#2b1f38',
			secretText: '#ecdcff',
			secretBorder: '#b98ae0',
			noteBorder: '#6ea3e8',
			tipBorder: '#6cc98a',
			warningBorder: '#e8a84f',
			codeBg: '#2a2c33'
		}
	},
	// Lago: grigi freddi appena tinti di verde acqua, un solo accento petrolio, fuoco arancio che non si confonde con l'accento.
	{
		id: 'lake',
		scheme: 'light',
		colors: {
			bg: '#f5f7f7',
			surface: '#ffffff',
			surface2: '#e9eef0',
			text: '#132024',
			muted: '#4b5b60',
			border: '#d2dbde',
			control: '#687a80',
			primary: '#0b6a70',
			onPrimary: '#ffffff',
			link: '#0b6470',
			missing: '#b3261e',
			focus: '#c2410c',
			danger: '#b3261e',
			success: '#1d6b3a',
			secretBg: '#f2edfb',
			secretText: '#3a1f63',
			secretBorder: '#7a4fb8',
			noteBorder: '#2b6cb0',
			tipBorder: '#2e7d4f',
			warningBorder: '#9a5800',
			codeBg: '#e9eef0'
		}
	},
	{
		id: 'lake-dark',
		scheme: 'dark',
		colors: {
			bg: '#0e1315',
			surface: '#151c1f',
			surface2: '#1f292d',
			text: '#e5eeef',
			muted: '#a2b2b6',
			border: '#2b373b',
			control: '#7a8c91',
			primary: '#5ccfc6',
			onPrimary: '#03201e',
			link: '#7ad6ce',
			missing: '#ff8f86',
			focus: '#ffb454',
			danger: '#ff8f86',
			success: '#7dd59f',
			secretBg: '#241b35',
			secretText: '#e9dcff',
			secretBorder: '#b08ae8',
			noteBorder: '#79aef0',
			tipBorder: '#6ece96',
			warningBorder: '#efb259',
			codeBg: '#1f292d'
		}
	}
];

export const THEME_IDS = ['auto', ...THEMES.map((t) => t.id)];

export const COLOR_KEYS = Object.keys(THEMES[0].colors) as (keyof ThemeColors)[];

const HEX = /^#[0-9a-f]{6}$/i;

/** Controlla un tema (es. importato da un file): colori validi e contrasti WCAG AA. */
export function checkTheme(v: unknown): { ok: true; theme: Omit<Theme, 'id'> } | { ok: false; error: string; problems?: string[] } {
	const t = v as Theme;
	if (!t || typeof t !== 'object' || !t.colors || typeof t.colors !== 'object') return { ok: false, error: 'themes.errFile' };
	const colors = {} as ThemeColors;
	for (const k of COLOR_KEYS) {
		const c = t.colors[k];
		if (typeof c !== 'string' || !HEX.test(c)) return { ok: false, error: 'themes.errColor' };
		colors[k] = c.toLowerCase();
	}
	const theme = { name: String(t.name ?? '').trim().slice(0, 40) || 'Theme', scheme: t.scheme === 'dark' ? 'dark' : 'light', colors } as const;
	const problems = contrastProblems({ id: 'x', ...theme });
	if (problems.length) return { ok: false, error: 'themes.errContrast', problems };
	return { ok: true, theme };
}

const cssName = (k: string) => '--c-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

function vars(t: Theme) {
	return (
		Object.entries(t.colors)
			.map(([k, v]) => `${cssName(k)}:${v};`)
			.join('') +
		`color-scheme:${t.scheme};` +
		(t.background ? `--bg-image:url(/files/${t.background});` : '')
	);
}

/** CSS di tutti i temi; "auto" segue l'impostazione chiaro/scuro del sistema. */
export function themeCss(custom: Theme[] = []): string {
	const light = THEMES.find((t) => t.id === 'light')!;
	const dark = THEMES.find((t) => t.id === 'dark')!;
	return [
		...[...THEMES, ...custom].map((t) => `:root[data-theme="${t.id}"]{${vars(t)}}`),
		`:root[data-theme="auto"]{${vars(light)}}`,
		`@media (prefers-color-scheme: dark){:root[data-theme="auto"]{${vars(dark)}}}`
	].join('\n');
}

// --- Contrasto (WCAG 2.2) ---

function channel(c: number) {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
	const h = hex.replace('#', '');
	const n = parseInt(h.length === 3 ? [...h].map((x) => x + x).join('') : h, 16);
	return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
	const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
}

/** Coppie da controllare: [primo piano, sfondo, minimo]. 4.5 per il testo, 3 per i controlli. */
export const CONTRAST_PAIRS: [keyof ThemeColors, keyof ThemeColors, number][] = [
	['text', 'bg', 4.5],
	['text', 'surface', 4.5],
	['text', 'surface2', 4.5],
	['muted', 'bg', 4.5],
	['muted', 'surface', 4.5],
	['muted', 'surface2', 4.5],
	['link', 'bg', 4.5],
	['link', 'surface', 4.5],
	['missing', 'bg', 4.5],
	['missing', 'surface', 4.5],
	['primary', 'bg', 4.5],
	['primary', 'surface', 4.5],
	['onPrimary', 'primary', 4.5],
	['danger', 'bg', 4.5],
	['danger', 'surface', 4.5],
	['success', 'bg', 4.5],
	['success', 'surface', 4.5],
	['secretText', 'secretBg', 4.5],
	['text', 'codeBg', 4.5],
	['control', 'bg', 3],
	['control', 'surface', 3],
	['focus', 'bg', 3],
	['focus', 'surface', 3],
	['secretBorder', 'surface', 3],
	['noteBorder', 'surface', 3],
	['tipBorder', 'surface', 3],
	['warningBorder', 'surface', 3]
];

export function contrastProblems(t: Theme): string[] {
	return CONTRAST_PAIRS.filter(([fg, bg, min]) => contrast(t.colors[fg], t.colors[bg]) < min).map(
		([fg, bg, min]) => `${t.id}: ${fg}/${bg} = ${contrast(t.colors[fg], t.colors[bg]).toFixed(2)} < ${min}`
	);
}

/** Le stesse coppie con il valore misurato, per la tabella dell'editor. */
export function contrastReport(colors: ThemeColors) {
	return CONTRAST_PAIRS.map(([fg, bg, min]) => {
		const ratio = contrast(colors[fg], colors[bg]);
		return { fg, bg, min, ratio, ok: ratio >= min };
	});
}

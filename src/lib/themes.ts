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
	scheme: 'light' | 'dark';
	colors: ThemeColors;
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
			link: '#0b5394',
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
			link: '#8ab8ff',
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
	{
		id: 'parchment',
		scheme: 'light',
		colors: {
			bg: '#f3e9d2',
			surface: '#faf3e3',
			surface2: '#eadcbc',
			text: '#2b1d0e',
			muted: '#5c4630',
			border: '#cdb88f',
			control: '#806645',
			primary: '#6b2414',
			onPrimary: '#fff8ea',
			link: '#6b2414',
			missing: '#a3121e',
			focus: '#0b4f9e',
			danger: '#9c1020',
			success: '#2d5e1e',
			secretBg: '#e6d7ee',
			secretText: '#35144f',
			secretBorder: '#6e3a91',
			noteBorder: '#355f8f',
			tipBorder: '#3f6b2b',
			warningBorder: '#8f5207',
			codeBg: '#eadcbc'
		}
	},
	{
		id: 'contrast',
		scheme: 'dark',
		colors: {
			bg: '#000000',
			surface: '#000000',
			surface2: '#1a1a1a',
			text: '#ffffff',
			muted: '#e6e6e6',
			border: '#ffffff',
			control: '#ffffff',
			primary: '#ffff00',
			onPrimary: '#000000',
			link: '#ffff00',
			missing: '#ff9e9e',
			focus: '#00ffff',
			danger: '#ff9e9e',
			success: '#7dff9b',
			secretBg: '#1a0033',
			secretText: '#ffffff',
			secretBorder: '#e0b3ff',
			noteBorder: '#80c4ff',
			tipBorder: '#7dff9b',
			warningBorder: '#ffc04d',
			codeBg: '#1a1a1a'
		}
	}
];

export const THEME_IDS = ['auto', ...THEMES.map((t) => t.id)];

const cssName = (k: string) => '--c-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

function vars(t: Theme) {
	return (
		Object.entries(t.colors)
			.map(([k, v]) => `${cssName(k)}:${v};`)
			.join('') + `color-scheme:${t.scheme};`
	);
}

/** CSS di tutti i temi; "auto" segue l'impostazione chiaro/scuro del sistema. */
export function themeCss(): string {
	const light = THEMES.find((t) => t.id === 'light')!;
	const dark = THEMES.find((t) => t.id === 'dark')!;
	return [
		...THEMES.map((t) => `:root[data-theme="${t.id}"]{${vars(t)}}`),
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

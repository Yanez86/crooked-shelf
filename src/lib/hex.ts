/**
 * Geometria delle mappe esagonali, uguale nel server e nel browser.
 *
 * Gli esagoni si salvano in coordinate assiali (q, r): così i vicini sono un conto di una riga e cambiare
 * orientamento (lati piatti o punte in alto) ruota la mappa senza romperla. Il nome che si legge («0504», colonna e
 * riga) è la coordinata «offset» classica dei manuali, calcolata per l'orientamento della mappa.
 */
export const HEX_STATES = ['hidden', 'glimpsed', 'explored'] as const;
/** Cosa sanno i giocatori: niente (non lo ricevono), il terreno visto da lontano, tutto quello che possono vedere. */
export type HexState = (typeof HEX_STATES)[number];
export const isHexState = (v: unknown): v is HexState => typeof v === 'string' && (HEX_STATES as readonly string[]).includes(v);

export const HEX_ORIENTATIONS = ['flat', 'pointy'] as const;
export type HexOrientation = (typeof HEX_ORIENTATIONS)[number];
export const isHexOrientation = (v: unknown): v is HexOrientation => typeof v === 'string' && (HEX_ORIENTATIONS as readonly string[]).includes(v);

export interface Axial {
	q: number;
	r: number;
}

/** I sei vicini, in senso antiorario a partire da est (lati piatti) o da nord-est (punte). */
export const HEX_DIRS: readonly [number, number][] = [
	[1, 0],
	[1, -1],
	[0, -1],
	[-1, 0],
	[-1, 1],
	[0, 1]
];

/** Fin dove può arrivare una mappa, in ogni direzione dall'esagono di partenza. */
export const HEX_RANGE = 200;

export const hexKey = (q: number, r: number) => `${q},${r}`;
export const neighbors = (h: Axial): Axial[] => HEX_DIRS.map(([dq, dr]) => ({ q: h.q + dq, r: h.r + dr }));

/** Colonna e riga «offset»: con i lati piatti le colonne dispari scendono di mezzo esagono, con le punte le righe dispari vanno a destra. */
export function toOffset(h: Axial, o: HexOrientation): { col: number; row: number } {
	return o === 'flat' ? { col: h.q, row: h.r + (h.q - (h.q & 1)) / 2 } : { col: h.q + (h.r - (h.r & 1)) / 2, row: h.r };
}

/** Due cifre da 1 in su («05»); prima della colonna o della riga 1 un segno meno («−01»): solo se la mappa, già scoperta, cresce verso ovest o nord. */
const part = (n: number) => {
	const v = n + 1;
	return v >= 1 ? String(v).padStart(2, '0') : '−' + String(1 - v).padStart(2, '0');
};

export interface HexOrigin {
	col: number;
	row: number;
}

/** Il nome dell'esagono, colonna e riga contate da `origin` (l'esagono 0101): «0504». */
export const hexLabel = (h: Axial, o: HexOrientation, origin: HexOrigin = { col: 0, row: 0 }) => {
	const { col, row } = toOffset(h, o);
	return part(col - origin.col) + part(row - origin.row);
};

/** L'angolo in alto a sinistra di un gruppo di esagoni: la colonna e la riga più piccole. */
export function topLeft(cells: Axial[], o: HexOrientation): HexOrigin {
	let col = Infinity;
	let row = Infinity;
	for (const h of cells) {
		const p = toOffset(h, o);
		col = Math.min(col, p.col);
		row = Math.min(row, p.row);
	}
	return Number.isFinite(col) ? { col, row } : { col: 0, row: 0 };
}

/** Larghezza e altezza di un esagono con il raggio (centro-vertice) `s`. */
export const hexBox = (o: HexOrientation, s: number) => (o === 'flat' ? { w: 2 * s, h: Math.sqrt(3) * s } : { w: Math.sqrt(3) * s, h: 2 * s });

/** Il centro dell'esagono, con il raggio `s`, rispetto al centro dell'esagono 0,0. */
export function hexCenter(h: Axial, o: HexOrientation, s: number): { x: number; y: number } {
	return o === 'flat'
		? { x: 1.5 * s * h.q, y: Math.sqrt(3) * s * (h.r + h.q / 2) }
		: { x: Math.sqrt(3) * s * (h.q + h.r / 2), y: 1.5 * s * h.r };
}

/**
 * Il disegno dentro un esagono usa una scatola fissa: 100 × 86.6 con i lati piatti, 86.6 × 100 con le punte.
 * `spots`: dove vanno i quattro motivi del terreno (il quinto, al centro, solo se non c'è un elemento);
 * `badge` e `party`: il cerchio dell'elemento e il segnalino del gruppo; `label`: il nome dell'esagono.
 */
export const HEX_SHAPE = {
	flat: {
		viewBox: '0 0 100 86.6',
		points: '25,0 75,0 100,43.3 75,86.6 25,86.6 0,43.3',
		inset: '28.5,5 71.5,5 93,43.3 71.5,81.6 28.5,81.6 7,43.3',
		clip: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)',
		spots: [
			[26, 27],
			[74, 27],
			[26, 60],
			[74, 60]
		],
		center: [50, 43.3],
		badge: [50, 40],
		party: [50, 70],
		label: [50, 14]
	},
	pointy: {
		viewBox: '0 0 86.6 100',
		points: '43.3,0 86.6,25 86.6,75 43.3,100 0,75 0,25',
		inset: '43.3,5.5 81.6,27.6 81.6,72.4 43.3,94.5 5,72.4 5,27.6',
		clip: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
		spots: [
			[24, 36],
			[62.6, 36],
			[24, 66],
			[62.6, 66]
		],
		center: [43.3, 50],
		badge: [43.3, 46],
		party: [43.3, 77],
		label: [43.3, 21]
	}
} as const;

/** Tratteggio sopra gli esagoni nascosti (lo vede solo il Master), nella scatola dell'orientamento. */
export function hatchPath(o: HexOrientation): string {
	const [w, h] = o === 'flat' ? [100, 86.6] : [86.6, 100];
	let d = '';
	for (let x = -h; x <= w; x += 11) d += `M${x} ${h}L${x + h * 0.58} 0`;
	return d;
}

/** Dove disegnare un motivo di 24 × 24 (come le icone) centrato in `x`,`y`, grande `k` volte. */
export const glyphTransform = (x: number, y: number, k: number) => `translate(${(x - 12 * k).toFixed(2)} ${(y - 12 * k).toFixed(2)}) scale(${k})`;

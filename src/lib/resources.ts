/** Risorse della campagna (la voce Risorse in fondo alla barra a sinistra): immagini, audio e altri file. */
export const RESOURCE_KINDS = ['image', 'audio', 'other'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const kindOf = (mime: string): ResourceKind =>
	mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'other';

/** «820 kB», «12,4 MB». */
export function formatSize(bytes: number, locale: string): string {
	const mb = bytes >= 1e6;
	return new Intl.NumberFormat(locale, { style: 'unit', unit: mb ? 'megabyte' : 'kilobyte', maximumFractionDigits: 1 }).format(
		mb ? bytes / 1e6 : Math.max(1, Math.round(bytes / 1e3))
	);
}

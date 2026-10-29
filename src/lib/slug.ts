/** Trasforma un titolo in un indirizzo leggibile: "Città di Neverwinter" -> "citta-di-neverwinter". */
export function slugify(input: string, fallback = 'page'): string {
	const s = input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/['’`]/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '');
	return s || fallback;
}

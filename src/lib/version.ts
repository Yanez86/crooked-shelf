/** Il repository del progetto: link nel piè di pagina e controllo degli aggiornamenti in Amministrazione. */
export const REPO = 'https://github.com/yanez86/crooked-shelf';

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Confronta due versioni MAGGIORE.MINORE.CORRETTIVA: negativo se `a` è più vecchia di `b`, 0 se uguali,
 * positivo se più nuova; null se una delle due non è una versione. Una pre-release (1.0.0-beta) viene prima di 1.0.0.
 */
export function compareVersions(a: string, b: string): number | null {
	const pa = SEMVER.exec(a.trim());
	const pb = SEMVER.exec(b.trim());
	if (!pa || !pb) return null;
	for (let i = 1; i <= 3; i++) {
		const d = Number(pa[i]) - Number(pb[i]);
		if (d) return Math.sign(d);
	}
	return comparePre(pa[4], pb[4]);
}

function comparePre(a: string | undefined, b: string | undefined): number {
	if (a === b) return 0;
	if (a === undefined) return 1;
	if (b === undefined) return -1;
	const xa = a.split('.');
	const xb = b.split('.');
	for (let i = 0; i < Math.max(xa.length, xb.length); i++) {
		if (xa[i] === undefined) return -1;
		if (xb[i] === undefined) return 1;
		if (xa[i] === xb[i]) continue;
		const na = /^\d+$/.test(xa[i]);
		const nb = /^\d+$/.test(xb[i]);
		// I numeri si confrontano come numeri e vengono prima delle parole (alpha.2 < alpha.10 < alpha.beta).
		if (na && nb) return Math.sign(Number(xa[i]) - Number(xb[i]));
		if (na !== nb) return na ? -1 : 1;
		return xa[i] < xb[i] ? -1 : 1;
	}
	return 0;
}

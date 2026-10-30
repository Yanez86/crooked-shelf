import { str } from './forms.ts';
import { getMap, validParentMap, type MapInput } from './maps.ts';

/** Legge le impostazioni della mappa dal modulo della pagina. La scala si scrive come "larghezza reale della mappa". */
export function readMapForm(f: FormData, imageWidth: number | null, id?: number) {
	const parent = Number(f.get('parentId'));
	const across = Number(String(f.get('across') ?? '').replace(',', '.'));
	const input: MapInput = {
		parentId: Number.isInteger(parent) && parent > 0 && getMap(parent) ? parent : null,
		scale: imageWidth && across > 0 && Number.isFinite(across) ? across / imageWidth : null,
		unit: str(f, 'unit', 20)
	};
	const values = { parentId: input.parentId, unit: input.unit, across: String(f.get('across') ?? '') };
	const error = id && !validParentMap(id, input.parentId) ? 'maps.errParent' : null;
	return { input, values, error };
}

/** Le impostazioni della mappa come le mostra il modulo. */
export const mapFormValues = (m: { parentId: number | null; scale: number | null; width: number; unit: string }) => ({
	parentId: m.parentId,
	across: m.scale ? String(Math.round(m.scale * m.width * 100) / 100) : '',
	unit: m.unit
});

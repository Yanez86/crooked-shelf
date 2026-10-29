import { str } from './forms.ts';
import { getMap, validParentMap, type MapInput, type MapVisibility } from './maps.ts';

const VIS: MapVisibility[] = ['public', 'players', 'master'];

/** Legge il modulo di una mappa. La scala si scrive come "larghezza reale della mappa". */
export function readMapForm(f: FormData, imageWidth: number | null, id?: number) {
	const parent = Number(f.get('parentId'));
	const across = Number(String(f.get('across') ?? '').replace(',', '.'));
	const input: MapInput = {
		title: str(f, 'title', 120),
		description: str(f, 'description', 1000),
		visibility: VIS.includes(str(f, 'visibility') as MapVisibility) ? (str(f, 'visibility') as MapVisibility) : 'players',
		parentId: Number.isInteger(parent) && parent > 0 && getMap(parent) ? parent : null,
		scale: imageWidth && across > 0 && Number.isFinite(across) ? across / imageWidth : null,
		unit: str(f, 'unit', 20)
	};
	const values = { ...input, across: String(f.get('across') ?? '') };
	let error: string | null = null;
	if (!input.title) error = 'errors.titleRequired';
	else if (id && !validParentMap(id, input.parentId)) error = 'maps.errParent';
	return { input, values, error };
}

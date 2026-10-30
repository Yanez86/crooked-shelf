import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { galleryImages } from '#lib/server/gallery.ts';

/** Le immagini della galleria che chi scrive può vedere: per scegliere la copertina di una pagina. */
export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	return json(galleryImages(locals.user).map(({ id, url, alt, width, height }) => ({ id, url, alt, width, height })));
};

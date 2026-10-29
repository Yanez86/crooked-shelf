import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { saveImage } from '#lib/server/files.ts';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) return json({ error: 'files.empty' }, { status: 400 });
	const r = saveImage(Buffer.from(await file.arrayBuffer()), file.name, locals.user.id);
	if (!r.ok) return json({ error: r.error }, { status: 400 });
	return json({ id: r.file.id, url: `/files/${r.file.id}`, width: r.file.width, height: r.file.height });
};

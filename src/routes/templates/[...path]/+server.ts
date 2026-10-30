import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** La pagina dei template della 0.10 e precedenti: ora i template sono pagine, nell'albero e nell'elenco. */
export const GET: RequestHandler = () => redirect(308, '/wiki?kind=template');

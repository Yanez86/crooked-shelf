import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Le preferenze ora stanno nel profilo: i vecchi collegamenti continuano a funzionare.
export const GET: RequestHandler = () => redirect(308, '/profile');

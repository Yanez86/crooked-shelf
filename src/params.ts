import { defineParams } from '@sveltejs/kit/params';

/** Parametri delle route con un formato: [id=id] è il numero di una campagna (es. /mcp/2). */
export const params = defineParams({
	id: (param) => (/^\d+$/.test(param) ? param : undefined)
});

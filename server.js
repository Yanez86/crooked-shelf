// Avvio di Crooked Shelf in produzione: `npm run build`, poi `npm start`.
//
// Variabili d'ambiente:
//   PORT            porta (predefinita 3000)
//   HOST            indirizzo su cui ascoltare (predefinito 0.0.0.0)
//   CS_DATA_DIR     cartella dei dati (predefinita ./data)
//   CS_ORIGIN       indirizzo pubblico, es. https://wiki.esempio.it (consigliato dietro un proxy)
//   CS_TRUST_PROXY  1 = fidati delle intestazioni X-Forwarded-* del proxy (Caddy, nginx…)
//
// Senza CS_ORIGIN la wiki usa l'indirizzo con cui viene raggiunta, in http: così funziona
// subito anche in rete locale (es. http://192.168.1.20:3000) senza certificati.
import { createServer } from 'node:http';
import process from 'node:process';

const origin = process.env.CS_ORIGIN ? new URL(process.env.CS_ORIGIN) : null;
const trustProxy = process.env.CS_TRUST_PROXY === '1';

process.env.PROTOCOL_HEADER = 'x-cs-proto';
process.env.HOST_HEADER = 'x-cs-host';
process.env.BODY_SIZE_LIMIT ??= '4M';
if (trustProxy) process.env.ADDRESS_HEADER ??= 'x-forwarded-for';

const { handler } = await import('./build/handler.js');

const first = (v) => (Array.isArray(v) ? v[0] : v)?.split(',')[0].trim();

const server = createServer((req, res) => {
	// Le intestazioni interne non possono arrivare da fuori.
	delete req.headers['x-cs-proto'];
	delete req.headers['x-cs-host'];
	if (origin) {
		req.headers['x-cs-proto'] = origin.protocol.slice(0, -1);
		req.headers['x-cs-host'] = origin.host;
	} else {
		const proto = trustProxy ? first(req.headers['x-forwarded-proto']) : undefined;
		const host = trustProxy ? first(req.headers['x-forwarded-host']) : undefined;
		req.headers['x-cs-proto'] = proto === 'https' ? 'https' : 'http';
		req.headers['x-cs-host'] = host || req.headers.host || 'localhost';
	}
	handler(req, res);
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
server.listen(port, host, () => console.log(`Crooked Shelf: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));

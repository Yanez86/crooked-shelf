import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';

// Fase 6: il profilo in alto a destra. Usa la wiki dei test precedenti.
test.describe.configure({ mode: 'serial' });

const SHOTS = 'test-results/screens';
const ADMIN = { user: 'davide', pass: 'drago-rosso-2024' };
const PLAYER = { user: 'alice', pass: 'elfa-dei-boschi-99' };

let admin: Page;

async function axe(page: Page, label: string) {
	const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
	const found = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
	expect(found, found.join('\n')).toEqual([]);
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function login(browser: Browser, u: { user: string; pass: string }) {
	const page = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await page.goto('/login');
	await page.getByLabel('Nome utente').fill(u.user);
	await page.getByLabel('Password').fill(u.pass);
	await page.getByRole('button', { name: 'Accedi' }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/login'));
	return page;
}

test('accesso', async ({ browser }) => {
	admin = await login(browser, ADMIN);
});

test('in alto a destra: icona, nome e grado', async () => {
	// Nella home: il menu (con le sezioni della wiki) non copre per metà i comandi dei filtri, come in /wiki.
	await admin.goto('/');
	const header = admin.locator('header.site-header');
	const toggle = header.locator('.user-menu summary');
	await expect(toggle).toBeVisible();
	await expect(toggle).toHaveAccessibleName('Profilo: Davide Master');

	// Si apre con il menu del profilo; Esc lo richiude.
	const menu = header.locator('.user-menu .panel');
	await expect(menu).toBeHidden();
	await toggle.click();
	await expect(menu.getByRole('link', { name: 'Profilo' })).toBeVisible();
	await expect(menu.getByRole('link', { name: 'Galleria' })).toHaveCount(0);
	await expect(menu.getByRole('link', { name: 'Amministrazione' })).toBeVisible();
	await expect(menu.getByRole('button', { name: /Esci/ })).toBeVisible();
	await axe(admin, 'menu del profilo');
	await shot(admin, '50-menu-del-profilo');
	await admin.keyboard.press('Escape');
	await expect(menu).toBeHidden();

	// Un clic fuori lo chiude; aprendo il profilo si richiude da solo.
	await toggle.click();
	await admin.mouse.click(10, 600);
	await expect(menu).toBeHidden();
	await toggle.click();
	await menu.getByRole('link', { name: 'Profilo' }).click();
	await expect(menu).toBeHidden();

	// Il popup mette il fuoco sul suo primo pulsante: aperto col mouse niente contorno, che torna con Tab.
	const focusWidth = () =>
		admin.evaluate(() => {
			const { outlineStyle, outlineWidth } = getComputedStyle(document.activeElement!);
			return outlineStyle === 'none' ? '0px' : outlineWidth;
		});
	const panel = admin.getByRole('dialog', { name: 'Profilo' });
	await expect(panel.frameLocator('iframe').getByRole('region', { name: 'Icona e nome' })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'Chiudi' })).toBeFocused();
	expect(await focusWidth()).toBe('0px');
	await admin.keyboard.press('Tab');
	await admin.keyboard.press('Shift+Tab');
	await expect(panel.getByRole('button', { name: 'Chiudi' })).toBeFocused();
	expect(await focusWidth()).toBe('3px');

	// Anche nei campi di testo, dove il browser lo mostrerebbe sempre.
	await admin.keyboard.press('Escape');
	await expect(panel).toBeHidden();
	await header.getByRole('searchbox').click();
	expect(await focusWidth()).toBe('0px');
});

test('profilo: preferenze, icona e nome', async () => {
	// Il vecchio indirizzo porta alla scheda Lettura del profilo; le schede sono collegamenti.
	await admin.goto('/preferences');
	await expect(admin).toHaveURL(/\/profile\?tab=reading$/);
	await expect(admin.getByRole('heading', { level: 1, name: 'Profilo' })).toBeVisible();
	await expect(admin.getByRole('main')).toContainText('@davide');
	const tabs = admin.getByRole('navigation', { name: 'Sezioni del profilo' });
	await expect(tabs.getByRole('link', { name: 'Lettura e accessibilità' })).toHaveAttribute('aria-current', 'page');
	await expect(admin.getByRole('region', { name: 'Lettura e accessibilità' })).toBeVisible();
	await expect(admin.getByRole('region', { name: 'Icona e nome' })).toHaveCount(0);
	await axe(admin, 'profilo');
	await tabs.getByRole('link', { name: 'Password' }).click();
	await expect(admin.getByLabel('Password attuale')).toBeVisible();
	await tabs.getByRole('link', { name: 'Icona e nome' }).click();
	await expect(admin).toHaveURL(/\/profile$/);

	// Senza scelta, la sagoma di una persona; si sceglie un'altra icona e si vede subito in alto.
	const identity = admin.getByRole('region', { name: 'Icona e nome' });
	await expect(identity.getByRole('radio', { name: 'Persona' })).toBeChecked();
	const before = await admin.locator('.user-menu summary path').getAttribute('d');
	await identity.getByRole('radio', { name: 'Corona' }).check();
	await identity.getByRole('button', { name: 'Salva' }).click();
	await expect(identity.getByRole('status')).toContainText('Modifiche salvate');
	await expect(admin.locator('.user-menu summary path')).not.toHaveAttribute('d', before!);
	await admin.reload();
	await expect(identity.getByRole('radio', { name: 'Corona' })).toBeChecked();
	await shot(admin, '51-profilo');

	// Un'immagine caricata prende il posto dell'icona; un file che non è un'immagine no.
	await identity.getByLabel('Immagine').setInputFiles({ name: 'nota.txt', mimeType: 'image/png', buffer: Buffer.from('non sono un png') });
	await identity.getByRole('button', { name: 'Salva' }).click();
	await expect(identity.getByRole('alert')).toBeVisible();
	await expect(admin.locator('.user-menu summary img')).toHaveCount(0);
	await identity.getByLabel('Immagine').setInputFiles('tests/fixtures/city.png');
	await identity.getByRole('button', { name: 'Salva' }).click();
	await expect(identity.getByRole('status')).toContainText('Modifiche salvate');
	const src = await admin.locator('.user-menu summary img').getAttribute('src');
	expect(src).toMatch(/^\/files\//);
	expect((await admin.request.get(src!)).status()).toBe(200);
	await expect(admin.locator('.who img')).toHaveAttribute('src', src!);
	await axe(admin, 'profilo con immagine');

	// Tolta, torna l'icona e il file sparisce.
	await identity.getByLabel("Togli l'immagine e torna all'icona").check();
	await identity.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.locator('.user-menu summary img')).toHaveCount(0);
	await expect(admin.locator('.user-menu summary path')).not.toHaveAttribute('d', before!);
	expect((await admin.request.get(src!)).status()).toBe(404);
});

test('profilo e amministrazione si aprono sopra la wiki, che resta sotto', async () => {
	await admin.goto('/wiki/locanda-del-grifone');
	const url = admin.url();
	const toggle = admin.locator('.user-menu summary');
	const frame = admin.frameLocator('dialog iframe');
	const open = async (name: string) => {
		await toggle.click();
		await admin.locator('.user-menu .panel').getByRole('link', { name, exact: true }).click();
		return admin.getByRole('dialog', { name });
	};

	// Solo la pagina, senza intestazione: i moduli salvano come sempre. Esc chiude anche col fuoco dentro, e la wiki si aggiorna.
	const profile = await open('Profilo');
	await expect(profile).toBeVisible();
	const identity = frame.getByRole('region', { name: 'Icona e nome' });
	await frame.getByLabel('Nome visualizzato').fill('Davide il Saggio');
	await identity.getByRole('button', { name: 'Salva' }).click();
	await expect(identity.getByRole('status')).toContainText('Modifiche salvate');
	await expect(frame.locator('header.site-header')).toHaveCount(0);
	await axe(admin, 'profilo in sovraimpressione');
	await shot(admin, '52-profilo-popup');
	await frame.getByLabel('Nome visualizzato').focus();
	await admin.keyboard.press('Escape');
	await expect(profile).toBeHidden();
	await expect(admin).toHaveURL(url);
	await expect(toggle).toHaveAccessibleName('Profilo: Davide il Saggio Master');
	await expect(toggle).toBeFocused();

	// Le sezioni si cambiano dentro il popup, anche dopo un modulo che ricarica la pagina. Si chiude con la X o cliccando fuori.
	const panel = await open('Amministrazione');
	// Le sezioni sono una barra a sinistra, alta quanto il popup, e la pagina sta alla sua destra.
	const sections = frame.getByRole('navigation', { name: 'Amministrazione' });
	await expect(frame.getByLabel('Nome del sito')).toBeVisible();
	const bar = (await sections.boundingBox())!;
	const view = (await panel.locator('iframe').boundingBox())!;
	expect(Math.abs(bar.x - view.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(bar.height - view.height)).toBeLessThanOrEqual(1);
	expect(bar.x + bar.width).toBeLessThanOrEqual((await frame.getByLabel('Nome del sito').boundingBox())!.x);
	await frame.getByRole('link', { name: 'Utenti' }).click();
	await expect(frame.getByRole('table', { name: 'Utenti' })).toContainText('@alice');
	await frame.getByRole('link', { name: 'Impostazioni' }).click();
	await expect(frame.getByLabel('Nome del sito')).toBeVisible();
	await frame.getByRole('button', { name: 'Salva' }).click();
	await expect(frame.getByRole('status')).toBeVisible();
	await expect(frame.locator('header.site-header')).toHaveCount(0);
	await panel.getByRole('button', { name: 'Chiudi' }).click();
	await expect(panel).toBeHidden();
	const again = await open('Amministrazione');
	await expect(again).toBeVisible();
	await admin.mouse.click(4, 4);
	await expect(again).toBeHidden();
	await expect(admin).toHaveURL(url);

	// Quello che si sta scrivendo sotto il popup non si perde.
	await admin.goto('/wiki/new?template=none');
	await admin.getByLabel('Titolo', { exact: true }).fill('Bozza non salvata');
	const draft = await open('Profilo');
	await expect(frame.getByLabel('Nome visualizzato')).toBeVisible();
	await draft.getByRole('button', { name: 'Chiudi' }).click();
	await expect(draft).toBeHidden();
	await expect(toggle).toHaveAccessibleName('Profilo: Davide il Saggio Master');
	await expect(admin.getByLabel('Titolo', { exact: true })).toHaveValue('Bozza non salvata');
});

test('il giocatore vede il suo nome e il suo grado, senza Amministrazione', async ({ browser }) => {
	const p = await login(browser, PLAYER);
	const header = p.locator('header.site-header');
	const toggle = header.locator('.user-menu summary');
	await expect(toggle).toHaveAccessibleName('Profilo: Alice Giocatore');
	await toggle.click();
	await expect(header.getByRole('link', { name: 'Profilo' })).toBeVisible();
	await expect(header.getByRole('link', { name: 'Amministrazione' })).toHaveCount(0);

	// Sul telefono resta solo l'icona: nome e grado si leggono nel menu.
	await p.setViewportSize({ width: 390, height: 844 });
	await p.goto('/');
	const icon = (await toggle.locator('.user-icon').boundingBox())!;
	expect((await toggle.boundingBox())!.width).toBeLessThan(icon.width * 1.5);
	await toggle.click();
	await expect(p.locator('.user-menu .panel')).toContainText('Alice · Giocatore');
	await axe(p, 'menu del profilo telefono');
	await shot(p, '52-menu-del-profilo-telefono');
	await p.context().close();
});

test('la home: una sola, in cima all\'albero, fuori dalle cartelle, non si elimina', async () => {
	const tree = admin.getByRole('navigation', { name: 'Pagine e risorse' });
	const box = admin.getByRole('checkbox', { name: 'Pagina home' });
	const options = admin.getByRole('button', { name: 'Opzioni pagina' });
	const first = tree.locator('.level.root > li').first();
	await admin.goto('/');
	await expect(first).toContainText('Le Cronache di Faerûn');
	await expect(first.getByRole('link')).toHaveAttribute('aria-current', 'page');

	// Una pagina che sta in una cartella diventa la home: si apre dalla radice del sito.
	await admin.goto('/wiki/locanda-del-grifone/edit');
	await options.click();
	await box.check();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin).toHaveURL(/\/$/);
	await expect(admin.getByRole('heading', { level: 1, name: 'Locanda del Grifone' })).toBeVisible();
	await expect(first).toContainText('Locanda del Grifone');
	await expect(tree.getByRole('button', { name: 'Sposta nel cestino: Locanda del Grifone' })).toHaveCount(0);
	await expect(tree.locator('li.row:has(a[href="/wiki/le-cronache-di-faerun"])').getByRole('button', { name: /^Sposta nel cestino/ })).toHaveCount(1);
	await axe(admin, 'nuova home');

	// In modifica: niente eliminazione, niente cartella, e la casella non si può togliere.
	await admin.getByRole('link', { name: 'Modifica: Locanda del Grifone' }).click();
	await options.click();
	await expect(box).toBeChecked();
	await expect(box).toBeDisabled();
	await expect(admin.getByLabel('Categoria')).toHaveCount(0);
	await expect(admin.getByRole('heading', { name: 'Eliminare la pagina' })).toHaveCount(0);

	// La home la deve vedere chi apre il sito; la vecchia home è una pagina come le altre e può tornare a esserlo.
	await admin.goto('/wiki/le-cronache-di-faerun/edit');
	await expect(admin.getByRole('heading', { name: 'Eliminare la pagina' })).toHaveCount(1);
	await options.click();
	await admin.getByRole('radio', { name: 'Solo Master' }).check();
	await box.check();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('alert')).toContainText('La home deve poterla vedere');
	await options.click();
	await admin.getByRole('radio', { name: 'Pubblica' }).check();
	await box.check();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Le Cronache di Faerûn' })).toBeVisible();
	await expect(first).toContainText('Le Cronache di Faerûn');
	await expect(tree.getByRole('button', { name: 'Sposta nel cestino: Locanda del Grifone' })).toHaveCount(1);
});

test('Claude legge la campagna col token del Master, e solo il Master lo crea', async ({ browser, request }) => {
	const createToken = async (p: Page) => {
		await p.goto('/campaign/1?tab=claude');
		await p.getByRole('button', { name: 'Crea un token' }).click();
		await expect(p.getByLabel('Indirizzo', { exact: true })).toHaveValue(/\/mcp$/);
		await axe(p, 'campagna: Claude');
		await shot(p, '6-campagna-claude');
		return p.getByLabel('Token', { exact: true }).inputValue();
	};
	const mcp = (token: string, name: string, args: object) =>
		request.post('/mcp', { headers: { Authorization: `Bearer ${token}` }, data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } });
	const text = async (token: string, name: string, args: object) => (await (await mcp(token, name, args)).json()).result.content[0].text as string;

	// Claude lavora su una campagna solo col suo Master: il giocatore non arriva alla scheda.
	const p = await login(browser, PLAYER);
	expect((await p.goto('/campaign/1?tab=claude'))?.status()).toBe(404);
	await p.context().close();

	const master = await createToken(admin);
	expect(await text(master, 'read_page', { slug: 'locanda-del-grifone' })).toContain('spia degli Zhentarim');
	expect(await text(master, 'list_pages', {})).toContain('piano-del-cattivo');

	// Senza token non si entra, nemmeno col cookie dell'Admin; il token non vale per il resto della wiki.
	const body = { data: { jsonrpc: '2.0', id: 1, method: 'tools/list' } };
	expect((await request.post('/mcp', body)).status()).toBe(401);
	expect((await request.post('/mcp', { ...body, headers: { Authorization: 'Bearer sbagliato' } })).status()).toBe(401);
	expect((await admin.request.post('/mcp', body)).status()).toBe(401);
	const other = await request.post('/api/tree', { headers: { Authorization: `Bearer ${master}` }, maxRedirects: 0 });
	expect(other.ok()).toBe(false);
	expect((await request.get('/mcp', { headers: { Authorization: `Bearer ${master}` } })).status()).toBe(405);

	// Senza la casella il token non scrive.
	expect((await (await mcp(master, 'create_page', { title: 'Abusiva', text: 'x' })).json()).error.code).toBe(-32602);

	// Con la casella Claude scrive, ma solo testo delle pagine.
	await admin.goto('/campaign/1?tab=claude');
	await admin.getByLabel('Claude può anche scrivere').check();
	await axe(admin, 'profilo: token che scrive');
	await admin.getByRole('button', { name: 'Sostituisci il token' }).click();
	const writer = await admin.getByLabel('Token', { exact: true }).inputValue();
	await expect(admin.getByRole('region', { name: 'Collegamenti attivi' })).toContainText('leggere e scrivere');
	await expect(admin.getByLabel('Claude può anche scrivere')).toBeChecked();
	expect((await mcp(master, 'list_pages', {})).status()).toBe(401);

	const text2 = '## Riassunto\n\nSi parla di [[Bartolo Pancia]] e di @incantesimo[Fireball].\n\n- primo fatto\n- secondo fatto\n\n<script>window.preso = 1</script>';
	const made = JSON.parse(await text(writer, 'create_page', { title: 'Scritta da Claude', text: text2, visibility: 'players' }));
	expect(made.slug).toBe('scritta-da-claude');
	await text(writer, 'append_to_page', { slug: made.slug, text: 'Nota del Master', secret: true });
	await text(writer, 'replace_text', { slug: made.slug, find: 'primo fatto', replace: 'fatto corretto' });

	const errors: string[] = [];
	admin.on('pageerror', (e) => errors.push(e.message));
	await admin.goto(`/wiki/${made.slug}`);
	const content = admin.locator('.content');
	await expect(content.getByRole('heading', { level: 2, name: 'Riassunto' })).toBeVisible();
	await expect(content.getByRole('link', { name: 'Bartolo Pancia' })).toHaveAttribute('href', '/wiki/bartolo-pancia');
	await expect(content.locator('.secret')).toContainText('Nota del Master');
	await expect(content).toContainText('fatto corretto');
	await expect(content).toContainText('<script>window.preso = 1</script>');
	expect(await admin.evaluate(() => (window as unknown as { preso?: number }).preso)).toBeUndefined();

	// L'editor del sito apre e salva quello che ha scritto Claude.
	await admin.goto(`/wiki/${made.slug}/edit`);
	await expect(admin.locator('.editor-content')).toContainText('fatto corretto');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await admin.waitForURL(`**/wiki/${made.slug}`);
	await expect(admin.locator('.content .secret')).toContainText('Nota del Master');
	expect(errors).toEqual([]);

	await admin.goto(`/wiki/${made.slug}/history`);
	await expect(admin.getByRole('main')).toContainText('Davide');

	// Il token che scrive resta chiuso fuori da tutto il resto.
	const auth = { Authorization: `Bearer ${writer}` };
	expect((await request.post('/api/tree', { headers: auth, maxRedirects: 0 })).ok()).toBe(false);
	expect((await request.delete('/api/tree', { headers: auth, data: { node: 'page-1' }, maxRedirects: 0 })).ok()).toBe(false);
	expect((await request.get('/admin/backup/download', { headers: auth, maxRedirects: 0 })).ok()).toBe(false);
	expect((await request.post('/admin/plugins', { headers: auth, maxRedirects: 0 })).ok()).toBe(false);
	expect((await (await mcp(writer, 'delete_page', { slug: made.slug })).json()).error.code).toBe(-32602);
});

test('Claude si collega come connettore (OAuth), uno per campagna e solo col Master', async ({ browser, request }) => {
	// L'indirizzo del connettore è nella scheda Claude della campagna, che vede solo il Master; da lì, senza token, Claude trova dove chiedere il consenso e si registra.
	await admin.goto('/campaign/1?tab=claude');
	const connector = await admin.getByLabel('Indirizzo del connettore per claude.ai').inputValue();
	expect(connector).toMatch(/\/mcp\/\d+$/);
	const denied = await request.post(connector, { data: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
	expect(denied.status()).toBe(401);
	const meta = /resource_metadata="([^"]+)"/.exec(denied.headers()['www-authenticate'])![1];
	const resource = await (await request.get(meta)).json();
	expect(resource.resource).toBe(connector);
	const as = await (await request.get(`${resource.authorization_servers[0]}/.well-known/oauth-authorization-server`)).json();
	const back = 'https://claude.ai/api/mcp/auth_callback';
	const client = await (await request.post(as.registration_endpoint, { data: { redirect_uris: [back], client_name: 'Claude' } })).json();

	const verifier = 'verificatore-di-prova-'.repeat(3);
	const challenge = createHash('sha256').update(verifier).digest('base64url');
	const q = new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: back, code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', resource: connector });
	const consent = `${as.authorization_endpoint}?${q}`;

	// Il giocatore non può collegare la campagna.
	const p = await login(browser, PLAYER);
	await p.goto(consent);
	await expect(p.getByRole('alert')).toContainText('solo col suo Master');
	await expect(p.getByRole('button', { name: 'Consenti' })).toHaveCount(0);
	await p.context().close();

	await admin.route('https://claude.ai/**', (r) => r.fulfill({ body: 'ok' }));
	await admin.goto(consent);
	await expect(admin.getByText('claude.ai', { exact: true })).toBeVisible();
	await expect(admin.getByRole('main')).toContainText('Le Cronache di Faerûn');
	await axe(admin, 'consenso per il connettore');
	await shot(admin, '6-oauth-consenso');
	await admin.getByRole('button', { name: 'Consenti' }).click();
	await admin.waitForURL(/^https:\/\/claude\.ai\//);
	const code = new URL(admin.url()).searchParams;
	expect(code.get('state')).toBe('xyz');

	// I server di Claude non mandano Origin: il token lo prendono lo stesso, gli altri form da fuori restano chiusi.
	const form = { grant_type: 'authorization_code', code: code.get('code')!, redirect_uri: back, code_verifier: verifier, client_id: client.client_id, resource: connector };
	const issued = await request.post(as.token_endpoint, { form });
	expect(issued.status()).toBe(200);
	const token = (await issued.json()).access_token as string;
	expect((await request.post(as.token_endpoint, { form })).status()).toBe(400);
	expect((await request.post('/login', { form: { username: 'alice', password: PLAYER.pass } })).status()).toBe(403);

	// Il token vale per la campagna del connettore e per nessun'altra.
	const read = (url: string) =>
		request.post(url, { headers: { Authorization: `Bearer ${token}` }, data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_page', arguments: { slug: 'locanda-del-grifone' } } } });
	expect((await (await read(connector)).json()).result.content[0].text).toContain('spia degli Zhentarim');
	expect((await read(connector.replace(/\d+$/, (n) => String(Number(n) + 1)))).status()).toBe(401);

	await admin.unroute('https://claude.ai/**');
	await admin.goto('/campaign/1?tab=claude');
	await expect(admin.getByRole('region', { name: 'Collegamenti attivi' })).toContainText('collegato da claude.ai');
	await admin.getByRole('button', { name: 'Revoca' }).click();
	await expect(admin.getByRole('status').filter({ hasText: 'Token revocato' })).toBeVisible();
	await expect(admin.getByRole('region', { name: 'Collegamenti attivi' })).toContainText('nessun collegamento');
	expect((await read(connector)).status()).toBe(401);
});

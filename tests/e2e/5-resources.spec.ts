import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// Fase 5: risorse (immagini, audio, altri file) e linguette dell'albero. Usa la wiki dei test precedenti.
test.describe.configure({ mode: 'serial' });

const SHOTS = 'test-results/screens';
const ADMIN = { user: 'davide', pass: 'drago-rosso-2024' };
const PLAYER = { user: 'alice', pass: 'elfa-dei-boschi-99' };
const TREE = 'Pagine e risorse';

let admin: Page;
let secretUrl = '';

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

/** Un secondo di silenzio in WAV (8 kHz, 8 bit, mono): il browser lo sa suonare davvero. */
function wav() {
	const data = Buffer.alloc(8000, 0x80);
	const h = Buffer.alloc(44);
	h.write('RIFF', 0);
	h.writeUInt32LE(36 + data.length, 4);
	h.write('WAVEfmt ', 8);
	h.writeUInt32LE(16, 16);
	h.writeUInt16LE(1, 20);
	h.writeUInt16LE(1, 22);
	h.writeUInt32LE(8000, 24);
	h.writeUInt32LE(8000, 28);
	h.writeUInt16LE(1, 32);
	h.writeUInt16LE(8, 34);
	h.write('data', 36);
	h.writeUInt32LE(data.length, 40);
	return Buffer.concat([h, data]);
}

async function upload(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, title = '', visibility?: string) {
	await page.goto('/resources/new');
	await page.getByLabel('File', { exact: true }).setInputFiles(file);
	if (title) await page.getByLabel('Titolo').fill(title);
	if (visibility) await page.getByLabel(visibility).check();
	await page.getByRole('button', { name: 'Carica', exact: true }).click();
	await page.waitForURL(/\/resources\/\d+$/);
}

test('accesso', async ({ browser }) => {
	admin = await login(browser, ADMIN);
});

test('linguette dell\'albero: pagine e risorse', async () => {
	await admin.goto('/wiki/locanda-del-grifone');
	const tree = admin.getByRole('navigation', { name: TREE });
	const pages = tree.getByRole('tab', { name: 'Pagine' });
	const resources = tree.getByRole('tab', { name: 'Risorse' });
	// Dopo il pacchetto mondo reimportato le locande sono due: conta quella aperta.
	const locanda = tree.locator('a[aria-current="page"]');
	await expect(pages).toHaveAttribute('aria-selected', 'true');
	await expect(locanda).toHaveText('Locanda del Grifone');
	await expect(locanda).toBeVisible();

	await resources.click();
	await expect(resources).toHaveAttribute('aria-selected', 'true');
	await expect(tree.getByRole('tabpanel', { name: 'Risorse' })).toContainText('Ancora nessuna risorsa.');
	await expect(locanda).toBeHidden();
	await expect(tree.getByRole('link', { name: 'Carica una risorsa' })).toBeVisible();

	// Da tastiera: le frecce passano da una linguetta all'altra.
	await admin.keyboard.press('ArrowLeft');
	await expect(pages).toBeFocused();
	await expect(pages).toHaveAttribute('aria-selected', 'true');
	await expect(locanda).toBeVisible();
	await axe(admin, 'albero con linguette');
});

test('il Master carica una musica, un ritratto e una dispensa segreta', async () => {
	// Senza titolo si usa il nome del file.
	await upload(admin, { name: 'Tema della locanda.wav', mimeType: 'audio/wav', buffer: wav() });
	await expect(admin.getByRole('heading', { level: 1, name: 'Tema della locanda' })).toBeVisible();
	const player = admin.getByLabel('Ascolta «Tema della locanda»');
	await expect.poll(() => player.evaluate((a: HTMLAudioElement) => a.duration)).toBeCloseTo(1, 1);

	// L'audio arriva anche a pezzi: Safari su iPhone non lo suona altrimenti.
	const src = (await player.getAttribute('src'))!;
	const part = await admin.request.get(src, { headers: { Range: 'bytes=0-3' } });
	expect(part.status()).toBe(206);
	expect(part.headers()['content-range']).toBe('bytes 0-3/8044');
	expect((await part.body()).toString()).toBe('RIFF');

	await upload(admin, { name: 'el.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/city.png') }, 'Ritratto di Elminster');
	await expect(admin.getByRole('img', { name: 'Ritratto di Elminster' })).toBeVisible();

	await upload(admin, { name: 'piano segreto.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') }, 'Piano del drago', 'Solo Master');
	secretUrl = new URL(admin.url()).pathname;
	await expect(admin.getByText('Solo Master', { exact: true })).toBeVisible();
	// Gli altri file si scaricano, non si aprono nel browser.
	const href = (await admin.getByRole('link', { name: 'Scarica' }).getAttribute('href'))!;
	const pdf = await admin.request.get(href);
	expect(pdf.headers()['content-disposition']).toContain('attachment; filename="piano segreto.pdf"');

	// Nell'albero si apre da sola la linguetta delle risorse, divise per tipo.
	const tree = admin.getByRole('navigation', { name: TREE });
	await expect(tree.getByRole('tab', { name: 'Risorse' })).toHaveAttribute('aria-selected', 'true');
	const panel = tree.getByRole('tabpanel', { name: 'Risorse' });
	for (const group of ['Immagini', 'Audio', 'Altri file']) await expect(panel.locator('summary', { hasText: group })).toBeVisible();
	await expect(panel.getByRole('link', { name: 'Piano del drago' })).toHaveAttribute('aria-current', 'page');
	await axe(admin, 'risorsa');
	await shot(admin, '40-risorsa');

	await admin.goto('/resources');
	await expect(admin.locator('main').getByRole('heading', { level: 2 })).toHaveText(['Immagini (1)', 'Audio (1)', 'Altri file (1)']);
	await axe(admin, 'elenco delle risorse');
	await shot(admin, '41-risorse');

	await admin.goto('/gallery?show=resources');
	await expect(admin.locator('main').getByRole('status')).toHaveText('1 immagini');
	await expect(admin.locator('main')).toContainText('Risorsa Ritratto di Elminster');
});

test('il giocatore vede le risorse, ma non quelle segrete', async ({ browser }) => {
	const p = await login(browser, PLAYER);
	await p.goto('/resources');
	const main = p.locator('main');
	await expect(main.getByRole('link', { name: 'Tema della locanda' })).toBeVisible();
	await expect(main.getByRole('link', { name: 'Ritratto di Elminster' })).toBeVisible();
	await expect(main).not.toContainText('Piano del drago');
	await expect(main.getByRole('link', { name: /Carica una risorsa/ })).toHaveCount(0);
	await expect(p.getByRole('navigation', { name: TREE })).not.toContainText('Piano del drago');
	expect((await p.goto(secretUrl))?.status()).toBe(404);
	expect((await p.goto('/resources/new'))?.status()).toBe(404);
	await p.context().close();
});

test('modifica ed elimina una risorsa', async () => {
	await admin.goto(secretUrl);
	await admin.getByRole('link', { name: 'Modifica la risorsa' }).click();
	await admin.getByLabel('Titolo').fill('Piano del drago (bozza)');
	await admin.getByLabel('Descrizione').fill('Da dare ai giocatori solo alla fine.');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Piano del drago (bozza)' })).toBeVisible();
	await expect(admin.locator('main')).toContainText('Da dare ai giocatori solo alla fine.');

	await admin.getByRole('link', { name: 'Modifica la risorsa' }).click();
	await admin.getByLabel('Sì, voglio eliminare «Piano del drago (bozza)» e il suo file').check();
	await admin.getByRole('button', { name: 'Elimina la risorsa' }).click();
	await expect(admin.getByRole('status')).toContainText('Risorsa eliminata.');
	await expect(admin.getByRole('navigation', { name: TREE })).not.toContainText('Piano del drago');
});

test('sul telefono la barra a sinistra è un pannello a scomparsa', async () => {
	await admin.setViewportSize({ width: 390, height: 844 });
	await admin.goto('/resources');
	const toggle = admin.getByRole('button', { name: 'Menu e pagine' });
	const tree = admin.getByRole('navigation', { name: TREE });
	const tema = tree.getByRole('link', { name: 'Tema della locanda' });
	const title = admin.getByRole('heading', { level: 1, name: 'Risorse' });
	await expect(tema).toBeHidden();
	const before = await title.boundingBox();

	// Entra da sinistra sopra la pagina, senza spostarla; il fuoco va sul primo collegamento, Nuova pagina.
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(admin.getByRole('link', { name: 'Nuova pagina' })).toBeFocused();
	await expect(tree.getByRole('tab', { name: 'Risorse' })).toHaveAttribute('aria-selected', 'true');
	await expect(tema).toBeVisible();
	expect((await title.boundingBox())?.y).toBe(before?.y);
	await axe(admin, 'risorse telefono');
	await shot(admin, '42-risorse-telefono');

	// Esc lo chiude e riporta il fuoco sul pulsante; anche un tocco fuori lo chiude.
	await admin.keyboard.press('Escape');
	await expect(tema).toBeHidden();
	await expect(toggle).toBeFocused();
	await toggle.click();
	await expect(tema).toBeVisible();
	await admin.mouse.click(370, 600);
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(tema).toBeHidden();

	// Aprendo una pagina dal pannello, il pannello si richiude.
	await toggle.click();
	await tema.click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Tema della locanda' })).toBeVisible();
	await expect(tema).toBeHidden();
	await admin.setViewportSize({ width: 1280, height: 800 });
});

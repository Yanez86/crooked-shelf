import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { strFromU8, unzipSync } from 'fflate';

// Fase 4: plugin, backup, pacchetto mondo, esportazione in Markdown. Usa la wiki dei test precedenti.
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

test('plugin: acceso porta tema, template, calendario e regole', async () => {
	await admin.goto('/admin/plugins');
	const card = admin.getByRole('listitem').filter({ hasText: 'Esempio: atmosfera gotica' });
	await expect(card).toContainText('Spento');
	await expect(card).toContainText('1 temi, 1 template, 1 calendari, 1 regole');
	await axe(admin, 'plugin');
	await card.getByRole('button', { name: /Accendi/ }).click();
	await expect(admin.getByRole('status').first()).toContainText('Plugin acceso');
	await shot(admin, '30-plugin');

	await admin.goto('/preferences');
	await expect(admin.getByRole('radio', { name: 'Gotico' })).toBeVisible();

	await admin.goto('/wiki/new');
	await admin.getByRole('link', { name: /^Taverna/ }).click();
	await expect(admin.getByLabel('Nome del campo 1')).toHaveValue('Oste');

	await admin.goto('/calendar');
	await expect(admin.getByLabel('Calendario pronto').locator('option', { hasText: 'Calendario di Lunargento' })).toHaveCount(1);

	await admin.goto('/rules/rule/riposo-in-taverna');
	await expect(admin.getByRole('heading', { level: 1, name: 'Riposo in taverna' })).toBeVisible();

	// Spento, tutto sparisce.
	await admin.goto('/admin/plugins');
	await admin.getByRole('button', { name: /Spegni/ }).click();
	await admin.goto('/preferences');
	await expect(admin.getByRole('radio', { name: 'Gotico' })).toHaveCount(0);
	expect((await admin.goto('/rules/rule/riposo-in-taverna'))?.status()).toBe(404);
});

test('backup completo', async () => {
	await admin.goto('/admin/backup');
	await axe(admin, 'backup');
	const res = await admin.request.get('/admin/backup/download');
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toBe('application/zip');
	const files = Object.keys(unzipSync(new Uint8Array(await res.body())));
	expect(files).toContain('crooked-shelf.db');
	expect(files.some((f) => f.startsWith('uploads/'))).toBe(true);
});

test('il giocatore non può scaricare backup e pacchetti', async ({ browser }) => {
	const p = await login(browser, PLAYER);
	expect((await p.request.get('/admin/backup/download')).status()).toBe(404);
	expect((await p.request.get('/admin/world/download?pages=all')).status()).toBe(404);
	expect((await p.request.get('/admin/export/download')).status()).toBe(404);
	await p.context().close();
});

test('esportazione in Markdown', async () => {
	await admin.goto('/admin/export');
	await axe(admin, 'esporta');
	const res = await admin.request.get('/admin/export/download');
	const zip = unzipSync(new Uint8Array(await res.body()));
	const loc = Object.keys(zip).find((k) => k.endsWith('Locanda del Grifone.md'))!;
	expect(loc).toBe('Luoghi/Città/Locanda del Grifone.md');
	expect(strFromU8(zip[loc])).toContain('[[Bartolo Pancia]]');
	expect(strFromU8(zip[loc])).toContain('> [!secret]');
	// Le immagini della colonna a lato vanno in cima, con il file accanto.
	const cover = /!\[Il mago nella sua torre\]\((_files\/[\w-]+\.png)\)/.exec(strFromU8(zip['Elminster.md']));
	expect(cover).not.toBeNull();
	expect(Object.keys(zip)).toContain(cover![1]);
	expect(Object.keys(zip)).toContain('Indice.md');
});

test('pacchetto mondo: esporta e reimporta', async () => {
	await admin.goto('/admin/world');
	await axe(admin, 'pacchetto mondo');
	await shot(admin, '31-pacchetto-mondo');

	// Il modulo di esportazione crea il link di download con le scelte fatte.
	await admin.getByLabel('Nome del pacchetto').fill('Costa della Spada');
	const [download] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('button', { name: 'Scarica il pacchetto' }).click()]);
	expect(download.suggestedFilename()).toBe('costa-della-spada.shelf');
	const path = await download.path();
	const zip = unzipSync(new Uint8Array((await import('node:fs')).readFileSync(path!)));
	const manifest = JSON.parse(strFromU8(zip['manifest.json']));
	expect(manifest).toMatchObject({ format: 'crooked-shelf-world', name: 'Costa della Spada', secrets: false });
	expect(strFromU8(zip['pages.json'])).not.toContain('spia degli Zhentarim');
	expect(strFromU8(zip['pages.json'])).not.toContain('Diario di Alice');

	// Reimportato nella stessa wiki: tutto è "doppione".
	await admin.getByLabel('File del pacchetto (.shelf)').setInputFiles(path!);
	await admin.getByRole('button', { name: 'Controlla il contenuto' }).click();
	await expect(admin.locator('main')).toContainText('Esistono già');
	await expect(admin.locator('main')).toContainText('Locanda del Grifone');
	await admin.getByRole('radio', { name: /nome nuovo/ }).check();
	await admin.getByRole('button', { name: 'Importa', exact: true }).click();
	await expect(admin.getByRole('status').first()).toContainText('Pacchetto importato');

	// La copia della Locanda punta alla copia di Bartolo.
	await admin.goto('/wiki/locanda-del-grifone-2');
	await expect(admin.locator('.content').getByRole('link', { name: 'Bartolo Pancia' })).toHaveAttribute('href', '/wiki/bartolo-pancia-2');
	await expect(admin.locator('.content .secret')).toHaveCount(0);
	await admin.goto('/wiki/elminster-2');
	await expect(admin.getByRole('complementary', { name: 'Scheda' }).getByRole('img', { name: 'Il mago nella sua torre' })).toBeVisible();
	await admin.goto('/maps');
	await expect(admin.getByRole('link', { name: 'Costa della Spada' })).toHaveCount(2);
});

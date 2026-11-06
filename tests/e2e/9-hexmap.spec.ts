import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Mappe a esagoni: il Master costruisce e scopre, il giocatore vede solo quello che ha scoperto.
// Usa la campagna in cui sono finiti i test precedenti («Da capo», tenuta da Davide).
test.describe.configure({ mode: 'serial' });

const SHOTS = 'test-results/screens';
const ADMIN = { user: 'davide', pass: 'drago-rosso-2024' };
const PLAYER = { user: 'alice', pass: 'elfa-dei-boschi-99' };
const TITLE = 'Valle di Vadoscuro';
const SLUG = 'valle-di-vadoscuro';

let dm: Page;
let alice: Page;

async function axe(page: Page, label: string) {
	await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
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

const mapOf = (page: Page) => page.getByRole('group', { name: `Mappa a esagoni: ${TITLE}` });
const cellsOf = (page: Page) => mapOf(page).getByRole('button', { name: /^Esagono/ });
const ghostsOf = (page: Page) => mapOf(page).getByRole('button', { name: /^Aggiungi l'esagono/ });
const panelOf = (page: Page) => page.getByRole('complementary', { name: /^Esagono/ });

test('accesso, e Alice entra nella campagna', async ({ browser }) => {
	dm = await login(browser, ADMIN);
	await dm.goto('/preferences');
	await dm.getByRole('radio', { name: 'Vintage bianca', exact: true }).check();
	await dm.getByRole('button', { name: 'Salva' }).first().click();
	await expect(dm.getByRole('status').first()).toContainText('Preferenze salvate');

	const settings = await dm.locator('#explorer a[href^="/campaign/"]').getAttribute('href');
	await dm.goto(`${settings}?tab=players`);
	await dm.getByRole('button', { name: 'Crea invito' }).click();
	const link = await dm.getByLabel('Link di invito').inputValue();
	alice = await login(browser, PLAYER);
	await alice.goto(link);
	await alice.locator('form[action="?/join"] button').click();
	await alice.waitForURL((u) => u.pathname === '/');
});

test('il Master crea una mappa a esagoni: si parte da un esagono, coi + intorno', async () => {
	await dm.goto('/wiki/new');
	await dm.locator('main').getByRole('link', { name: /^Nuova mappa a esagoni/ }).click();
	await dm.getByLabel('Titolo', { exact: true }).fill(TITLE);
	await expect(dm.getByRole('radio', { name: 'Lati piatti in alto' })).toBeChecked();
	await expect(dm.getByRole('radio', { name: /^Tratto/ })).toBeChecked();
	await dm.getByLabel('Un esagono è largo').fill('6');
	await dm.getByLabel('Unità').fill('miglia');
	await axe(dm, 'nuova mappa a esagoni');
	await dm.getByRole('button', { name: 'Crea la pagina' }).click();

	await expect(dm.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
	await expect(dm.getByText('Un esagono: 6 miglia')).toBeVisible();
	await expect(cellsOf(dm)).toHaveCount(1);
	await expect(ghostsOf(dm)).toHaveCount(6);
	await expect(dm.getByRole('button', { name: 'Terreno', exact: true })).toHaveAttribute('aria-pressed', 'true');
	// Un solo esagono nell'ordine del Tab: gli altri si raggiungono con le frecce.
	await expect(mapOf(dm).locator('[tabindex="0"]')).toHaveCount(1);
	await axe(dm, 'mappa a esagoni appena creata');
});

test('terreno: col mouse, trascinando e da tastiera; nasce tutto nascosto', async () => {
	await dm.getByRole('button', { name: 'Foresta', exact: true }).click();
	for (let i = 0; i < 6; i++) await ghostsOf(dm).nth(i % 3).click();
	await expect(cellsOf(dm)).toHaveCount(7);
	await expect(mapOf(dm).getByRole('button', { name: /Foresta, nascosto/ })).toHaveCount(6);

	// Da tastiera: le frecce portano a un altro esagono, Invio usa lo strumento (qui aggiunge un esagono).
	await cellsOf(dm).first().focus();
	const before = await dm.evaluate(() => document.activeElement?.getAttribute('aria-label'));
	await dm.keyboard.press('ArrowDown');
	expect(await dm.evaluate(() => document.activeElement?.getAttribute('aria-label'))).not.toBe(before);
	await ghostsOf(dm).last().focus();
	await dm.keyboard.press('Enter');
	await expect(cellsOf(dm)).toHaveCount(8);

	// Trascinando col mouse si dipingono più esagoni in una volta.
	await dm.getByRole('button', { name: 'Colline', exact: true }).click();
	const a = (await cellsOf(dm).nth(1).boundingBox())!;
	const b = (await cellsOf(dm).nth(5).boundingBox())!;
	await dm.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
	await dm.mouse.down();
	await dm.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
	// La pennellata parte tutta insieme quando si alza il mouse.
	const saved = dm.waitForResponse((r) => r.url().endsWith('/hexes') && r.request().method() === 'POST');
	await dm.mouse.up();
	expect((await saved).ok()).toBe(true);
	await expect.poll(() => mapOf(dm).getByRole('button', { name: /Colline/ }).count()).toBeGreaterThan(1);

	// Il server li ha tutti: ricaricando sono ancora lì (la pennellata, passando su un +, può averne aggiunto uno).
	await expect(dm.getByRole('status').filter({ hasText: /Colline|Aggiunto/ })).toBeVisible();
	const painted = await cellsOf(dm).count();
	expect(painted).toBeGreaterThanOrEqual(8);
	await dm.reload();
	await expect(cellsOf(dm)).toHaveCount(painted);
	await expect.poll(() => mapOf(dm).getByRole('button', { name: /Colline/ }).count()).toBeGreaterThan(1);
});

test('elementi: una città per i giocatori, un passaggio segreto e la nota del Master', async () => {
	await dm.getByRole('button', { name: 'Elementi', exact: true }).click();
	await cellsOf(dm).first().click();
	const panel = panelOf(dm);
	await panel.getByRole('button', { name: 'Aggiungi elemento' }).click();
	const dialog = dm.getByRole('dialog', { name: /^Nuovo elemento in/ });
	await dialog.getByLabel('Nome').fill('Vadoscuro');
	await dialog.getByLabel('Tipo').selectOption('city');
	await dialog.getByLabel('Pagina collegata').fill('Vadoscuro');
	await axe(dm, 'nuovo elemento');
	await dialog.getByRole('button', { name: 'Salva' }).click();
	await expect(dialog).toBeHidden();
	await expect(panel).toContainText('Vadoscuro');

	await panel.getByRole('button', { name: 'Aggiungi elemento' }).click();
	await dialog.getByLabel('Nome').fill('Cunicoli dei contrabbandieri');
	await dialog.getByLabel('Tipo').selectOption('dungeon');
	await dialog.getByRole('radio', { name: 'Solo Master' }).check();
	await dialog.getByRole('button', { name: 'Salva' }).click();
	await expect(dialog).toBeHidden();
	await expect(panel).toContainText('Cunicoli dei contrabbandieri');
	await expect(panel).toContainText('I giocatori lo vedranno quando l\'esagono sarà esplorato.');

	await panel.getByLabel('Note del Master').fill('Il borgomastro paga i briganti.');
	await panel.getByRole('button', { name: 'Salva la nota' }).click();
	await expect(dm.getByRole('status').filter({ hasText: 'Nota salvata' })).toBeVisible();
	await expect(panel.getByLabel('Note del Master')).toHaveValue('Il borgomastro paga i briganti.');
});

test('il gruppo esplora: l’esagono diventa esplorato, quelli intorno intravisti', async () => {
	await dm.getByRole('button', { name: 'Gruppo', exact: true }).click();
	const city = mapOf(dm).getByRole('button', { name: /Vadoscuro/ });
	await city.click();
	await expect(city).toHaveAccessibleName(/esplorato.*qui c'è il gruppo/);
	await expect.poll(() => mapOf(dm).getByRole('button', { name: /, intravisto/ }).count()).toBeGreaterThan(0);
	await expect(panelOf(dm).getByRole('button', { name: 'Esplorato', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await axe(dm, 'mappa a esagoni del Master');
	await shot(dm, '90-mappa-esagoni-master');

	// La stessa mappa in tabella.
	await dm.getByRole('button', { name: 'Elenco', exact: true }).click();
	await expect(dm.getByRole('table')).toContainText('Cunicoli dei contrabbandieri (segreto)');
	await axe(dm, 'mappa a esagoni in elenco');
	await dm.getByRole('button', { name: 'Mappa', exact: true }).click();
});

test('la pagina della città dice in che mappa compare', async () => {
	await panelOf(dm).getByRole('link', { name: 'Crea la pagina' }).click();
	await dm.locator('main').getByRole('link', { name: /^Pagina bianca/ }).click();
	await expect(dm.getByLabel('Titolo', { exact: true })).toHaveValue('Vadoscuro');
	await dm.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(dm.getByRole('heading', { level: 1, name: 'Vadoscuro' })).toBeVisible();
	await expect(dm.locator('.related')).toContainText(TITLE);
});

test('il giocatore vede solo quello che ha scoperto', async () => {
	await dm.goto(`/wiki/${SLUG}`);
	const known = Number((await dm.getByText(/noti ai giocatori/).textContent())!.match(/(\d+) noti/)![1]);
	expect(known).toBeGreaterThan(1);

	await alice.goto(`/wiki/${SLUG}`);
	await expect(alice.getByText(`${known} esagoni scoperti`)).toBeVisible();
	await expect(cellsOf(alice)).toHaveCount(known);
	await expect(ghostsOf(alice)).toHaveCount(0);
	await expect(alice.getByRole('button', { name: 'Terreno', exact: true })).toHaveCount(0);
	// Il segreto e la nota non arrivano proprio, neanche nei dati della pagina.
	const html = await (await alice.request.get(`/wiki/${SLUG}`)).text();
	for (const secret of ['Cunicoli', 'contrabbandieri', 'briganti']) expect(html).not.toContain(secret);

	await mapOf(alice).getByRole('button', { name: /Vadoscuro/ }).click();
	const panel = panelOf(alice);
	await expect(panel).toContainText('Vadoscuro');
	await expect(panel.getByRole('link', { name: 'Apri «Vadoscuro»' })).toBeVisible();
	await expect(panel).not.toContainText('Solo Master');
	await expect(panel.getByLabel('Note del Master')).toHaveCount(0);
	await axe(alice, 'mappa a esagoni del giocatore');
	await shot(alice, '91-mappa-esagoni-giocatore');
	await alice.setViewportSize({ width: 390, height: 844 });
	await axe(alice, 'mappa a esagoni del giocatore al telefono');
	await shot(alice, '92-mappa-esagoni-telefono');
	await alice.setViewportSize({ width: 1280, height: 800 });

	await alice.goto('/wiki/vadoscuro');
	await expect(alice.locator('.related')).toContainText(TITLE);
});

test('il Master guarda come un giocatore, e torna', async () => {
	await dm.goto(`/wiki/${SLUG}`);
	await dm.getByRole('button', { name: 'Guarda come un giocatore' }).click();
	await expect(dm.getByText('Stai vedendo la wiki come la vede un giocatore.')).toBeVisible();
	await expect(dm.getByRole('button', { name: 'Terreno', exact: true })).toHaveCount(0);
	await expect(mapOf(dm).getByRole('button', { name: /Cunicoli/ })).toHaveCount(0);
	await dm.getByRole('button', { name: 'Torna alla tua vista' }).click();
	await expect(dm.getByRole('button', { name: 'Terreno', exact: true })).toBeVisible();
});

test('impostazioni: punte in alto e il set «Pergamena» del plugin d’esempio', async () => {
	await dm.goto('/admin/plugins');
	const card = dm.getByRole('listitem').filter({ hasText: 'Esempio: atmosfera gotica' });
	await expect(card).toContainText('1 set di tasselli');
	if (await card.getByRole('button', { name: /Accendi/ }).count()) {
		await card.getByRole('button', { name: /Accendi/ }).click();
		await expect(dm.getByRole('status').first()).toContainText('Plugin acceso');
	}
	const count = await (async () => {
		await dm.goto(`/wiki/${SLUG}`);
		return cellsOf(dm).count();
	})();

	await dm.goto(`/wiki/${SLUG}/edit`);
	await dm.getByRole('radio', { name: 'Punte in alto' }).check();
	await dm.getByRole('radio', { name: /^Pergamena/ }).check();
	await axe(dm, 'impostazioni della mappa a esagoni');
	await dm.getByRole('button', { name: 'Salva' }).click();
	await expect(dm.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
	await expect(dm.getByText('Set di tasselli: Pergamena')).toBeVisible();
	// Cambiare orientamento e set non cambia la mappa.
	await expect(cellsOf(dm)).toHaveCount(count);
	await expect(mapOf(dm).getByRole('button', { name: /Vadoscuro/ })).toHaveAccessibleName(/qui c'è il gruppo/);
	await axe(dm, 'mappa a esagoni con le punte in alto');
	await shot(dm, '93-mappa-esagoni-pergamena');

	// Spento il plugin, la mappa torna al set incluso e il Master ne è avvisato.
	await dm.goto('/admin/plugins');
	await card.getByRole('button', { name: /Spegni/ }).click();
	await expect(dm.getByRole('status').first()).toContainText('Plugin spento');
	await dm.goto(`/wiki/${SLUG}`);
	await expect(dm.getByText(/Il set «esempio-gotico\/pergamena» non c'è più/)).toBeVisible();
	await expect(cellsOf(dm)).toHaveCount(count);
	await dm.context().close();
	await alice.context().close();
});

import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Più campagne nella stessa installazione. Usa la wiki dei test precedenti, che è la prima campagna.
test.describe.configure({ mode: 'serial' });

const ADMIN = { user: 'davide', pass: 'drago-rosso-2024' };
const PLAYER = { user: 'alice', pass: 'elfa-dei-boschi-99' };
const DM = { user: 'merlino', pass: 'mago-del-lago-2024' };

let admin: Page;
let dm: Page;
let alice: Page;
const SECRET_SLUG = 'pagina-di-avalon';

async function axe(page: Page, label: string) {
	const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
	const found = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
	expect(found, found.join('\n')).toEqual([]);
}

async function login(browser: Browser, u: { user: string; pass: string }) {
	const page = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await page.goto('/login');
	await page.getByLabel('Nome utente').fill(u.user);
	await page.getByLabel('Password').fill(u.pass);
	await page.getByRole('button', { name: 'Accedi' }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/login'));
	return page;
}

async function inviteLink(page: Page) {
	return page.getByLabel('Link di invito').inputValue();
}

test('un account da Master senza campagne aspetta di riceverne una', async ({ browser }) => {
	admin = await login(browser, ADMIN);
	alice = await login(browser, PLAYER);
	await admin.goto('/admin/invites');
	await admin.getByLabel('Ruolo').selectOption({ label: 'Master' });
	await admin.getByRole('button', { name: 'Crea invito' }).click();
	const link = await inviteLink(admin);

	dm = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await dm.goto(link);
	await dm.getByLabel('Nome utente').fill(DM.user);
	await dm.getByLabel('Nome visualizzato').fill('Merlino');
	await dm.getByLabel('Password', { exact: true }).fill(DM.pass);
	await dm.getByLabel('Ripeti la password').fill(DM.pass);
	await dm.getByRole('button', { name: "Crea l'account" }).click();
	await dm.waitForURL('**/campaign');
	await expect(dm.getByRole('main')).toContainText('nessuna campagna');
});

test("l'Admin crea una campagna e la dà a un Master", async () => {
	await admin.goto('/admin/campaigns');
	await axe(admin, 'campagne');
	const form = admin.locator('form[action="?/create"]');
	await form.getByLabel('Nome della campagna').fill('Avalon');
	await form.getByLabel('Master').selectOption({ label: 'Merlino (@merlino)' });
	await form.getByRole('button', { name: 'Nuova campagna' }).click();
	await expect(admin.getByRole('status')).toContainText('Campagna creata');
	await expect(admin.locator('form[action="?/update"]').last().getByLabel('Nome della campagna')).toHaveValue('Avalon');
});

test('il Master vede solo la sua campagna e scrive una pagina segreta', async () => {
	await dm.goto('/');
	await expect(dm.locator('.brand')).not.toContainText('Faerûn');
	await expect(dm.locator('#explorer')).not.toContainText('Elminster');
	await dm.locator('.user-menu summary').click();
	await expect(dm.locator('.user-menu .role')).toHaveText('Master');
	await expect(dm.locator('.user-menu .campaigns')).toHaveCount(0);

	await dm.goto('/wiki/new?template=none');
	await dm.getByLabel('Titolo', { exact: true }).fill('Pagina di Avalon');
	await dm.getByRole('radio', { name: /Solo Master/ }).check();
	await dm.getByRole('button', { name: 'Crea la pagina' }).click();
	await dm.waitForURL(`**/wiki/${SECRET_SLUG}`);
});

test('chi non è nella campagna non la raggiunge', async () => {
	expect((await alice.goto(`/wiki/${SECRET_SLUG}`))?.status()).toBe(404);
	expect((await admin.goto(`/wiki/${SECRET_SLUG}`))?.status()).toBe(404);
	expect((await alice.goto('/campaign'))?.status()).toBe(404);
	expect((await alice.request.post('/campaign?/switch', { form: { id: '2' }, headers: { origin: new URL(alice.url()).origin } })).status()).toBeLessThan(400);
	await alice.goto('/');
	await expect(alice.locator('.brand')).toContainText('Faerûn');
});

test('il Master invita un giocatore che ha già un account', async () => {
	await dm.goto('/campaign');
	await axe(dm, 'campagna');
	await dm.getByRole('button', { name: 'Crea invito' }).click();
	const link = await inviteLink(dm);
	await alice.goto(link);
	await expect(alice.getByRole('main')).toContainText('Avalon');
	await alice.locator('form[action="?/join"] button').click();
	await alice.waitForURL((u) => u.pathname === '/');
	await expect(alice.locator('.brand')).toContainText('Avalon');
	await dm.goto('/campaign');
	await expect(dm.getByRole('main')).toContainText('@alice');
});

test('nella campagna nuova il giocatore non vede i segreti, e può tornare a quella di prima', async () => {
	expect((await alice.goto(`/wiki/${SECRET_SLUG}`))?.status()).toBe(404);
	await alice.goto('/');
	await alice.locator('.user-menu summary').click();
	const list = alice.locator('.user-menu .campaigns');
	await expect(list.getByRole('button')).toHaveCount(2);
	await list.getByRole('button', { name: /Faerûn/ }).click();
	await alice.waitForURL((u) => u.pathname === '/');
	await expect(alice.locator('.brand')).toContainText('Faerûn');
});

test('rimosso dal Master, il giocatore non entra più', async () => {
	await dm.goto('/campaign');
	await dm.getByRole('button', { name: /Rimuovi/ }).click();
	await expect(dm.getByRole('status')).toContainText('rimosso');
	await alice.goto('/');
	await expect(alice.locator('.user-menu .campaigns')).toHaveCount(0);
});

/** Apre «Elimina la campagna» di `name`, scrive `typed` e conferma. */
async function deleteCampaign(page: Page, name: string, typed = name) {
	await page.locator('summary', { hasText: name }).click();
	await page.getByLabel(`Per confermare scrivi «${name}»`).fill(typed);
	await page.getByRole('button', { name: new RegExp(`Elimina per sempre ${name}`) }).click();
}

test('un giocatore non può eliminare la campagna', async () => {
	const origin = new URL(alice.url()).origin;
	const res = await alice.request.post('/campaign?/delete', { form: { confirm: 'Le Cronache di Faerûn' }, headers: { origin } });
	expect(res.status()).toBe(404);
	await alice.goto('/');
	await expect(alice.locator('.brand')).toContainText('Faerûn');
	expect((await alice.goto('/admin/campaigns'))?.status()).toBe(404);
});

test('il Master elimina la sua campagna, ma solo col nome giusto', async () => {
	await dm.goto('/campaign');
	await deleteCampaign(dm, 'Avalon', 'Camelot');
	await expect(dm.getByRole('alert')).toContainText('non è stata eliminata');
	await expect(dm.locator('.brand')).toContainText('Avalon');

	await deleteCampaign(dm, 'Avalon');
	await dm.waitForURL('**/campaign');
	await expect(dm.getByRole('main')).toContainText('nessuna campagna');
	expect((await dm.goto('/')) && new URL(dm.url()).pathname).toBe('/campaign');
});

test("l'Admin le elimina tutte e riparte da una nuova", async () => {
	await admin.goto('/admin/campaigns');
	await axe(admin, 'campagne: eliminazione');
	await deleteCampaign(admin, 'Le Cronache di Faerûn');
	await expect(admin.getByRole('status')).toContainText('Campagna eliminata');
	await expect(admin.getByRole('main')).toContainText('nessuna campagna');

	// Senza campagne si resta qui: il resto dell'amministrazione lavora sulla campagna corrente.
	await admin.goto('/');
	expect(new URL(admin.url()).pathname).toBe('/admin/campaigns');
	await admin.goto('/admin/world');
	expect(new URL(admin.url()).pathname).toBe('/admin/campaigns');

	await alice.goto('/');
	expect(new URL(alice.url()).pathname).toBe('/campaign');

	const form = admin.locator('form[action="?/create"]');
	await form.getByLabel('Nome della campagna').fill('Da capo');
	await form.getByRole('button', { name: 'Nuova campagna' }).click();
	await expect(admin.getByRole('status')).toContainText('Campagna creata');
	await admin.goto('/');
	await expect(admin.locator('.brand')).toContainText('Da capo');
	await dm.context().close();
	await alice.context().close();
	await admin.context().close();
});

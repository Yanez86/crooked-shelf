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

	// Di Avalon, che è di Merlino, l'Admin non può nominarsi Master: non c'è nell'elenco, e il server lo rifiuta.
	const avalon = admin.locator('form[action="?/update"]').last();
	await expect(avalon.getByLabel('Master').locator('option', { hasText: '@davide' })).toHaveCount(0);
	await expect(admin.locator('form[action="?/update"]').first().getByLabel('Master').locator('option', { hasText: '@davide' })).toHaveCount(1);
	const id = await avalon.locator('input[name="id"]').inputValue();
	const davide = await admin.locator('form[action="?/create"] option', { hasText: '@davide' }).getAttribute('value');
	const origin = new URL(admin.url()).origin;
	const res = await admin.request.post('/admin/campaigns?/update', { form: { id, name: 'Avalon', masterId: davide! }, headers: { origin } });
	expect(await res.text()).toContain('selfAppoint');
	await admin.reload();
	await expect(admin.locator('form[action="?/update"]').last().getByLabel('Master')).toHaveValue(/.+/);
	await expect(admin.locator('form[action="?/update"]').last().getByLabel('Master').locator('option:checked')).toHaveText(/@merlino/);
});

test('il Master vede solo la sua campagna e scrive una pagina segreta', async () => {
	await dm.goto('/');
	await expect(dm.locator('.brand')).not.toContainText('Faerûn');
	await expect(dm.locator('#explorer')).not.toContainText('Elminster');
	await dm.locator('.user-menu summary').click();
	await expect(dm.locator('.user-menu .role')).toHaveText('Master');
	await expect(dm.locator('.user-menu .campaigns')).toHaveCount(0);
	// Le opzioni della campagna stanno in fondo alla barra, solo per il suo Master.
	await expect(dm.locator('#explorer').getByRole('link', { name: 'Impostazioni campagna' })).toHaveAttribute('href', '/campaign/2');

	await dm.goto('/wiki/new?template=none');
	await dm.getByLabel('Titolo', { exact: true }).fill('Pagina di Avalon');
	await dm.getByRole('button', { name: 'Opzioni pagina' }).click();
	await dm.getByRole('radio', { name: /Solo Master/ }).check();
	await dm.getByRole('button', { name: 'Crea la pagina' }).click();
	await dm.waitForURL(`**/wiki/${SECRET_SLUG}`);
});

test('chi non è nella campagna non la raggiunge', async () => {
	expect((await alice.goto(`/wiki/${SECRET_SLUG}`))?.status()).toBe(404);
	expect((await admin.goto(`/wiki/${SECRET_SLUG}`))?.status()).toBe(404);
	// Il pannello Campagne è di ogni account, ma le opzioni del Master solo per le campagne che si tengono.
	await alice.goto('/campaign');
	await expect(alice.getByRole('main')).toContainText('Le Cronache di Faerûn');
	await expect(alice.getByRole('main')).not.toContainText('Avalon');
	await expect(alice.getByRole('main').getByRole('link', { name: /Gestisci/ })).toHaveCount(0);
	expect((await alice.goto('/campaign/1'))?.status()).toBe(404);
	expect((await alice.goto('/campaign/2'))?.status()).toBe(404);
	expect((await alice.request.post('/campaign?/switch', { form: { id: '2' }, headers: { origin: new URL(alice.url()).origin } })).status()).toBeLessThan(400);
	await alice.goto('/');
	await expect(alice.locator('.brand')).toContainText('Faerûn');
	await expect(alice.locator('#explorer').getByRole('link', { name: 'Impostazioni campagna' })).toHaveCount(0);
});

test('il Master invita un giocatore che ha già un account', async () => {
	await dm.goto('/campaign/2?tab=players');
	await axe(dm, 'campagna');
	await dm.getByRole('button', { name: 'Crea invito' }).click();
	const link = await inviteLink(dm);
	await alice.goto(link);
	await expect(alice.getByRole('main')).toContainText('Avalon');
	await alice.locator('form[action="?/join"] button').click();
	await alice.waitForURL((u) => u.pathname === '/');
	await expect(alice.locator('.brand')).toContainText('Avalon');
	await dm.goto('/campaign/2?tab=players');
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
	await dm.goto('/campaign/2?tab=players');
	await dm.getByRole('button', { name: /Rimuovi/ }).click();
	await expect(dm.getByRole('status').filter({ hasText: 'rimosso' })).toBeVisible();
	await alice.goto('/');
	await expect(alice.locator('.user-menu .campaigns')).toHaveCount(0);
});

test("l'Admin invitato da un altro Master è un giocatore: non vede i segreti", async () => {
	await dm.goto('/campaign/2?tab=players');
	await dm.getByRole('button', { name: 'Crea invito' }).click();
	const link = await inviteLink(dm);
	await admin.goto(link);
	await admin.locator('form[action="?/join"] button').click();
	await admin.waitForURL((u) => u.pathname === '/');
	await expect(admin.locator('.brand')).toContainText('Avalon');
	await admin.locator('.user-menu summary').click();
	await expect(admin.locator('.user-menu .role')).toHaveText('Giocatore');
	// Amministra ancora il sito, ma qui non è il Master.
	await expect(admin.locator('.user-menu .panel').getByRole('link', { name: 'Amministrazione' })).toBeVisible();
	await expect(admin.locator('.user-menu .panel').getByRole('button', { name: 'Visualizza come giocatore' })).toHaveCount(0);
	expect((await admin.goto(`/wiki/${SECRET_SLUG}`))?.status()).toBe(404);
	expect((await admin.goto('/campaign/2'))?.status()).toBe(404);
	await admin.goto('/admin/world');
	await expect(admin.getByLabel(/Includi i segreti del Master/)).toHaveCount(0);

	// Nella sua campagna torna Master.
	await admin.goto('/');
	await admin.locator('.user-menu summary').click();
	await admin.locator('.user-menu .campaigns').getByRole('button', { name: /Faerûn/ }).click();
	await admin.waitForURL((u) => u.pathname === '/');
	await admin.locator('.user-menu summary').click();
	await expect(admin.locator('.user-menu .role')).toHaveText('Master');
});

/** Il pulsante rosso «Elimina la campagna» di `name` apre il popup: si scrive `typed` e si conferma. */
async function deleteCampaign(page: Page, name: string, typed = name) {
	await page.getByRole('button', { name: `Elimina la campagna ${name}`, exact: true }).click();
	const dlg = page.getByRole('dialog', { name: `Eliminare «${name}»?` });
	await expect(dlg).toContainText('Non si può annullare');
	await expect(dlg.getByLabel(`Per confermare scrivi «${name}»`)).toBeFocused();
	await dlg.getByLabel(`Per confermare scrivi «${name}»`).fill(typed);
	await dlg.getByRole('button', { name: `Elimina per sempre ${name}`, exact: true }).click();
}

test('un giocatore non può eliminare la campagna', async () => {
	const origin = new URL(alice.url()).origin;
	const res = await alice.request.post('/campaign/1?/delete', { form: { confirm: 'Le Cronache di Faerûn' }, headers: { origin } });
	expect(res.status()).toBe(404);
	await alice.goto('/');
	await expect(alice.locator('.brand')).toContainText('Faerûn');
	expect((await alice.goto('/admin/campaigns'))?.status()).toBe(404);
});

test('il Master elimina la sua campagna, ma solo col nome giusto', async () => {
	await dm.goto('/campaign/2');
	// Il popup si apre dal pulsante rosso e si chiude con Annulla senza toccare niente.
	await dm.getByRole('button', { name: 'Elimina la campagna Avalon', exact: true }).click();
	const dlg = dm.getByRole('dialog', { name: 'Eliminare «Avalon»?' });
	await expect(dlg).toBeVisible();
	await axe(dm, 'elimina la campagna');
	await dlg.getByRole('button', { name: 'Annulla' }).click();
	await expect(dlg).toBeHidden();
	await deleteCampaign(dm, 'Avalon', 'Camelot');
	await expect(dm.getByRole('alert')).toContainText('non è stata eliminata');
	await expect(dm.locator('.brand')).toContainText('Avalon');

	await deleteCampaign(dm, 'Avalon');
	await dm.waitForURL('**/campaign');
	await expect(dm.getByRole('main')).toContainText('nessuna campagna');
	expect((await dm.goto('/')) && new URL(dm.url()).pathname).toBe('/campaign');
});

test("l'Admin fa una campagna nuova da un pacchetto mondo e la dà a un Master", async () => {
	const templates = async (page: Page) => {
		await page.goto('/wiki?kind=template');
		return page.locator('main .page-list > li').count();
	};
	const before = await templates(admin);
	expect(before).toBeGreaterThan(0);

	await admin.goto('/admin/world');
	await admin.getByLabel('Nome del pacchetto').fill('Costa della Spada');
	const [download] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('button', { name: 'Scarica il pacchetto' }).click()]);
	await admin.getByLabel('File del pacchetto (.shelf)').setInputFiles((await download.path())!);
	await admin.getByRole('button', { name: 'Controlla il contenuto' }).click();
	await expect(admin.getByRole('radio', { name: /In questa campagna \(Le Cronache di Faerûn\)/ })).toBeChecked();
	await expect(admin.locator('main')).toContainText('Esistono già');

	// In una campagna nuova non c'è niente che esista già: si sceglie il nome (quello del pacchetto, di partenza) e il Master.
	await admin.getByRole('radio', { name: 'In una campagna nuova' }).check();
	await expect(admin.locator('main')).not.toContainText('Esistono già');
	await expect(admin.getByRole('group', { name: 'Se una pagina o una mappa esiste già' })).toHaveCount(0);
	await expect(admin.getByLabel('Nome della campagna')).toHaveValue('Costa della Spada');
	await admin.getByLabel('Nome della campagna').fill('Ritorno a Faerûn');
	await admin.getByLabel('Master', { exact: true }).selectOption({ label: 'Merlino (@merlino)' });
	await axe(admin, 'pacchetto mondo: campagna nuova');
	await admin.getByRole('button', { name: 'Importa', exact: true }).click();
	await expect(admin.getByRole('status').first()).toContainText('Pacchetto importato nella campagna nuova «Ritorno a Faerûn».');
	await axe(admin, 'pacchetto mondo: importato in una campagna nuova');

	// La campagna è di Merlino: l'Admin non ci entra, la gestisce da Amministrazione › Campagne.
	await expect(admin.getByRole('button', { name: /Apri la campagna/ })).toHaveCount(0);

	// Il Master, rimasto senza campagne, la trova pronta: la home è quella del pacchetto, e i template
	// preinstallati non si sono aggiunti a quelli che porta; i segreti non sono venuti col pacchetto.
	await dm.goto('/');
	await expect(dm.locator('.brand')).toContainText('Ritorno a Faerûn');
	await expect(dm.getByRole('heading', { level: 1, name: 'Le Cronache di Faerûn' })).toBeVisible();
	expect(await templates(dm)).toBe(before);
	await dm.goto('/wiki/locanda-del-grifone');
	await expect(dm.getByRole('heading', { level: 1, name: 'Locanda del Grifone' })).toBeVisible();
	await expect(dm.locator('.content .secret')).toHaveCount(0);
});

test("l'Admin le elimina tutte e riparte da una nuova", async () => {
	await admin.goto('/admin/campaigns');
	await axe(admin, 'campagne: eliminazione');
	await deleteCampaign(admin, 'Ritorno a Faerûn');
	await expect(admin.getByRole('status')).toContainText('Campagna eliminata');
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
});

test('ognuno crea le sue campagne, fino al suo limite, che l\'Admin cambia a una persona sola', async () => {
	// Alice è una giocatrice rimasta senza campagne: ne crea una sua, e lì è il Master.
	await alice.goto('/campaign');
	await expect(alice.getByRole('heading', { name: 'Nuova campagna' })).toBeVisible();
	await expect(alice.getByText('Campagne che tieni: 0 su 3.')).toBeVisible();
	await axe(alice, 'nuova campagna');
	for (const name of ['Il regno di Alice', 'La seconda di Alice', 'La terza di Alice']) {
		await alice.goto('/campaign');
		await alice.getByLabel('Nome della campagna').fill(name);
		await alice.getByRole('button', { name: 'Crea la campagna' }).click();
		await alice.waitForURL((u) => u.pathname === '/');
		await expect(alice.locator('.brand')).toContainText(name);
	}
	await alice.locator('.user-menu summary').click();
	await expect(alice.locator('.user-menu .role')).toHaveText('Master');
	await expect(alice.locator('.user-menu .campaigns').getByRole('button')).toHaveCount(3);

	// Dal pannello Campagne gestisce anche una campagna in cui non si trova, senza entrarci.
	await alice.goto('/campaign');
	await axe(alice, 'campagne: elenco');
	await alice.getByRole('link', { name: 'Gestisci Il regno di Alice' }).click();
	await expect(alice.getByRole('heading', { level: 1 })).toHaveText('Il regno di Alice');
	await axe(alice, 'campagna: impostazioni');
	await alice.getByLabel('Nome della campagna').fill('Il reame di Alice');
	await alice.locator('form[action^="?/rename"]').getByRole('button', { name: 'Salva' }).click();
	await expect(alice.getByRole('status').first()).toContainText('Modifiche salvate');
	await expect(alice.getByRole('heading', { level: 1 })).toHaveText('Il reame di Alice');
	await expect(alice.locator('.brand')).toContainText('La terza di Alice');

	// Al limite il modulo non c'è più, e il server dice di no anche a chi lo manda lo stesso.
	await alice.goto('/campaign');
	await expect(alice.getByText('Campagne che tieni: 3 su 3.')).toBeVisible();
	await expect(alice.getByLabel('Nome della campagna')).toHaveCount(0);
	const res = await alice.request.post('/campaign?/newCampaign', { form: { name: 'Quarta' }, headers: { origin: new URL(alice.url()).origin } });
	expect(res.status()).toBe(403);

	// L'Admin alza il limite solo ad Alice: gli altri restano a 3.
	await admin.goto('/admin/users');
	const limit = admin.getByLabel('Campagne che alice può creare (ora ne tiene 3)');
	await expect(limit).toHaveValue('3');
	await axe(admin, 'utenti col limite delle campagne');
	await limit.fill('4');
	await admin.getByRole('button', { name: /Salva.*alice/ }).click();
	await expect(admin.getByRole('status').filter({ hasText: 'Modifiche salvate' })).toBeVisible();
	await expect(admin.getByLabel(/Campagne che alice può creare/)).toHaveValue('4');
	await expect(admin.getByLabel(/Campagne che merlino può creare/)).toHaveValue('3');
	await alice.reload();
	await expect(alice.getByText('Campagne che tieni: 3 su 4.')).toBeVisible();
	await expect(alice.getByLabel('Nome della campagna')).toBeVisible();
	await dm.context().close();
	await alice.context().close();
	await admin.context().close();
});

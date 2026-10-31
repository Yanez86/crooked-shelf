import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
	await expect(toggle).toHaveAccessibleName('Profilo: Davide Admin');

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
	await expect(panel.frameLocator('iframe').getByRole('region', { name: 'Lettura e accessibilità' })).toBeVisible();
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
	// Il vecchio indirizzo porta al profilo.
	await admin.goto('/preferences');
	await expect(admin).toHaveURL(/\/profile$/);
	await expect(admin.getByRole('heading', { level: 1, name: 'Profilo' })).toBeVisible();
	await expect(admin.getByRole('main')).toContainText('@davide');
	await expect(admin.getByRole('region', { name: 'Lettura e accessibilità' })).toBeVisible();
	await axe(admin, 'profilo');

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
	await expect(toggle).toHaveAccessibleName('Profilo: Davide il Saggio Admin');
	await expect(toggle).toBeFocused();

	// Le sezioni si cambiano dentro il popup, anche dopo un modulo che ricarica la pagina. Si chiude con la X o cliccando fuori.
	const panel = await open('Amministrazione');
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
	await expect(toggle).toHaveAccessibleName('Profilo: Davide il Saggio Admin');
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
	const first = tree.locator('.level.root > li').first();
	await admin.goto('/');
	await expect(first).toContainText('Le Cronache di Faerûn');
	await expect(first.getByRole('link')).toHaveAttribute('aria-current', 'page');

	// Una pagina che sta in una cartella diventa la home: si apre dalla radice del sito.
	await admin.goto('/wiki/locanda-del-grifone/edit');
	await box.check();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin).toHaveURL(/\/$/);
	await expect(admin.getByRole('heading', { level: 1, name: 'Locanda del Grifone' })).toBeVisible();
	await expect(first).toContainText('Locanda del Grifone');
	await expect(tree.getByRole('button', { name: 'Sposta nel cestino: Locanda del Grifone' })).toHaveCount(0);
	await expect(tree.locator('li.row:has(a[href="/wiki/le-cronache-di-faerun"])').getByRole('button')).toHaveCount(1);
	await axe(admin, 'nuova home');

	// In modifica: niente eliminazione, niente cartella, e la casella non si può togliere.
	await admin.getByRole('link', { name: 'Modifica: Locanda del Grifone' }).click();
	await expect(box).toBeChecked();
	await expect(box).toBeDisabled();
	await expect(admin.getByLabel('Categoria')).toHaveCount(0);
	await expect(admin.getByRole('heading', { name: 'Eliminare la pagina' })).toHaveCount(0);

	// La home la deve vedere chi apre il sito; la vecchia home è una pagina come le altre e può tornare a esserlo.
	await admin.goto('/wiki/le-cronache-di-faerun/edit');
	await expect(admin.getByRole('heading', { name: 'Eliminare la pagina' })).toHaveCount(1);
	await admin.getByRole('radio', { name: 'Solo Master' }).check();
	await box.check();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('alert')).toContainText('La home deve poterla vedere');
	await admin.getByRole('radio', { name: 'Pubblica' }).check();
	await box.check();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Le Cronache di Faerûn' })).toBeVisible();
	await expect(first).toContainText('Le Cronache di Faerûn');
	await expect(tree.getByRole('button', { name: 'Sposta nel cestino: Locanda del Grifone' })).toHaveCount(1);
});

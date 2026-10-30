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
	await expect(menu.getByRole('link', { name: 'Galleria' })).toBeVisible();
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
	await expect(admin).toHaveURL(/\/profile$/);
	await expect(menu).toBeHidden();
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

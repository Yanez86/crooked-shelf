import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Sul telefono: niente sfora, si legge, e intestazione, ricerca e collegamenti funzionano col dito.
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const PAGES = ['/', '/wiki', '/wiki/vicolo-del-drago', '/wiki/vicolo-del-drago/edit', '/wiki/new', '/search?q=drago', '/tags', '/categories', '/gallery', '/resources', '/rules', '/calendar', '/profile', '/admin', '/admin/users', '/admin/plugins'];

test.beforeEach(async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Nome utente').fill('davide');
	await page.getByLabel('Password').fill('drago-rosso-2024');
	await page.getByRole('button', { name: 'Accedi' }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/login'));
});

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('si scrive una pagina dal telefono: Salva è sotto il testo', async ({ page }) => {
	for (const [title, text] of [
		['Bottega del Drago', 'Vende candele.'],
		['Vicolo del Drago', 'Porta alla [[Bottega del Drago]] e a un portone chiuso.']
	]) {
		await page.goto('/wiki/new?template=none');
		await page.getByLabel('Titolo', { exact: true }).fill(title);
		await page.locator('.editor-content').click();
		await page.keyboard.type(text + ' ');
		await page.getByRole('button', { name: 'Crea la pagina' }).click();
		await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
	}
});

test('niente sfora lo schermo, nemmeno a 320px', async ({ page }) => {
	for (const width of [390, 320]) {
		await page.setViewportSize({ width, height: 700 });
		for (const path of PAGES) {
			await page.goto(path);
			expect(await overflow(page), `${path} a ${width}px`).toBeLessThanOrEqual(0);
		}
	}
});

test('testo e campi a 16px: Safari non ingrandisce la pagina al tocco', async ({ page }) => {
	await page.goto('/wiki/vicolo-del-drago/edit');
	const size = (selector: string) => page.locator(selector).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
	expect(await size('body')).toBeGreaterThanOrEqual(16);
	for (const field of ['.toolbar select', '.chip select', '.chip input[type="text"]']) expect(await size(field), field).toBeGreaterThanOrEqual(16);
	await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze().then((r) => expect(r.violations).toEqual([]));
});

test('intestazione su una riga, in vista mentre si scorre; la ricerca sta dietro la lente', async ({ page }) => {
	await page.goto('/wiki');
	const header = page.locator('.site-header');
	const input = page.getByRole('searchbox', { name: 'Cerca nella wiki' });
	const lens = page.getByRole('button', { name: 'Cerca nella wiki' });
	expect((await header.boundingBox())!.height).toBeLessThan(64);
	await expect(input).toBeHidden();

	await page.evaluate(() => scrollTo(0, 400));
	await expect.poll(async () => (await header.boundingBox())!.y).toBe(0);

	await lens.click();
	await expect(input).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(input).toBeHidden();
	await expect(lens).toBeFocused();

	await lens.click();
	await input.fill('drago');
	await input.press('Enter');
	await expect(page).toHaveURL(/\/search\?q=drago/);
	await expect(page.locator('.site-header').getByRole('searchbox')).toBeHidden();
});

test('i collegamenti aprono la pagina al suo posto, e Indietro torna', async ({ page }) => {
	await page.goto('/wiki/vicolo-del-drago');
	await page.locator('.prose a.wikilink:not(.missing)').first().click();
	await expect(page).not.toHaveURL(/vicolo-del-drago$/);
	await expect(page.locator('dialog[open]')).toHaveCount(0);
	await page.goBack();
	await expect(page).toHaveURL(/vicolo-del-drago$/);

	await page.locator('.user-menu summary').click();
	await page.locator('.user-menu').getByRole('link', { name: 'Profilo' }).click();
	await expect(page).toHaveURL(/\/profile$/);
	await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('in modifica Salva resta a portata di dito', async ({ page }) => {
	await page.goto('/wiki/vicolo-del-drago/edit');
	const save = page.getByRole('button', { name: 'Salva' });
	await expect(save).toHaveCount(1);
	await page.locator('.editor-content').scrollIntoViewIfNeeded();
	await expect(save).toBeInViewport();
});

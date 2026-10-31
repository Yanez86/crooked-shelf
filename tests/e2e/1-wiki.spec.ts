import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

// Un'unica storia, in ordine: configurazione, pagine, invito di un giocatore, permessi, preferenze, accessibilità.
test.describe.configure({ mode: 'serial' });

const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });

const ADMIN = { user: 'davide', pass: 'drago-rosso-2024' };
const TREE = 'Pagine e risorse';
const PLAYER = { user: 'alice', pass: 'elfa-dei-boschi-99' };

let admin: Page;
let inviteLink = '';

async function axe(page: Page, label: string) {
	const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
	const found = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
	expect(found, found.join('\n')).toEqual([]);
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function newPage(page: Page, title: string, write: (p: Page) => Promise<void>, opts: { visibility?: string; tags?: string; category?: string } = {}) {
	await page.goto('/wiki/new?template=none');
	await page.getByLabel('Titolo', { exact: true }).fill(title);
	const editor = page.locator('.editor-content');
	await editor.click();
	await write(page);
	if (opts.category) await page.getByLabel('Categoria').selectOption({ label: opts.category });
	if (opts.tags) await page.getByLabel('Tag', { exact: true }).fill(opts.tags);
	if (opts.visibility) await page.getByRole('radio', { name: new RegExp(opts.visibility) }).check();
	await page.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

async function login(browser: Browser, u: { user: string; pass: string }) {
	const ctx = await browser.newContext({ locale: 'it-IT' });
	const page = await ctx.newPage();
	await page.goto('/login');
	await page.getByLabel('Nome utente').fill(u.user);
	await page.getByLabel('Password').fill(u.pass);
	await page.getByRole('button', { name: 'Accedi' }).click();
	// Senza aspettare, la pagina successiva può partire prima che l'accesso sia fatto (e finire sul login).
	await page.waitForURL((url) => !url.pathname.startsWith('/login'));
	return page;
}

test('prima configurazione', async ({ browser }) => {
	admin = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await admin.goto('/');
	await expect(admin).toHaveURL(/\/setup$/);
	await axe(admin, 'setup');
	await shot(admin, '01-setup');

	await admin.getByLabel('Nome della campagna').fill('Le Cronache di Faerûn');
	await admin.getByLabel('Lingua predefinita').selectOption('it');
	await admin.getByLabel('Nome utente').fill(ADMIN.user);
	await admin.getByLabel('Nome visualizzato').fill('Davide');
	await admin.getByLabel('Password', { exact: true }).fill(ADMIN.pass);
	await admin.getByLabel('Ripeti la password').fill(ADMIN.pass);
	await admin.getByRole('button', { name: 'Crea la wiki' }).click();

	await expect(admin.getByRole('heading', { level: 1, name: 'Le Cronache di Faerûn' })).toBeVisible();
	await expect(admin.getByText('La wiki è vuota')).toBeVisible();
	await axe(admin, 'home vuota');
});

test('la configurazione non si può ripetere', async ({ page }) => {
	await page.goto('/setup');
	await expect(page).toHaveURL(/\/login/);
});

test('categorie', async () => {
	// Nuova cartella: nasce nell'albero a sinistra col nome da scrivere, senza cambiare pagina.
	await admin.goto('/');
	const tree = admin.locator('#explorer');
	await tree.getByRole('button', { name: 'Nuova cartella' }).click();
	const name = tree.getByLabel('Nome della nuova cartella');
	await expect(name).toBeFocused();
	await expect(name).toHaveValue('Nuova cartella');
	await axe(admin, 'nuova cartella');
	// Esc la lascia perdere.
	await admin.keyboard.press('Escape');
	await expect(name).toHaveCount(0);
	await expect(tree.getByRole('button', { name: 'Nuova cartella' })).toBeFocused();
	await admin.keyboard.press('Enter');
	await admin.keyboard.type('Luoghi');
	await admin.keyboard.press('Enter');
	await expect(tree.locator('summary', { hasText: 'Luoghi' })).toBeFocused();
	await expect(admin).toHaveURL(/\/$/);

	await admin.goto('/categories');
	await admin.getByLabel('Nome', { exact: true }).first().fill('Città');
	await admin.getByLabel('Dentro la categoria').first().selectOption({ label: 'Luoghi' });
	await admin.getByRole('button', { name: 'Aggiungi' }).click();
	await expect(admin.locator('.tree')).toContainText('Città');
	await axe(admin, 'categorie');
});

test('pagine, collegamenti e segreti', async () => {
	await newPage(admin, 'Bartolo Pancia', async (p) => {
		await p.keyboard.type('Il locandiere più grasso della Costa della Spada.');
	});

	await newPage(
		admin,
		'Locanda del Grifone',
		async (p) => {
			await p.keyboard.type('## Descrizione');
			await p.keyboard.press('Enter');
			await p.keyboard.type('Il proprietario è ');
			await p.keyboard.type('[[Bart');
			const option = p.getByRole('option', { name: 'Bartolo Pancia' });
			await expect(option).toBeVisible();
			await expect(p.locator('.editor-content')).toHaveAttribute('aria-activedescendant', /suggest-/);
			await p.keyboard.press('Enter');
			await p.keyboard.type('e serve birra annacquata. Si parla di [[Drago Rosso]] ');
			await p.keyboard.press('Enter');
			await p.getByRole('button', { name: /Segreto del Master/ }).click();
			await p.keyboard.type('Bartolo è una spia degli Zhentarim.');
		},
		{ tags: 'Taverna, Nord', category: 'Luoghi › Città' }
	);

	const content = admin.locator('.content');
	await expect(content.getByRole('heading', { level: 2, name: 'Descrizione' })).toBeVisible();
	await expect(content.getByRole('link', { name: 'Bartolo Pancia' })).toHaveAttribute('href', '/wiki/bartolo-pancia');
	await expect(content.locator('.wikilink.missing')).toContainText('Drago Rosso');
	await expect(content.locator('.secret')).toContainText('spia degli Zhentarim');
	await expect(admin.getByRole('navigation', { name: 'Percorso della pagina' })).toContainText('Luoghi');
	await expect(admin.getByRole('link', { name: 'Taverna' })).toBeVisible();
	// In fondo: chi l'ha creata e l'ultima modifica.
	const foot = admin.locator('.page-foot');
	await expect(foot).toContainText('Creata da Davide');
	await expect(foot).toContainText(/Ultima modifica di Davide, \d/);
	await axe(admin, 'pagina con segreto');
	await shot(admin, '02-pagina');

	// Il collegamento rosso porta alla creazione con il titolo già scritto.
	await content.locator('.wikilink.missing').click();
	await admin.locator('main').getByRole('link', { name: /Mostro/ }).click();
	await expect(admin.getByLabel('Titolo', { exact: true })).toHaveValue('Drago Rosso');
	await expect(admin.getByLabel('Nome del campo 1')).toHaveValue('Tipo');

	// Backlink.
	await admin.goto('/wiki/bartolo-pancia');
	await expect(admin.getByRole('region', { name: 'Pagine che collegano qui' })).toContainText('Locanda del Grifone');

	await newPage(admin, 'Piano del cattivo', async (p) => {
		await p.keyboard.type('Il drago dorme sotto la locanda.');
	}, { visibility: 'Solo Master' });
});

test('i collegamenti tra le pagine si aprono in un popup', async () => {
	await admin.goto('/wiki/locanda-del-grifone');
	const url = admin.url();
	const link = admin.locator('.content').getByRole('link', { name: 'Bartolo Pancia' });
	const popup = admin.getByRole('dialog', { name: 'Bartolo Pancia' });
	const frame = admin.frameLocator('dialog iframe');

	// Tutta la pagina, senza intestazione né albero. La pagina sotto resta dov'è.
	await link.click();
	await expect(frame.getByRole('heading', { level: 1, name: 'Bartolo Pancia' })).toBeVisible();
	await expect(frame.locator('header.site-header, #explorer')).toHaveCount(0);
	await expect(admin).toHaveURL(url);
	await axe(admin, 'pagina in popup');
	await shot(admin, '03-pagina-popup');
	await popup.getByRole('button', { name: 'Chiudi' }).click();
	await expect(popup).toBeHidden();

	// Dentro il popup si naviga senza aprirne altri.
	const backlink = frame.getByRole('region', { name: 'Pagine che collegano qui' }).getByRole('link', { name: 'Locanda del Grifone' });
	const locanda = frame.getByRole('heading', { level: 1, name: 'Locanda del Grifone' });
	await link.click();
	await backlink.click();
	await expect(locanda).toBeVisible();
	await frame.locator('.content .wikilink', { hasText: 'Bartolo Pancia' }).click();
	await expect(frame.getByRole('heading', { level: 1, name: 'Bartolo Pancia' })).toBeVisible();
	await expect(frame.locator('dialog')).toHaveCount(0);

	// Sulla schermata principale va la pagina aperta adesso, non quella di partenza.
	await backlink.click();
	await expect(locanda).toBeVisible();
	await frame.getByRole('navigation', { name: 'Percorso della pagina' }).getByRole('link').first().click();
	await expect(locanda).toHaveCount(0);
	await popup.getByRole('button', { name: 'Apri la pagina intera' }).click();
	await expect(popup).toBeHidden();
	await expect(admin).toHaveURL(/\/wiki\?category=/);

	await admin.goto('/wiki/locanda-del-grifone');
	await link.click();
	await popup.getByRole('button', { name: 'Apri la pagina intera' }).click();
	await expect(admin).toHaveURL(/\/wiki\/bartolo-pancia$/);
	await expect(admin.getByRole('heading', { level: 1, name: 'Bartolo Pancia' })).toBeVisible();
});

test('albero delle cartelle e delle pagine', async () => {
	await admin.goto('/wiki/locanda-del-grifone');
	const tree = admin.getByRole('navigation', { name: TREE });
	// Le cartelle della pagina aperta sono già aperte, la pagina è evidenziata.
	const locanda = tree.getByRole('link', { name: 'Locanda del Grifone' });
	await expect(locanda).toHaveAttribute('aria-current', 'page');
	// Le pagine senza categoria stanno alla radice.
	await expect(tree.getByRole('link', { name: 'Bartolo Pancia' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Piano del cattivo' })).toBeVisible();

	// Una cartella si chiude col mouse e si riapre da tastiera.
	const luoghi = tree.locator('summary', { hasText: 'Luoghi' });
	await luoghi.click();
	await expect(locanda).toBeHidden();
	await luoghi.focus();
	await admin.keyboard.press('Enter');
	await expect(locanda).toBeVisible();

	await tree.getByRole('link', { name: 'Bartolo Pancia' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Bartolo Pancia' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Bartolo Pancia' })).toHaveAttribute('aria-current', 'page');
	// Le cartelle aperte restano aperte.
	await expect(locanda).toBeVisible();
	// Niente barra orizzontale e niente sezioni: il menu del profilo ha solo Profilo, Campagna, Amministrazione ed Esci.
	await expect(admin.getByRole('navigation', { name: 'Navigazione principale' })).toHaveCount(0);
	await admin.locator('.user-menu summary').click();
	await expect(admin.locator('.user-menu .panel').getByRole('link')).toHaveText(['Profilo', 'Campagna', 'Amministrazione']);
	await expect(admin.locator('.user-menu .panel').getByRole('button', { name: /Esci/ })).toBeVisible();
	await admin.locator('.user-menu summary').click();
	// Il Cestino è sempre l'ultima voce della barra, anche sulla linguetta Risorse.
	await expect(tree.getByRole('link').last()).toHaveAttribute('href', '/trash');
	await tree.getByRole('tab', { name: 'Risorse' }).click();
	await expect(tree.getByRole('link').last()).toHaveAttribute('href', '/trash');
	// I template preparati con la wiki stanno nella loro linguetta, con il pulsante per farne uno nuovo.
	await tree.getByRole('tab', { name: 'Template' }).click();
	await expect(tree.getByRole('link', { name: 'Luogo, Template' })).toBeVisible();
	await expect(tree.getByRole('link', { name: 'Nuovo template' })).toHaveAttribute('href', '/wiki/new?kind=template');
	await expect(tree.getByRole('link').last()).toHaveAttribute('href', '/trash');
	await tree.getByRole('tab', { name: 'Pagine' }).click();
	await expect(admin.locator('#explorer').getByRole('link', { name: 'Nuova pagina' })).toHaveAttribute('href', '/wiki/new');
	// Anche le cronologie preparate con la wiki sono pagine dell'albero; i template no.
	await expect(tree.getByRole('link', { name: 'Cronologia del mondo, Cronologia' })).toBeVisible();
	await expect(tree.locator('summary', { hasText: 'Template' })).toHaveCount(0);
	await axe(admin, 'albero');
	await shot(admin, '02b-albero');

	// Sul telefono la barra sta chiusa in un pulsante.
	await admin.setViewportSize({ width: 390, height: 844 });
	const toggle = admin.getByRole('button', { name: 'Menu e pagine' });
	await expect(locanda).toBeHidden();
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(locanda).toBeVisible();
	await shot(admin, '02c-albero-telefono');
	await admin.setViewportSize({ width: 1280, height: 800 });
});

test("l'albero si riordina trascinando, ha i divisori e il cestino", async () => {
	await admin.setViewportSize({ width: 1280, height: 900 });
	await newPage(admin, 'Riga Uno', async (p) => p.keyboard.type('Uno.'));
	await newPage(admin, 'Riga Due', async (p) => p.keyboard.type('Due.'));
	expect((await admin.request.post('/api/categories', { data: { name: 'Scaffale' } })).ok()).toBe(true);
	await admin.goto('/wiki/riga-uno');
	const tree = admin.getByRole('navigation', { name: TREE });
	const uno = tree.getByRole('link', { name: 'Riga Uno' });
	const due = tree.getByRole('link', { name: 'Riga Due' });

	// Una pagina si lascia dentro un'altra pagina, e ci resta anche ricaricando.
	await due.dragTo(uno);
	const nested = tree.locator('li', { has: admin.locator('.page-row', { hasText: 'Riga Uno' }) });
	await expect(nested.getByRole('link', { name: 'Riga Due' })).toBeVisible();
	await admin.reload();
	await expect(nested.getByRole('link', { name: 'Riga Due' })).toBeVisible();
	await axe(admin, 'pagina dentro una pagina');

	// La freccia apre e chiude; il titolo porta alla pagina.
	const arrow = tree.getByRole('button', { name: 'Contenuto di Riga Uno' });
	await arrow.click();
	await expect(nested.getByRole('link', { name: 'Riga Due' })).toHaveCount(0);
	await arrow.click();

	// Da tastiera: Alt e freccia a sinistra la riporta fuori, e il fuoco resta su di lei.
	await nested.getByRole('link', { name: 'Riga Due' }).focus();
	await admin.keyboard.press('Alt+ArrowLeft');
	await expect(nested.getByRole('link', { name: 'Riga Due' })).toHaveCount(0);
	await expect(due).toBeFocused();

	// Il divisorio nasce in fondo; si sposta come il resto e si elimina dalla sua crocetta.
	await tree.getByRole('button', { name: 'Nuovo divisorio' }).click();
	const line = tree.locator('.divider');
	await expect(line).toHaveCount(1);
	await expect(line.getByRole('button', { name: 'Elimina il divisorio' })).toBeFocused();
	await line.dragTo(tree.locator('summary', { hasText: 'Scaffale' }), { targetPosition: { x: 20, y: 2 } });
	await expect(tree.locator('.level.root > li').filter({ hasText: 'Scaffale' }).locator('xpath=preceding-sibling::li[1]')).toHaveClass(/divider/);
	await axe(admin, 'divisorio');
	await shot(admin, '02c-albero-riordinato');
	await line.hover();
	await line.getByRole('button', { name: 'Elimina il divisorio' }).click();
	await expect(line).toHaveCount(0);

	// Il cestino compare passando sulla riga.
	const trashDue = tree.getByRole('button', { name: 'Sposta nel cestino: Riga Due' });
	await expect(trashDue).toHaveCSS('opacity', '0');
	await due.hover();
	await expect(trashDue).toHaveCSS('opacity', '1');
	await shot(admin, '02d-cestino-albero');
	await trashDue.click();
	await expect(due).toHaveCount(0);

	// La pagina che stai leggendo: si torna all'elenco.
	await uno.hover();
	await tree.getByRole('button', { name: 'Sposta nel cestino: Riga Uno' }).click();
	await expect(admin).toHaveURL(/\/wiki\?deleted=1/);

	await tree.locator('summary', { hasText: 'Scaffale' }).hover();
	await tree.getByRole('button', { name: 'Sposta nel cestino: Scaffale' }).click();
	await expect(tree.locator('summary', { hasText: 'Scaffale' })).toHaveCount(0);

	await admin.goto('/trash');
	await expect(admin.locator('li', { hasText: 'Scaffale' })).toContainText('cartella');
	await axe(admin, 'cestino con le cartelle');
	await admin.getByRole('button', { name: /Recupera.*Scaffale/ }).click();
	await expect(tree.locator('summary', { hasText: 'Scaffale' })).toBeVisible();

	// Si elimina per sempre con una conferma, anche la cartella: il cestino resta vuoto per chi viene dopo.
	await tree.locator('summary', { hasText: 'Scaffale' }).hover();
	await tree.getByRole('button', { name: 'Sposta nel cestino: Scaffale' }).click();
	await expect(tree.locator('summary', { hasText: 'Scaffale' })).toHaveCount(0);
	await admin.goto('/trash');
	for (const name of ['Scaffale', 'Riga Uno', 'Riga Due']) {
		await admin.getByRole('checkbox', { name: new RegExp(`Sono sicuro.*${name}`) }).check();
		await admin.getByRole('button', { name: new RegExp(`Elimina per sempre.*${name}`) }).click();
		await expect(admin.locator('main').getByText(name, { exact: true })).toHaveCount(0);
	}
	await expect(admin.getByText('Il cestino è vuoto.')).toBeVisible();
});

test('la home è una pagina: si modifica con la sua matita, i riquadri vanno a destra', async () => {
	await admin.goto('/');
	await admin.getByRole('link', { name: 'Modifica: Le Cronache di Faerûn' }).click();
	await expect(admin).toHaveURL(/\/wiki\/[^/]+\/edit$/);
	const editor = admin.locator('.editor-content');
	await expect(editor).toHaveAttribute('contenteditable', 'true');
	await editor.click();
	await expect(editor.locator('.has-focus')).toHaveCount(1);
	await admin.keyboard.type('Una campagna nella Costa della Spada.');
	// Un riquadro, come nelle altre pagine.
	await admin.getByRole('button', { name: 'Aggiungi la colonna a lato' }).click();
	await admin.getByRole('region', { name: 'Colonna a lato' }).getByRole('button', { name: 'Testo', exact: true }).click();
	await admin.getByLabel('Nome del campo 1').fill('Sessioni');
	await admin.getByLabel('Valore del campo 1').fill('Il martedì sera');
	await admin.getByRole('button', { name: 'Salva' }).click();

	await expect(admin).toHaveURL(/\/$/);
	await expect(admin.getByRole('complementary', { name: 'Scheda' }).getByText('Il martedì sera')).toBeVisible();
	const presentation = admin.getByText('Una campagna nella Costa della Spada.');
	const recent = admin.getByRole('region', { name: 'Modificate di recente' });
	const added = admin.getByRole('region', { name: 'Aggiunte di recente' });
	await expect(presentation).toBeVisible();
	await expect(recent.getByRole('link', { name: 'Bartolo Pancia' })).toBeVisible();
	await expect(added.getByRole('link', { name: 'Bartolo Pancia' })).toBeVisible();
	// La home non compare nei propri elenchi; dall'albero si torna qui.
	await expect(recent.getByRole('link', { name: 'Le Cronache di Faerûn' })).toHaveCount(0);
	expect((await recent.boundingBox())!.x).toBeGreaterThan((await presentation.boundingBox())!.x + 200);
	// Le due colonne partono alla stessa altezza; la matita sta dentro la colonna centrale.
	const left = (await admin.locator('#explorer').boundingBox())!;
	const right = (await admin.getByRole('complementary', { name: 'Scheda' }).boundingBox())!;
	expect(right.y).toBe(left.y);
	const pencil = (await admin.getByRole('link', { name: 'Modifica: Le Cronache di Faerûn' }).boundingBox())!;
	expect(pencil.x + pencil.width).toBeLessThan(right.x);
	await axe(admin, 'home');
	await shot(admin, '02d-home');

	// La freccia nasconde la colonna a destra e il riquadro centrale prende il suo posto; la scelta resta anche ricaricando.
	const middle = admin.locator('.content.panel');
	const hideSide = admin.getByRole('button', { name: 'Nascondi la colonna a destra' });
	const showSide = admin.getByRole('button', { name: 'Mostra la colonna a destra' });
	const narrow = (await middle.boundingBox())!.width;
	await hideSide.click();
	await expect(recent).toBeHidden();
	await expect(showSide).toBeFocused();
	expect((await middle.boundingBox())!.width).toBeGreaterThan(narrow + 200);
	await admin.reload();
	await expect(recent).toBeHidden();
	await showSide.click();
	await expect(recent).toBeVisible();
	await expect(hideSide).toBeFocused();
	expect((await middle.boundingBox())!.width).toBe(narrow);

	// Senza colonna a destra non c'è la freccia, e il riquadro centrale arriva in fondo.
	await admin.goto('/wiki');
	await expect(hideSide).toHaveCount(0);
	expect((await admin.locator('.column.panel').boundingBox())!.width).toBe((await admin.locator('#main').boundingBox())!.width);
	await admin.goto('/');

	await admin.getByRole('navigation', { name: TREE }).getByRole('link', { name: 'Le Cronache di Faerûn' }).click();
	await expect(presentation).toBeVisible();

	await admin.setViewportSize({ width: 390, height: 844 });
	await expect(recent).toBeVisible();
	expect((await recent.boundingBox())!.y).toBeGreaterThan((await presentation.boundingBox())!.y);
	await shot(admin, '02e-home-telefono');
	await admin.setViewportSize({ width: 1280, height: 800 });
});

test('editor: accessibilità e telefono', async () => {
	await admin.goto('/wiki/locanda-del-grifone/edit');
	await expect(admin.locator('.editor-content')).toContainText('spia');
	await axe(admin, 'editor');
	await shot(admin, '03-editor');
	await admin.setViewportSize({ width: 390, height: 844 });
	await shot(admin, '04-editor-telefono');
	await admin.goto('/wiki/locanda-del-grifone');
	await shot(admin, '05-pagina-telefono');
	await axe(admin, 'pagina telefono');
	await admin.setViewportSize({ width: 1280, height: 800 });
});

test('editor: il cestino elimina il blocco, Annulla lo riporta', async () => {
	await admin.goto('/wiki/new?template=none');
	const editor = admin.locator('.editor-content');
	await editor.click();
	await admin.keyboard.type('Primo\nSecondo\nTerzo\nQuarto\nQuinto');
	const onBlock = admin.locator('.block-delete');
	for (const text of ['Primo', 'Secondo', 'Terzo', 'Quarto']) {
		// Modifiche vicine nel tempo contano come un'azione sola.
		await admin.waitForTimeout(600);
		await editor.getByText(text).hover();
		if (text === 'Primo') {
			await axe(admin, 'cestino sul blocco');
			await shot(admin, '03-editor-cestino');
		}
		await onBlock.click();
		await expect(editor.getByText(text)).toHaveCount(0);
	}

	const undo = admin.getByRole('toolbar').getByRole('button', { name: "Annulla l'ultima azione" });
	// Oltre le tre azioni: il limite è quello dell'editor, cento.
	for (const text of ['Quarto', 'Terzo', 'Secondo', 'Primo']) {
		await undo.click();
		await expect(editor.getByText(text)).toBeVisible();
	}
	await editor.getByText('Quinto').click();

	// Un blocco senza testo, e l'ultimo rimasto: l'editor resta con un paragrafo vuoto.
	await admin.getByRole('toolbar').getByRole('button', { name: 'Separatore' }).click();
	await editor.locator('hr').hover();
	await onBlock.click();
	await expect(editor.locator('hr')).toHaveCount(0);
	for (const text of ['Primo', 'Secondo', 'Terzo', 'Quarto']) {
		await editor.getByText(text).hover();
		await onBlock.click();
	}
	await editor.getByText('Quinto').click();
	await admin.getByRole('toolbar').getByRole('button', { name: 'Elimina il blocco' }).click();
	await expect(editor).not.toContainText('Quinto');
	await expect(editor.locator('> *')).toHaveCount(1);
});

test('modifica concorrente non sovrascrive', async ({ browser }) => {
	const other = await login(browser, ADMIN);
	await other.goto('/wiki/bartolo-pancia/edit');
	await admin.goto('/wiki/bartolo-pancia/edit');
	await admin.locator('.editor-content').click();
	await admin.keyboard.type(' Prima modifica.');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.locator('.content')).toContainText('Prima modifica');

	await other.locator('.editor-content').click();
	await other.keyboard.type(' Seconda modifica.');
	await other.getByRole('button', { name: 'Salva' }).click();
	await expect(other.getByRole('alert')).toContainText('Qualcun altro');
	await expect(other.locator('.editor-content')).toContainText('Seconda modifica');
	await other.context().close();
});

test('ricerca', async () => {
	await admin.goto('/search?q=spia');
	await expect(admin.locator('main').getByRole('link', { name: 'Locanda del Grifone' })).toBeVisible();
	await admin.goto('/search?q=locandiere');
	await expect(admin.locator('.hits mark').first()).toBeVisible();
	await axe(admin, 'ricerca');
});

test('invito di un giocatore', async ({ browser }) => {
	await admin.goto('/admin/invites');
	await admin.getByLabel('Ruolo').selectOption('player');
	await admin.getByRole('button', { name: 'Crea invito' }).click();
	inviteLink = await admin.getByLabel('Link di invito').inputValue();
	expect(inviteLink).toMatch(/\/invite\/[\w-]{20,}$/);
	await axe(admin, 'inviti');

	const ctx = await browser.newContext({ locale: 'it-IT' });
	const p = await ctx.newPage();
	await p.goto(inviteLink);
	await expect(p.getByText('invitato come Giocatore')).toBeVisible();
	await p.getByLabel('Nome utente').fill(PLAYER.user);
	await p.getByLabel('Nome visualizzato').fill('Alice');
	await p.getByLabel('Password', { exact: true }).fill(PLAYER.pass);
	await p.getByLabel('Ripeti la password').fill(PLAYER.pass);
	await p.getByRole('button', { name: "Crea l'account" }).click();
	await expect(p.getByText('Bentornato, Alice.')).toBeVisible();

	// L'invito non funziona una seconda volta.
	const p2 = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await p2.goto(inviteLink);
	await expect(p2.getByRole('alert')).toContainText('non è valido');
	await ctx.close();
});

test('il giocatore non vede i segreti', async ({ browser }) => {
	const p = await login(browser, PLAYER);
	await p.goto('/wiki/locanda-del-grifone');
	await expect(p.locator('.content')).toContainText('birra annacquata');
	await expect(p.locator('.content')).not.toContainText('spia');
	await expect(p.getByText('Contiene segreti')).toHaveCount(0);
	await expect(p.getByRole('link', { name: /Modifica/ })).toHaveCount(0);
	await expect(p.locator('.page-foot')).toContainText('Creata da Davide');

	await expect(p.getByRole('navigation', { name: TREE })).toContainText('Bartolo Pancia');
	await expect(p.getByRole('navigation', { name: TREE })).not.toContainText('Piano del cattivo');

	const r = await p.goto('/wiki/piano-del-cattivo');
	expect(r?.status()).toBe(404);
	const e = await p.goto('/wiki/locanda-del-grifone/edit');
	expect(e?.status()).toBe(404);

	await p.goto('/search?q=spia');
	await expect(p.getByRole('status')).toContainText('0 risultati');
	await p.goto('/search?q=dorme');
	await expect(p.locator('.hits')).toHaveCount(0);

	const s = await p.request.get('/api/suggest?q=piano');
	expect(await s.json()).toEqual([]);

	await p.goto('/admin');
	await expect(p.getByRole('heading', { name: 'Pagina non trovata' })).toBeVisible();

	// Il giocatore crea una sua pagina, senza pulsante "Segreto".
	await p.goto('/wiki/new?template=none');
	await expect(p.getByRole('button', { name: /Segreto del Master/ })).toHaveCount(0);
	await expect(p.getByRole('radio', { name: /Solo Master/ })).toHaveCount(0);
	await newPage(p, 'Diario di Alice', async (pg) => {
		await pg.keyboard.type('Oggi ho incontrato Bartolo.');
	}, { visibility: 'Personale' });

	const back = await login(browser, ADMIN);
	const r2 = await back.goto('/wiki/diario-di-alice');
	expect(r2?.status()).toBe(404);
	await back.context().close();

	// Preferenze di lettura.
	await p.goto('/preferences');
	await p.getByRole('radio', { name: 'Scuro', exact: true }).check();
	await p.getByLabel('Dimensione del testo').selectOption('150');
	await p.getByLabel('Carattere').selectOption('opendyslexic');
	await p.getByRole('button', { name: 'Salva' }).first().click();
	await expect(p.getByRole('status').first()).toContainText('Preferenze salvate');
	const html = p.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await expect(html).toHaveAttribute('data-font', 'opendyslexic');
	await p.goto('/wiki/locanda-del-grifone');
	await expect(html).toHaveAttribute('style', /--font-scale:1\.5/);
	await shot(p, '06-giocatore-scuro');
	await axe(p, 'giocatore scuro');

	await p.goto('/preferences');
	await p.getByLabel('Lingua', { exact: true }).selectOption('en');
	await p.getByRole('button', { name: 'Salva' }).first().click();
	await expect(p.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible();
	await expect(html).toHaveAttribute('lang', 'en');
	await p.context().close();
});

test('visitatori: spenti di default', async ({ browser }) => {
	const p = await (await browser.newContext({ locale: 'it-IT' })).newPage();
	await p.goto('/wiki');
	await expect(p).toHaveURL(/\/login\?next=%2Fwiki/);
	// Nessun titolo di pagina a chi non ha fatto l'accesso.
	await expect(p.getByRole('navigation', { name: TREE })).toHaveCount(0);
	expect(await p.content()).not.toContain('Bartolo Pancia');
	await axe(p, 'login');
	await shot(p, '07-login');
	await p.context().close();
});

test('temi: contrasti e accessibilità', async () => {
	for (const theme of ['Chiaro', 'Scuro']) {
		await admin.goto('/preferences');
		await admin.getByRole('radio', { name: theme, exact: true }).check();
		await admin.getByRole('button', { name: 'Salva' }).first().click();
		await expect(admin.getByRole('status').first()).toContainText('Preferenze salvate');
		for (const url of ['/', '/wiki', '/wiki/locanda-del-grifone', '/tags']) {
			await admin.goto(url);
			await axe(admin, `${theme} ${url}`);
		}
		await admin.goto('/wiki/locanda-del-grifone');
		await shot(admin, `08-tema-${theme.toLowerCase().replace(' ', '-')}`);
	}
});

test('la barra a sinistra si può tenere chiusa', async () => {
	const save = async (choice: string) => {
		await admin.goto('/preferences');
		await admin.getByLabel('Barra a sinistra', { exact: true }).selectOption({ label: choice });
		await admin.getByRole('button', { name: 'Salva' }).first().click();
		await expect(admin.getByRole('status').first()).toContainText('Preferenze salvate');
	};
	const tree = admin.getByRole('navigation', { name: TREE });
	const toggle = admin.locator('#tree-toggle');
	await save('Chiusa, si apre col pulsante');
	await admin.goto('/wiki/locanda-del-grifone');
	await expect(tree).toBeHidden();
	await toggle.click();
	await expect(tree).toBeVisible();
	await admin.keyboard.press('Escape');
	await expect(tree).toBeHidden();
	await expect(toggle).toBeFocused();
	await save('Sempre aperta');
	await admin.goto('/wiki/locanda-del-grifone');
	await expect(tree).toBeVisible();
	await expect(toggle).toBeHidden();

	// La freccia la nasconde e la riporta accanto alla pagina; la scelta resta anche ricaricando.
	const hide = admin.getByRole('button', { name: 'Nascondi la barra a sinistra' });
	const show = admin.getByRole('button', { name: 'Mostra la barra a sinistra' });
	await hide.click();
	await expect(tree).toBeHidden();
	await expect(show).toBeFocused();
	await admin.reload();
	await expect(tree).toBeHidden();
	await expect(toggle).toBeHidden();
	await show.click();
	await expect(tree).toBeVisible();
	await expect(hide).toBeFocused();

	// Profilo, aperto come pagina: la barra parte nascosta; si apre e si richiude con la freccia.
	await admin.goto('/profile');
	await expect(tree).toBeHidden();
	await expect(toggle).toBeHidden();
	await show.click();
	await expect(tree).toBeVisible();
	await expect(hide).toBeFocused();
	await hide.click();
	await expect(tree).toBeHidden();
	await expect(show).toBeFocused();

	// Amministrazione: la barra è chiusa e si apre col pulsante.
	for (const url of ['/admin', '/admin/themes']) {
		await admin.goto(url);
		await expect(tree).toBeHidden();
		await expect(toggle).toBeVisible();
	}
	await admin.goto('/wiki');
	await expect(tree).toBeVisible();
});

test('utenti: la tabella scorre dentro il suo riquadro, anche sul telefono', async () => {
	await admin.setViewportSize({ width: 390, height: 844 });
	await admin.goto('/admin/users');
	await axe(admin, 'utenti');
	expect(await admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
	await admin.setViewportSize({ width: 1280, height: 720 });
});

test('tastiera: link per saltare al contenuto', async () => {
	await admin.goto('/wiki');
	await admin.keyboard.press('Tab');
	const skip = admin.getByRole('link', { name: 'Vai al contenuto' });
	await expect(skip).toBeFocused();
	await admin.keyboard.press('Enter');
	await expect(admin.locator('#main')).toBeFocused();
});

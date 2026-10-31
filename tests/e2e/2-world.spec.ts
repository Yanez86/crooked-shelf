import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// Fase 2: template, immagini, calendario, cronologie, mappe. Usa la wiki creata da 1-wiki.spec.ts.
test.describe.configure({ mode: 'serial' });

const SHOTS = 'test-results/screens';
const TREE = 'Pagine e risorse';
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
	await page.waitForURL((u) => !u.pathname.startsWith('/login'));
	return page;
}

test('accesso', async ({ browser }) => {
	admin = await login(browser, ADMIN);
	// I test precedenti lasciano il tema scuro: torniamo al chiaro.
	await admin.goto('/preferences');
	await admin.getByRole('radio', { name: 'Chiaro', exact: true }).check();
	await admin.getByRole('button', { name: 'Salva' }).first().click();
	await expect(admin.getByRole('status').first()).toContainText('Preferenze salvate');
});

test('calendario: Harptos', async () => {
	await admin.goto('/calendar');
	await admin.getByLabel('Calendario pronto').selectOption('harptos');
	await admin.getByRole('button', { name: 'Carica nel modulo' }).click();
	await expect(admin.getByRole('textbox', { name: 'Mesi' })).toHaveValue(/Midwinter: 1 \*/);
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('heading', { level: 1 })).toContainText('Harptos');
	await expect(admin.locator('main')).toContainText('Oggi nel mondo: 1 Hammer 1491 DR');

	// Un errore viene spiegato con la riga.
	await admin.getByRole('textbox', { name: 'Mesi' }).fill('Hammer: 30\nAlturiak');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('alert').first()).toContainText('Un mese non è scritto bene');
	await expect(admin.getByText('Controlla la riga 2.')).toBeVisible();
	await axe(admin, 'calendario');
});

test('template PNG con scheda, segreto e immagine', async () => {
	await admin.goto('/wiki/new');
	await expect(admin.getByText('Che pagina vuoi fare?')).toBeVisible();
	await axe(admin, 'scelta template');
	await shot(admin, '10-scelta-template');
	await admin.locator('main').getByRole('link', { name: /^PNG/ }).click();

	await expect(admin.getByRole('heading', { level: 1 })).toHaveText('Nuova pagina: PNG');
	await admin.getByLabel('Titolo', { exact: true }).fill('Elminster');
	await expect(admin.getByLabel('Nome del campo 3')).toHaveValue('Allineamento');
	await admin.getByLabel('Valore del campo 3').fill('Caotico buono');
	await admin.getByLabel('Valore del campo 4').fill('[[Locanda del Grifone]]');
	await admin.getByRole('region', { name: 'Colonna a lato' }).getByRole('button', { name: 'Testo', exact: true }).click();
	await expect(admin.getByLabel('Nome del campo 6')).toBeFocused();
	await admin.getByLabel('Nome del campo 6').fill('Età');
	await admin.getByLabel('Valore del campo 6').fill('Più di mille anni');

	const editor = admin.locator('.editor-content');
	await expect(editor.getByRole('heading', { name: 'Aspetto' })).toBeVisible();
	await expect(editor.locator('aside.secret')).toContainText('solo il Master');

	// Immagine: si carica e si descrive.
	await editor.getByRole('heading', { name: 'Aspetto' }).click();
	await admin.keyboard.press('End');
	await admin.keyboard.press('Enter');
	await admin.locator('input[type=file]').setInputFiles('tests/fixtures/city.png');
	const alt = admin.getByRole('dialog', { name: /Descrivi l'immagine/ });
	await alt.getByRole('textbox').fill('Ritratto di un vecchio mago con la barba');
	await alt.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('status').filter({ hasText: 'Immagine inserita' })).toBeVisible();
	await expect(editor.locator('img')).toHaveAttribute('alt', 'Ritratto di un vecchio mago con la barba');
	await axe(admin, 'editor con template');

	await admin.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Elminster' })).toBeVisible();
	const box = admin.getByRole('complementary', { name: 'Scheda' });
	await expect(box).toContainText('Caotico buono');
	await expect(box.getByRole('link', { name: 'Locanda del Grifone' })).toBeVisible();
	await expect(box).toContainText('Più di mille anni');
	await expect(admin.locator('.content img')).toHaveAttribute('alt', 'Ritratto di un vecchio mago con la barba');
	const src = await admin.locator('.content img').getAttribute('src');
	const img = await admin.request.get(src!);
	expect(img.headers()['content-type']).toBe('image/png');
	await axe(admin, 'pagina PNG');
	await shot(admin, '11-pagina-png');
	await admin.setViewportSize({ width: 390, height: 844 });
	await shot(admin, '11b-pagina-png-telefono');
	await admin.setViewportSize({ width: 1280, height: 800 });

	// Il campo collega anche all'indietro.
	await admin.goto('/wiki/locanda-del-grifone');
	await expect(admin.getByRole('region', { name: 'Pagine che collegano qui' })).toContainText('Elminster');
	// E la ricerca trova i campi.
	await admin.goto('/search?q=caotico');
	await expect(admin.locator('main').getByRole('link', { name: 'Elminster' })).toBeVisible();
});

test('i template sono pagine: si modificano e si fotocopiano', async () => {
	// Nella linguetta Template della barra a sinistra, che si apre da sola su un template.
	await admin.goto('/wiki/elminster');
	const tree = admin.getByRole('navigation', { name: TREE });
	await tree.getByRole('tab', { name: 'Template' }).click();
	await tree.getByRole('link', { name: 'Luogo, Template' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Luogo' })).toBeVisible();
	await admin.reload();
	await expect(tree.getByRole('tab', { name: 'Template' })).toHaveAttribute('aria-selected', 'true');
	await tree.getByRole('tab', { name: 'Pagine' }).click();
	await expect(admin.locator('main .meta')).toContainText('Template');

	// La struttura la decide chi lo scrive: si aggiunge una sezione.
	await admin.getByRole('link', { name: 'Modifica: Luogo' }).click();
	await expect(admin.getByRole('checkbox', { name: 'È un template' })).toBeChecked();
	const editor = admin.locator('.editor-content');
	await expect(editor).toHaveAttribute('contenteditable', 'true');
	await editor.getByRole('heading', { name: 'Personaggi' }).click();
	// Il primo clic arriva all'editor con un attimo di ritardo: i tasti premuti prima finirebbero a inizio documento.
	await expect(editor.locator('.has-focus')).toHaveText('Personaggi');
	await admin.keyboard.press('End');
	await admin.keyboard.press('Enter');
	await admin.keyboard.type('## Clima');
	await admin.getByRole('button', { name: 'Salva' }).click();
	const headings = admin.locator('.prose h2');
	await expect(headings).toHaveText(['Descrizione', 'Luoghi notevoli', 'Personaggi', 'Clima', 'Segreti']);
	await axe(admin, 'pagina template');
	await shot(admin, '11f-template');

	// La fotocopia: stessi blocchi, stessa colonna, stessa icona.
	await admin.getByRole('link', { name: 'Usa questo template' }).click();
	await expect(admin.getByRole('heading', { level: 1 })).toHaveText('Nuova pagina: Luogo');
	await expect(admin.locator('.editor-content').getByRole('heading', { name: 'Clima', exact: true })).toBeVisible();
	await expect(admin.getByLabel('Nome del campo 1')).toHaveValue('Tipo');
	await expect(admin.getByRole('checkbox', { name: 'È un template' })).not.toBeChecked();
	await admin.getByLabel('Titolo', { exact: true }).fill('Neverwinter');
	await admin.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Neverwinter' })).toBeVisible();
	await expect(admin.locator('.content').getByRole('heading', { name: 'Clima', exact: true })).toBeVisible();
	await expect(admin.locator('main .meta')).not.toContainText('Template');

	// Una pagina qualsiasi diventa un template e compare tra le scelte.
	await admin.goto('/wiki/neverwinter/edit');
	await admin.getByRole('checkbox', { name: 'È un template' }).check();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.locator('main .meta')).toContainText('Template');
	await admin.goto('/wiki/new');
	await expect(admin.locator('main').getByRole('link', { name: /^Neverwinter/ })).toBeVisible();
	await admin.goto('/wiki/neverwinter/edit');
	await admin.getByRole('checkbox', { name: 'È un template' }).uncheck();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await admin.goto('/wiki/new');
	await expect(admin.locator('main').getByRole('link', { name: /^Neverwinter/ })).toHaveCount(0);
});

test('colonna a lato: si aggiunge modificando la pagina, con riquadri di testo e immagini', async () => {
	// Di base la colonna non c'è, nemmeno per chi può modificare.
	await admin.goto('/wiki/locanda-del-grifone');
	const column = admin.getByRole('complementary', { name: 'Scheda' });
	await expect(column).toHaveCount(0);
	await admin.goto('/wiki/locanda-del-grifone/edit');
	const side = admin.getByRole('region', { name: 'Colonna a lato' });
	await expect(side).toHaveCount(0);
	const plus = admin.getByRole('button', { name: 'Aggiungi la colonna a lato' });
	await shot(admin, '11c-modifica-senza-colonna');
	await plus.click();
	await expect(side.getByRole('button', { name: 'Testo', exact: true })).toBeFocused();
	await axe(admin, 'colonna vuota');
	// Vuota si toglie com'è stata aggiunta.
	await side.getByRole('button', { name: 'Togli la colonna' }).click();
	await expect(side).toHaveCount(0);
	await expect(plus).toBeFocused();

	// Un riquadro di testo, salvato.
	await plus.click();
	await side.getByRole('button', { name: 'Testo', exact: true }).click();
	await admin.getByLabel('Nome del campo 1').fill('Oste');
	await admin.getByLabel('Valore del campo 1').fill('[[Bartolo Pancia]]');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(column.getByRole('link', { name: 'Bartolo Pancia' })).toBeVisible();
	// Tolto l'ultimo riquadro e la colonna, la pagina torna senza.
	await admin.goto('/wiki/locanda-del-grifone/edit');
	await side.getByRole('button', { name: 'Elimina: Nome del campo 1' }).click();
	await side.getByRole('button', { name: 'Togli la colonna' }).click();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Locanda del Grifone' })).toBeVisible();
	await expect(column).toHaveCount(0);

	// Elminster ha già la scheda del template: la colonna è aperta. Si aggiunge un'immagine.
	await admin.goto('/wiki/elminster/edit');
	await side.getByRole('button', { name: 'Immagine', exact: true }).click();
	let box = side.getByRole('group', { name: 'Immagine 7' });
	await expect(box.getByRole('button', { name: "Scegli un'immagine" })).toBeFocused();

	// Un file che non è un'immagine viene rifiutato.
	await box.getByLabel("File dell'immagine 7").setInputFiles({ name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
	await expect(box.getByRole('status')).toContainText('Formato non supportato');

	// Un file trascinato dal computer sul riquadro.
	const png = readFileSync('tests/fixtures/map.png').toString('base64');
	const dataTransfer = await admin.evaluateHandle((b64) => {
		const dt = new DataTransfer();
		dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'elminster.png', { type: 'image/png' }));
		return dt;
	}, png);
	await box.dispatchEvent('dragover', { dataTransfer });
	await box.dispatchEvent('drop', { dataTransfer });
	await expect(box.getByRole('status')).toContainText('Immagine caricata');
	await expect(box.locator('img')).toBeVisible();
	await box.getByLabel("Didascalia dell'immagine 7").fill('Il mago nella sua torre');

	// In cima con la freccia, da tastiera: il fuoco resta sulla freccia.
	await box.getByRole('button', { name: 'Sposta su: Immagine 7' }).focus();
	for (let i = 0; i < 6; i++) await admin.keyboard.press('Enter');
	box = side.getByRole('group', { name: 'Immagine 1' });
	await expect(box.getByRole('button', { name: 'Sposta giù: Immagine 1' })).toBeFocused();
	await expect(box.getByRole('button', { name: 'Sposta su: Immagine 1' })).toBeDisabled();
	await axe(admin, 'colonna con immagine');
	await shot(admin, '11d-modifica-colonna');
	// In modifica la colonna parte alla stessa altezza dell'albero e resta in vista mentre si scorre.
	await admin.evaluate(() => scrollTo(0, 0));
	const top = async () => (await side.boundingBox())!.y;
	expect(await top()).toBeCloseTo((await admin.locator('#explorer').boundingBox())!.y, 0);
	await admin.evaluate(() => scrollTo(0, 500));
	await expect.poll(top).toBeCloseTo(16, 0);
	await admin.evaluate(() => scrollTo(0, 0));
	await admin.getByRole('button', { name: 'Salva' }).click();

	// In lettura: immagine in cima con la didascalia, poi la scheda; nessun pulsante.
	const img = column.getByRole('img', { name: 'Il mago nella sua torre' });
	await expect(img).toBeVisible();
	await expect(column.locator('figcaption')).toHaveText('Il mago nella sua torre');
	await expect(column.locator(':scope > *').first()).toHaveJSProperty('tagName', 'FIGURE');
	await expect(column).toContainText('Caotico buono');
	await expect(column.getByRole('button')).toHaveCount(0);
	const first = (await img.getAttribute('src'))!;
	expect((await admin.request.get(first)).headers()['content-type']).toBe('image/png');
	await axe(admin, 'pagina con immagine');
	await shot(admin, '11e-colonna-con-immagine');

	// In modifica la matita e la × stanno sull'immagine stessa; senza mouse la matita apre la scelta del file.
	await admin.goto('/wiki/elminster/edit');
	const onImage = box.locator('.frame');
	await expect(onImage.getByRole('button', { name: 'Cambia immagine: Immagine 1' })).toBeVisible();
	await expect(onImage.getByRole('button', { name: 'Elimina: Immagine 1' })).toBeVisible();
	await box.getByLabel("File dell'immagine 1").setInputFiles('tests/fixtures/city.png');
	await expect(box.getByRole('status')).toContainText('Immagine caricata');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(img).toBeVisible();
	await expect(img).not.toHaveAttribute('src', first);
});

test('copertina: dalla galleria, riposizionata da tastiera, poi un colore e un file nuovo', async () => {
	await admin.goto('/wiki/locanda-del-grifone/edit');
	// L'icona sta a sinistra del titolo, come in lettura.
	await admin.getByTitle('Icona', { exact: true }).click();
	await admin.getByRole('radio', { name: 'Boccale' }).check();
	await admin.getByTitle('Icona', { exact: true }).click();

	// Dalla galleria: le immagini che ci sono già nella campagna.
	await admin.getByRole('button', { name: 'Aggiungi copertina' }).click();
	const picker = admin.getByRole('region', { name: 'Copertina' });
	await expect(picker.getByRole('heading', { name: 'Copertina' })).toBeFocused();
	await picker.getByRole('button', { name: 'Il mago nella sua torre' }).click();
	await expect(picker).toHaveCount(0);
	const cover = admin.locator('main .page-cover');
	await expect(cover.locator('img')).toBeVisible();
	await expect(admin.getByRole('button', { name: 'Cambia copertina' })).toBeFocused();

	// Riposizionare senza mouse: è un cursore, le frecce spostano l'immagine, Invio conferma.
	await admin.getByRole('button', { name: 'Riposiziona la copertina' }).click();
	const slider = admin.getByRole('slider', { name: 'Posizione della copertina' });
	await expect(slider).toBeFocused();
	await admin.keyboard.press('ArrowDown');
	await admin.keyboard.press('ArrowDown');
	await expect(slider).toHaveAttribute('aria-valuenow', '40');
	await admin.keyboard.press('Enter');
	await expect(admin.getByRole('button', { name: 'Riposiziona la copertina' })).toBeFocused();
	await axe(admin, 'copertina in modifica');
	await shot(admin, '11f-copertina-modifica');
	await admin.getByRole('button', { name: 'Salva' }).click();

	// In lettura: la copertina in alto e l'icona a sinistra del titolo.
	await expect(admin.getByRole('heading', { level: 1, name: 'Locanda del Grifone' })).toBeVisible();
	await expect(cover.locator('img')).toHaveCSS('object-position', '50% 40%');
	await expect(admin.locator('main .page-head .page-icon')).toBeVisible();
	await axe(admin, 'pagina con copertina');
	await shot(admin, '11g-pagina-con-copertina');

	// Un colore pieno, poi via: il fuoco torna su «Aggiungi copertina».
	await admin.goto('/wiki/locanda-del-grifone/edit');
	await admin.getByRole('button', { name: 'Cambia copertina' }).click();
	await picker.getByRole('button', { name: 'Tinta unita' }).click();
	await picker.getByRole('button', { name: 'Notte' }).click();
	await expect(cover).toHaveCSS('background-color', 'rgb(58, 71, 101)');
	await expect(admin.getByRole('button', { name: 'Riposiziona la copertina' })).toHaveCount(0);
	await admin.getByRole('button', { name: 'Togli la copertina' }).click();
	await expect(cover).toHaveCount(0);
	await expect(admin.getByRole('button', { name: 'Aggiungi copertina' })).toBeFocused();

	// Un file nuovo dal computer; Esc chiude il pannello senza cambiare niente.
	await admin.keyboard.press('Enter');
	await admin.keyboard.press('Escape');
	await expect(picker).toHaveCount(0);
	await expect(admin.getByRole('button', { name: 'Aggiungi copertina' })).toBeFocused();
	await admin.getByRole('button', { name: 'Aggiungi copertina' }).click();
	await picker.getByRole('button', { name: 'Carica' }).click();
	await picker.getByLabel("Carica un'immagine").setInputFiles('tests/fixtures/map.png');
	await expect(cover.locator('img')).toBeVisible();
	await admin.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Locanda del Grifone' })).toBeVisible();
	await expect(cover.locator('img')).toBeVisible();
	await expect(cover.locator('img')).toHaveCSS('object-position', '50% 50%');
});

test('un file che non è un\'immagine viene rifiutato', async () => {
	const r = await admin.request.post('/api/files', {
		multipart: { file: { name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg onload="alert(1)"/>') } },
		headers: { origin: new URL(admin.url()).origin }
	});
	expect(r.status()).toBe(400);
	expect((await r.json()).error).toBe('files.badType');
});

test('cronologia del mondo', async () => {
	// Le cronologie sono pagine dell'albero.
	await admin.goto('/');
	await admin.getByRole('navigation', { name: TREE }).getByRole('link', { name: 'Cronologia del mondo, Cronologia' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Cronologia del mondo' })).toBeVisible();
	const add = async (title: string, y: string, m: string, d: string, extra?: () => Promise<void>) => {
		await admin.getByLabel('Titolo').fill(title);
		await admin.getByLabel('Anno').fill(y);
		await admin.getByLabel('Mese').selectOption(m ? { label: m } : '');
		await admin.getByLabel('Giorno').fill(d);
		if (extra) await extra();
		await admin.getByRole('button', { name: 'Aggiungi', exact: true }).click();
		await expect(admin.getByRole('status').first()).toContainText('Evento aggiunto');
	};
	await add('Arrivo degli eroi a Waterdeep', '1491', 'Mirtul', '15', async () => {
		await admin.getByLabel('Pagina collegata').fill('Locanda del Grifone');
		await admin.getByLabel('Descrizione').fill('Si incontrano da [[Bartolo Pancia]].');
	});
	await add('Caduta di Myth Drannor', '714', '', '', async () => {
		await admin.getByLabel('Data approssimativa').fill('circa 800 anni fa');
	});
	await add('Il patto segreto', '1490', 'Midwinter', '1', async () => {
		await admin.getByRole('radio', { name: 'Solo Master' }).check();
	});

	// Data che non esiste: Midsummer ha 2 giorni solo negli anni di Shieldmeet.
	await admin.getByLabel('Titolo').fill('Data sbagliata');
	await admin.getByLabel('Anno').fill('1491');
	await admin.getByLabel('Mese').selectOption({ label: 'Midsummer' });
	await admin.getByLabel('Giorno').fill('2');
	await admin.getByRole('button', { name: 'Aggiungi', exact: true }).click();
	await expect(admin.getByRole('alert')).toContainText('non esiste nel calendario');

	const items = admin.locator('main li.event');
	await expect(items).toHaveCount(3);
	await expect(items.nth(0)).toContainText('Caduta di Myth Drannor');
	await expect(items.nth(0)).toContainText('circa 800 anni fa');
	await expect(items.nth(0)).toContainText('777 anni fa');
	await expect(items.nth(1)).toContainText('Midwinter 1490 DR');
	await expect(items.nth(2)).toContainText('15 Mirtul 1491 DR');
	await expect(items.nth(2).getByRole('link', { name: 'Arrivo degli eroi a Waterdeep', exact: true })).toHaveAttribute('href', '/wiki/locanda-del-grifone');
	await expect(items.nth(2).getByRole('link', { name: 'Bartolo Pancia' })).toBeVisible();
	await axe(admin, 'cronologia mondo');
	await shot(admin, '12-cronologia-mondo');

	await admin.getByRole('link', { name: 'Linea del tempo' }).click();
	await expect(admin.getByRole('region', { name: 'Linea del tempo' })).toBeVisible();
	await axe(admin, 'cronologia linea');
	await shot(admin, '13-cronologia-linea');

	// L'evento compare anche nella pagina collegata.
	await admin.goto('/wiki/locanda-del-grifone');
	await expect(admin.getByRole('region', { name: 'Collegamenti' })).toContainText('Arrivo degli eroi a Waterdeep');
});

test('resoconto di sessione nella cronologia della campagna', async () => {
	await admin.goto('/wiki/new?template=resoconto-di-sessione');
	await admin.getByLabel('Titolo', { exact: true }).fill('Sessione 1: il Grifone');
	await admin.getByLabel('Sessione n.').fill('1');
	await admin.getByLabel('Data della sessione').fill('2026-10-24');
	await admin.locator('#sessionWorldYear').fill('1491');
	await admin.locator('#sessionWorldMonth').selectOption({ label: 'Mirtul' });
	await admin.locator('#sessionWorldDay').fill('15');
	await admin.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(admin.getByRole('complementary', { name: 'Scheda' })).toContainText('15 Mirtul 1491 DR');

	await admin.getByRole('navigation', { name: TREE }).getByRole('link', { name: 'Cronologia della campagna, Cronologia' }).click();
	const ev = admin.locator('main li.event').first();
	await expect(ev).toContainText('15 Mirtul 1491 DR');
	await expect(ev).toContainText('giocata il 24 ottobre 2026');
	await expect(ev.getByRole('link', { name: 'Sessione 1: il Grifone' })).toBeVisible();
	await expect(ev).toContainText('Sessione');
	await axe(admin, 'cronologia campagna');
});

test('una cronologia nuova è una pagina con i suoi eventi', async () => {
	await admin.goto('/wiki/new');
	await admin.locator('main').getByRole('link', { name: /^Nuova cronologia/ }).click();
	await admin.getByLabel('Titolo', { exact: true }).fill('Leggende del Nord');
	await expect(admin.getByRole('radio', { name: 'Del mondo' })).toBeChecked();
	await axe(admin, 'nuova cronologia');
	await admin.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Leggende del Nord' })).toBeVisible();
	await expect(admin.getByRole('navigation', { name: TREE }).getByRole('link', { name: 'Leggende del Nord, Cronologia' })).toHaveAttribute('aria-current', 'page');
	await expect(admin.getByText('Ancora nessun evento.')).toBeVisible();
	await admin.getByLabel('Titolo').fill('Il drago di ghiaccio');
	await admin.getByLabel('Anno').fill('1300');
	await admin.getByRole('button', { name: 'Aggiungi', exact: true }).click();
	await expect(admin.getByRole('status').first()).toContainText('Evento aggiunto');
	await expect(admin.locator('main li.event')).toHaveCount(1);
	// Gli eventi restano nella loro cronologia.
	await admin.goto('/wiki/cronologia-del-mondo');
	await expect(admin.locator('main')).not.toContainText('Il drago di ghiaccio');
});

test('mappe con pin, livelli e mappe annidate', async () => {
	await admin.goto('/wiki/new');
	await admin.locator('main').getByRole('link', { name: /^Nuova mappa/ }).click();
	await admin.getByLabel('Titolo').fill('Costa della Spada');
	await admin.getByLabel('Immagine della mappa').setInputFiles('tests/fixtures/map.png');
	await admin.getByLabel('Larghezza reale').fill('1200');
	await admin.getByLabel('Unità').fill('km');
	await admin.getByRole('button', { name: 'Crea la mappa' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Costa della Spada' })).toBeVisible();
	await expect(admin.locator('.leaflet-image-layer')).toBeVisible();
	// Di base l'immagine è larga come la colonna centrale.
	expect(Math.abs((await admin.locator('.leaflet-image-layer').boundingBox())!.width - (await admin.locator('.leaflet-container').evaluate((e) => e.clientWidth)))).toBeLessThan(2);
	// Lo zoom è in alto a destra, «Aggiungi pin» subito sotto, sulla mappa: stessa misura e stesso bordo destro di un tasto dello zoom.
	const zoomBox = (await admin.locator('.leaflet-top.leaflet-right .leaflet-control-zoom').boundingBox())!;
	const zoomOut = (await admin.locator('.leaflet-control-zoom-out').boundingBox())!;
	const addBox = (await admin.getByRole('button', { name: /Aggiungi pin/ }).boundingBox())!;
	expect(addBox.y).toBeGreaterThanOrEqual(zoomBox.y + zoomBox.height);
	expect(addBox.y - (zoomBox.y + zoomBox.height)).toBeLessThan(16);
	expect(Math.abs(addBox.width - zoomOut.width)).toBeLessThan(1);
	expect(Math.abs(addBox.height - zoomOut.height)).toBeLessThan(1);
	expect(Math.abs(addBox.x + addBox.width - (zoomOut.x + zoomOut.width))).toBeLessThan(1);
	// L'altezza segue la forma dell'immagine: da quella di base fino al doppio, non oltre.
	const [base, double] = await admin.locator('.leaflet-container').evaluate((e) => {
		const ratio = e.style.aspectRatio;
		const heights = ['4 / 1', '1 / 4'].map((r) => ((e.style.aspectRatio = r), e.getBoundingClientRect().height));
		e.style.aspectRatio = ratio;
		return heights;
	});
	expect(double).toBeCloseTo(base * 2, 0);
	// La mappa è una pagina dell'albero.
	await expect(admin.getByRole('navigation', { name: TREE }).getByRole('link', { name: 'Costa della Spada, Mappa' })).toHaveAttribute('aria-current', 'page');

	// Il livello base c'è sempre; «Nuovo livello» ne crea un altro, con nome e visibilità.
	const layersBtn = admin.getByTitle('Livelli', { exact: true });
	await layersBtn.click();
	await expect(admin.getByRole('group', { name: 'Livelli' })).toContainText('Livello base');
	const addLayer = admin.getByRole('button', { name: 'Nuovo livello' });
	await addLayer.click();
	const layerName = admin.getByRole('textbox', { name: 'Nome del livello' });
	await expect(layerName).toBeFocused();
	await layerName.fill('Segreti');
	await admin.locator('#new-layer-vis').selectOption('master');
	await admin.getByRole('button', { name: 'Aggiungi', exact: true }).click();
	await expect(admin.getByRole('group', { name: 'Livelli' })).toContainText('Segreti');
	await expect(addLayer).toBeFocused();
	await expect(layerName).toHaveCount(0);
	await axe(admin, 'elenco dei livelli');
	// I livelli si aprono dal tasto subito sotto «Aggiungi pin».
	const pinBox = (await admin.getByRole('button', { name: /Aggiungi pin/ }).boundingBox())!;
	const layersBox = (await layersBtn.boundingBox())!;
	expect(layersBox.y).toBeGreaterThanOrEqual(pinBox.y + pinBox.height);
	expect(Math.abs(layersBox.x - pinBox.x)).toBeLessThan(1);
	await layersBtn.click();

	const pinForm = admin.getByRole('dialog', { name: /^(Nuovo|Modifica) pin$/ });
	// Da tastiera il pin nasce al centro della vista. Questo è collegato a una pagina.
	await admin.getByRole('button', { name: /Aggiungi pin/ }).focus();
	await admin.keyboard.press('Enter');
	await expect(pinForm.getByLabel('Nome', { exact: true })).toBeFocused();
	// Se non si sceglie altro, il pin va nel livello base.
	await expect(pinForm.getByLabel('Livello', { exact: true }).locator('option:checked')).toHaveText('Livello base');
	await pinForm.getByLabel('Nome', { exact: true }).fill('Waterdeep');
	await pinForm.getByLabel('Pagina collegata').fill('Locanda del Grifone');
	await pinForm.getByLabel('Simbolo').selectOption('city');
	await pinForm.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('status').first()).toContainText('Pin aggiunto');

	// Pin col clic sulla mappa, nel livello segreto.
	await admin.getByRole('button', { name: /Aggiungi pin/ }).click();
	const mapEl = admin.locator('.leaflet-container');
	const box = async () => {
		await mapEl.scrollIntoViewIfNeeded();
		return (await mapEl.boundingBox())!;
	};
	let mapBox = await box();
	await admin.mouse.click(mapBox.x + mapBox.width * 0.3, mapBox.y + mapBox.height * 0.6);
	// Il pin si vede già, e il popup chiede i dati.
	await expect(admin.locator('.leaflet-marker-icon')).toHaveCount(2);
	await expect(pinForm.getByLabel('Nome', { exact: true })).toBeFocused();
	await axe(admin, 'mappa: popup del pin');
	await admin.screenshot({ path: `${SHOTS}/14a-mappa-popup-del-pin.png` });
	await pinForm.getByLabel('Nome', { exact: true }).fill('Covo dei Zhentarim');
	await pinForm.getByLabel('Livello', { exact: true }).selectOption({ label: 'Segreti' });
	await pinForm.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('status').first()).toContainText('Pin aggiunto');

	await expect(admin.locator('.leaflet-marker-icon')).toHaveCount(2);
	await expect(admin.getByRole('table')).toContainText('Covo dei Zhentarim');

	// Spegnere un livello nasconde i suoi pin.
	await layersBtn.click();
	await admin.getByRole('checkbox', { name: /Segreti/ }).uncheck();
	await expect(admin.locator('.leaflet-marker-icon')).toHaveCount(1);
	await admin.getByRole('checkbox', { name: /Segreti/ }).check();
	await layersBtn.click();

	// Il pin si trova dall'elenco; Invio apre la sua pagina sopra la mappa, Esc la chiude.
	await admin.getByRole('button', { name: /^Mostra ?: Waterdeep$/ }).click();
	const waterdeep = admin.getByRole('button', { name: 'Waterdeep', exact: true });
	await expect(waterdeep).toBeFocused();
	await admin.keyboard.press('Enter');
	const pinPage = admin.getByRole('dialog', { name: 'Locanda del Grifone' });
	await expect(pinPage.locator('.content')).toContainText('birra annacquata');
	await expect(pinPage.locator('.content .secret')).toContainText('spia');
	await expect(pinPage.getByRole('link', { name: 'Apri la pagina intera' })).toHaveAttribute('href', '/wiki/locanda-del-grifone');
	await expect(pinPage).toBeFocused();
	await axe(admin, 'mappa: pagina del pin');
	await admin.screenshot({ path: `${SHOTS}/14b-mappa-pagina-del-pin.png` });
	await admin.keyboard.press('Escape');
	await expect(pinPage).toBeHidden();
	await expect(waterdeep).toBeFocused();

	// Col mouse: clic sul pin. Dalla finestra il Master passa al modulo del pin.
	await waterdeep.click();
	await expect(pinPage).toBeVisible();
	await pinPage.getByRole('button', { name: 'Modifica pin' }).click();
	await expect(pinPage).toBeHidden();
	await expect(pinForm.getByLabel('Nome', { exact: true })).toHaveValue('Waterdeep');
	await pinForm.getByRole('button', { name: 'Chiudi' }).click();

	// Clic fuori dalla finestra: si chiude.
	await waterdeep.click();
	await expect(pinPage).toBeVisible();
	await admin.mouse.click(5, 5);
	await expect(pinPage).toBeHidden();

	// Un pin senza pagina ha ancora il fumetto.
	await admin.getByRole('button', { name: 'Covo dei Zhentarim', exact: true }).click();
	await expect(admin.locator('.leaflet-popup')).toContainText('Modifica pin');
	await expect(admin.getByRole('dialog')).toHaveCount(0);

	// Righello. I pin si spengono: dove cadono dipende dalla finestra, e un clic su un pin non misura.
	// Anche il fumetto del Covo deve sparire: Leaflet lo dissolve per un attimo, e intanto prende i clic.
	const layers = [admin.getByRole('checkbox', { name: 'Livello base' }), admin.getByRole('checkbox', { name: /Segreti/ })];
	await layersBtn.click();
	for (const l of layers) await l.uncheck();
	await layersBtn.click();
	await expect(admin.locator('.leaflet-marker-icon')).toHaveCount(0);
	await expect(admin.locator('.leaflet-popup')).toHaveCount(0);
	await admin.getByRole('button', { name: /Misura/ }).click();
	await admin.keyboard.press('Escape');
	mapBox = await box();
	const points = [0.2, 0.8].map((f) => ({ x: mapBox.x + mapBox.width * f, y: mapBox.y + mapBox.height * 0.5 }));
	// Cosa c'è sotto i due punti: se la misura non riesce, il messaggio dice chi ha preso il clic.
	const under = await admin.evaluate(
		(pts) => pts.map((p) => { const e = document.elementFromPoint(p.x, p.y); return e ? `${e.tagName.toLowerCase()}.${e.getAttribute('class') ?? ''}` : '—'; }),
		points
	);
	for (const p of points) await admin.mouse.click(p.x, p.y);
	await expect(admin.getByRole('status').filter({ hasText: 'Distanza' }), `sotto i clic: ${under.join(' | ')}`).toContainText('km');
	await admin.getByRole('button', { name: /Misura/ }).click();
	await layersBtn.click();
	for (const l of layers) await l.check();
	await layersBtn.click();
	await expect(admin.locator('.leaflet-marker-icon')).toHaveCount(2);

	await axe(admin, 'mappa');
	await shot(admin, '14-mappa');

	// Mappa annidata.
	await admin.getByRole('link', { name: 'Nuova mappa qui dentro' }).click();
	await admin.getByLabel('Titolo').fill('Waterdeep');
	await admin.getByLabel('Immagine della mappa').setInputFiles('tests/fixtures/city.png');
	await expect(admin.getByLabel('Si trova dentro la mappa')).toHaveValue(/\d+/);
	await admin.getByRole('button', { name: 'Crea la mappa' }).click();
	await expect(admin.getByRole('navigation', { name: 'Percorso delle mappe' })).toContainText('Costa della Spada');
	await admin.goto('/maps/costa-della-spada');
	await expect(admin.getByRole('region', { name: 'Mappe contenute' })).toContainText('Waterdeep');

	// La pagina sa di essere sulla mappa.
	await admin.goto('/wiki/locanda-del-grifone');
	await expect(admin.getByRole('region', { name: 'Collegamenti' }).getByRole('link', { name: 'Costa della Spada' })).toBeVisible();
	await admin.goto('/maps');
	await axe(admin, 'elenco mappe');
	await admin.setViewportSize({ width: 390, height: 844 });
	await admin.goto('/maps/costa-della-spada');
	await shot(admin, '15-mappa-telefono');
	await admin.setViewportSize({ width: 1280, height: 800 });
});

test('la descrizione della mappa si scrive in modifica e sta in un riquadro sopra la mappa', async () => {
	await admin.goto('/wiki/costa-della-spada');
	await expect(admin.locator('.prose.panel')).toHaveCount(0);
	await admin.goto('/wiki/costa-della-spada/edit');
	await admin.getByRole('textbox', { name: 'Descrizione' }).fill('Dove finisce il Nord.');
	await admin.getByRole('button', { name: 'Salva' }).click();
	await admin.waitForURL('/wiki/costa-della-spada');
	const box = admin.locator('.prose.panel');
	await expect(box).toHaveText('Dove finisce il Nord.');
	expect((await box.boundingBox())!.y).toBeLessThan((await admin.locator('.leaflet-container').boundingBox())!.y);
});

test('galleria: tutte le immagini della campagna', async () => {
	await admin.goto('/gallery');
	const main = admin.locator('main');
	// Due mappe, la copertina della Locanda, l'immagine della pagina e quella nel testo di Elminster; le più recenti prima.
	await expect(main.getByRole('status')).toHaveText('5 immagini');
	const figures = main.locator('figure');
	await expect(figures.nth(0)).toContainText('Mappa Waterdeep');
	await expect(figures.nth(2)).toContainText('Immagine della pagina Locanda del Grifone');
	await expect(figures.nth(3)).toContainText('Immagine della pagina Elminster');
	await expect(figures.nth(4)).toContainText('Nel testo di Elminster');
	await axe(admin, 'galleria');
	await shot(admin, '16-galleria');

	// Il visore: frecce per scorrere, Esc per chiudere.
	const thumb = main.getByRole('link', { name: 'Ritratto di un vecchio mago con la barba' });
	await thumb.click();
	const viewer = admin.getByRole('dialog', { name: 'Immagine 5 di 5' });
	await expect(viewer.getByRole('img', { name: 'Ritratto di un vecchio mago con la barba' })).toBeVisible();
	await axe(admin, 'galleria: visore');
	await shot(admin, '17-galleria-visore');
	await admin.keyboard.press('ArrowRight');
	await expect(admin.getByRole('dialog', { name: 'Immagine 1 di 5' }).getByRole('img', { name: 'Waterdeep' })).toBeVisible();
	await admin.keyboard.press('Escape');
	await expect(admin.getByRole('dialog')).toHaveCount(0);
	await expect(thumb).toBeFocused();

	await admin.getByRole('navigation', { name: 'Quali immagini' }).getByRole('link', { name: /Mappe/ }).click();
	await expect(main.getByRole('status')).toHaveText('2 immagini');
	await expect(main.getByRole('link', { name: 'Elminster', exact: true })).toHaveCount(0);
});

test('il giocatore non vede pin, livelli ed eventi segreti', async ({ browser }) => {
	const p = await login(browser, PLAYER);
	// Nella fase 1 il giocatore ha scelto l'inglese: torna alla lingua della wiki.
	await p.goto('/preferences');
	await p.locator('#locale').selectOption('');
	await p.locator('form[action="?/prefs"] button[type=submit]').click();
	await expect(p.locator('html')).toHaveAttribute('lang', 'it');
	await p.goto('/maps/costa-della-spada');
	await expect(p.locator('.leaflet-marker-icon')).toHaveCount(1);
	await expect(p.locator('main')).not.toContainText('Covo dei Zhentarim');
	await expect(p.locator('main')).not.toContainText('Segreti');
	await expect(p.getByRole('button', { name: /Aggiungi pin/ })).toHaveCount(0);
	// Il livello base è di tutti.
	await p.getByTitle('Livelli', { exact: true }).click();
	await expect(p.getByRole('group', { name: 'Livelli' })).toContainText('Livello base');
	await expect(p.getByRole('button', { name: 'Nuovo livello' })).toHaveCount(0);
	await p.getByTitle('Livelli', { exact: true }).click();
	const move = await p.request.patch('/api/maps/1/pins/1', { data: { x: 1, y: 1 } });
	expect(move.status()).toBe(404);

	// La pagina del pin sopra la mappa: senza i segreti del Master e senza «Modifica pin».
	await p.getByRole('button', { name: 'Waterdeep', exact: true }).click();
	const pinPage = p.getByRole('dialog', { name: 'Locanda del Grifone' });
	await expect(pinPage.locator('.content')).toContainText('birra annacquata');
	await expect(pinPage.locator('.content')).not.toContainText('spia');
	await expect(pinPage.getByRole('button', { name: 'Modifica pin' })).toHaveCount(0);
	await pinPage.getByRole('button', { name: /Chiudi/ }).click();
	await expect(pinPage).toBeHidden();
	const peek = await p.request.get('/api/pages/locanda-del-grifone');
	expect(await peek.text()).not.toContain('spia');
	expect((await p.request.get('/api/pages/piano-del-cattivo')).status()).toBe(404);

	await p.goto('/timeline/world');
	await expect(p.locator('main')).not.toContainText('Il patto segreto');
	await expect(p.locator('main')).toContainText('Caduta di Myth Drannor');
	await expect(p.getByText('Aggiungi un evento')).toHaveCount(0);

	// Nella cronologia della campagna anche i giocatori aggiungono eventi.
	await p.goto('/timeline/campaign');
	await p.getByText('Aggiungi un evento').click();
	await p.getByLabel('Titolo').fill('Alice trova una mappa del tesoro');
	await p.getByRole('button', { name: 'Aggiungi', exact: true }).click();
	await expect(p.getByRole('status').first()).toContainText('Evento aggiunto');
	await expect(p.getByRole('radio', { name: 'Solo Master' })).toHaveCount(0);

	// Le pagine del Master non compaiono nella cronologia (il segreto del PNG resta nascosto).
	await p.goto('/wiki/elminster');
	await expect(p.locator('.content')).not.toContainText('solo il Master');
	await expect(p.locator('.content img')).toBeVisible();

	// Vede la colonna con l'immagine ma non può cambiarla.
	const column = p.getByRole('complementary', { name: 'Scheda' });
	await expect(column.getByRole('img', { name: 'Il mago nella sua torre' })).toBeVisible();
	await expect(column.getByRole('button')).toHaveCount(0);
	expect((await p.goto('/wiki/elminster/edit'))?.status()).toBe(404);
	await p.goto('/wiki/locanda-del-grifone');
	await expect(column).toHaveCount(0);

	await p.goto('/gallery');
	await expect(p.locator('main').getByRole('link', { name: 'Ritratto di un vecchio mago con la barba' })).toBeVisible();
	await axe(p, 'galleria giocatore');
	await p.context().close();
});

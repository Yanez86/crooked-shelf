import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// Fase 2: template, immagini, calendario, cronologie, mappe. Usa la wiki creata da 1-wiki.spec.ts.
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
	await page.waitForURL((u) => !u.pathname.startsWith('/login'));
	return page;
}

test('accesso', async ({ browser }) => {
	admin = await login(browser, ADMIN);
	// I test precedenti lasciano il tema ad alto contrasto: torniamo al chiaro.
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
	await expect(admin.getByText('Da dove vuoi partire?')).toBeVisible();
	await axe(admin, 'scelta template');
	await shot(admin, '10-scelta-template');
	await admin.getByRole('link', { name: /^PNG/ }).click();

	await expect(admin.getByRole('heading', { level: 1 })).toHaveText('Nuova pagina: PNG');
	await admin.getByLabel('Titolo', { exact: true }).fill('Elminster');
	await expect(admin.getByLabel('Nome del campo 3')).toHaveValue('Allineamento');
	await admin.getByLabel('Valore del campo 3').fill('Caotico buono');
	await admin.getByLabel('Valore del campo 4').fill('[[Locanda del Grifone]]');
	await admin.getByRole('button', { name: 'Aggiungi riquadro' }).click();
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
	admin.once('dialog', (d) => d.accept('Ritratto di un vecchio mago con la barba'));
	await admin.locator('input[type=file]').setInputFiles('tests/fixtures/city.png');
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

test("immagine della pagina: si trascina nel riquadro in alto a destra", async () => {
	await admin.goto('/wiki/elminster');
	const box = admin.getByRole('group', { name: 'Immagine della pagina' });
	// Senza immagine resta solo il pulsante; il riquadro compare mentre si trascina un file.
	await expect(box.getByRole('button', { name: "Aggiungi un'immagine" })).toBeVisible();
	await axe(admin, 'pagina senza immagine');

	// Un file trascinato dal computer sul riquadro.
	const png = readFileSync('tests/fixtures/city.png').toString('base64');
	const dataTransfer = await admin.evaluateHandle((b64) => {
		const dt = new DataTransfer();
		dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'elminster.png', { type: 'image/png' }));
		return dt;
	}, png);
	await box.dispatchEvent('dragenter', { dataTransfer });
	await box.dispatchEvent('dragover', { dataTransfer });
	await box.dispatchEvent('drop', { dataTransfer });
	await expect(box.getByRole('status')).toContainText('Immagine salvata');
	const img = box.getByRole('img', { name: 'Elminster' });
	await expect(img).toBeVisible();

	// È salvata davvero.
	await admin.reload();
	await expect(img).toBeVisible();
	const first = (await img.getAttribute('src'))!;
	expect((await admin.request.get(first)).headers()['content-type']).toBe('image/png');
	await axe(admin, 'pagina con immagine');
	await shot(admin, '11c-immagine-della-pagina');

	// Senza mouse: «Cambia immagine» apre la scelta del file.
	await expect(box.getByRole('button', { name: 'Cambia immagine' })).toBeVisible();
	await box.getByLabel("File dell'immagine della pagina").setInputFiles('tests/fixtures/map.png');
	await expect(box.getByRole('status')).toContainText('Immagine salvata');
	await expect(img).not.toHaveAttribute('src', first);

	// Un file che non è un'immagine viene rifiutato.
	await box.getByLabel("File dell'immagine della pagina").setInputFiles({ name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
	await expect(box.getByRole('status')).toContainText('Formato non supportato');

	admin.once('dialog', (d) => d.accept());
	await box.getByRole('button', { name: 'Rimuovi' }).click();
	await expect(box.getByRole('status')).toContainText('Immagine rimossa');
	await expect(box.getByRole('img')).toHaveCount(0);

	await box.getByLabel("File dell'immagine della pagina").setInputFiles('tests/fixtures/city.png');
	await expect(img).toBeVisible();
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
	await admin.goto('/timeline/world');
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
	await admin.goto('/wiki/new?template=b:session');
	await admin.getByLabel('Titolo', { exact: true }).fill('Sessione 1: il Grifone');
	await admin.getByLabel('Sessione n.').fill('1');
	await admin.getByLabel('Data della sessione').fill('2026-10-24');
	await admin.locator('#sessionWorldYear').fill('1491');
	await admin.locator('#sessionWorldMonth').selectOption({ label: 'Mirtul' });
	await admin.locator('#sessionWorldDay').fill('15');
	await admin.getByRole('button', { name: 'Crea la pagina' }).click();
	await expect(admin.getByRole('complementary', { name: 'Scheda' })).toContainText('15 Mirtul 1491 DR');

	await admin.goto('/timeline/campaign');
	const ev = admin.locator('main li.event').first();
	await expect(ev).toContainText('15 Mirtul 1491 DR');
	await expect(ev).toContainText('giocata il 24 ottobre 2026');
	await expect(ev.getByRole('link', { name: 'Sessione 1: il Grifone' })).toBeVisible();
	await expect(ev).toContainText('Sessione');
	await axe(admin, 'cronologia campagna');
});

test('mappe con pin, livelli e mappe annidate', async () => {
	await admin.goto('/maps/new');
	await admin.getByLabel('Titolo').fill('Costa della Spada');
	await admin.getByLabel('Immagine della mappa').setInputFiles('tests/fixtures/map.png');
	await admin.getByLabel('Larghezza reale').fill('1200');
	await admin.getByLabel('Unità').fill('km');
	await admin.getByRole('button', { name: 'Crea la mappa' }).click();
	await expect(admin.getByRole('heading', { level: 1, name: 'Costa della Spada' })).toBeVisible();
	await expect(admin.locator('.leaflet-image-layer')).toBeVisible();

	// Livello segreto.
	await admin.getByText('Gestisci i livelli').click();
	await admin.getByLabel('Nuovo livello').fill('Segreti');
	await admin.locator('#new-layer-vis').selectOption('master');
	await admin.getByRole('button', { name: 'Aggiungi', exact: true }).click();
	await expect(admin.getByRole('group', { name: 'Livelli' })).toContainText('Segreti');

	const pinForm = admin.getByRole('region', { name: /^(Nuovo|Modifica) pin$/ });
	// Pin al centro (senza mouse) collegato a una pagina.
	await admin.getByRole('button', { name: 'Pin al centro della vista' }).click();
	await expect(pinForm.getByLabel('Nome', { exact: true })).toBeFocused();
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
	await pinForm.getByLabel('Nome', { exact: true }).fill('Covo dei Zhentarim');
	await pinForm.getByLabel('Livello', { exact: true }).selectOption({ label: 'Segreti' });
	await pinForm.getByRole('button', { name: 'Salva' }).click();
	await expect(admin.getByRole('status').first()).toContainText('Pin aggiunto');

	await expect(admin.locator('.leaflet-marker-icon')).toHaveCount(2);
	await expect(admin.getByRole('table')).toContainText('Covo dei Zhentarim');

	// Spegnere un livello nasconde i suoi pin.
	await admin.getByRole('checkbox', { name: /Segreti/ }).uncheck();
	await expect(admin.locator('.leaflet-marker-icon')).toHaveCount(1);
	await admin.getByRole('checkbox', { name: /Segreti/ }).check();

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
	await pinForm.getByRole('button', { name: 'Annulla' }).click();

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
	const layers = [admin.getByRole('checkbox', { name: 'Senza livello' }), admin.getByRole('checkbox', { name: /Segreti/ })];
	for (const l of layers) await l.uncheck();
	await expect(admin.locator('.leaflet-marker-icon')).toHaveCount(0);
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
	for (const l of layers) await l.check();
	await expect(admin.locator('.leaflet-marker-icon')).toHaveCount(2);

	await axe(admin, 'mappa');
	await shot(admin, '14-mappa');

	// Mappa annidata.
	await admin.getByRole('link', { name: '+ Nuova mappa qui dentro' }).click();
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

test('galleria: tutte le immagini della campagna', async () => {
	await admin.goto('/gallery');
	const main = admin.locator('main');
	// Immagine della pagina, immagine nel testo, due mappe; le più recenti prima.
	await expect(main.getByRole('status')).toHaveText('4 immagini');
	const figures = main.locator('figure');
	await expect(figures.nth(0)).toContainText('Mappa Waterdeep');
	await expect(figures.nth(2)).toContainText('Immagine della pagina Elminster');
	await expect(figures.nth(3)).toContainText('Nel testo di Elminster');
	await axe(admin, 'galleria');
	await shot(admin, '16-galleria');

	// Il visore: frecce per scorrere, Esc per chiudere.
	const thumb = main.getByRole('link', { name: 'Ritratto di un vecchio mago con la barba' });
	await thumb.click();
	const viewer = admin.getByRole('dialog', { name: 'Immagine 4 di 4' });
	await expect(viewer.getByRole('img', { name: 'Ritratto di un vecchio mago con la barba' })).toBeVisible();
	await axe(admin, 'galleria: visore');
	await shot(admin, '17-galleria-visore');
	await admin.keyboard.press('ArrowRight');
	await expect(admin.getByRole('dialog', { name: 'Immagine 1 di 4' }).getByRole('img', { name: 'Waterdeep' })).toBeVisible();
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

	// Vede l'immagine della pagina ma non può cambiarla.
	const box = p.getByRole('group', { name: 'Immagine della pagina' });
	await expect(box.getByRole('img', { name: 'Elminster' })).toBeVisible();
	await expect(box.getByRole('button')).toHaveCount(0);
	const up = await p.request.post('/wiki/elminster?/image', {
		multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: readFileSync('tests/fixtures/city.png') } },
		headers: { origin: new URL(p.url()).origin }
	});
	expect(up.status()).toBe(404);
	await p.goto('/wiki/locanda-del-grifone');
	// Senza immagine e senza permessi il riquadro non c'è proprio.
	await expect(p.getByRole('group', { name: 'Immagine della pagina' })).toHaveCount(0);

	await p.goto('/gallery');
	await expect(p.locator('main').getByRole('link', { name: 'Ritratto di un vecchio mago con la barba' })).toBeVisible();
	await axe(p, 'galleria giocatore');
	await p.context().close();
});

// Costruisce il pacchetto mondo di esempio e l'elenco dei prompt per le immagini, da qui dentro:
//
//   node examples/la-campana-sommersa/build.mjs
//
// Le statistiche vengono dallo SRD 5.2 (src/lib/server/rules/srd-5.2.json): il test del pacchetto controlla riferimenti e collegamenti.
import { writeFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { slugify } from '../../src/lib/slug.ts';
import { parseRuleKind } from '../../src/lib/rules/index.ts';

const NAME = 'La Campana Sommersa';
const STYLE = 'dark fantasy tabletop RPG illustration, painterly brushwork, muted teal and ochre palette, soft dramatic light, no text, no letters, no watermark';
const COVER = { where: 'copertina', ratio: '21:9', framing: 'wide panoramic composition with the main subject in the central horizontal band' };
const PORTRAIT = { where: 'colonna a lato', ratio: '3:4', framing: 'half-length portrait, face clearly visible' };
const EMBLEM = { where: 'colonna a lato', ratio: '1:1', framing: 'centered and symmetrical composition' };

// Cartelle: gli indirizzi non coincidono con quelli di una campagna esistente, che l'importazione sposterebbe qui dentro.
const CATEGORIES = [
	{ slug: 'campana-sommersa', name: NAME, parent: null, description: "Avventura di esempio per tre personaggi di 2° livello." },
	{ slug: 'campana-png', name: 'PNG', parent: 'campana-sommersa', description: '' },
	{ slug: 'campana-personaggi', name: 'Personaggi', parent: 'campana-sommersa', description: '' },
	{ slug: 'campana-luoghi', name: 'Luoghi', parent: 'campana-sommersa', description: '' },
	{ slug: 'campana-fazioni', name: 'Fazioni', parent: 'campana-sommersa', description: '' }
];
const COVER_COLORS = { 'campana-sommersa': 'night', 'campana-luoghi': 'sea' };

// --- Blocchi dell'editor ---

/** Testo con [[Pagina]], [[Pagina|testo]], @mostro[Name|testo] e **grassetto**. */
function inline(text) {
	const out = [];
	let last = 0;
	const plain = (s) => s && out.push({ type: 'text', text: s });
	for (const m of text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|@(\w+)\[([^\]|]+)(?:\|([^\]]+))?\]|\*\*(.+?)\*\*/g)) {
		plain(text.slice(last, m.index));
		if (m[1]) out.push({ type: 'wikiLink', attrs: { target: slugify(m[1]), title: m[1], label: m[2] ?? null } });
		else if (m[3]) out.push({ type: 'ruleRef', attrs: { kind: parseRuleKind(m[3]), name: m[4], label: m[5] ?? null } });
		else out.push({ type: 'text', text: m[6], marks: [{ type: 'bold' }] });
		last = m.index + m[0].length;
	}
	plain(text.slice(last));
	return out;
}
const p = (text) => ({ type: 'paragraph', content: inline(text) });
const h = (text, level = 2) => ({ type: 'heading', attrs: { level }, content: inline(text) });
const h3 = (text) => h(text, 3);
const ul = (...items) => ({ type: 'bulletList', content: items.map((i) => ({ type: 'listItem', content: [p(i)] })) });
const quote = (text) => ({ type: 'blockquote', content: [p(text)] });
const secret = (...texts) => ({ type: 'secret', content: texts.map(p) });
const callout = (kind, text) => ({ type: 'callout', attrs: { kind }, content: [p(text)] });
const cell = (type, text) => ({ type, attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(text)] });
const row = (type, cells) => ({ type: 'tableRow', content: cells.map((c) => cell(type, c)) });
const table = (head, ...rows) => ({ type: 'table', content: [row('tableHeader', head), ...rows.map((r) => row('tableCell', r))] });

// --- Pagine ---

const PAGES = [
	{
		title: NAME,
		category: 'campana-sommersa',
		visibility: 'master',
		icon: 'scroll',
		tags: ['Avventura'],
		fields: [
			['Sistema', 'D&D 5.5 (2024)'],
			['Personaggi', 'Tre, di 2° livello'],
			['Durata', 'Una o due sessioni'],
			['Luogo', '[[Acquaferma]]']
		],
		body: [
			callout('tip', "Questa pagina è solo per il Master: i giocatori vedono i PNG, la cittadina e la fazione, senza i riquadri segreti. Per giocare bastano i tre personaggi pronti: [[Renzo Bracadoro]], [[Sibilla Vanni]] e [[Pip Mezzaluna]]."),
			h('Premessa'),
			p("Sessant'anni fa la [[Compagnia delle Chiuse]] voleva un lago, e il paese che stava sul fondo della valle non voleva vendere. Una notte le paratie si aprirono: Acquaferma Vecchia finì sott'acqua con quarantuno abitanti, e agli atti restò un'inondazione. L'unico a dare l'allarme fu [[Oddone il Campanaro]], che suonò finché l'acqua non lo coprì."),
			p("Quest'estate la Compagnia ha venduto troppa acqua alle città di pianura. Il lago si è abbassato e la cima del [[Il Campanile Sommerso|campanile]] è riemersa. Da tre notti, a mezzanotte, una campana suona sott'acqua: chi dorme si alza e cammina verso il lago."),
			h('Atto 1: Acquaferma'),
			p("I personaggi arrivano o si trovano già in [[Acquaferma|cittadina]], dove [[Nives Sartori]] offre 40 monete d'oro a chi fermerà la campana. [[Bruno Caligo]] li riceve con cortesia e offre di raddoppiare, purché tutto resti riservato. Solo [[Tessa Mezzaluna]] è disposta a portarli al campanile."),
			table(
				['d6', 'Voce di paese', 'Verità'],
				['1', 'La campana suona per chi ha venduto il lago.', 'Più vera di quanto creda chi la racconta.'],
				['2', 'La Compagnia paga doppio chi lavora di notte alla diga.', 'Vero: nessuno deve contare i barconi.'],
				['3', 'Di notte le paratie restano aperte.', 'Vero: è per questo che il lago cala.'],
				['4', 'Tessa ha ripescato il figlio di Nives con la barca.', 'Vero: Tobia ripeteva «sono in ritardo per la messa».'],
				['5', 'Chi dorme con la cera nelle orecchie non cammina.', 'Vero: non sente i rintocchi.'],
				['6', 'Sotto la chiesa vecchia c\'è il tesoro del paese.', 'Falso, ma attira gli sciacalli.']
			),
			h3('La prima mezzanotte'),
			p("Mostra subito il pericolo: i personaggi sono svegli e vedono una dozzina di persone scendere in camicia da notte verso la riva. Chi dorme e sente la campana fa un tiro salvezza su Saggezza con CD 11: se fallisce è @condizione[Charmed|affascinato] e cammina verso l'acqua finché non viene svegliato con uno schiaffo o una secchiata."),
			h3('Il conto alla rovescia'),
			ul('**Prima notte:** una dozzina di camminatori; senza aiuto ne annegano due.', '**Seconda notte:** tutto il porto; senza aiuto ne annegano sei.', '**Terza notte:** mezza cittadina; il lago si prende chi non è stato legato o svegliato.'),
			h('Atto 2: il campanile'),
			p("Tessa porta i personaggi al [[Il Campanile Sommerso]] prima di mezzanotte. Dentro trovano i morti, la prova del delitto e Oddone, che crede ancora di suonare l'allarme: i rintocchi chiamano gli abitanti a una messa che non finirà mai."),
			h('Atto 3: il registro'),
			p("Con il registro di Oddone in mano, i personaggi decidono cosa farne. Bruno li aspetta al molo con due @mostro[Guard|guardie] e un'offerta: 100 monete d'oro per il libro. Le guardie sono di Acquaferma, e se il registro viene letto ad alta voce abbassano le lance."),
			table(
				['Scelta', 'Conseguenza'],
				['Il registro viene letto in piazza', 'La Compagnia crolla, Bruno è processato e le paratie si chiudono. Acquaferma però perde la sua ricchezza, e qualcuno ne incolperà i personaggi.'],
				['Il registro viene venduto a Bruno', 'I personaggi hanno un protettore potente e un segreto che non possono più raccontare. Il lago continua a calare.'],
				['Il registro serve da ricatto', 'Bruno riduce le vendite d\'acqua e paga in silenzio, per ora. Sa chi sono i personaggi.']
			)
		],
		image: {
			...COVER,
			prompt: 'A half-drowned medieval stone bell tower rising from a still black mountain lake at midnight, pale waterlines on its walls, slow ripples spreading from it under a thin moon, a tiny rowboat with one shuttered lantern approaching, distant sleepwalkers in white nightclothes wading from the shore'
		}
	},
	{
		title: 'Nives Sartori',
		category: 'campana-png',
		visibility: 'players',
		icon: 'mug',
		tags: ['Alleati'],
		fields: [
			['Specie', '@specie[Human|Umana]'],
			['Ruolo', "Locandiera dell'Anguilla Storta"],
			['Allineamento', 'Neutrale buona'],
			['Luogo', '[[Acquaferma]]']
		],
		body: [
			h('Aspetto'),
			p("Una donna robusta sulla cinquantina, con i capelli ramati e grigi raccolti in un fazzoletto e il grembiule sempre infarinato. Da tre notti non dorme, e si vede."),
			h('Carattere'),
			p("Sbrigativa e generosa: dà da mangiare prima di fare domande. Parla forte per non far sentire che ha paura. «Prima mangi, poi mi dici perché dovrei fidarmi di te.»"),
			h('Relazioni'),
			ul("Suo figlio Tobia è stato ripescato dal lago da [[Tessa Mezzaluna]]: da allora dorme legato al letto.", "Deve alla [[Compagnia delle Chiuse]] due anni di affitto, e [[Bruno Caligo]] finora non li ha chiesti."),
			secret("Sua nonna era di Acquaferma Vecchia. Nives conserva una lista di nomi che in famiglia si recita a bassa voce nell'anniversario dell'inondazione: quarantuno nomi, gli stessi del registro.", "Se i personaggi portano il registro in piazza, è lei a leggerlo per prima.")
		],
		image: {
			...PORTRAIT,
			prompt: 'A sturdy woman in her early fifties, innkeeper, greying auburn hair tied in a kerchief, flour-dusted apron over a brown wool dress, tired kind eyes, holding a ceramic jug, firelit tavern behind her with a carved wooden eel hanging from a beam'
		}
	},
	{
		title: 'Bruno Caligo',
		category: 'campana-png',
		visibility: 'players',
		icon: 'key',
		tags: ['Compagnia delle Chiuse'],
		fields: [
			['Specie', '@specie[Human|Umana]'],
			['Ruolo', 'Gran Chiusaio'],
			['Allineamento', 'Legale neutrale'],
			['Luogo', '[[Acquaferma]]'],
			['Fazione', '[[Compagnia delle Chiuse]]']
		],
		body: [
			h('Aspetto'),
			p("Sessantun anni, magro, barba corta e argentata. Porta una giacca verde scuro con i bottoni d'ottone e alla cintura un anello di chiavi di ferro, che tocca quando riflette."),
			h('Carattere'),
			p("Cortese, paziente, mai una parola di troppo. Ricorda il nome di tutti e quello dei loro debiti. «Acquaferma mangia grazie a quella diga. Ricordatelo, quando sentirai le storie.»"),
			h('Relazioni'),
			ul("Comanda di fatto [[Acquaferma]] come capo della [[Compagnia delle Chiuse]].", "[[Renzo Bracadoro]] era una delle sue guardie: lo ha congedato senza spiegazioni.", "Tollera il contrabbando di [[Tessa Mezzaluna]] finché gli torna utile."),
			secret("Fu suo padre Ettore a dare l'ordine di aprire le paratie. Bruno lo sa da sempre, e ha trovato la lettera di Ettore citata nei conti: l'originale è rimasto nella sacrestia del campanile.", "È lui a far vendere l'acqua di notte. Se serve usa le statistiche di un @mostro[Noble|nobile]: non combatte, compra."),
		],
		image: {
			...PORTRAIT,
			prompt: 'A lean man of about sixty, neat silver hair and short beard, dark green wool coat with brass buttons, a heavy ring of iron keys at his belt, courteous smile that does not reach his eyes, wood-panelled office behind him, a window showing a great stone dam'
		}
	},
	{
		title: 'Tessa Mezzaluna',
		category: 'campana-png',
		visibility: 'players',
		icon: 'wave',
		tags: ['Alleati'],
		fields: [
			['Specie', '@specie[Halfling]'],
			['Ruolo', 'Barcaiola e contrabbandiera'],
			['Allineamento', 'Caotica neutrale'],
			['Luogo', '[[Acquaferma]]']
		],
		body: [
			h('Aspetto'),
			p("Halfling sulla quarantina, bruciata dal sole, con i ricci neri sotto un cappello di tela cerata. Rema in piedi e non porta mai una lanterna accesa, se può evitarlo."),
			h('Carattere'),
			p("Diffidente, ironica, puntuale. Fa pagare tutto tranne i salvataggi. «Ti porto fin là. A tornare indietro ci pensiamo se ci arrivi.»"),
			h('Relazioni'),
			ul("Sorella maggiore di [[Pip Mezzaluna]], che ha tirato fuori dai guai più volte di quante lui ricordi.", "Ha ripescato Tobia, il figlio di [[Nives Sartori]].", "Conosce ogni secca del lago fino al [[Il Campanile Sommerso|campanile]]."),
			secret("Trasporta sotto costa i contabili della [[Compagnia delle Chiuse]] e sa quanti barconi escono ogni notte. Non lo dirà finché non si fida.", "Aspetta i personaggi alla finestra della cella campanaria fino all'alba. Se la campana smette di suonare e l'acqua sale, va a prenderli alla finestra più bassa che trova.")
		],
		image: {
			...PORTRAIT,
			prompt: 'A small halfling woman around forty, sun-weathered skin, curly black hair under an oilcloth hat, wry guarded expression, standing in a narrow wooden rowboat with a long oar, reeds and dark lake water at dusk behind her, a shuttered unlit lantern at her feet'
		}
	},
	{
		title: 'Oddone il Campanaro',
		category: 'campana-png',
		visibility: 'master',
		icon: 'skull',
		tags: ['Antagonisti'],
		fields: [
			['Specie', '@mostro[Specter|Spettro]'],
			['Ruolo', 'Campanaro di Acquaferma Vecchia'],
			['Allineamento', 'Caotico neutrale'],
			['Luogo', '[[Il Campanile Sommerso]]']
		],
		body: [
			h('Aspetto'),
			p("Un vecchio sagrestano trasparente, verde come l'acqua di fondo, con le mani serrate su una corda che non si consuma. Attorno a lui l'acqua scorre verso l'alto. Apre la bocca per gridare, e al posto della voce si sente la campana."),
			h('Carattere'),
			p("Non odia nessuno: crede che sia ancora quella notte. I suoi rintocchi sono un allarme, e ogni abitante che scende nel lago per lui è uno che finalmente ha sentito. Attacca chi cerca di fermare la corda."),
			h('Relazioni'),
			ul("I morti della chiesa sono i suoi compaesani: li protegge e loro lo proteggono.", "Riconosce il sigillo della [[Compagnia delle Chiuse]] e il nome Caligo: sentirli lo fa infuriare."),
			h('Tattiche'),
			p("Usa le statistiche di uno @mostro[Specter|spettro]. Passa attraverso la campana per raggiungere chi sta leggendo il registro, e il suo risucchio riduce i punti ferita massimi: al 2° livello tre colpi mettono in crisi chiunque."),
			h('Come finisce'),
			ul('**Sconfitto:** la corda si spezza e i rintocchi cessano, ma nelle notti di luna qualcuno giura di sentirli ancora.', '**Liberato:** leggere ad alta voce i quarantuno nomi del registro richiede tre azioni in tutto, anche di personaggi diversi. Alla terza Oddone lascia la corda, chiede «Sono arrivati tutti?» e svanisce.')
		],
		image: {
			...PORTRAIT,
			prompt: 'A translucent pale green ghost of an old bell-ringer in a tattered sexton robe, hollow eyes, mouth open in a silent shout, bony hands gripping a frayed rope, water and drifting silt flowing upward around him, a dark flooded crypt behind him'
		}
	},
	{
		title: 'Renzo Bracadoro',
		category: 'campana-personaggi',
		visibility: 'players',
		icon: 'swords',
		tags: ['Pregenerati'],
		fields: [
			['Giocatore', 'Da assegnare'],
			['Specie', '@specie[Human|Umano]'],
			['Classe', '@classe[Fighter|Guerriero] 2'],
			['Background', '@background[Soldier|Soldato]'],
			['Allineamento', 'Legale buono']
		],
		body: [
			h('Aspetto'),
			p("Trentadue anni, tarchiato, il naso rotto due volte. Porta ancora la cotta di maglia della guardia della diga, con lo stemma raschiato via dalla sopravveste."),
			h('Storia'),
			p("Ha fatto la guardia alla diga per sette anni, finché non ha chiesto perché i barconi partissero solo di notte. La settimana dopo [[Bruno Caligo]] lo ha congedato con una stretta di mano e tre mesi di paga."),
			h('Obiettivi'),
			ul("Scoprire che cosa nasconde la [[Compagnia delle Chiuse]].", "Proteggere gli ex compagni di turno, che non sanno in cosa sono finiti."),
			h('Scheda rapida'),
			table(
				['CA', 'PF', 'FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'],
				['18', '20', '16', '13', '15', '10', '13', '8']
			),
			p("**Spada lunga:** +5 a colpire, 1d8+5 taglienti (con lo scudo). Una volta per riposo può curarsi da solo e fare un'azione in più. È il muro del gruppo: resta davanti e tiene occupati i nemici.")
		],
		image: {
			...PORTRAIT,
			prompt: 'A stocky human man of thirty-two, short dark hair, twice-broken nose, steady honest eyes, worn chain mail under a tabard with its emblem scratched away, longsword and round wooden shield, a great stone dam in grey morning light behind him'
		}
	},
	{
		title: 'Sibilla Vanni',
		category: 'campana-personaggi',
		visibility: 'players',
		icon: 'candle',
		tags: ['Pregenerati'],
		fields: [
			['Giocatore', 'Da assegnare'],
			['Specie', '@specie[Dwarf|Nana]'],
			['Classe', '@classe[Cleric|Chierica] 2'],
			['Background', '@background[Acolyte|Accolita]'],
			['Allineamento', 'Neutrale buona']
		],
		body: [
			h('Aspetto'),
			p("Nana dall'età indefinibile, con trecce color rame strette da piccoli anelli d'argento. Viaggia con un mantello grigio da pellegrina e una candela sempre in tasca."),
			h('Storia'),
			p("Sua nonna fu tra i pochi sopravvissuti di Acquaferma Vecchia e le insegnò il Canto delle Acque, un inno che nessuno canta più. Sibilla è venuta ad [[Acquaferma]] per pregare sul lago, e l'ha trovato più basso di quanto la nonna raccontasse."),
			h('Obiettivi'),
			ul("Dare pace ai morti del paese vecchio.", "Sapere perché sua nonna non volle mai più vedere la diga."),
			h('Scheda rapida'),
			table(
				['CA', 'PF', 'FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'],
				['15', '19', '13', '10', '14', '8', '17', '13']
			),
			p("**Mazza:** +3 a colpire, 1d6+1 contundenti. **Incantesimi:** CD 13, tre slot di 1° livello. Conosce @incantesimo[Sacred Flame|Fiamma Sacra] e @incantesimo[Guidance|Guida], e tiene pronti @incantesimo[Bless|Benedizione], @incantesimo[Cure Wounds|Cura Ferite] e @incantesimo[Shield of Faith|Scudo della Fede]. Due volte per riposo può scacciare i non morti.")
		],
		image: {
			...PORTRAIT,
			prompt: 'An adult dwarf woman cleric, copper braids bound with small silver rings, calm stern eyes, chain shirt under a grey pilgrim cloak, a mace at her belt, cupping a lit candle in both hands, misty lakeshore at dawn behind her'
		}
	},
	{
		title: 'Pip Mezzaluna',
		category: 'campana-personaggi',
		visibility: 'players',
		icon: 'coins',
		tags: ['Pregenerati'],
		fields: [
			['Giocatore', 'Da assegnare'],
			['Specie', '@specie[Halfling]'],
			['Classe', '@classe[Rogue|Ladro] 2'],
			['Background', '@background[Criminal|Criminale]'],
			['Allineamento', 'Caotico buono']
		],
		body: [
			h('Aspetto'),
			p("Halfling sulla ventina, lentiggini, un sorriso che arriva sempre un attimo prima delle scuse. Ha le tasche cucite all'interno della giacca e un rotolo di grimaldelli nello stivale."),
			h('Storia'),
			p("Cresciuto sulla barca di sua sorella [[Tessa Mezzaluna]], ha scoperto presto che le serrature rendono più delle reti. Ora deve 60 monete d'oro alla [[Compagnia delle Chiuse]], e il debito raddoppia a fine mese."),
			h('Obiettivi'),
			ul("Trovare il modo di cancellare quel debito.", "Non farlo sapere a Tessa."),
			h('Scheda rapida'),
			table(
				['CA', 'PF', 'FOR', 'DES', 'COS', 'INT', 'SAG', 'CAR'],
				['14', '17', '8', '17', '14', '12', '10', '14']
			),
			p("**Spada corta o arco corto:** +5 a colpire, 1d6+3 perforanti, più 1d6 se ha vantaggio o un alleato accanto al bersaglio. Può nascondersi o allontanarsi con un'azione bonus. È lui ad aprire le serrature e a trovare le trappole.")
		],
		image: {
			...PORTRAIT,
			prompt: 'A small slender halfling man in his twenties, freckles, curly brown hair, mischievous grin, dark leather armor and a short hooded cape, a coin balanced on his knuckles, short sword at his hip, moonlit wooden dock behind him'
		}
	},
	{
		title: 'Acquaferma',
		category: 'campana-luoghi',
		visibility: 'players',
		icon: 'house',
		tags: ['Lago Tacito'],
		fields: [
			['Tipo', 'Cittadina'],
			['Regione', 'Valle del lago Tacito'],
			['Abitanti', 'Circa 1.200'],
			['Governante', '[[Bruno Caligo]]']
		],
		body: [
			h('Descrizione'),
			p("Tetti rossi e case di pietra stretti attorno a un porto, in fondo a una valle chiusa da una diga enorme. Il lago Tacito ha reso ricca Acquaferma: pesca, mulini e soprattutto l'acqua venduta alle città di pianura. Quest'anno però il livello è sceso di dieci metri, le barche poggiano sul fango e sulle rocce resta una riga pallida."),
			p("Tutti conoscono la storia del paese vecchio, finito sott'acqua nell'inondazione di sessant'anni fa. Pochi ne parlano, e ora che la punta del campanile è tornata a vedersi ancora meno. Da tre notti nessuno dorme tranquillo: di giorno si sentono soltanto i martelli di chi inchioda le porte."),
			h('Luoghi notevoli'),
			ul("**L'Anguilla Storta:** la locanda di [[Nives Sartori]], il posto migliore per voci e minestra.", "**La Casa delle Chiuse:** palazzo severo sul molo, sede della [[Compagnia delle Chiuse]].", "**La Diga:** due ore di cammino; l'accesso è sorvegliato giorno e notte.", "**Il Molo Basso:** dove ormeggia [[Tessa Mezzaluna]], ora un pontile sospeso sulla melma."),
			h('Personaggi'),
			ul("[[Nives Sartori]], locandiera.", "[[Bruno Caligo]], Gran Chiusaio.", "[[Tessa Mezzaluna]], barcaiola."),
			secret("Il prezzo della cera d'api è triplicato in due giorni: la bottega del droghiere è il primo indizio che qualcuno sa come non sentire la campana. Il droghiere fa da informatore a [[Bruno Caligo]].", "I pochi vecchi rimasti ricordano che la notte dell'inondazione non pioveva: è il primo indizio che non fu un incidente.")
		],
		image: {
			...COVER,
			prompt: 'A small alpine lakeside town at dusk seen from the water, red tile roofs and stone houses crowded around a little harbor, an enormous stone dam closing the valley in the distance, a pale ring on the rocks showing the lake has dropped, fishing boats stranded on cracked mud, the first lantern lights in the windows'
		}
	},
	{
		title: 'Compagnia delle Chiuse',
		category: 'campana-fazioni',
		visibility: 'players',
		icon: 'crown',
		tags: ['Compagnia delle Chiuse'],
		fields: [
			['Capo', '[[Bruno Caligo]]'],
			['Sede', 'Casa delle Chiuse, [[Acquaferma]]'],
			['Obiettivi', "Vendere l'acqua del lago e tenere in piedi la diga"],
			['Alleati', 'Mercanti di pianura'],
			['Nemici', 'Contrabbandieri, debitori']
		],
		body: [
			h('Descrizione'),
			p("La gilda che costruì la diga e che da sessant'anni ne tiene le chiavi. Decide il livello del lago, gli affitti del porto e il prezzo dell'acqua: ad [[Acquaferma]] quasi tutti lavorano per lei o le devono qualcosa."),
			h('Membri'),
			ul("[[Bruno Caligo]], Gran Chiusaio.", "I chiusai, una dozzina di tecnici fedeli e ben pagati.", "Una ventina di guardie, che usano le statistiche della @mostro[Guard|guardia].", "Ex membro: [[Renzo Bracadoro]]."),
			h('Storia'),
			p("Fondata da Ettore Caligo per portare l'acqua in pianura. Dopo l'inondazione risarcì i sopravvissuti di tasca propria, e per questo in cittadina il suo nome è ancora rispettato."),
			secret("L'inondazione non fu un incidente: Ettore fece aprire le paratie perché il paese rifiutava di vendere. La prova è una sua lettera, conservata nella sacrestia del [[Il Campanile Sommerso|campanile]].", "La Compagnia è sull'orlo della bancarotta e ha già venduto l'acqua dei prossimi tre anni. Per questo il lago cala: se le consegne si fermano, Bruno è rovinato.")
		],
		image: {
			...EMBLEM,
			prompt: 'A guild emblem embossed on an old brass seal: a dam sluice gate crossed by two iron keys above three wavy lines of water, resting on dark oak, oxidized edges, single candle light from one side'
		}
	},
	{
		title: 'Il Campanile Sommerso',
		category: 'campana-luoghi',
		visibility: 'master',
		icon: 'spiral',
		tags: ['Lago Tacito', 'Dungeon'],
		fields: [
			['Tipo', 'Chiesa sommersa'],
			['Regione', 'Valle del lago Tacito'],
			['Stanze', 'Cinque'],
			['Abitanti', '[[Oddone il Campanaro]] e i suoi morti']
		],
		body: [
			h('Descrizione'),
			p("Della chiesa di Acquaferma Vecchia resta fuori dal lago solo la cima del campanile. Sotto, la volontà di [[Oddone il Campanaro]] tiene fuori l'acqua: sta contro finestre e porte come vetro nero, e dietro ci passano i pesci. Sul pavimento non ne arriva più di un palmo."),
			callout('tip', "Si entra dall'alto e si scende. Dopo la stanza 3 c'è un buon posto per un riposo breve, nella sacrestia: se gioci in due sessioni, fermati lì."),
			h('1. La cella campanaria'),
			quote("La finestra è abbastanza larga per una persona alla volta. Dentro non c'è nessuna campana: restano le travi spezzate e una corda spessa come un polso, tesa, che scende dritta nel buio da un buco nel pavimento. Ogni tanto si muove da sola."),
			p("Tagliare la corda è impossibile: si ricompone nel giro di un respiro. Una prova di Indagare con CD 10 sulle travi rivela che la campana è caduta attraverso i piani, sessant'anni fa."),
			h('2. La scala a chiocciola'),
			quote("I gradini di legno girano attorno alla corda. Oltre le feritoie l'acqua nera sta ferma, e pesci pallidi vi guardano passare."),
			p("Il sesto gradino è marcio. Una prova di Percezione con CD 13 lo nota; chi non lo vede fa un tiro salvezza su Destrezza con CD 12 o cade per 3 metri, subendo 1d6 danni contundenti e finendo @condizione[Prone|prono]. Il tonfo sveglia i due @mostro[Swarm of Rats|sciami di ratti] nel pianerottolo sottostante."),
			h('3. La navata'),
			quote("Ventuno figure siedono nei banchi con l'acqua alle caviglie, la testa bassa, le mani in grembo. Sono pazienti. Stanno aspettando."),
			p("Solo tre di loro sono @mostro[Zombie|zombi]: gli altri sono cadaveri. Si alzano appena qualcuno parla ad alta voce o tocca l'altare. Attraversare in silenzio richiede una prova di Furtività con CD 11 per ognuno. Il Canto delle Acque di [[Sibilla Vanni]], o una prova di Religione con CD 12, li fa tornare a sedere."),
			h('4. La sacrestia'),
			quote("Una porta di quercia, intatta. Dentro l'aria è secca e sa di cera, come se qualcuno fosse uscito un minuto fa."),
			p("Niente la attraversa, nemmeno i morti: è il luogo più sicuro del dungeon. In un armadio chiuso (Rapidità di mano con CD 13, o si forza con Forza CD 15) ci sono:"),
			ul("**Il registro della parrocchia**, con i quarantuno nomi.", "**La lettera di Ettore Caligo** al parroco, col sigillo della [[Compagnia delle Chiuse]]: «Vendete entro domani, o alla terza ora di notte le paratie si apriranno comunque».", "Due @oggetto[Potions of Healing|pozioni di guarigione] e calici d'argento per 60 monete d'oro."),
			h('5. La cripta della campana'),
			quote("Il pavimento della chiesa è sfondato. In fondo al cratere la campana, grande come un carro, poggia di traverso sulle tombe. La corda si avvolge attorno alle mani di un vecchio trasparente che tira, e tira, e tira."),
			p("[[Oddone il Campanaro]] combatte con due @mostro[Zombie|zombi]: uno scontro di difficoltà bassa, reso più duro dai rintocchi. Le sue tattiche e i due finali sono nella sua pagina."),
			p("**Il rintocco.** Al conteggio 20 dell'iniziativa suona la campana: ogni creatura viva fa un tiro salvezza su Saggezza con CD 11. Se fallisce, nel suo prossimo turno usa tutto il movimento per avvicinarsi alla campana. Chi ha le orecchie tappate con la cera non fa il tiro salvezza."),
			callout('warning', "Appena la campana tace, l'acqua riprende a entrare. I personaggi hanno dieci minuti per risalire: niente tiri, solo la scala, il buio e il rumore della chiesa che si riempie.")
		],
		image: {
			...COVER,
			prompt: 'Interior of a drowned medieval church, ankle-deep black water on the floor, cracked pillars and rotted pews with hunched seated figures, a huge bronze bell fallen at an angle through the broken floor, a thick rope rising into darkness, tall windows holding back a wall of dark lake water with pale fish drifting past, torchlight'
		}
	}
];

// --- Pacchetto e prompt ---

const counts = { pages: PAGES.length, categories: CATEGORIES.length };
const packPages = PAGES.map(({ title, category, visibility, icon, tags, fields, body, image }) => ({
	slug: slugify(title),
	title,
	content: { type: 'doc', content: body },
	fields: fields.map(([label, value]) => ({ label, value })),
	visibility,
	category,
	tags,
	template: null,
	icon,
	// Una tinta unita tiene il posto solo a chi avrà una copertina: i ritratti stanno nella colonna a lato.
	cover: image.where !== COVER.where ? null : { image: null, color: COVER_COLORS[category], y: 50 },
	kind: 'page'
}));

const json = (v) => strToU8(JSON.stringify(v, null, 2));
const here = new URL('.', import.meta.url).pathname;
const pack = zipSync(
	{
		'manifest.json': json({ format: 'crooked-shelf-world', version: 2, name: NAME, secrets: true, counts }),
		'pages.json': json(packPages),
		'categories.json': json(CATEGORIES)
	},
	{ level: 6 }
);
writeFileSync(`${here}la-campana-sommersa.shelf`, pack);

const prompts = PAGES.map(({ title, image }) => `## ${title}\n\n**Dove va:** ${image.where} · **Formato:** ${image.ratio}\n\n\`\`\`text\n${image.prompt}, ${image.framing}, ${STYLE}\n\`\`\``);
writeFileSync(
	`${here}prompt-immagini.md`,
	`# ${NAME}: prompt per le immagini

Un prompt per ogni pagina dell'avventura, in inglese perché i generatori lo capiscono meglio. Ognuno è completo: si copia così com'è. Lo stile in fondo è sempre lo stesso, così le immagini stanno bene insieme.

La copertina è una fascia bassa e larga: se il generatore non arriva a 21:9, usa il formato più largo che ha e riposiziona l'immagine dalla pagina. La prima immagine della colonna a lato è anche quella della galleria e delle anteprime dei collegamenti.

Questo file e \`la-campana-sommersa.shelf\` si rigenerano da \`build.mjs\`.

${prompts.join('\n\n')}
`
);
console.log(`${PAGES.length} pagine, ${pack.length} byte`);

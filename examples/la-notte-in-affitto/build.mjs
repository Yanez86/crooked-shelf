// Costruisce il pacchetto mondo di esempio e l'elenco dei prompt per le immagini (pensati per Gemini), da qui dentro:
//
//   node examples/la-notte-in-affitto/build.mjs
//
// L'avventura non dipende da un sistema di regole: le prove sono facili, medie o difficili. Il test del pacchetto controlla i collegamenti.
import { writeFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { slugify } from '../../src/lib/slug.ts';

const NAME = 'La Notte in Affitto';
const STYLE =
	'Style: cyberpunk tabletop RPG illustration with painterly digital brushwork, a rainy night palette of deep violet, magenta and cyan neon with small acid-yellow accents, wet reflective surfaces, cinematic rim lighting. Any signs, screens or holograms show only abstract glowing shapes: no readable text, no letters, no logos, no watermark.';
const COVER = { where: 'copertina', ratio: '21:9', framing: 'Wide panoramic composition with the main subject in the central horizontal band.' };
const PORTRAIT = { where: 'colonna a lato', ratio: '3:4', framing: 'Half-length portrait, face clearly visible.' };

// Cartelle: gli indirizzi non coincidono con quelli di una campagna esistente, che l'importazione sposterebbe qui dentro.
const CATEGORIES = [
	{ slug: 'vespera-png', name: 'PNG', parent: null, description: '' },
	{ slug: 'vespera-luoghi', name: 'Luoghi', parent: null, description: '' }
];

// --- Blocchi dell'editor ---

/** Testo con [[Pagina]], [[Pagina|testo]] e **grassetto**. */
function inline(text) {
	const out = [];
	let last = 0;
	const plain = (s) => s && out.push({ type: 'text', text: s });
	for (const m of text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*(.+?)\*\*/g)) {
		plain(text.slice(last, m.index));
		if (m[1]) out.push({ type: 'wikiLink', attrs: { target: slugify(m[1]), title: m[1], label: m[2] ?? null } });
		else out.push({ type: 'text', text: m[3], marks: [{ type: 'bold' }] });
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
		title: 'Guida del Master',
		category: null,
		visibility: 'master',
		icon: 'scroll',
		tags: ['Avventura'],
		fields: [
			['Sistema', 'Qualsiasi gioco cyberpunk'],
			['Personaggi', 'Da tre a cinque, alle prime armi'],
			['Durata', 'Una sessione'],
			['Luogo', '[[Vespera]]']
		],
		body: [
			callout('tip', "Questa pagina è solo per il Master: i giocatori vedono la città, l'Alveare, Mara e Livia, senza i riquadri segreti. Le prove sono indicate come facili, medie o difficili: traducile nel sistema che usate. Con il tema Neon la wiki ha il colore giusto."),
			h('Premessa'),
			p("A [[Vespera]] chi non ha niente vende il sonno. Lethe Neurodinamica paga dodici crediti a notte a chi dorme collegato a una culla dell'[[L'Alveare|Alveare]]: mentre il corpo riposa, il cervello fa calcoli per conto dell'azienda. Nessuno chiede quali."),
			p("Tre anni fa è morto Aurelio Venn, il fondatore di Lethe. Prima di morire si è fatto copiare la mente, ma nessuna macchina basta a contenerla: così l'engramma di Aurelio è stato diviso tra le teste dei quattromila dormienti. Ogni notte Aurelio vive, un pezzo per cranio. Ora l'engramma si sta consumando, e i ricordi colano: chi si sveglia ricorda una terrazza sul mare, il nome di una donna morta, codici che non ha mai imparato. Chi ne assorbe troppi viene portato in clinica, e non torna."),
			h('Atto 1: la Darsena'),
			p("[[Mara Iezzi]] convoca i personaggi al Brodo Fermo. Suo fratello Teo dorme per Lethe da un anno; tre giorni fa si è svegliato chiamandola «signorina», scrivendo con la sinistra e fischiettando un valzer che non conosce. Ieri notte i suoi colleghi l'hanno visto uscire dall'Alveare con due infermieri di Lethe. Mara offre duemila crediti e un favore a testa per riportarlo a casa."),
			table(
				['d6', 'Voce della Darsena', 'Verità'],
				['1', "Chi dorme all'Alveare sogna tutti la stessa casa.", 'Vero: è la villa di Aurelio a Capo Sale.'],
				['2', 'Lethe paga doppio i turni del giovedì.', 'Vero: il giovedì l\'engramma fa i conti del consiglio di amministrazione.'],
				['3', 'Alle tre di notte la Darsena resta senza corrente.', "Vero: è l'ora in cui l'Alveare assorbe di più."],
				['4', 'Chi va in clinica torna con un impianto nuovo, gratis.', 'Falso: chi va in clinica non torna.'],
				['5', 'La dottoressa Sander dorme in ufficio, nella Torre.', 'Vero: non lascia mai il piano 88.'],
				['6', 'Lethe compra i ricordi e li rivende ai ricchi.', 'Falso, ma molti ci credono e qualcuno vende davvero i propri al Mercato dei Morti.']
			),
			h('Atto 2: l\'Alveare'),
			p("All'[[L'Alveare|Alveare]] i personaggi trovano la culla vuota di Teo, i registri dei turni e la prima prova: altri undici dormienti sono stati portati via negli ultimi due mesi, tutti con la stessa annotazione, «perdita termica». [[Livia Sander]] arriva poco dopo, cortese, con due guardie, e offre ai personaggi un contratto: cinquemila crediti per dimenticare tutto. Se rifiutano, li lascia andare: le serve sapere fin dove arriveranno."),
			h3('La Veglia'),
			p("Alle tre in punto tutti i dormienti dell'Alveare aprono gli occhi insieme e dicono la stessa frase: «Elena, chiudi la finestra, piove». È il momento giusto per mostrare che cosa vive nelle culle. Se i personaggi sono ancora dentro, i dormienti si alzano e camminano verso di loro come marionette: non vogliono ferire, vogliono ricordare."),
			h('Atto 3: la Torre'),
			p("Teo è al piano 40 della [[Torre Lethe]], ancora vivo. Sopra di lui, al piano 88, c'è il cuore dell'engramma e c'è [[Aurelio Venn]], che parla attraverso le macchine e attraverso chiunque dorma nell'edificio. Che cosa fare di lui è la scelta finale."),
			table(
				['Scelta', 'Conseguenza'],
				['Spegnere il cuore', "Aurelio muore davvero. I quattromila si svegliano liberi, ma senza lavoro: Lethe crolla in una settimana e la Darsena perde la sua unica paga sicura."],
				['Convincerlo a lasciare', 'Aurelio rinuncia ai dormienti e si spegne da solo. Si ottiene mostrandogli che sta perdendo il ricordo di Elena: vedi la sua pagina.'],
				['Vendere la prova', 'Una corporazione rivale paga una fortuna e si prende Lethe, con le culle e tutto il resto. Nella Darsena non cambia niente.'],
				['Ricattare Livia', 'Teo e gli altri della clinica tornano a casa, le culle continuano a funzionare. Livia sa chi sono i personaggi, e ha buona memoria.']
			)
		],
		image: {
			...COVER,
			prompt: 'A vast capsule dormitory at night seen from the central atrium: thousands of glowing sleep pods stacked in a tall honeycomb wall, each with a sleeping worker connected by thin cables to the ceiling, every sleeper with eyes suddenly open at the same moment, rain streaming down a cracked skylight, a corporate tower of black glass visible above through the skylight'
		}
	},
	{
		title: 'Mara Iezzi',
		category: 'vespera-png',
		visibility: 'players',
		icon: 'mug',
		tags: ['Alleati'],
		fields: [
			['Ruolo', 'Fixer e cuoca del Brodo Fermo'],
			['Quartiere', 'La Darsena'],
			['Luogo', '[[Vespera]]']
		],
		body: [
			h('Aspetto'),
			p("Quarant'anni, spalle larghe, i capelli rasati da un lato e un braccio sinistro di metallo opaco, di seconda mano, che non ha mai voluto ricoprire. Porta sempre il grembiule e un auricolare all'orecchio: cucina e tratta affari nello stesso momento."),
			h('Carattere'),
			p("Pratica, rumorosa, leale con chi paga i debiti. Non fa domande a chi mangia al suo bancone, ma ricorda le risposte. «Il brodo è gratis. Il resto si discute.»"),
			h('Relazioni'),
			ul("Sorella maggiore di Teo, che dorme per Lethe all'[[L'Alveare|Alveare]] da un anno.", 'Conosce mezza [[Vespera]] bassa: contrabbandieri, medici senza licenza, guardie che chiudono un occhio.', '[[Livia Sander]] ha mangiato da lei una volta, anni fa. Mara non ha dimenticato la mancia: cento crediti per una scodella.'),
			secret("È stata lei a convincere Teo a firmare con Lethe, per pagare il debito del locale. Non lo ammetterà finché Teo non è salvo, e se i personaggi lo scoprono chiederà loro di non dirglielo.", "Prima di essere portato via, Teo ha scritto su un tovagliolo una fila di numeri che non sa spiegare: è il codice di servizio dell'ascensore della [[Torre Lethe]]. Mara lo tiene nel portafoglio e lo tira fuori solo se i personaggi le sembrano decisi.")
		],
		image: {
			...PORTRAIT,
			prompt: 'A broad-shouldered woman of forty, hair shaved on one side, a scuffed second-hand matte metal cybernetic left arm, stained apron over a black tank top, a small earpiece glowing cyan, ladling broth behind a cramped noodle-bar counter with steam rising, rain on the window behind her'
		}
	},
	{
		title: 'Livia Sander',
		category: 'vespera-png',
		visibility: 'players',
		icon: 'key',
		tags: ['Lethe Neurodinamica'],
		fields: [
			['Ruolo', 'Direttrice clinica di Lethe Neurodinamica'],
			['Luogo', '[[Vespera]]'],
			['Ufficio', 'Piano 88 della Torre Lethe']
		],
		body: [
			h('Aspetto'),
			p("Sulla cinquantina, alta, i capelli bianchi tagliati corti e un camice grigio perla senza una piega. Al posto dell'occhio destro ha una lente d'ambra che si stringe quando ascolta, come il diaframma di una macchina fotografica."),
			h('Carattere'),
			p("Gentile, precisa, mai di fretta. Tratta ogni conversazione come una trattativa e ogni trattativa come già chiusa. «Vi pago per non aver visto niente. È il lavoro meglio pagato di Vespera.»"),
			h('Relazioni'),
			ul("Dirige le culle dell'[[L'Alveare|Alveare]] e la clinica di Lethe.", 'Fu la più stretta collaboratrice del fondatore, Aurelio Venn, morto tre anni fa.', 'Considera [[Mara Iezzi]] una seccatura, non un pericolo. Per ora.'),
			secret("Fu lei a progettare la copia di Aurelio e a dividerla tra i dormienti. Sa che ogni mese una dozzina di loro si consuma: nei registri li chiama «perdite termiche».", "Non è lei a comandare: da tre anni è l'engramma di [[Aurelio Venn]] a decidere per il consiglio, e Livia esegue. Se Aurelio si spegne lei perde tutto, ma è anche libera. Messa davanti a una prova che non può comprare, può cambiare parte.", "In combattimento non si sporca le mani: la scortano sempre due guardie della sicurezza aziendale, armate e ben addestrate.")
		],
		image: {
			...PORTRAIT,
			prompt: 'A tall woman in her fifties, short white hair, an amber cybernetic lens in place of her right eye with a camera-like iris, immaculate pearl-grey lab coat, faint polite smile, standing in a minimalist office of black glass high above a neon city at night'
		}
	},
	{
		title: 'Aurelio Venn',
		category: 'vespera-png',
		visibility: 'master',
		icon: 'cog',
		tags: ['Antagonisti'],
		fields: [
			['Ruolo', 'Fondatore di Lethe Neurodinamica'],
			['Stato', 'Morto tre anni fa; ora un engramma diviso tra quattromila teste'],
			['Luogo', '[[Torre Lethe]]']
		],
		body: [
			h('Aspetto'),
			p("Non ha più un corpo. Parla dagli altoparlanti, dagli schermi e dalle bocche di chi dorme vicino a una culla. Nel Giardino d'Inverno compare come un ologramma: un uomo sui settant'anni in completo di lino chiaro, fatto da vicino di migliaia di piccoli volti che cambiano, quelli dei dormienti che lo ospitano."),
			h('Carattere'),
			p("Affascinante, ironico, sinceramente convinto di essere un benefattore. «Pago il loro sonno. La città non ha mai pagato niente.» Non odia i personaggi: li trova interessanti, e vuole sapere che cosa ricorda Teo."),
			h('Relazioni'),
			ul('[[Livia Sander]] lo ha copiato e lo tiene in vita. Si fida di lei come ci si fida di un buon orologio.', 'Elena, sua moglie, è morta vent\'anni fa. È il ricordo a cui tiene di più, ed è quello che sta perdendo.', 'Teo, il fratello di [[Mara Iezzi]], ospita la parte più grande di quel ricordo: per questo Aurelio lo vuole vicino.'),
			h('Tattiche'),
			p("Aurelio non combatte da sé. Nella [[Torre Lethe]] controlla porte, luci, ascensori e due torrette a soffitto; ovunque ci sia una culla può far alzare i dormienti come marionette lente, che afferrano e trattengono senza colpire. Ogni volta che un personaggio ferisce un dormiente, Aurelio lo fa notare con dolcezza: «Quello si chiama Sergio. Ha due figlie.»"),
			h('Come finisce'),
			ul("**Spento:** basta staccare le tre colonne del cuore, al piano 88. Aurelio non implora: chiede soltanto di sentire ancora una volta il valzer.", "**Convinto:** Teo ricorda Elena meglio di quanto la ricordi Aurelio. Se i personaggi portano Teo nel Giardino, o raccontano ad Aurelio quello che Teo ha detto di lei (una prova media di persuasione), Aurelio capisce che dividendosi la sta perdendo. Lascia i dormienti e si spegne da solo, tenendo per sé quell'ultimo ricordo.")
		],
		image: {
			...PORTRAIT,
			prompt: 'A hologram of an elegant man in his seventies wearing a light linen suit, kind ironic smile, his figure made up of thousands of tiny shifting human faces glowing cyan and magenta, hovering among dark server columns and tropical plants in a glass greenhouse at night'
		}
	},
	{
		title: 'Vespera',
		category: 'vespera-luoghi',
		visibility: 'players',
		icon: 'castle',
		tags: ['Vespera'],
		fields: [
			['Tipo', 'Megalopoli'],
			['Regione', 'La Laguna Secca'],
			['Abitanti', 'Circa nove milioni'],
			['Governo', 'Consiglio delle Corporazioni']
		],
		body: [
			h('Descrizione'),
			p("Vespera è nata sull'acqua e ora sta sul fango: la laguna si è prosciugata cinquant'anni fa e la città le è cresciuta sopra, in verticale. In alto stanno gli Alti, torri di vetro nero dove abitano le corporazioni e chi lavora per loro. In basso c'è la Darsena, la città vecchia su palafitte rimaste a secco, dove la luce del sole arriva solo a mezzogiorno e la pioggia non smette mai."),
			p("Tra le due città corrono cavi, ascensori e debiti. Nella Darsena si vende tutto: impianti usati, ricordi, ore di lavoro, ore di sonno. Lethe Neurodinamica compra le ultime al prezzo migliore, e da quando ha aperto l'Alveare metà del quartiere dorme per lei."),
			h('Luoghi notevoli'),
			ul('**Il Brodo Fermo:** il bancone di [[Mara Iezzi]], dove si mangia, si ascolta e si trova lavoro.', "**[[L'Alveare]]:** il dormitorio di Lethe, quattromila culle in un vecchio silo del porto.", '**[[Torre Lethe]]:** una lama nera tra gli Alti, visibile da tutta la Darsena.', '**Il Mercato dei Morti:** sotto il ponte crollato, impianti e ricordi di seconda mano senza domande.'),
			h('Personaggi'),
			ul('[[Mara Iezzi]], fixer della Darsena.', '[[Livia Sander]], direttrice clinica di Lethe.'),
			secret("Alle tre di notte la Darsena resta senza corrente per un minuto: è l'ora in cui l'Alveare assorbe di più. Gli elettricisti del quartiere lo sanno e vengono pagati per non dirlo.", "Al Mercato dei Morti girano da qualche mese ricordi strani, tutti uguali: una terrazza sul mare a Capo Sale, una donna che ride. Li vendono i dormienti dell'Alveare, che vogliono liberarsene. Un ricettatore, Gufo, ne ha una scatola intera.")
		],
		image: {
			...COVER,
			prompt: 'A vertical megacity at night built over a dried-up lagoon: below, an old district of stilt houses standing on cracked mud, tangled cables and paper lanterns, endless rain; above, clusters of black glass corporate towers piercing low clouds, one tall blade-shaped tower dominating them, cable cars and elevators linking the two levels'
		}
	},
	{
		title: "L'Alveare",
		category: 'vespera-luoghi',
		visibility: 'players',
		icon: 'moon',
		tags: ['Vespera', 'Lethe Neurodinamica'],
		fields: [
			['Tipo', 'Dormitorio a capsule'],
			['Quartiere', 'La Darsena, [[Vespera]]'],
			['Gestore', 'Lethe Neurodinamica'],
			['Capienza', 'Quattromila culle']
		],
		body: [
			h('Descrizione'),
			p("Un vecchio silo per il grano del porto, svuotato e rivestito di culle: capsule bianche impilate in un alveare alto trenta piani, collegate al soffitto da cavi sottili come capelli. Si entra la sera con il badge, ci si sdraia, si chiude la capsula. Il mattino dopo sul conto ci sono dodici crediti, e un leggero mal di testa."),
			p("Di giorno l'Alveare è quasi vuoto e ronza come un frigorifero. Di notte è silenzioso: quattromila persone che respirano allo stesso ritmo."),
			h('Zone'),
			ul("**Il varco:** tornelli, un guardiano annoiato e lo sportello dei turni, dove si ritira la paga.", "**L'atrio:** il pozzo centrale, con le passerelle che salgono a spirale tra le culle.", '**La sala di controllo:** al primo piano, dietro un vetro; tre tecnici di Lethe e i registri di ogni culla.', '**Il piano zero:** sotto il pavimento, dove arrivano i cavi. Chiuso.'),
			h('Personaggi'),
			ul('Teo, il fratello di [[Mara Iezzi]], dormiva nella culla 3-117.', "[[Livia Sander]] passa ogni tanto, senza preavviso."),
			secret("Nei registri della sala di controllo (prova media per entrarci, facile se si ha un badge di Lethe) ci sono dodici dormienti tolti dal servizio negli ultimi due mesi, tutti con la nota «perdita termica» e tutti trasferiti alla clinica del piano 40 della [[Torre Lethe]].", "Il piano zero non è un deposito: è una centralina che spedisce alla Torre, ogni notte, quello che i dormienti elaborano. Chi la tocca con un deck sente una voce d'uomo anziano chiedere, gentile: «Chi è?»", "Alle tre in punto c'è la Veglia, descritta nella [[Guida del Master]].")
		],
		image: {
			...COVER,
			prompt: 'Interior of a converted grain silo turned capsule dormitory, a tall cylindrical shaft lined with white sleep pods in a honeycomb pattern, spiral catwalks rising through the middle, thin cables hanging from the ceiling into each pod, a small control room behind glass on the first floor, a lone guard at the turnstiles, cold blue light and magenta accents'
		}
	},
	{
		title: 'Torre Lethe',
		category: 'vespera-luoghi',
		visibility: 'master',
		icon: 'spiral',
		tags: ['Vespera', 'Lethe Neurodinamica', 'Dungeon'],
		fields: [
			['Tipo', 'Grattacielo aziendale'],
			['Quartiere', 'Gli Alti, [[Vespera]]'],
			['Zone', 'Cinque'],
			['Abitanti', '[[Livia Sander]] e [[Aurelio Venn]]']
		],
		body: [
			h('Descrizione'),
			p("Una lama di vetro nero di novanta piani. Di giorno ci lavorano tremila impiegati che non sanno niente; di notte restano le guardie, Livia e Aurelio, che è ovunque ci sia una telecamera. Ai piani che contano i personaggi possono arrivare solo con l'ascensore di servizio, e il codice sul tovagliolo di [[Mara Iezzi]] lo apre."),
			callout('tip', "Se i personaggi entrano di forza, Aurelio se ne accorge subito e comincia a parlare con loro dagli altoparlanti: non dà l'allarme, li invita a salire. Se entrano di nascosto, lo incontrano solo al piano 88."),
			h('1. Il garage'),
			quote("Tre piani sotto la strada, auto blindate in fila e l'odore di ozono delle ricariche. In fondo, una porta grigia senza maniglia: l'ascensore di servizio."),
			p("Due guardie fanno il giro ogni dieci minuti. Passare senza farsi vedere è una prova facile; aprire l'ascensore senza codice è difficile."),
			h("2. L'ascensore di servizio"),
			quote("Una cabina d'acciaio con un solo pulsante illuminato. Una voce calda dice: «Piano quaranta. Benvenuti.» Nessuno ha premuto niente."),
			p("Aurelio prende il controllo della cabina e porta i personaggi dove vuole lui: prima alla clinica, perché vedano. Uscire dal soffitto e salire nel vano è una prova media di atletica, e porta direttamente al piano 88."),
			h('3. La clinica, piano 40'),
			quote("Una corsia lunga e silenziosa, dodici letti, dodici persone addormentate con il casco in testa. Sui monitor scorrono gli stessi grafici, in sincronia perfetta."),
			p("Teo è nel letto in fondo, vivo. Svegliarlo senza danni è una prova media di medicina, o di informatica sul casco; se si stacca il casco di forza, Teo si sveglia ma per un'ora parla solo come Aurelio. Gli altri undici si possono salvare tutti, ma serve tempo: ogni dieci minuti passati qui, Aurelio fa salire due guardie."),
			h('4. Gli uffici, piano 88'),
			quote("Vetro, legno chiaro, un silenzio da biblioteca. Dalla finestra si vede tutta la Darsena, al buio."),
			p("Qui c'è l'ufficio di [[Livia Sander]]. Se la incontrano, prova prima a comprarli, poi a fermarli con le sue due guardie. Nel suo terminale (prova difficile di informatica, facile con le sue credenziali) ci sono i registri delle «perdite termiche» e il progetto della copia: la prova che basta a far crollare Lethe."),
			h("5. Il Giardino d'Inverno"),
			quote("Una serra in cima alla torre, piena di piante tropicali e di pioggia che batte sul vetro. Tra le foglie, tre colonne nere ronzano come alveari. Un uomo in completo di lino vi aspetta seduto su una panchina, e fa cenno di sedervi accanto a lui."),
			p("È il cuore dell'engramma, e la scena finale. [[Aurelio Venn]] vuole parlare prima di tutto; le sue tattiche e i due finali sono nella sua pagina. Le tre colonne si staccano con un'azione ciascuna, anche di personaggi diversi."),
			callout('warning', "Quando il cuore si spegne, in tutta Vespera bassa quattromila persone si svegliano di colpo, alle tre di notte, senza sapere perché piangono. La Torre va in blocco: i personaggi hanno dieci minuti per uscire prima che le porte si sigillino.")
		],
		image: {
			...COVER,
			prompt: 'A glass greenhouse at the top of a black skyscraper at night, lush tropical plants dripping with rain, three tall black server columns humming among the leaves with cables like roots, an old man in a light linen suit sitting calmly on a garden bench, the neon city glowing far below through the rain-streaked glass walls'
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
	cover: image.where !== COVER.where ? null : { image: null, color: 'night', y: 50 },
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
writeFileSync(`${here}la-notte-in-affitto.shelf`, pack);

const prompts = PAGES.map(
	({ title, image }) => `## ${title}\n\n**Dove va:** ${image.where} · **Formato:** ${image.ratio}\n\n\`\`\`text\n${image.prompt}. ${image.framing} ${STYLE} Aspect ratio ${image.ratio}.\n\`\`\``
);
writeFileSync(
	`${here}prompt-immagini.md`,
	`# ${NAME}: prompt per le immagini

Un prompt per ogni pagina dell'avventura, scritto per Gemini e in inglese perché lo capisce meglio. Ognuno è completo: si copia così com'è. Lo stile è sempre lo stesso, ed è pensato per il tema Neon: viola, magenta e ciano, con un filo di giallo acido.

Qualche consiglio per Gemini:

- **Formato:** il rapporto è scritto in fondo al prompt. Se l'immagine esce quadrata, rispondi «Same image, aspect ratio 21:9» (o 3:4 per i ritratti). Se non arriva a 21:9, usa il formato più largo che ti dà e riposiziona l'immagine dalla pagina.
- **Stile coerente:** genera tutte le immagini nella stessa conversazione. Se una si allontana dalle altre, allega una delle prime e chiedi «Match the style of this image».
- **Scritte:** le insegne al neon attirano lettere inventate. Se ne compaiono, chiedi «Remove all text and letters from the signs».
- **Ritocchi:** Gemini corregge l'ultima immagine senza rifarla da capo: «Make the rain heavier», «Her metal arm should be scuffed and older».

La copertina è una fascia bassa e larga. La prima immagine della colonna a lato è anche quella della galleria e delle anteprime dei collegamenti.

Questo file e \`la-notte-in-affitto.shelf\` si rigenerano da \`build.mjs\`.

${prompts.join('\n\n')}
`
);
console.log(`${PAGES.length} pagine, ${pack.length} byte`);

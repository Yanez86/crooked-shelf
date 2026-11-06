# Guida all'uso

## Chi può fare cosa

| Ruolo | Cosa può fare |
|---|---|
| **Admin** | È uno solo e gestisce il sito: campagne (per chiunque, scegliendone il Master), impostazioni, utenti e quante campagne crea ognuno, inviti, temi, plugin, backup, pacchetti mondo. Nelle campagne non ha poteri in più: è Master in quelle che tiene e giocatore in quelle in cui è invitato |
| **Master** | Nella sua campagna crea e modifica tutte le pagine, scrive e vede i segreti, gestisce categorie, tag, mappe, risorse, calendario, cronologia del mondo e giocatori |
| **Giocatore** | Legge, crea pagine, modifica le sue e quelle aperte ai giocatori, ha la sua scheda, aggiunge eventi alla cronologia della campagna, usa le bacheche |
| **Visitatore** | Solo le pagine pubbliche, se l'Admin ha acceso l'accesso dei visitatori |

Master e Giocatore non sono ruoli dell'account: li decide la campagna. Si è Master delle campagne che si tengono e giocatori in quelle in cui si è invitati, quindi la stessa persona può fare il Master in una campagna e giocare in un'altra. L'Admin è uno solo, di solito chi ha installato la wiki.

Si entra con un **invito**: il Master lo crea in Impostazioni campagna › Giocatori, l'Admin in Amministrazione › Inviti (per la campagna in cui si trova, o per nessuna). Ogni link vale una volta sola.

Chiunque abbia un account, anche un giocatore, può **creare le sue campagne** e farne il Master.

## Campagne

Un'installazione può contenere più campagne. Ognuna è una wiki a sé: pagine, cartelle, tag, mappe, cronologie, bacheche, risorse, home e calendario non si vedono dalle altre, e due campagne possono avere pagine con lo stesso indirizzo.

- **Crearne una**: menu del profilo › **Campagne**, in fondo sotto «Nuova campagna». Si sceglie il nome e se ne è il Master, qualunque ruolo si abbia altrove. Ognuno ne tiene fino a **3**, contando quelle avute dall'Admin; l'Admin cambia il limite persona per persona in Amministrazione › Utenti, e da Amministrazione › Campagne ne crea per gli altri anche oltre il limite. Ogni campagna ha un solo Master. Nasce con la home, i template, le due cronologie e la cartella PG.
- **Il pannello Campagne** (menu del profilo) elenca le tue campagne col tuo ruolo: «Entra» apre la campagna, «Gestisci» (solo se ne sei Master) ne apre le impostazioni senza entrarci.
- **Impostazioni campagna**: la pagina di una campagna, col suo nome come titolo. Il Master ci arriva da «Gestisci» o dalla voce **Impostazioni campagna** in fondo alla barra a sinistra. Quattro schede: **Generale** (nome, riepilogo, eliminazione), **Giocatori** (inviti, rimozione, template delle schede), **Appuntamenti** (accenderli; poi link per il remoto, regola del minimo, Stars & Wishes) e **Claude** (token e connettori).
- **Invitare i giocatori**: in Impostazioni campagna › Giocatori il Master crea un link. Chi non ha un account lo crea; chi lo ha entra col suo.
- **Cambiare campagna**: dal menu del profilo, in cima, o dal pannello Campagne. La scelta resta sul dispositivo. Un collegamento a una pagina si apre nella campagna in cui ti trovi.
- **Eliminarne una**: il Master elimina la sua da Impostazioni campagna › Generale, l'Admin qualsiasi da Amministrazione › Campagne (il pulsante rosso accanto a Salva), anche l'ultima. Il popup dice cosa sparisce e chiede di riscrivere il nome; Annulla, Esc o la X lo chiudono. Pagine, mappe, cronologie, bacheche, risorse e immagini spariscono per tutti, e tornano solo ripristinando un backup. Chi resta senza campagne può ancora accedere, e aspetta un invito o ne crea una.
- Si è Master solo nelle proprie campagne; nelle altre si è giocatori, se invitati. Vale anche per l'Admin: entra solo dove è Master o invitato, e vede i segreti solo nelle sue. Le altre le gestisce da Amministrazione › Campagne senza entrarci, e non può nominarsi Master di una campagna che esiste già (ne vedrebbe i segreti); di una nuova sì.
- Esportazione e pacchetti mondo riguardano la campagna in cui ti trovi; il backup tutta l'installazione.

## Schede giocatore

Ogni campagna ha la cartella **PG** (in inglese «PCs») con una **scheda** per giocatore: la pagina del suo personaggio, dei suoi appunti, delle sue cose.

- **Nasce da sola** quando il giocatore entra nella campagna, con un invito o perché il Master gli ha passato la campagna. Nelle campagne più vecchie cartella e schede compaiono alla prima visita, e una cartella «PG» che c'era già diventa quella delle schede.
- **Il titolo** parte col nome del giocatore, che lo cambia con quello del personaggio.
- **Visibilità**: la vedono tutti i giocatori, la modificano il giocatore e il Master. Si sceglie solo tra **Pubblica** e **Giocatori**, così il Master e gli altri giocatori la vedono sempre.
- **Segreti**: il Master può oscurare un blocco della scheda, anche scritto dal giocatore. Il giocatore non lo vede più e continua a modificare la scheda: salvando, il blocco resta dov'era. Finché c'è un segreto, la visibilità della scheda la cambia solo il Master.
- **Pagine dentro la scheda**: con **Nuova pagina qui dentro** (il giocatore nella sua, il Master in tutte). La pagina nuova è **Personale**: appunti che il giocatore tiene per sé, e che il Master non vede. Può essere anche una bacheca.
- **Sta al suo posto**: la scheda non cambia cartella, non diventa template né home, si riordina solo dentro PG e non va nel cestino finché il giocatore è al tavolo. La cartella PG si rinomina e si sposta, ma non si elimina; se va nel cestino la cartella che la contiene, PG risale alla radice.
- **Chi esce** dalla campagna sparisce da «Al tavolo», ma la scheda resta e il Master può eliminarla. Se rientra la ritrova, anche dal cestino.
- **Il template delle schede** di base è «Scheda giocatore» (personaggio e appunti). Il Master lo modifica come ogni template o ne sceglie un altro, anche nessuno, in **Impostazioni campagna › Giocatori**. Vale per le schede nuove. Il plugin D&D Beyond aggiunge «Scheda D&D», col link al personaggio sul sito.
- **Al tavolo**: in cima alla colonna a destra della home ci sono il Master e i giocatori. Il nome di un giocatore porta alla sua scheda, col personaggio sotto. I visitatori non vedono l'elenco.
- Schede e pagine dentro non entrano nel pacchetto mondo (sono del tavolo, non del mondo), ma restano nel backup e nell'esportazione in Markdown.

## Appuntamenti

**Appuntamenti**, in fondo alla barra a sinistra, è il calendario delle sessioni: un mese per pagina e, sotto, le date coi dettagli. Lo vedono Master e giocatori, non i visitatori.

È un'**opzione della campagna**, spenta nelle campagne nuove: il Master la accende in **Impostazioni campagna › Appuntamenti** con «Usa gli appuntamenti». Spenta, spariscono la voce nella barra, le sue impostazioni, le sessioni nella home e Stars & Wishes, e `/schedule` non si apre. Non si cancella niente: riaccendendo torna tutto com'era.

- **Il Master fissa un appuntamento** con «Nuovo appuntamento»: titolo, data, inizio e fine (una fine prima dell'inizio è dopo mezzanotte, es. 20:00–00:00), e se si gioca **in presenza** (e dove), **da remoto** o in tutti e due i modi.
- **Si ripete** ogni settimana, ogni 2 settimane o ogni mese, fino a una data o senza fine. «Ogni mese» tiene il giorno della settimana: dal primo giovedì, il primo giovedì di ogni mese. **Annulla questa data** toglie una data sola; «Modifica la serie» le cambia tutte.
- **I giocatori rispondono** per ogni data: in presenza, da remoto (se l'appuntamento lo ammette) o «Non ci sono», e possono cambiare idea.
- **Le date** sotto il calendario sono schede compatte: titolo con la matita del Master, quando e lo stato, il posto e l'icona del link per il remoto. **Chi c'è** è una riga di facce, il Master per primo: il globo vuol dire da remoto, la croce «non viene», la faccia sbiadita «non ha risposto». Passando col mouse si leggono nome e personaggio; toccando la riga (o con Invio) si apre l'elenco dei nomi.
- **Il link per il remoto** (Discord o altro) lo mette il Master in **Impostazioni campagna › Appuntamenti**, per tutti; un appuntamento può averne uno suo. Nelle date se ne vede l'icona (quella di Discord, per Discord) e l'indirizzo passandoci sopra.
- **La regola del minimo**, sempre lì: sotto un certo numero di giocatori confermati la sessione **salta**. Finché mancano più ore di quelle scelte (di base 24) è **in forse**, poi salta; con abbastanza giocatori è **confermata**. Il Master non conta; con 0 la regola non c'è.
- Date e orari sono quelli del tavolo, senza fusi orari: l'ora in cui una sessione salta è quella del server (`TZ`, vedi l'installazione).

### Stars & Wishes

Dopo una sessione, due domande a chi c'era: **che cosa ti è piaciuto di questa sessione?** e **che cosa ti piacerebbe esplorare nella prossima?** Il Master lo accende in **Impostazioni campagna › Appuntamenti**.

- Le domande arrivano, a sessione finita, a chi aveva risposto «Ci sono» (in presenza o da remoto). Le sessioni annullate o saltate non contano.
- Il giocatore le trova in un popup **alla prima pagina che apre dopo la sessione**. «Più tardi» (o la X) le rimanda di qualche ora. Rispondere non è obbligatorio, e la risposta si invia **una volta sola**. Il Master non le riceve: le risposte sono per lui.
- Le domande si chiudono **il giorno della sessione dopo**; se non ce n'è una in calendario, restano aperte.
- Le risposte le legge **solo il Master**, negli Appuntamenti, sotto la data. Spegnendo Stars & Wishes restano salvate.

## La barra a sinistra

Tutta la wiki si raggiunge dalla barra a sinistra:

- in cima le icone: **Nuova pagina**, **Nuova cartella**, **Nuovo divisorio**, chiudi tutto e apri tutto;
- l'**albero**: le categorie sono cartelle che si aprono con un clic (o Invio), con dentro sottocartelle e pagine di ogni tipo, ognuna con la sua icona. Le pagine senza categoria stanno in fondo. La cartella della pagina aperta si apre da sola;
- **Nuova cartella** (il Master): la cartella compare in cima all'albero col nome da scrivere; Invio la crea, Esc la lascia perdere. Si rinomina in **Cartelle** (`/categories`);
- **Riordinare** (il Master): trascina una voce prima o dopo un'altra, o al centro di una riga per metterla dentro. Una pagina con voci dentro ha la freccia per aprirle. Da tastiera, sulla riga: **Alt** con le frecce su e giù sposta, destra mette dentro la voce sopra, sinistra riporta fuori. Le voci mai spostate restano in fondo, in ordine alfabetico;
- **Nuovo divisorio** (le tre righe): una riga in fondo all'albero, da trascinare dove serve; si toglie dalla crocetta;
- **Cestino**: passando su una riga compare il cestino, per chi può eliminare quella pagina (le cartelle solo il Master). Una cartella ci va con tutto quello che contiene e torna intera; le pagine annidate in una pagina eliminata invece restano e risalgono alla sua cartella;
- **Visibilità** (il Master): accanto al cestino, l'icona di chi vede la pagina: globo Pubblica, occhio Giocatori, occhio barrato Solo Master, lucchetto Personale. Solo Master e Personale si vedono sempre, le altre passando sulla riga (sul telefono sempre). Cliccandola si cambia; se la pagina ne contiene altre si sceglie se cambiare anche quelle. «Personale» vale solo per le pagine scritte da te. La home si cambia dalla sua matita.

La **home** è la pagina iniziale: dalla matita si scrive la presentazione, con blocchi, riquadri, copertina e icona. A destra, sotto i riquadri, ci sono chi è al tavolo e le pagine cambiate di recente. Sta sempre in cima alla barra, non si sposta e non si elimina. Per sceglierne un'altra, il Master spunta **Pagina home** modificando una pagina Pubblica o Giocatori.

In fondo alla barra ci sono **Risorse**, **Appuntamenti** (se accesi) e **Cestino**. I template si usano da «Nuova pagina». Le altre sezioni si aprono dal loro indirizzo: Pagine con i filtri (`/wiki`), Tag (`/tags`), Galleria (`/gallery`), Regole (`/rules`), Calendario (`/calendar`), Cartelle (`/categories`).

Sul telefono l'intestazione è una riga che resta in vista: «Menu e pagine» apre la barra (si chiude con Esc, × o toccando fuori), la lente la ricerca. Col dito i cestini nelle righe non ci sono: una pagina si elimina dalla sua modifica, una cartella da Categorie. Sul computer la freccia in cima alla barra la nasconde e la riapre, e il browser se lo ricorda; una freccia uguale fa lo stesso con la colonna a destra delle pagine. Il centro prende lo spazio libero. Per tenere la barra chiusa anche sul computer: Profilo › «Barra a sinistra». Nel Profilo la barra parte nascosta, in Amministrazione chiusa.

## Pagine

Ogni cosa della wiki è una **pagina**, con un indirizzo `/wiki/…`, una cartella, dei tag, una visibilità, la colonna a lato e le versioni. Ci sono quattro tipi:

| Tipo | Cos'è | Chi la crea |
|---|---|---|
| **Pagina** | Bianca, o copiata da un template | Chi ha fatto l'accesso |
| **Template** | Un modello da copiare: blocchi, colonna a lato e icona | Master |
| **Mappa** | Un'immagine con pin e livelli, più il testo | Master |
| **Cronologia** | Eventi in ordine di data, più il testo | Master |

- **Nuova pagina** chiede da dove partire: **pagina bianca** o un **template**. Il Master trova anche «Nuovo template», «Nuova mappa» e «Nuova cronologia».
- **Template**: la wiki nasce con alcuni (PNG, Luogo, Fazione, Resoconto di sessione…), che si modificano come ogni pagina. «Usa questo template» ne crea una copia. Il Master trasforma una pagina in template, e viceversa, con «È un template»; con «Le copie sono resoconti di sessione» le copie hanno numero, data e voce nella cronologia della campagna. Cambiare un template non cambia le pagine già fatte.
- **Chi la vede**: Pubblica, Giocatori, Solo Master o Personale (solo tu: per gli appunti privati).
- **Opzioni pagina**: in modifica, il pulsante accanto ad Annulla apre visibilità, «Anche i giocatori possono modificarla», «È un template», «Pagina home» e il link alle versioni. Si chiude con Esc o cliccando fuori. Se ci sono modifiche non salvate, prima di aprire le versioni la wiki lo chiede.
- **Copertina e icona**: in modifica, «Aggiungi copertina» (accanto a Salva) sceglie un'immagine della **Galleria**, una **Tinta unita** o un file da **Caricare**. Le icone sul lato della copertina la cambiano, la riposizionano (trascinando o con le frecce, Invio conferma), la ritagliano e la tolgono. L'icona della pagina, a sinistra del titolo, si sceglie cliccandola.
- **Colonna a lato**: in modifica, il «+» a destra la aggiunge; resta in vista mentre scorri. Contiene riquadri:
  - **Testo**: un titolo e un testo breve (es. «Ruolo: Locandiere»), con `[[Pagina]]` e Markdown semplice: `**grassetto**`, `*corsivo*`, `__sottolineato__` e, su righe a sé, elenchi (`- voce`, `1. voce`);
  - **Immagine**: trascinala sul riquadro o usa «Scegli un'immagine», con un titoletto (sopra) e una didascalia (sotto) se vuoi. «Ritaglia» tiene solo la parte scelta: trascina il riquadro o l'angolo, o usa le frecce (con Maiusc cambi la misura). Il ritaglio è un'immagine nuova; l'originale resta tra le immagini.

  I riquadri si riordinano dalla maniglia a sinistra del titolo (col mouse o col dito; vicino al bordo la pagina scorre) o con le frecce. La crocetta toglie un riquadro; «Togli la colonna» toglie la colonna vuota. La prima immagine è anche quella della pagina, nella galleria e nell'anteprima dei collegamenti. Le pagine fatte da un template partono con i suoi riquadri.
- **Versioni**: l'orologio in fondo alla pagina mostra le versioni precedenti, cosa è cambiato, e le ripristina.
- **Cestino**: le pagine eliminate, anche mappe e cronologie con pin ed eventi, si recuperano dal Cestino, che mostra chi le ha create e quando e l'ultima modifica, e le recupera o le elimina per sempre.

### Scrivere

| Scrivi | Ottieni |
|---|---|
| `## ` all'inizio della riga | titolo |
| `- ` o `1. ` | elenco |
| `> ` | citazione |
| `**parola**` / `*parola*` | grassetto / corsivo |
| `[[` | suggerimenti per collegare un'altra pagina |
| `[[Titolo|testo]]` | collegamento con un testo diverso |
| `@` e il nome | suggerimenti di regole (incantesimi, mostri…) |
| `@incantesimo[Fireball|Palla di fuoco]` | regola con il testo che vuoi |
| `/` e il nome | tiro su una tabella di tiro (vedi sotto) |

Dalla barra dell'editor si inseriscono immagini (con la descrizione per chi non vede), tabelle e riquadri «Nota», «Consiglio», «Attenzione».

La pagina è fatta di **blocchi**: paragrafi, titoli, immagini, tabelle, riquadri. Passando col mouse su un blocco compaiono in alto a destra:

- il **più**, che aggiunge dopo un blocco di **testo** o un'**immagine**;
- sulle immagini, le **due frecce** per la dimensione e «Ritaglia»;
- l'**occhio**, solo per il Master, che **oscura** il blocco: diventa un **segreto del Master**, che i giocatori non vedono e non trovano cercando. Lo stesso occhio lo mostra di nuovo;
- il **cestino**, che elimina il blocco.

**Dimensione delle immagini**: le due frecce scelgono **piccola** (un quarto della colonna), **media** (metà), **grande** (tre quarti), larga quanto la colonna o **originale** (fin dove ci sta). Oppure trascina la maniglia sull'angolo in basso a destra, a passi del 5%. Da tastiera, con l'immagine selezionata, c'è «Dimensione dell'immagine» nella barra. Il file non cambia, solo come si vede.

**Ritagliare le immagini**: «Ritaglia» funziona come nella colonna a lato (da tastiera è nella barra). Il ritaglio prende il posto dell'immagine, che resta tra le immagini; «Annulla l'ultima azione» la rimette.

**I blocchi oscurati** nell'editor hanno lo sfondo dei segreti e il bordo viola, e quelli di fila sembrano un riquadro solo, con un lucchetto sull'angolo del primo (i lettori di schermo leggono «Segreto del Master»). Nella pagina quelli di fila stanno in un riquadro col titoletto «Segreto del Master». Da tastiera, l'occhio nella barra oscura o mostra i blocchi in cui scrivi o che hai selezionato, e il cestino elimina il blocco in cui scrivi. Un blocco nato da un blocco oscurato (andando a capo, col più, inserendo un'immagine o una tabella) è oscurato anche lui, e così la copia incollata di un blocco oscurato. Il primo pulsante della barra annulla l'ultima azione (Ctrl+Z).

**Pagine con un segreto**: chi può modificare la pagina la modifica anche se contiene blocchi oscurati. Un giocatore non li riceve, neanche nell'editor; quando salva, ognuno torna dopo il blocco che lo precedeva (se l'ha eliminato, dopo il primo blocco rimasto prima di quello). Il giocatore non può oscurare blocchi, e ripristinare una versione vecchia non gli mostra i segreti. Visibilità, permessi ed eliminazione di una pagina con un segreto restano al Master, anche se l'ha scritta il giocatore.

Da tastiera: Tab entra nella barra, le frecce si muovono tra i comandi, Esc esce dall'editor.

Un collegamento a una pagina che non esiste è **rosso tratteggiato**: cliccandolo la crei. Uno a una pagina che esiste la apre in un popup sopra quella di partenza, con i tasti per aprirla a schermo intero e per chiudere. Con Ctrl (Cmd sul Mac) si apre in una nuova scheda. Sul telefono si apre la pagina, e Indietro riporta a quella di prima.

### Tabelle di tiro

Una tabella di tiro è una tabella della pagina da cui esce un risultato a caso, come nei manuali: «Bottega povera», un d6, una bottega per riga.

- **Crearla** (il Master): il dado nella barra dell'editor, «Nuova tabella di tiro». Nella prima riga il dado (d6) e il nome; sotto, una riga per faccia: nella prima colonna i numeri (`3`, `4-6`, `01–05`), nelle altre il risultato, anche con grassetti, `[[collegamenti]]` e `@regole`. Una tabella che c'è già diventa di tiro con «Tabella di tiro» tra gli strumenti della tabella.
- **I dadi**: d4, d6, d8, d10, d12, d20, d100 (o d%), d66 e dadi sommati come 2d6. Nel d10 lo `0` vale 10, nel d100 lo `00` vale 100. Senza numeri nella prima colonna, ogni riga ha la stessa probabilità.
- **Se qualcosa non va**, sotto gli strumenti della tabella c'è scritto cosa manca, per esempio un numero che non è in nessuna riga, o è in due.
- **Tirare nella pagina**: «Tira», sotto la tabella, mostra il risultato accanto senza cambiare la pagina.
- **Tirare mentre scrivi**: scrivi `/` e il nome della tabella (`/bottega` o `/bottega-povera`), scegli e premi Invio: il risultato entra nel testo. Col cursore sul risultato compaiono **Ritira**, che ne mette un altro, e **Fissa**, che lo rende testo normale. Cambiare la tabella non cambia le pagine già scritte.
- **Chi le usa**: le crea il Master, le tira chi vede la pagina. Una tabella oscurata la trova e la tira solo il Master. La tabella deve stare nella pagina, non in un riquadro.
- Sono parte del testo della pagina: hanno le versioni, si trovano cercando, finiscono nell'esportazione in Markdown e nel pacchetto mondo.

## Mappe

Una mappa è una pagina: il Master la crea con Nuova pagina › «Nuova mappa» e carica l'immagine. Per un **pin**: «Aggiungi pin», sotto lo zoom, e un clic sulla mappa (da tastiera, Invio lo mette al centro della vista); poi un popup chiede i dati, Salva lo crea, Esc o la X lo lasciano perdere. Un pin apre una pagina o un'altra mappa (regno › città › edificio). La pagina di un pin si apre sopra la mappa: Esc, la X o un clic fuori la chiudono, «Apri la pagina intera» la apre.

I **livelli** raggruppano i pin e si accendono e spengono da «Livelli». Il **Livello base** è visibile a tutti e prende i pin senza un altro livello; «Nuovo livello» ne crea uno con nome e visibilità, «Gestisci i livelli», sotto la mappa, li rinomina ed elimina. Un livello «Solo Master» i giocatori non lo vedono. Indicando la larghezza reale della mappa compare il righello.

Sotto la mappa c'è l'elenco dei pin. Immagine, scala e mappa che la contiene si cambiano modificando la pagina; la «Descrizione», il testo della pagina, compare in un riquadro sopra la mappa.

## Galleria

Tutte le immagini della campagna, le più recenti prima: copertine, colonna a lato, testo delle pagine, mappe e risorse. Sotto ognuna c'è dove compare; cliccandola si apre in grande (← → per scorrere, Esc per chiudere). Si filtrano per pagine, mappe o risorse. Ognuno vede solo le immagini di quello che può vedere.

## Risorse

Immagini, musica e altri file della campagna: dispense, ritratti, sottofondi. Si aprono da **Risorse**, in fondo alla barra a sinistra, divise in Immagini, Audio e Altri file.

Il Master le carica con «Carica una risorsa»: immagini (PNG, JPEG, WebP o GIF, fino a 25 MB), audio (MP3, OGG, WAV, FLAC o M4A) o altri file, fino a 90 MB. Senza titolo si usa il nome del file. Sceglie chi le vede: Pubbliche, Giocatori o Solo Master.

Tra le Immagini ci sono anche quelle già usate nella wiki (copertine, colonna a lato, testo, mappe), ognuna col nome del file. Il Master ne cambia solo il nome (l'estensione resta); il resto si cambia nella pagina che le usa.

Immagini e audio si guardano e si ascoltano nella wiki, anche dal telefono; gli altri file, PDF compresi, si scaricano. La scheda di una risorsa mostra dove compare, e con la matita il Master ne cambia titolo, descrizione, visibilità e file, o la elimina.

Le risorse entrano nel backup, non ancora nel pacchetto mondo.

## Cronologie e calendario

Una cronologia è una pagina (Nuova pagina › «Nuova cronologia»), e se ne fanno quante se ne vuole, di due tipi:

- **del mondo**: la storia in ordine di data, scritta dal Master (la wiki nasce con la «Cronologia del mondo»);
- **della campagna**: cosa è successo al tavolo, in ordine di data di gioco. Anche i giocatori aggiungono eventi, e i **resoconti di sessione** entrano da soli (la wiki nasce con la «Cronologia della campagna»).

Gli eventi si vedono in due modi:

- **Elenco**: l'anno a sinistra (nella cronologia della campagna il mese di gioco), i salti lunghi segnati («≈ 318 anni») e la riga «Oggi». Con molti anni, «Vai a» porta a quello che cerchi.
- **Linea del tempo**: gli eventi in scala, su più corsie; i salti lunghi si accorciano e dicono quanto coprono. Lo zoom va con − e +, con Ctrl + rotella o con due dita, e «Tutto» mostra l'intera cronologia; si trascina per spostarsi, e la panoramica in alto porta in un punto. Scelto un evento, anche con le frecce, sotto la linea compare tutto, con Precedente e Successivo. Un doppio clic in un punto vuoto apre «Aggiungi un evento» con quella data. Sul telefono, o dove la linea non ci sta, si vede l'elenco.

In tutte e due si cerca nel testo e si filtra: con una pagina collegata, Solo Master, sessioni. Nella cronologia della campagna si sceglie l'ordine: data di gioco o data nel mondo. La matita modifica l'evento sul posto, dove c'è anche «Elimina l'evento»; l'icona del collegamento copia l'indirizzo dell'evento.

Il **calendario** può essere gregoriano, Harptos (Forgotten Realms), semplice o inventato (mesi, feste, anni bisestili, ere, «oggi nel mondo»).

## Regole

La pagina **Regole** ha 999 voci dell'SRD 5.2 (in inglese) da cercare e citare. Nelle pagine `@incantesimo[Fireball]` diventa un link alla scheda della regola, con il pulsante **i** per l'anteprima; col plugin **D&D Beyond** acceso (Amministrazione › Plugin) porta invece alla ricerca di D&D Beyond. Ogni regola mostra le pagine che la citano, così le vostre regole della casa restano collegate.

## Bacheche

Una bacheca è una pagina: **Nuova pagina › Nuova bacheca**, con le colonne di partenza (una per riga). Sta nell'albero e ha la sua visibilità: **Personale**, Giocatori o Solo Master. Chi la vede aggiunge e sposta le schede (con le frecce o trascinandole), anche con `[[Pagina]]` e `@regole`. Le colonne le gestisce chi può modificare la pagina. Le bacheche non entrano nel pacchetto mondo.

## Profilo

In alto a destra ci sono la tua icona, il tuo nome e il tuo ruolo nella campagna. Il menu contiene le tue campagne (se più d'una), **Profilo**, **Campagne**, **Visualizza come giocatore** (il Master), **Amministrazione** (l'Admin) ed **Esci**. Sul telefono in alto resta solo l'icona.

**Profilo** e **Amministrazione** si aprono in un popup sopra la wiki (si chiude con Esc, la X o cliccando fuori); con Ctrl+clic in un'altra scheda, sul telefono come pagine.

Il **Profilo** ha tre schede:

- **Icona e nome**: il nome e l'icona, tra quelle delle pagine (una corona, un cappello da mago, delle spade…) o un'immagine (PNG, JPEG, GIF o WebP);
- **Lettura e accessibilità**: le preferenze qui sotto;
- **Password**: cambiarla, vedere le sessioni aperte e chiudere quelle sugli altri dispositivi.

Chi non ha fatto l'accesso trova solo la lettura, salvata nel browser.

## Lettura e accessibilità

Nel **Profilo** ognuno sceglie:

- tema: automatico (Aria, o Aria di notte se il sistema è scuro), Aria, Aria di notte, Neon, Vintage bianca, Vintage scura o quelli dell'Admin. Con Aria e Neon, sullo schermo grande, barra e scheda della pagina vanno da cima a fondo, senza riquadri; i Vintage hanno l'intestazione in alto e i riquadri;
- testo fino al 200%;
- carattere Atkinson Hyperlegible o OpenDyslexic;
- spaziatura ampia, animazioni ridotte, lingua;
- barra a sinistra sempre aperta, o chiusa e da aprire col pulsante.

Tutta la wiki si usa da tastiera e con i lettori di schermo; i colori rispettano WCAG 2.2 AA.

## Amministrazione

- **Impostazioni**: nome del sito, lingua predefinita, visitatori. Sotto, la **versione** installata confrontata con l'ultima su GitHub («Aggiornata» o «Non aggiornata»), coi link alle novità e a come aggiornare.
- **Campagne**: crearle per chiunque (anche oltre il limite), sceglierne il Master tra tutti gli account, eliminarle.
- **Utenti**: quante campagne crea ognuno (e quante ne tiene), disattivazione e, per chi ha dimenticato la password, un link di reimpostazione (vale due giorni, una volta sola). Qui non si scelgono ruoli. In fondo, **Passa l'amministrazione**: l'Admin la dà a un altro account attivo e diventa un account come gli altri, con le sue campagne.
- **Inviti**: link per entrare nel sito, uno per persona: entra come giocatore nella campagna in cui ti trovi, o in nessuna.
- **Temi**: copia un tema e cambia i colori; si salva solo se il testo resta leggibile. Può avere un'immagine di sfondo, dietro i riquadri, visibile sugli schermi larghi. Si esporta e importa come file (solo i colori: lo sfondo viaggia col pacchetto mondo).
- **Plugin**: accendi e spegni i plugin installati; cliccandone uno vedi scopo, istruzioni, autore e contenuto (per crearne uno: [plugin.md](plugin.md)).
- **Backup**: il backup completo da scaricare e quello **automatico** di ogni giorno in una cartella (anche di OneDrive, Google Drive o Dropbox), con ora, copie da tenere e una **password** facoltativa che lo cifra e non si può recuperare. Vedi [installazione.md](installazione.md#backup-automatico).
- **Pacchetto mondo**, **Esporta in Markdown**: vedi [installazione.md](installazione.md#backup-e-ripristino).
- **Registro**: accessi riusciti e falliti, cambi di ruolo e password, inviti, token di Claude, consensi, backup ed esportazioni degli ultimi sei mesi.

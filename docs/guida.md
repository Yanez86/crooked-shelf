# Guida all'uso

## Chi può fare cosa

| Ruolo | Cosa può fare |
|---|---|
| **Admin** | Gestisce il sito: crea le campagne e ne sceglie il Master, impostazioni, utenti, inviti, temi, plugin, backup, pacchetti mondo. Nelle campagne non ha poteri in più: è Master in quelle che tiene e giocatore in quelle in cui è invitato |
| **Master** | Nella sua campagna: crea e modifica tutte le pagine, scrive e vede i segreti, gestisce categorie, tag, mappe, risorse, calendario, cronologia del mondo e giocatori |
| **Giocatore** | Legge, crea pagine, modifica le sue e quelle aperte ai giocatori, ha la sua scheda giocatore, aggiunge eventi alla cronologia della campagna, usa le bacheche |
| **Visitatore** | Solo le pagine pubbliche, e solo se l'Admin ha acceso l'accesso dei visitatori |

Le persone entrano con un **invito**: il Master lo crea in Campagna › Giocatori, l'Admin in Amministrazione › Inviti. Ogni link funziona una volta sola.

## Campagne

Una installazione può contenere più campagne. Ognuna è una wiki a sé: pagine, cartelle, tag, mappe, cronologie, bacheche, risorse, home e calendario non si vedono dalle altre, e la stessa pagina può avere lo stesso indirizzo in due campagne.

- **Crearne una**: Amministrazione › Campagne › «Nuova campagna», con il nome e il Master. Ogni campagna ha un solo Master; lo stesso account può tenerne più d'una. Parte con la home, i template, le due cronologie e la cartella PG.
- **La pagina Campagna**: il Master la apre dal menu del profilo. Ha quattro schede: **Generale** (nome, opzioni, eliminazione), **Giocatori** (inviti, rimozione, template delle schede), **Appuntamenti** (link per il remoto, regola del minimo, Stars & Wishes; solo con gli appuntamenti accesi) e **Claude** (token e connettori).
- **Invitare i giocatori**: in Campagna › Giocatori il Master crea un link di invito. Chi non ha un account lo crea; chi lo ha già accede ed entra nella campagna col suo.
- **Cambiare campagna**: chi ne ha più di una le trova in cima al menu del profilo. La scelta resta sul dispositivo. Un collegamento a una pagina si apre nella campagna in cui ti trovi.
- **Eliminarne una**: il Master elimina la sua dalla pagina Campagna, l'Admin qualsiasi da Amministrazione › Campagne, anche l'ultima; per conferma si riscrive il nome. Spariscono per tutti pagine, mappe, cronologie, bacheche, risorse e immagini, e torna solo ripristinando un backup. Chi resta senza campagne può ancora accedere e aspetta un invito.
- Si è Master solo nella propria campagna: nelle altre si è giocatori, se si è stati invitati. Vale anche per l'Admin: entra solo nelle campagne che tiene o in cui è invitato, e vede i segreti solo nelle sue. Le altre le gestisce da Amministrazione › Campagne senza entrarci, e non può nominarsi Master di una campagna che esiste già: lo fa un altro Admin. Di una campagna nuova invece può essere lui il Master.
- Esportazione e pacchetti mondo riguardano la campagna in cui ti trovi; il backup riguarda tutta l'installazione.

## Schede giocatore

Ogni campagna ha la cartella **PG** (in inglese «PCs») e dentro una **scheda** per ogni giocatore: la pagina dove tiene il suo personaggio, gli appunti, le sue cose.

- **Nasce da sola** quando il giocatore entra nella campagna (con un invito, o quando il Master passa la campagna a un altro e diventa giocatore). Nelle campagne nate prima di questa versione cartella e schede compaiono alla prima visita; una cartella «PG» che c'era già diventa la cartella PG.
- **Il titolo** all'inizio è il nome del giocatore: lui lo cambia con quello del personaggio.
- **Chi la vede e chi la modifica**: la vedono tutti i giocatori, la modificano il giocatore e il Master. Nelle opzioni della pagina si sceglie solo tra **Pubblica** e **Giocatori**: niente Solo Master né Personale, così il Master la vede sempre e gli altri giocatori pure.
- **I segreti del Master**: nella scheda il Master può oscurare un blocco, anche uno scritto dal giocatore. Il giocatore non lo vede più e continua a modificare la sua scheda: quando salva, il blocco oscurato resta dov'era. Finché nella scheda c'è un segreto, la visibilità della scheda la cambia solo il Master.
- **Pagine dentro la scheda**: nella scheda c'è **Nuova pagina qui dentro** (il giocatore nella sua, il Master in tutte). La pagina nuova parte **Personale**: va bene per gli appunti che il giocatore tiene per sé, e che non vede neanche il Master. Si può fare anche una bacheca.
- **Sta al suo posto**: la scheda non cambia cartella, non diventa un template né la home, e nell'albero si riordina solo dentro la cartella PG. Non va nel cestino finché il giocatore è al tavolo. La cartella PG si rinomina e si sposta, ma non si elimina; se finisce nel cestino la cartella che la contiene, lei risale alla radice.
- **Chi esce dalla campagna** non compare più nell'elenco «Al tavolo», ma la sua scheda resta: il Master la può eliminare. Se il giocatore rientra ritrova la sua, anche dal cestino.
- **Il template delle schede**: di base è «Scheda giocatore», generico (il personaggio e gli appunti), nella linguetta Template. Il Master lo modifica come ogni template, oppure ne sceglie un altro in **Campagna › Giocatori** (anche nessuno: pagina bianca). Vale per le schede che nasceranno; quelle che ci sono restano come sono. Il plugin D&D Beyond porta il template «Scheda D&D», col link alla scheda del personaggio sul sito.
- **Al tavolo**: nella home, in cima alla colonna a destra, ci sono il Master e i giocatori, con l'icona del profilo. Il nome di un giocatore porta alla sua scheda, col nome del personaggio sotto. I visitatori senza account non vedono l'elenco.
- Le schede e le pagine dentro di loro non entrano nel pacchetto mondo: sono del tavolo, non del mondo. Restano nel backup e nell'esportazione in Markdown.

## Appuntamenti

In fondo alla barra a sinistra, **Appuntamenti** è il calendario delle sessioni di gioco della campagna: un mese per pagina, e sotto la griglia ogni data con i suoi dettagli. Lo vedono il Master e i giocatori, non i visitatori senza account.

Gli appuntamenti sono un'**opzione della campagna**: il Master li accende e li spegne in **Campagna › Generale**, alla voce «Appuntamenti». Nelle campagne nuove sono spenti. Spenti, spariscono la voce nella barra, la scheda Appuntamenti della pagina Campagna, le sessioni nella home e le domande di Stars & Wishes; gli indirizzi `/schedule` non si aprono. Niente viene cancellato: riaccesi, appuntamenti, risposte e impostazioni tornano come prima.

- **Il Master fissa un appuntamento** con «Nuovo appuntamento»: titolo, data, inizio e fine (una fine prima dell'inizio vuol dire dopo mezzanotte, es. 20:00–00:00). Sceglie se si gioca **in presenza** (e dove), **da remoto** o in tutti e due i modi.
- **Si ripete** ogni settimana, ogni 2 settimane od ogni mese, fino a una data o senza fine. «Ogni mese» è lo stesso giorno della settimana nella stessa posizione: dal primo giovedì, il primo giovedì di ogni mese. Una sola data si toglie con **Annulla questa data**; «Modifica la serie» cambia tutte le date.
- **I giocatori rispondono** per ogni data: in presenza, da remoto (solo nei modi che l'appuntamento ammette) o «Non ci sono». Si può cambiare idea. Sotto ogni data c'è chi viene, come, chi no e chi non ha ancora risposto.
- **Il link per il remoto** (Discord o altro) il Master lo mette in **Campagna › Appuntamenti** e vale per tutti; un appuntamento può averne uno suo.
- **La regola del minimo**, sempre in Campagna › Appuntamenti: sotto un certo numero di giocatori confermati la sessione **salta**. Finché mancano più ore di quelle scelte (di base 24) è **in forse**, poi salta; con abbastanza giocatori è **confermata**. Il Master non conta. Con 0 non c'è regola.
- Date e orari sono quelli del tavolo, senza fusi orari: l'ora in cui una sessione «salta» è quella del server (`TZ`, vedi l'installazione).

### Stars & Wishes

Dopo una sessione, due domande a chi c'era: **che cosa ti è piaciuto di questa sessione?** e **che cosa ti piacerebbe esplorare nella prossima?** Si accende in **Campagna › Appuntamenti** ed è spento finché il Master non lo accende.

- Le domande arrivano a chi aveva risposto «Ci sono» (in presenza o da remoto), quando la sessione è finita. Le sessioni annullate o saltate per la regola del minimo non contano.
- Il giocatore le trova in un popup **entrando nella campagna**: aprendo la wiki o passando da un'altra campagna. «Più tardi» le rimanda al prossimo ingresso; rispondere non è obbligatorio.
- La risposta si invia **una volta sola** e non si cambia più.
- Le domande si chiudono da sole **il giorno della sessione dopo**. Se non ce n'è una in calendario, restano aperte.
- Le risposte le legge **solo il Master**, negli Appuntamenti, sotto la data della sessione. Spegnendo Stars & Wishes spariscono dalla vista ma restano salvate.

## La barra a sinistra

Tutta la wiki si raggiunge dalla barra a sinistra (in alto non c'è più il menu orizzontale):

- in cima quattro linguette, ognuna con l'icona e il nome sotto: **Pagine** (il foglio), **Tag** (l'etichetta: i tag nel loro colore, col numero di pagine; un clic apre le pagine con quel tag, e il Master ne cambia nome e colore da «Nomi e colori dei tag»), **Risorse** (l'immagine: immagini, audio e altri file, vedi sotto) e **Template** (i fogli sovrapposti: tutti i template, in ordine di titolo);
- sotto, le icone: **Nuova pagina**, **Nuova cartella** e **Nuovo divisorio** (o **Carica una risorsa**, nelle Risorse; **Nuovo template**, nei Template), chiudi tutto e apri tutto;
- l'**albero**: le categorie sono cartelle che si aprono e si chiudono con un clic (o con Invio da tastiera); dentro ci sono le sottocartelle e le pagine di ogni tipo (pagine, mappe, cronologie, bacheche), ognuna con la sua icona. Le pagine senza categoria stanno in fondo, alla radice. La cartella della pagina che stai leggendo si apre da sola.
- **Nuova cartella** (l'icona della cartella col «+», per il Master): la cartella compare subito in cima all'albero col nome da scrivere; Invio la crea, Esc la lascia perdere. Rinominarle si fa in **Cartelle**, all'indirizzo `/categories`.
- **Riordinare** (il Master): trascina una cartella o una pagina per metterla prima o dopo un'altra, oppure lasciala nel mezzo di una riga per annidarla dentro quella cartella o pagina. Una pagina con voci dentro ha la freccia per aprirle; il titolo porta alla pagina. Da tastiera, sulla riga: **Alt** e le frecce su e giù spostano, destra la mette dentro la voce sopra, sinistra la riporta fuori. Le voci mai spostate restano in fondo, in ordine alfabetico.
- **Nuovo divisorio** (l'icona con le tre righe): aggiunge una riga in fondo all'albero, da trascinare tra una cartella e l'altra. Si elimina dalla sua crocetta.
- **Cestino**: passando su una pagina o una cartella, a destra nella riga compare il cestino (lo vede chi può eliminare quella pagina; le cartelle solo il Master). Una cartella ci va con tutto quello che contiene e, dal **Cestino**, torna intera. Le pagine annidate in una pagina eliminata invece restano e risalgono alla sua cartella.
- **Visibilità** (il Master): accanto al cestino c'è l'icona di chi può vedere la pagina: il globo per Pubblica, l'occhio per Giocatori, l'occhio barrato per Solo Master, il lucchetto per Personale. Solo Master e Personale si vedono sempre; le altre compaiono passando sulla riga (sul telefono si vedono tutte). Cliccandola si sceglie un altro livello. Se la pagina ne contiene altre (anche dentro sue cartelle), si chiede se cambiarle tutte o solo lei. «Personale» vale solo per le pagine scritte da te: quelle degli altri restano come sono. La home non ha l'icona: si cambia dalla sua matita.

La **home** è la pagina iniziale del sito, nata con la wiki: dalla matita si scrive la presentazione, con blocchi, riquadri, copertina e icona. A destra, sotto i suoi riquadri, ci sono chi è al tavolo (vedi Schede giocatore) e le pagine modificate e aggiunte di recente. Sta sempre in cima alla barra a sinistra, fuori dalle cartelle, e non si sposta. Non si può eliminare e ce n'è una sola: per cambiarla, il Master spunta **Pagina home** modificando un'altra pagina, che deve essere Pubblica o Giocatori. Quella di prima torna una pagina come le altre.

In fondo alla barra, su ogni linguetta, ci sono sempre **Appuntamenti** (se la campagna li ha accesi) e il **Cestino**. Le altre sezioni della wiki (Pagine, cioè l'elenco con i filtri, Tag, Galleria, Regole, Calendario, Cartelle) non hanno una voce di menu: si aprono dal loro indirizzo (`/wiki`, `/tags`, `/gallery`, `/rules`, `/calendar`, `/categories`).

Sul telefono l'intestazione è una sola riga che resta in vista mentre scorri: il pulsante a sinistra («Menu e pagine») apre la barra, che si chiude con Esc, con × o toccando fuori; la lente apre la ricerca. Col dito i cestini accanto alle righe non ci sono: una pagina si elimina dalla sua modifica, una cartella da Categorie. Sul computer la freccia in cima alla barra la nasconde e la freccia opposta la riapre; il browser se lo ricorda. Una freccia uguale, in cima alla colonna a destra delle pagine quando c'è, fa lo stesso con quella colonna. Il riquadro centrale occupa lo spazio che le colonne lasciano libero. Chi preferisce la pagina più larga la tiene chiusa anche sul computer (Profilo › «Barra a sinistra»). Nel Profilo la barra parte nascosta e si apre con la freccia, in Amministrazione è chiusa e si apre col pulsante.

## Pagine

Ogni cosa della wiki è una **pagina**, nell'albero a sinistra, con un indirizzo `/wiki/…`, una cartella, dei tag, chi la può vedere, la colonna a lato e la cronologia delle modifiche. Le pagine sono di quattro tipi:

| Tipo | Cos'è | Chi la crea |
|---|---|---|
| **Pagina** | Bianca, oppure fotocopiata da un template | Tutti quelli che hanno fatto l'accesso |
| **Template** | Una pagina da fotocopiare: blocchi, colonna a lato e icona decisi da chi la scrive | Master |
| **Mappa** | Un'immagine con pin e livelli, più il testo della pagina | Master |
| **Cronologia** | Eventi in ordine di data, più il testo della pagina | Master |

- **Nuova pagina** chiede da dove partire: **pagina bianca** o uno dei **template**; il Master trova sotto anche «Nuovo template», «Nuova mappa» e «Nuova cronologia».
- **Template**: alla creazione della wiki ce ne sono già alcuni (PNG, Luogo, Fazione, Resoconto di sessione…) nella linguetta **Template** della barra a sinistra. Si modificano come ogni pagina: la struttura (titoli, riquadri, segreti, colonna a lato, icona) è quella che scrivi tu. Dalla pagina del template, «Usa questo template» crea la fotocopia; il Master può trasformare in template qualsiasi pagina (e viceversa) con la casella «È un template». La casella «Le copie sono resoconti di sessione» fa delle copie dei resoconti (numero, data, voce nella cronologia della campagna). Cambiare un template non cambia le pagine già fatte.
- **Chi la vede**: pubblica, giocatori, solo Master, oppure personale (solo tu: va bene per gli appunti privati).
- **Opzioni pagina**: mentre modifichi la pagina, il pulsante accanto ad Annulla apre le opzioni: chi la vede, «Anche i giocatori possono modificarla», «È un template» e «Pagina home» (per chi le può cambiare), e il link alle versioni della pagina. Si chiude con Esc o cliccando fuori, e le scelte valgono anche a pannello chiuso. Se hai modifiche non salvate, prima di aprire le versioni la wiki te lo chiede.
- **Copertina e icona**: come in Notion, in cima alla pagina può esserci una copertina; l'icona della pagina sta a sinistra del titolo. Mentre modifichi la pagina, l'icona dell'immagine accanto a Salva e Annulla («Aggiungi copertina») apre un pannello: un'immagine della **Galleria**, una **Tinta unita** oppure un file da **Caricare**. Sul lato della copertina tre piccole icone la cambiano, la riposizionano (trascinando l'immagine, oppure con le frecce su e giù; Invio conferma) e la tolgono. L'icona (la stessa dell'albero) si sceglie cliccandola, a sinistra del titolo.
- **Colonna a lato**: di base la pagina non ce l'ha. Mentre la modifichi, il pulsante «+» a destra aggiunge la colonna, che resta in vista mentre scorri il testo; dentro metti dei riquadri:
  - **Testo**: un titolo e un testo breve (es. «Allineamento: Caotico buono»); anche lì si può scrivere `[[Pagina]]`;
  - **Immagine**: trascinala dal computer sul riquadro oppure usa «Scegli un'immagine»; se vuoi, scrivi un titoletto (sta sopra l'immagine) e una didascalia (sotto).

  Per cambiare l'ordine trascina un riquadro dalla maniglia a sinistra del titolo, col mouse o col dito (vicino al bordo dello schermo la pagina scorre da sola), oppure usa le frecce su e giù. La crocetta toglie un riquadro; vuota, la colonna si toglie con «Togli la colonna». La prima immagine è anche quella della pagina: compare nella galleria e nell'anteprima dei collegamenti. Le pagine fatte con un template partono con i riquadri del template.
- **Cronologia delle modifiche**: dall'icona dell'orologio in fondo alla pagina vedi le versioni precedenti, cosa è cambiato e puoi ripristinarle.
- **Cestino**: le pagine eliminate (anche mappe e cronologie, con pin ed eventi) si recuperano dal Cestino: ogni riga mostra chi ha creato la pagina e quando, l'ultima modifica e le icone per recuperarla o eliminarla per sempre.

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

Con i pulsanti della barra inserisci immagini (con la descrizione per chi non vede), tabelle e riquadri «Nota», «Consiglio», «Attenzione».

La pagina è fatta di **blocchi**: un paragrafo, un titolo, un'immagine, una tabella, un riquadro. Passando col mouse su un blocco compaiono in alto a destra:

- il **più**, che aggiunge subito dopo un blocco di **testo** o un'**immagine**;
- l'**occhio**, solo per il Master, che **oscura** il blocco: diventa un **segreto del Master**, che i giocatori non vedono e non trovano neanche cercando. Lo stesso occhio lo mostra di nuovo;
- il **cestino**, che elimina il blocco per intero.

Nell'editor il blocco oscurato ha lo sfondo dei segreti, e sopra il primo di quelli di fila il lucchetto con «Segreto del Master»; nella pagina i blocchi oscurati di fila stanno in un solo riquadro. Da tastiera c'è il lucchetto nella barra, che oscura (o mostra) i blocchi in cui stai scrivendo o che hai selezionato, e il cestino nella barra, che elimina il blocco in cui stai scrivendo. Un blocco nuovo nasce oscurato se lo fai da un blocco oscurato: andando a capo, col più, inserendo un'immagine o una tabella. Copiando e incollando un blocco oscurato, la copia è oscurata anche lei. Il primo pulsante della barra annulla l'ultima azione (come Ctrl+Z).

**Pagine con un segreto**: chi può modificare la pagina la modifica anche se il Master ci ha oscurato qualcosa. Un giocatore non riceve i blocchi oscurati, nemmeno nell'editor; quando salva, ognuno torna subito dopo il blocco che lo precedeva (se l'ha eliminato, dopo il primo blocco prima di quello che c'è ancora). Il giocatore non può oscurare blocchi, e ripristinando una versione vecchia non ne tira fuori i segreti. Visibilità, permessi ed eliminazione di una pagina con un segreto restano al Master, anche se la pagina l'ha scritta il giocatore.

Da tastiera: con Tab entri nella barra, con le frecce ti muovi tra i comandi, con Esc esci dall'editor.

Un collegamento a una pagina che non esiste è **rosso tratteggiato**: cliccandolo la crei.

Un collegamento a una pagina che esiste la apre in un popup, con tutto il suo contenuto e la pagina di partenza che resta sotto. In alto a destra ci sono i tasti per portarla sulla schermata principale e per chiudere il popup. Con Ctrl (Cmd sul Mac) si apre invece in una nuova scheda. Sul telefono niente popup: si apre la pagina, e il tasto Indietro riporta a quella di prima.

## Mappe

Una mappa è una pagina: il Master la crea con Nuova pagina › «Nuova mappa», carica l'immagine e aggiunge i **pin**: con «Aggiungi pin», sotto i tasti dello zoom, e un clic sulla mappa. Da tastiera, Invio su «Aggiungi pin» crea il pin al centro della vista. Il pin si posiziona e un popup chiede i suoi dati: Salva lo crea, Esc o la X in alto a destra lo lasciano perdere. Un pin può aprire una pagina o un'altra mappa (regno › città › edificio). Cliccando su un pin collegato a una pagina (o con Invio), la pagina si apre in sovraimpressione, sopra la mappa: Esc, la X o un clic fuori la chiudono, «Apri la pagina intera» porta alla pagina vera e propria.

I **livelli** raggruppano i pin e si accendono e spengono dal tasto «Livelli», sotto «Aggiungi pin»: c'è sempre il **Livello base**, visibile a tutti, dove finisce ogni pin a cui non scegli un altro livello; «Nuovo livello» nello stesso elenco ne crea un altro, col nome e la visibilità; «Gestisci i livelli», sotto la mappa, li rinomina e li elimina; un livello «Solo Master» è invisibile ai giocatori. Indicando la larghezza reale della mappa compare il righello per misurare le distanze.

Tutti i pin sono anche nell'elenco sotto la mappa. Immagine, scala e mappa che la contiene si cambiano modificando la pagina; la «Descrizione» che scrivi lì, il testo della pagina, compare in un riquadro sopra la mappa.

## Galleria

Tutte le immagini della campagna in un posto solo: le immagini delle pagine (copertine e colonna a lato), quelle inserite nel testo, le mappe e le risorse, le più recenti prima. Sotto ogni immagine c'è dove compare; cliccandola si apre in grande (frecce ← → per scorrere, Esc per chiudere). Si possono vedere tutte, solo quelle delle pagine, solo le mappe o solo le risorse. Ognuno vede solo le immagini delle pagine, delle mappe e delle risorse che può vedere.

## Risorse

Immagini, musica e altri file della campagna: dispense, ritratti, sottofondi per le sessioni. Stanno nella linguetta **Risorse** dell'albero a sinistra, divise in Immagini, Audio e Altri file, e nella pagina Risorse della barra.

Il Master le carica con «Carica una risorsa»: immagini (PNG, JPEG, WebP o GIF, fino a 25 MB), audio (MP3, OGG, WAV, FLAC o M4A) o qualsiasi altro file, fino a 90 MB. Se non scrive un titolo si usa il nome del file. Come per le mappe sceglie chi le vede: pubbliche, giocatori o solo Master.

Tra le Immagini ci sono anche tutte quelle usate nella wiki, cioè copertine, colonna a lato, testo delle pagine e mappe, senza doverle caricare di nuovo: ognuno vede solo quelle che può vedere. Compaiono con il nome del file; la loro scheda dice dove compaiono e con la matita il Master cambia solo il nome (l'estensione del file resta); il resto si cambia nella pagina che le usa.

Le immagini si guardano e l'audio si ascolta direttamente nella wiki, anche dal telefono; gli altri file (PDF compresi) si scaricano. Cliccando una risorsa si apre la sua scheda: con la matita in alto a destra il Master ne cambia titolo, descrizione, visibilità e file, o la elimina.

Le risorse entrano nel backup, ma non ancora nel pacchetto mondo.

## Cronologie e calendario

Una cronologia è una pagina, e se ne possono fare quante se ne vogliono (Nuova pagina › «Nuova cronologia»). Ognuna è di uno di due tipi:

- **del mondo**: la storia, in ordine di data nel mondo, scritta dal Master (alla creazione della wiki c'è già la «Cronologia del mondo»);
- **della campagna**: cosa è successo al tavolo, in ordine di data di gioco; anche i giocatori aggiungono eventi, e i **resoconti di sessione** compaiono da soli (c'è già la «Cronologia della campagna»).

Gli eventi si vedono in elenco o sulla linea del tempo; ognuno appartiene alla sua cronologia.

- **Calendario**: gregoriano, Harptos (Forgotten Realms), semplice o inventato (mesi, feste, anni bisestili, ere, «oggi nel mondo»).

## Regole

Pagina **Regole**: 999 voci dell'SRD 5.2 (in inglese) da cercare e citare. Nelle pagine, `@incantesimo[Fireball]` diventa un link alla scheda della regola con il pulsante **i** per l'anteprima. Accendendo il plugin **D&D Beyond** (Amministrazione › Plugin), il link porta invece alla ricerca di D&D Beyond. Ogni regola mostra le pagine che la citano: le vostre regole della casa restano collegate.

## Bacheche

Le bacheche sono pagine: **Nuova pagina › Nuova bacheca**, con le colonne di partenza (una per riga). Stanno nell'albero come le altre pagine e hanno la loro visibilità: **Personale** (solo tu), Giocatori, Solo Master. Chi vede la bacheca aggiunge e sposta le schede (con le frecce o trascinandole); nel testo vanno bene `[[Pagina]]` e `@regole`. Le colonne le aggiunge, rinomina, sposta ed elimina chi può modificare la pagina. Le bacheche non entrano nel pacchetto mondo.

## Profilo

In alto a destra c'è il tuo profilo: la tua icona, il tuo nome e il tuo grado nella campagna (Master o Giocatore). Cliccandoci si apre il menu con le tue campagne (se ne hai più d'una), **Profilo**, **Campagna** (per il Master), **Amministrazione** (solo per l'Admin) ed **Esci**; sul telefono in alto resta solo l'icona, e nome e grado si leggono nel menu.

**Profilo** e **Amministrazione** si aprono in un popup sopra la wiki: lo chiudi con Esc, con la X o cliccando fuori, e sotto ritrovi la pagina che stavi leggendo. Con Ctrl+clic si aprono come pagine, in un'altra scheda. Sul telefono si aprono direttamente come pagine.

Il **Profilo** ha tre schede:

- **Icona e nome**: il nome visualizzato e l'icona, scelta tra quelle delle pagine (una corona, un cappello da mago, delle spade…) oppure un'immagine caricata (PNG, JPEG, GIF o WebP);
- **Lettura e accessibilità**: le preferenze qui sotto;
- **Password**: cambiarla, vedere quante sessioni sono aperte e chiudere quelle sugli altri dispositivi.

Chi non ha fatto l'accesso trova solo la lettura, salvata nel browser.

## Lettura e accessibilità

Nel **Profilo** ognuno sceglie:

- tema: chiaro, scuro o automatico, come il sistema; Lago, Lago di notte, Neon (o quelli creati dall'Admin);
- dimensione del testo fino al 200%;
- carattere Atkinson Hyperlegible o OpenDyslexic;
- spaziatura ampia, animazioni ridotte, lingua;
- barra a sinistra sempre aperta, oppure chiusa e da aprire col pulsante in alto.

Tutta la wiki si usa da tastiera e con i lettori di schermo; i colori rispettano le regole WCAG 2.2 AA.

## Amministrazione

- **Impostazioni**: nome del sito, lingua predefinita e visitatori. Sotto c'è la **versione** installata, confrontata con l'ultima su GitHub: «Aggiornata» o «Non aggiornata», con il link alle novità e a come aggiornare.
- **Campagne**: crearle, sceglierne il Master, eliminarle.
- **Utenti**: ruoli, disattivazione e, per chi ha dimenticato la password, un link di reimpostazione (vale due giorni, una volta sola).
- **Inviti**: link per entrare nel sito, uno per persona.
- **Temi**: copia un tema e cambia i colori; si salva solo se il testo resta leggibile. Un tema può avere un'immagine di sfondo, che sta dietro i riquadri e si vede solo sugli schermi larghi. Esporta e importa come file (solo i colori: lo sfondo viaggia col pacchetto mondo).
- **Plugin**: accendi e spegni i plugin installati; cliccandone uno si apre una finestra con scopo, istruzioni, autore e contenuto (per crearne uno, vedi [plugin.md](plugin.md)).
- **Backup**, **Pacchetto mondo**, **Esporta in Markdown**: vedi [installazione.md](installazione.md#backup-e-ripristino).
- **Registro**: accessi riusciti e falliti, cambi di ruolo e password, inviti, token di Claude, consensi, backup ed esportazioni degli ultimi sei mesi.

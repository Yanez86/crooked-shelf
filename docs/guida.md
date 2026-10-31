# Guida all'uso

## Chi può fare cosa

| Ruolo | Cosa può fare |
|---|---|
| **Admin** | Tutto, in tutte le campagne: crea le campagne, impostazioni, utenti, inviti, temi, plugin, backup, pacchetti mondo |
| **Master** | Nella sua campagna: crea e modifica tutte le pagine, scrive e vede i segreti, gestisce categorie, tag, mappe, risorse, calendario, cronologia del mondo e giocatori |
| **Giocatore** | Legge, crea pagine, modifica le sue e quelle aperte ai giocatori, aggiunge eventi alla cronologia della campagna, usa le bacheche |
| **Visitatore** | Solo le pagine pubbliche, e solo se l'Admin ha acceso l'accesso dei visitatori |

Le persone entrano con un **invito**: Amministrazione › Inviti › «Crea invito», poi mandi il link. Ogni link funziona una volta sola.

## Campagne

Una installazione può contenere più campagne. Ognuna è una wiki a sé: pagine, cartelle, tag, mappe, cronologie, bacheche, risorse, home e calendario non si vedono dalle altre, e la stessa pagina può avere lo stesso indirizzo in due campagne.

- **Crearne una**: Amministrazione › Campagne › «Nuova campagna», con il nome e il Master. Ogni campagna ha un solo Master; lo stesso account può tenerne più d'una. Parte con la home, i template e le due cronologie.
- **Invitare i giocatori**: il Master apre **Campagna** dal menu del profilo e crea un link di invito. Chi non ha un account lo crea; chi lo ha già accede ed entra nella campagna col suo. Dalla stessa pagina il Master rinomina la campagna e rimuove i giocatori.
- **Cambiare campagna**: chi ne ha più di una le trova in cima al menu del profilo. La scelta resta sul dispositivo. Un collegamento a una pagina si apre nella campagna in cui ti trovi.
- **Eliminarne una**: il Master elimina la sua dalla pagina Campagna, l'Admin qualsiasi da Amministrazione › Campagne, anche l'ultima; per conferma si riscrive il nome. Spariscono per tutti pagine, mappe, cronologie, bacheche, risorse e immagini, e torna solo ripristinando un backup. Chi resta senza campagne può ancora accedere e aspetta un invito.
- Si è Master solo nella propria campagna: nelle altre si è giocatori, se si è stati invitati. L'Admin entra in tutte e vede anche i segreti.
- Esportazione e pacchetti mondo riguardano la campagna in cui ti trovi; il backup riguarda tutta l'installazione.

## La barra a sinistra

Tutta la wiki si raggiunge dalla barra a sinistra (in alto non c'è più il menu orizzontale):

- in cima tre linguette a icona: **Pagine** (il foglio), **Risorse** (l'immagine: immagini, audio e altri file, vedi sotto) e **Template** (i fogli sovrapposti: tutti i template, in ordine di titolo);
- sotto, le icone: **Nuova pagina**, **Nuova cartella** e **Nuovo divisorio** (o **Carica una risorsa**, nelle Risorse; **Nuovo template**, nei Template), chiudi tutto e apri tutto;
- l'**albero**: le categorie sono cartelle che si aprono e si chiudono con un clic (o con Invio da tastiera); dentro ci sono le sottocartelle e le pagine di ogni tipo (pagine, mappe, cronologie, bacheche), ognuna con la sua icona. Le pagine senza categoria stanno in fondo, alla radice. La cartella della pagina che stai leggendo si apre da sola.
- **Nuova cartella** (l'icona della cartella col «+», per Master e Admin): la cartella compare subito in cima all'albero col nome da scrivere; Invio la crea, Esc la lascia perdere. Rinominarle si fa in **Cartelle**, all'indirizzo `/categories`.
- **Riordinare** (Master e Admin): trascina una cartella o una pagina per metterla prima o dopo un'altra, oppure lasciala nel mezzo di una riga per annidarla dentro quella cartella o pagina. Una pagina con voci dentro ha la freccia per aprirle; il titolo porta alla pagina. Da tastiera, sulla riga: **Alt** e le frecce su e giù spostano, destra la mette dentro la voce sopra, sinistra la riporta fuori. Le voci mai spostate restano in fondo, in ordine alfabetico.
- **Nuovo divisorio** (l'icona con le tre righe): aggiunge una riga in fondo all'albero, da trascinare tra una cartella e l'altra. Si elimina dalla sua crocetta.
- **Cestino**: passando su una pagina o una cartella, a destra nella riga compare il cestino (lo vede chi può eliminare quella pagina; le cartelle solo Master e Admin). Una cartella ci va con tutto quello che contiene e, dal **Cestino**, torna intera. Le pagine annidate in una pagina eliminata invece restano e risalgono alla sua cartella.

La **home** è la pagina iniziale del sito, nata con la wiki: dalla matita si scrive la presentazione, con blocchi, riquadri, copertina e icona. A destra, sotto i suoi riquadri, ci sono le pagine modificate e aggiunte di recente. Sta sempre in cima alla barra a sinistra, fuori dalle cartelle, e non si sposta. Non si può eliminare e ce n'è una sola: per cambiarla, Master e Admin spuntano **Pagina home** modificando un'altra pagina, che deve essere Pubblica o Giocatori. Quella di prima torna una pagina come le altre.

In fondo alla barra, su entrambe le linguette, c'è sempre il **Cestino**. Le altre sezioni della wiki (Pagine, cioè l'elenco con i filtri, Tag, Galleria, Regole, Calendario, Cartelle) non hanno una voce di menu: si aprono dal loro indirizzo (`/wiki`, `/tags`, `/gallery`, `/rules`, `/calendar`, `/categories`).

Sul telefono la barra si apre con il pulsante in alto a sinistra («Menu e pagine») e si chiude con Esc, con × o toccando fuori. Sul computer la freccia in cima alla barra la nasconde e la freccia opposta la riapre; il browser se lo ricorda. Una freccia uguale, in cima alla colonna a destra delle pagine quando c'è, fa lo stesso con quella colonna. Il riquadro centrale occupa lo spazio che le colonne lasciano libero. Chi preferisce la pagina più larga la tiene chiusa anche sul computer (Profilo › «Barra a sinistra»). Nel Profilo la barra parte nascosta e si apre con la freccia, in Amministrazione è chiusa e si apre col pulsante.

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
- **Copertina e icona**: come in Notion, in cima alla pagina può esserci una copertina; l'icona della pagina sta a sinistra del titolo. Mentre modifichi la pagina, l'icona dell'immagine accanto a Salva e Annulla («Aggiungi copertina») apre un pannello: un'immagine della **Galleria**, una **Tinta unita** oppure un file da **Caricare**. Sul lato della copertina tre piccole icone la cambiano, la riposizionano (trascinando l'immagine, oppure con le frecce su e giù; Invio conferma) e la tolgono. L'icona (la stessa dell'albero) si sceglie cliccandola, a sinistra del titolo.
- **Colonna a lato**: di base la pagina non ce l'ha. Mentre la modifichi, il pulsante «+» a destra aggiunge la colonna, che resta in vista mentre scorri il testo; dentro metti dei riquadri:
  - **Testo**: un titolo e un testo breve (es. «Allineamento: Caotico buono»); anche lì si può scrivere `[[Pagina]]`;
  - **Immagine**: trascinala dal computer sul riquadro oppure usa «Scegli un'immagine», poi scrivi una didascalia se vuoi.

  Le frecce su e giù cambiano l'ordine, la crocetta toglie un riquadro; vuota, la colonna si toglie con «Togli la colonna». La prima immagine è anche quella della pagina: compare nella galleria e nell'anteprima dei collegamenti. Le pagine fatte con un template partono con i riquadri del template.
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

Con i pulsanti della barra inserisci immagini (con la descrizione per chi non vede), tabelle, riquadri «Nota», «Consiglio», «Attenzione» e il **Segreto del Master**: un riquadro che i giocatori non vedono e non trovano neanche cercando.

Da tastiera: con Tab entri nella barra, con le frecce ti muovi tra i comandi, con Esc esci dall'editor.

Un collegamento a una pagina che non esiste è **rosso tratteggiato**: cliccandolo la crei.

Un collegamento a una pagina che esiste la apre in un popup, con tutto il suo contenuto e la pagina di partenza che resta sotto. In alto a destra ci sono i tasti per portarla sulla schermata principale e per chiudere il popup. Con Ctrl (Cmd sul Mac) si apre invece in una nuova scheda.

## Mappe

Una mappa è una pagina: il Master la crea con Nuova pagina › «Nuova mappa», carica l'immagine e aggiunge i **pin**: con «Aggiungi pin», sotto i tasti dello zoom, e un clic sulla mappa. Da tastiera, Invio su «Aggiungi pin» crea il pin al centro della vista. Il pin si posiziona e un popup chiede i suoi dati: Salva lo crea, Esc o la X in alto a destra lo lasciano perdere. Un pin può aprire una pagina o un'altra mappa (regno › città › edificio). Cliccando su un pin collegato a una pagina (o con Invio), la pagina si apre in sovraimpressione, sopra la mappa: Esc, la X o un clic fuori la chiudono, «Apri la pagina intera» porta alla pagina vera e propria.

I **livelli** raggruppano i pin e si accendono e spengono dal tasto «Livelli», sotto «Aggiungi pin»: c'è sempre il **Livello base**, visibile a tutti, dove finisce ogni pin a cui non scegli un altro livello; «Nuovo livello» nello stesso elenco ne crea un altro, col nome e la visibilità; «Gestisci i livelli», sotto la mappa, li rinomina e li elimina; un livello «Solo Master» è invisibile ai giocatori. Indicando la larghezza reale della mappa compare il righello per misurare le distanze.

Tutti i pin sono anche nell'elenco sotto la mappa. Immagine, scala e mappa che la contiene si cambiano modificando la pagina; la «Descrizione» che scrivi lì, il testo della pagina, compare in un riquadro sopra la mappa.

## Galleria

Tutte le immagini della campagna in un posto solo: le immagini delle pagine (copertine e colonna a lato), quelle inserite nel testo, le mappe e le risorse, le più recenti prima. Sotto ogni immagine c'è dove compare; cliccandola si apre in grande (frecce ← → per scorrere, Esc per chiudere). Si possono vedere tutte, solo quelle delle pagine, solo le mappe o solo le risorse. Ognuno vede solo le immagini delle pagine, delle mappe e delle risorse che può vedere.

## Risorse

Immagini, musica e altri file della campagna: dispense, ritratti, sottofondi per le sessioni. Stanno nella linguetta **Risorse** dell'albero a sinistra, divise in Immagini, Audio e Altri file, e nella pagina Risorse della barra.

Il Master le carica con «Carica una risorsa»: immagini (PNG, JPEG, WebP o GIF, fino a 25 MB), audio (MP3, OGG, WAV, FLAC o M4A) o qualsiasi altro file, fino a 90 MB. Se non scrive un titolo si usa il nome del file. Come per le mappe sceglie chi le vede: pubbliche, giocatori o solo Master.

Le immagini si guardano e l'audio si ascolta direttamente nella wiki, anche dal telefono; gli altri file (PDF compresi) si scaricano. Con «Modifica la risorsa» si cambiano titolo, descrizione, visibilità e file, o la si elimina.

Le risorse entrano nel backup, ma non ancora nel pacchetto mondo.

## Cronologie e calendario

Una cronologia è una pagina, e se ne possono fare quante se ne vogliono (Nuova pagina › «Nuova cronologia»). Ognuna è di uno di due tipi:

- **del mondo**: la storia, in ordine di data nel mondo, scritta dal Master (alla creazione della wiki c'è già la «Cronologia del mondo»);
- **della campagna**: cosa è successo al tavolo, in ordine di data di gioco; anche i giocatori aggiungono eventi, e i **resoconti di sessione** compaiono da soli (c'è già la «Cronologia della campagna»).

Gli eventi si vedono in elenco o sulla linea del tempo; ognuno appartiene alla sua cronologia.

- **Calendario**: gregoriano, Harptos (Forgotten Realms), semplice o inventato (mesi, feste, anni bisestili, ere, «oggi nel mondo»).

## Regole

Pagina **Regole**: 999 voci dell'SRD 5.2 (in inglese) da cercare e citare. Nelle pagine, `@incantesimo[Fireball]` diventa un link a D&D Beyond con il pulsante **i** per l'anteprima. Ogni regola mostra le pagine che la citano: le vostre regole della casa restano collegate.

## Bacheche

Le bacheche sono pagine: **Nuova pagina › Nuova bacheca**, con le colonne di partenza (una per riga). Stanno nell'albero come le altre pagine e hanno la loro visibilità: **Personale** (solo tu), Giocatori, Solo Master. Chi vede la bacheca aggiunge e sposta le schede (con le frecce o trascinandole); nel testo vanno bene `[[Pagina]]` e `@regole`. Le colonne le aggiunge, rinomina, sposta ed elimina chi può modificare la pagina. Le bacheche non entrano nel pacchetto mondo.

## Profilo

In alto a destra c'è il tuo profilo: la tua icona, il tuo nome e il tuo grado (Admin, Master o Giocatore). Cliccandoci si apre il menu con **Profilo**, **Amministrazione** (solo per l'Admin) ed **Esci**; sul telefono in alto resta solo l'icona, e nome e grado si leggono nel menu.

**Profilo** e **Amministrazione** si aprono in un popup sopra la wiki: lo chiudi con Esc, con la X o cliccando fuori, e sotto ritrovi la pagina che stavi leggendo. Con Ctrl+clic si aprono come pagine, in un'altra scheda.

Nel **Profilo** ci sono le preferenze di lettura (sotto), l'icona da scegliere tra quelle delle pagine (una corona, un cappello da mago, delle spade…), il nome visualizzato e la password. Chi non ha fatto l'accesso trova solo le preferenze, salvate nel browser.

## Lettura e accessibilità

Nel **Profilo** ognuno sceglie:

- tema: chiaro, scuro o automatico, come il sistema (o quelli creati dall'Admin);
- dimensione del testo fino al 200%;
- carattere Atkinson Hyperlegible o OpenDyslexic;
- spaziatura ampia, animazioni ridotte, lingua;
- barra a sinistra sempre aperta, oppure chiusa e da aprire col pulsante in alto.

Tutta la wiki si usa da tastiera e con i lettori di schermo; i colori rispettano le regole WCAG 2.2 AA.

## Amministrazione

- **Temi**: copia un tema e cambia i colori; si salva solo se il testo resta leggibile. Un tema può avere un'immagine di sfondo, che sta dietro i riquadri e si vede solo sugli schermi larghi. Esporta e importa come file (solo i colori: lo sfondo viaggia col pacchetto mondo).
- **Plugin**: accendi e spegni i plugin installati (vedi [plugin.md](plugin.md)).
- **Backup**, **Pacchetto mondo**, **Esporta in Markdown**: vedi [installazione.md](installazione.md#backup-e-ripristino).

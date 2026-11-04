# Novità

Le versioni seguono il [versionamento semantico](https://semver.org/lang/it/): MAGGIORE.MINORE.CORRETTIVA.
Questo file è anche la pagina «Novità» della wiki (`/changelog`).

## 0.13.0 — 2026-11-04

Versione dedicata alla sicurezza, dopo una revisione completa del codice. Niente cambia per chi gioca; per chi installa c'è un passaggio in più alla prima configurazione.

### Aggiunte
- Prima configurazione con un codice: finché la wiki non ha utenti, `/setup` chiede il codice scritto nei log del server (o in `CS_SETUP_TOKEN`), così la wiki la configura chi ha il server e non chi arriva prima all'indirizzo. Due richieste insieme non creano più due amministratori.
- Limiti ai tentativi: accessi falliti per indirizzo (20 ogni 10 minuti, oltre ai 5 per nome utente), e per indirizzo su registrazione, cambio password, connettore di Claude, caricamenti e `/mcp`, più un tetto agli hash delle password in corso: un'ondata di accessi con nomi inventati non satura più il server. All'avvio la wiki avvisa nei log se le intestazioni del proxy e `CS_TRUST_PROXY` non tornano.
- I file si scaricano solo da chi può vedere ciò che li usa (pagina, anche nel cestino o nelle versioni, mappa, risorsa, tema, avatar): l'indirizzo casuale non basta più. Un file appena caricato lo vede solo chi l'ha caricato; quelli che nessuno usa da un giorno si eliminano da soli.
- Quota di spazio per le immagini dei giocatori (`CS_UPLOAD_QUOTA_MB`, 512 MB di base; Master e Admin senza limite) e corpo delle richieste limitato per tipo di pagina (64 KB per chi non ha fatto l'accesso).
- Sessioni: scadono comunque dopo 90 giorni dall'accesso; dal Profilo › Password si vedono quante sono aperte e si chiudono le altre. In HTTPS il cookie ha il prefisso `__Host-`: dopo l'aggiornamento si rifà l'accesso una volta.
- Token di Claude con data di creazione e ultimo uso, visibili in Campagna › Claude; fermi da 90 giorni smettono di valere. Il consenso del connettore verso un sito che non è di Claude chiede una conferma esplicita.
- Password dimenticata: l'Admin crea un link di reimpostazione da Amministrazione › Utenti (due giorni, una volta sola). Le password più comuni, o che contengono il nome utente, vengono rifiutate.
- Amministrazione › Registro: accessi riusciti e falliti, cambi di ruolo e password, inviti, token di Claude, consensi, backup ed esportazioni degli ultimi sei mesi.
- Intestazioni `Strict-Transport-Security` (in HTTPS), `Permissions-Policy` e `Cross-Origin-Opener-Policy`.

### Modifiche
- Il backup esce a pezzi, un file alla volta: una wiki con molti GB di immagini non passa più dalla memoria. I pacchetti mondo da importare hanno un limite configurabile (`CS_PACK_MAX_MB`, 200 di base) e i file dell'anteprima si puliscono da soli.
- Documentazione: cosa può davvero un Admin (il backup contiene tutto), come esporre la wiki dietro un proxy solo su `127.0.0.1`, le nuove variabili.
- CI: azioni GitHub fissate al commit e `npm audit` sulle dipendenze di produzione.

### Correzioni
- Open redirect: `/login?next=/\sito.esterno` (barra rovesciata) portava fuori dalla wiki dopo l'accesso; lo stesso nei collegamenti delle pagine. Ora passano solo percorsi interni.
## 0.12.4 — 2026-11-04

### Aggiunte
- Appuntamenti: il Master che prepara l'appuntamento sceglie come gioca, in presenza o da remoto (con un modo solo è quello). Si vede nella scheda e nel popup di ogni data, accanto al suo nome.

### Correzioni
- Home: nella prossima sessione il Master non risulta più «Non hai ancora risposto», ma col modo scelto nell'appuntamento.

## 0.12.3 — 2026-11-04

### Aggiunte
- Barra a sinistra: la linguetta Tag, tra Pagine e Risorse, con i tag nel loro colore e il numero di pagine; un clic apre le pagine con quel tag. Il Master ne cambia nome e colore dall'icona «Nomi e colori dei tag».

### Modifiche
- Appuntamenti: gli avatar accanto ai nomi nelle schede e il bordo delle figure più sottile.

## 0.12.2 — 2026-11-03

### Aggiunte
- Appuntamenti: cliccando una data nel calendario si apre un popup con le specifiche della sessione, dove si risponde anche. Sotto ogni appuntamento ci sono le figure di chi viene: il Master con il bordo dell'accento, chi viene in presenza, chi da remoto con il bordo blu e chi non c'è con la croce rossa.
- Home: sotto il tavolo, la prossima sessione (con lo stato e la propria risposta) e le date del mese a cui il giocatore non ha ancora risposto.
- Stars & Wishes: dopo ogni sessione, a chi aveva risposto «Ci sono», due domande in un popup entrando nella campagna: che cosa gli è piaciuto e che cosa vorrebbe esplorare. Si accende in Campagna › Appuntamenti; non è obbligatorio, si risponde una volta sola e le risposte le legge solo il Master, negli Appuntamenti.
- Claude come connettore: da claude.ai la wiki si aggiunge come connettore personalizzato, con un indirizzo per campagna (`/mcp/<id>`) e accesso e consenso nella wiki. Claude lavora su una campagna solo col suo Master.
- Avatar: nel profilo si carica un'immagine (PNG, JPEG, GIF o WebP) che prende il posto dell'icona.

### Modifiche
- La pagina Campagna è divisa in schede: Generale, Giocatori, Appuntamenti, Claude. Token e connettori di Claude si gestiscono in Campagna › Claude, non più nel Profilo.
- Anche il Profilo è diviso in schede: Icona e nome, Lettura e accessibilità, Password. Il vecchio indirizzo `/preferences` apre la scheda della lettura.

## 0.12.0 — 2026-11-03

### Aggiunte
- Appuntamenti: ogni campagna ha il calendario delle sessioni di gioco, un mese per pagina, da «Appuntamenti» in fondo alla barra a sinistra. Il Master fissa un appuntamento con data, orario e modo (in presenza con il luogo, da remoto, o tutti e due), anche ripetuto ogni settimana, ogni 2 settimane od ogni mese (lo stesso giorno della settimana, es. il primo giovedì), fino a una data o senza fine; una sola data della serie si annulla. I giocatori rispondono per ogni data: in presenza, da remoto o «Non ci sono», e sotto ogni data si vede chi viene e come, chi no e chi non ha risposto. In Campagna › Appuntamenti il Master mette il link per giocare da remoto (Discord o altro) e la regola del minimo: sotto un certo numero di giocatori confermati la sessione salta, decisa un certo numero di ore prima (di base 24). Lo vedono il Master e i giocatori, non i visitatori. L'ora è quella del server: con Docker si imposta con `TZ`.

## 0.11.1 — 2026-11-03

### Correzioni
- Il menu utente non finisce più sotto il contenuto della pagina con i temi che danno all'intestazione un effetto vetro, come Neon.
- Home: il pulsante per nascondere la colonna a lato non resta più coperto dalla colonna stessa.

## 0.11.0 — 2026-11-03

### Aggiunte
- Schede giocatore: ogni campagna ha la cartella PG, con una scheda per ogni giocatore dove tiene il personaggio, gli appunti e le sue cose. La scheda nasce da sola quando il giocatore entra nella campagna (nelle campagne di prima, alla prima visita), col nome del giocatore come titolo, da cambiare con quello del personaggio. La vedono tutti i giocatori e la modificano lui e il Master; si sceglie solo tra Pubblica e Giocatori, non ha segreti del Master, resta nella cartella PG e non va nel cestino finché il giocatore è al tavolo. Con «Nuova pagina qui dentro» il giocatore ci mette le sue pagine, che partono Personali. Il template delle schede nuove è «Scheda giocatore», generico, oppure un altro scelto dal Master in Campagna › Schede giocatore. Le schede non entrano nel pacchetto mondo.
- Home: in cima alla colonna a destra c'è chi è al tavolo, il Master e i giocatori; il nome di un giocatore porta alla sua scheda. I visitatori senza account non lo vedono.
- Plugin D&D Beyond: il template «Scheda D&D» (specie, classe, livello, background, allineamento) col link alla scheda del personaggio su D&D Beyond. Se il plugin era già acceso, spegnilo e riaccendilo per averlo.
- Due temi nuovi, Lago e Lago di notte: grigi freddi, accento verde petrolio, contrasti WCAG AA con margine. Si scelgono da Profilo.
- Tema Neon, scuro e cyberpunk: notte viola, magenta e ciano, fuoco giallo acido. Oltre ai colori ha uno stile suo: titoli larghi con bagliore e ombra cromatica, intestazione in vetro col filo di luce, riquadri con due angoli tagliati e staffe luminose, griglia in prospettiva e scanline sullo sfondo, segreti a strisce come un fascicolo riservato. Gli effetti stanno dietro al testo, quindi i contrasti WCAG AA restano quelli misurati; il movimento si ferma con «Riduci il movimento» e con i colori forzati del sistema restano solo testo e bordi. Una copia del tema prende i colori ma non gli effetti.
- Il marchio nell'intestazione e l'icona della scheda del browser prendono i colori del tema: fondo nel colore principale, libri nel colore che ci sta sopra. Vale anche per i temi creati dall'Admin; con «Automatico» l'icona segue il chiaro o scuro del sistema.
- Plugin per Claude Code: Claude cerca e legge le pagine di una campagna per rispondere alle tue domande, con i tuoi stessi permessi. Se lo permetti quando crei il token, può anche creare pagine e cambiarne il testo: niente eliminazioni, niente impostazioni, e ogni modifica lascia una versione. Il token si crea da Profilo › Claude; le istruzioni sono in [docs/claude.md](docs/claude.md).
- Colonna a lato: i riquadri si spostano anche trascinandoli dalla maniglia a sinistra del titolo, col mouse o col dito; vicino al bordo dello schermo la pagina scorre da sola. Le frecce restano per la tastiera. I riquadri immagine hanno un titoletto facoltativo, sopra l'immagine.
- Pacchetto mondo: si importa anche in una campagna nuova, creata per quel mondo. Dopo «Controlla il contenuto» l'Admin sceglie «In una campagna nuova», con nome e Master. La campagna prende il calendario del pacchetto e la sua home (i pacchetti esportati da adesso dicono quale pagina è la home; con quelli di prima la home nasce vuota). I template preinstallati e la cronologia del mondo arrivano solo se il pacchetto non li ha, così non ci sono doppioni.
- Amministrazione › Impostazioni mostra la versione installata e la confronta con l'ultima su GitHub: «Aggiornata» o «Non aggiornata», con i link alle novità e a come aggiornare. Il controllo parte solo quando un Admin apre la pagina, al massimo una volta all'ora; con `CS_UPDATE_CHECK=0` la wiki non contatta GitHub.

### Modifiche
- L'Admin non vede più i segreti delle campagne che non tiene. Admin vuol dire gestire il sito (utenti, campagne, inviti, backup, plugin), non avere i poteri del Master ovunque: è Master solo nelle campagne che tiene, giocatore in quelle in cui è invitato, e nelle altre non entra (le gestisce da Amministrazione › Campagne). Nel pacchetto mondo, dove è giocatore non può includere i segreti né importare nella campagna corrente; importando in una campagna nuova, le pagine le scrive il Master che la riceve, segreti compresi. Un Admin non può nominarsi Master di una campagna che esiste già: lo fa un altro Admin; di una campagna nuova invece può essere lui il Master.
- Telefono: tutta la wiki rivista per il dito. Testo a 16px e campi che non fanno più ingrandire la pagina; intestazione su una riga, sempre in vista, con la ricerca dietro la lente; scheda della pagina compatta, nome e valore sulla stessa riga; elenchi a righe, filtri a due a due, miniature a due per riga; in modifica Salva segue il pollice; bersagli più grandi e mappa più bassa, così la pagina si scorre. I collegamenti aprono la pagina invece del popup, e Indietro funziona.
- Sopra il titolo di una pagina, al posto della categoria, c'è il percorso per arrivarci: cartella » pagina » sottopagina. Ogni voce porta lì.
- Pulsanti uguali ovunque: per modificare c'è sempre la matita, Salva ha il dischetto a sinistra e ogni popup si chiude con la X, compresi la scelta dell'icona, i livelli della mappa e le domande dell'editor su collegamenti e testo alternativo, che prima erano finestre del browser.
- Risorse: tra le Immagini ci sono anche tutte quelle usate nella wiki (copertine, colonna a lato, testo delle pagine, mappe), con il nome del file e l'elenco di dove compaiono. La matita in alto a destra c'è su ogni risorsa: sulle immagini della wiki il Master ne cambia il nome.
- D&D Beyond diventa un plugin incluso, spento di base: per riavere i link al sito accendilo da Amministrazione › Plugin. Senza plugin, `@incantesimo[Fireball]` porta alla scheda della regola, o resta testo se la voce non è nell'elenco. Altri plugin possono aggiungere link ad altri siti.
- Plugin: ogni plugin dice a cosa serve e come si usa. Cliccandolo si apre una finestra con scopo, istruzioni, autore, licenza e contenuto.
- Barra a sinistra: sotto le icone delle linguette c'è il nome: Pagine, Risorse, Template.
- Editor: passando col mouse su un blocco compare un cestino che lo elimina per intero; lo stesso comando è nella barra, per il blocco in cui si sta scrivendo.
- Editor: Annulla e Ripeti sono i primi pulsanti della barra.
- I collegamenti tra le pagine si aprono in un popup con tutta la pagina, senza la barra a sinistra. In alto a destra, accanto alla X, un tasto la porta sulla schermata principale.
- Temi: un tema può avere un'immagine di sfondo, ferma dietro i riquadri mentre la pagina scorre. Si carica nell'editor dei temi e sugli schermi stretti non compare, perché lì il testo non ha un riquadro sotto. Il pacchetto mondo la porta con sé, «Esporta» no.
- Mappe: creando o modificando una mappa si può scrivere una descrizione, che compare in un riquadro sopra la mappa.
- Una installazione può contenere più campagne, ognuna con un solo Master e con pagine, cartelle, tag, mappe, cronologie, bacheche, risorse, home e calendario tutti suoi. L'Admin le crea in Amministrazione › Campagne; il Master invita i suoi giocatori dalla nuova pagina Campagna; chi è in più campagne le cambia dal menu del profilo. La wiki che c'era diventa la prima campagna: la tiene il primo Master (o, se non ce ne sono, il primo Admin) e tutti gli altri ne fanno parte. Se c'erano più Master, gli altri lì diventano giocatori: l'Admin può cambiare il Master da Amministrazione › Campagne.
- Una campagna si può eliminare per sempre, con tutto ciò che contiene: il Master la sua dalla pagina Campagna, l'Admin qualsiasi da Amministrazione › Campagne. Per conferma si riscrive il nome.
- Mappe: di base l'immagine è larga come la colonna centrale. Il riquadro si allunga con l'immagine, fino al doppio dell'altezza di prima; se l'immagine è ancora più alta, il resto si raggiunge trascinando o rimpicciolendo.
- Mappe: via il pulsante «Pin al centro della vista». Da tastiera, Invio su «Aggiungi pin» crea il pin al centro della vista.
- Mappe: i tasti dello zoom stanno in alto a destra e «Aggiungi pin» sta sulla mappa, subito sotto. Cliccando sulla mappa il pin si posiziona e i suoi dati si inseriscono in un popup, lo stesso che si apre modificando un pin: si chiude con la X in alto a destra o con Esc.
- Le bacheche sono pagine: si creano da «Nuova pagina», stanno nell'albero e hanno la visibilità delle pagine (le personali restano visibili solo a te). Quelle che c'erano sono nella cartella Bacheche.
- «Nuova pagina» propone prima cosa fare (pagina bianca, bacheca, cronologia, template, mappa), poi le fotocopie dei template.
- «Nuova cartella» crea la cartella direttamente nell'albero a sinistra, col nome da scrivere: Invio la crea, Esc la lascia perdere.
- Albero a sinistra: Master e Admin trascinano cartelle e pagine per ordinarle o annidarle, anche dentro una pagina (da tastiera: Alt e le frecce). Un nuovo pulsante aggiunge un divisorio tra le voci.
- Passando su una pagina o una cartella dell'albero compare il cestino. Anche le cartelle ora vanno nel cestino, con quello che contengono, e tornano intere.
- Colonna a destra delle pagine: il titolo di ogni riquadro occupa tutta la larghezza, con il testo a capo sotto.
- La colonna centrale sta in un riquadro che occupa lo spazio libero, secondo le colonne presenti, e albero, testo e colonna a destra hanno lo stesso aspetto. Sul telefono il riquadro centrale non c'è: lo spazio serve al testo.
- Il contenuto della colonna centrale segue la sua larghezza, in lettura e in modifica: niente più spazio vuoto a destra.
- Barra a sinistra: larga come la colonna a destra e più compatta.
- Via le sezioni in cima alla barra a sinistra. Il menu del profilo ha solo Profilo, Amministrazione ed Esci; il Cestino è sempre l'ultima voce della barra a sinistra.
- In modifica, la copertina si aggiunge dall'icona dell'immagine accanto a Salva e Annulla.
- La home è una pagina della wiki: si modifica dalla matita, con blocchi, riquadri, copertina e icona come tutte le altre. A destra, sotto i suoi riquadri, le pagine modificate e aggiunte di recente. Categorie e pagine del mondo stanno nell'albero a sinistra.
- Pagine: l'icona sta a sinistra del titolo, senza bordo, con o senza copertina.
- I popup si chiudono con la sola X, senza la scritta «Chiudi».
- Mappe: i livelli si aprono da un tasto sulla mappa, sotto «Aggiungi pin». C'è sempre il Livello base, visibile a tutti, dove finiscono i pin a cui non si sceglie un altro livello; «Nuovo livello» nell'elenco ne crea un altro, col nome e la visibilità.
- Cestino: per ogni pagina il titolo, chi l'ha creata e quando, l'ultima modifica, e due icone per recuperarla o eliminarla per sempre.
- Modificando una pagina si può scegliere «Pagina home»: diventa la pagina iniziale del sito al posto di quella di prima. La home sta in cima alla barra a sinistra, fuori dalle cartelle, e non si può eliminare.
- Pagine: la matita sta sul bordo destro del testo e la colonna a lato parte alla stessa altezza dell'albero; in modifica resta in vista mentre si scorre il testo, e se è lunga scorre da sola.
- Barra a sinistra: in alto le linguette Pagine, Risorse e Template, grandi icone al centro, sotto le icone per creare una pagina, creare una cartella, chiudere e aprire tutto.
- I template hanno la loro linguetta nella barra a sinistra, con il pulsante Nuovo template: non stanno più tra le pagine dell'albero.
- Barra a sinistra: una freccia in alto la nasconde e lascia tutta la larghezza alla pagina; la freccia opposta la riapre. Anche nel Profilo, dove parte nascosta. Una freccia uguale nasconde la colonna a destra delle pagine, quando c'è.
- Amministrazione e Profilo: tutte le sezioni stanno in una sola colonna al centro della pagina, con riquadri della stessa larghezza. Nelle tabelle i controlli sono allineati al testo e le azioni stanno a destra; in Utenti icona, nome e nome utente stanno insieme, come nel profilo.
- Profilo e Amministrazione si aprono in un popup sopra la wiki: si chiude con Esc, con la X o cliccando fuori, e sotto c'è ancora la pagina che stavi leggendo.
- La cronologia delle modifiche si apre dall'icona dell'orologio in fondo alla pagina, accanto a chi l'ha creata e modificata.
- Tutti i testi della wiki sono leggermente più piccoli. La dimensione si regola sempre dal Profilo, fino al 200%.
- Modifica di una pagina: chi la vede, «Anche i giocatori possono modificarla», template e home stanno in «Opzioni pagina», il pulsante accanto ad Annulla, insieme al link alle versioni della pagina. Chiuse, le scelte si salvano lo stesso; se ci sono modifiche non salvate, prima di aprire le versioni si chiede conferma.

### Correzioni
- Sul telefono la tabella degli utenti non allarga più tutta la pagina.
- Il contorno del fuoco non compare più usando il mouse: resta per chi si muove con la tastiera, da Tab in poi.
- Colonna a lato sul telefono: le frecce dei riquadri immagine coprivano la matita e la × sull'immagine. Ora stanno nella riga in cima al riquadro, sopra l'immagine.

## 0.10.0 — 2026-10-29

### Aggiunte
- Pagina «Novità» con l'elenco delle versioni, raggiungibile dal numero di versione in fondo alla pagina.
- Albero a sinistra: pulsanti per aprire tutte le cartelle, chiuderle tutte e creare una nuova cartella.

## 0.9.0 — 2026-10-29

### Aggiunte
- Wiki con accesso, ruoli, editor a blocchi, collegamenti, categorie, tag, ricerca, italiano e inglese, temi accessibili.
- Template, immagini, mappe con pin e livelli, cronologie con calendari personalizzati.
- Regole con anteprima SRD 5.2, bacheche, cronologia delle modifiche, cestino, editor dei temi.
- Plugin, backup, pacchetto mondo, esportazione Markdown, Docker.
- Albero delle cartelle e delle pagine, immagine della pagina, galleria.

### Modifiche
- Revisione grafica: menu sul telefono, gerarchia delle azioni, scala dei caratteri, schede, home, stati vuoti.

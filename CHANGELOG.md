# Novità

Le versioni seguono il [versionamento semantico](https://semver.org/lang/it/): MAGGIORE.MINORE.CORRETTIVA.
Questo file è anche la pagina «Novità» della wiki (`/changelog`).

## 0.11.0 — 2026-10-30

### Modifiche
- Sopra il titolo di una pagina, al posto della categoria, c'è il percorso per arrivarci: cartella » pagina » sottopagina. Ogni voce porta lì.
- Pulsanti uguali ovunque: per modificare c'è sempre la matita, Salva ha il dischetto a sinistra e ogni popup si chiude con la X, compresi la scelta dell'icona, i livelli della mappa e le domande dell'editor su collegamenti e testo alternativo, che prima erano finestre del browser.
- Risorse: tra le Immagini ci sono anche tutte quelle usate nella wiki (copertine, colonna a lato, testo delle pagine, mappe), con il nome del file e l'elenco di dove compaiono.
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

### Correzioni
- Sul telefono la tabella degli utenti non allarga più tutta la pagina.
- Il contorno del fuoco non compare più usando il mouse: resta per chi si muove con la tastiera, da Tab in poi.

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

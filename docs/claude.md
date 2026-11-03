# Claude

Il plugin per Claude Code porta una campagna nella conversazione: chi è quel personaggio, cosa è successo nell'ultima sessione, quali pagine parlano di un luogo. Claude cerca e legge le pagine da solo e, se glielo permetti, le scrive: un resoconto di sessione, un personaggio nuovo, una correzione.

Claude vede **solo quello che puoi vedere tu** e fa **solo quello che puoi fare tu**. Con un token di un giocatore i segreti non arrivano a Claude; con quello del Master sì.

## Installare

1. Nella wiki, entra nella campagna e apri Profilo › Claude. Spunta «Claude può anche scrivere» solo se ti serve, poi «Crea un token». Copia indirizzo e token: il token si vede una volta sola.
2. In Claude Code:

   ```bash
   claude plugin marketplace add Yanez86/crooked-shelf
   claude plugin install crooked-shelf@crooked-shelf
   ```

3. Quando Claude Code li chiede, inserisci indirizzo e token. Il token resta nel portachiavi del computer.

La wiki deve essere raggiungibile dal computer su cui gira Claude Code.

## Il token

- Vale per una sola campagna, e per una persona ne esiste uno per campagna: crearne un altro sostituisce il precedente.
- Si revoca da Profilo › Claude. Smette di valere anche cambiando la password, se l'account viene disattivato o se esci dalla campagna.
- Di base legge soltanto: per farlo scrivere va creato con la casella spuntata, e i token creati prima restano in lettura.
- Apre solo l'indirizzo `/mcp`: non vale per accedere al resto della wiki.

Il testo delle pagine arriva a Claude, quindi ad Anthropic, come ogni contenuto di una conversazione. Crea il token solo se per il tuo gruppo va bene.

## Cosa legge

Le pagine, con la colonna a lato e l'elenco di chi le cita. Non legge ancora i pin delle mappe, gli eventi delle cronologie e le schede delle bacheche.

## Cosa scrive

Solo il testo delle pagine, in tre modi:

| Strumento | Cosa fa |
|---|---|
| `create_page` | crea una pagina; se non chiedi altro la vedi solo tu |
| `append_to_page` | aggiunge testo in fondo, anche in un blocco segreto se sei Master |
| `replace_text` | sostituisce un pezzo di testo che compare una volta sola |

**Non può** eliminare pagine, cambiare titolo, visibilità, permessi o cartella di una pagina che c'è già, toccare template, mappe, cronologie e bacheche, caricare file, né arrivare a impostazioni, utenti, plugin, temi o backup: per queste cose non esiste nessuno strumento.

Il testo passa da un convertitore che riconosce un elenco chiuso di elementi (titoli, grassetto, corsivo, elenchi, citazioni, collegamenti): HTML e codice restano testo e non vengono mai eseguiti. Valgono le regole del sito: un giocatore modifica solo le pagine che può modificare nel sito.

Ogni modifica lascia una versione nella cronologia della pagina, a tuo nome: da lì si torna indietro.

### Attenzione ai permessi di Claude Code

Claude Code chiede conferma prima di ogni scrittura, mostrando il testo: conviene lasciarla attiva, soprattutto col token del Master. Il testo delle pagine lo scrivono tutti i partecipanti, e una pagina potrebbe contenere istruzioni pensate per ingannare Claude, ad esempio copiare un segreto in una pagina che vedono i giocatori. Claude è istruito a non seguirle, ma la conferma è il controllo che resta nelle tue mani.

## Per chi sviluppa

`src/routes/mcp/+server.ts` parla MCP su HTTP, un messaggio a richiesta e senza sessione; gli strumenti sono in `src/lib/server/mcp.ts` e passano dalle stesse funzioni del sito. Chi aggiunge uno strumento di scrittura deve restare sul testo delle pagine: Claude non manda mai JSON dell'editor, solo Markdown che passa da `fromMarkdown`. Il plugin è in `claude-plugin/`. Per provarlo senza installarlo: `claude --plugin-dir claude-plugin`.

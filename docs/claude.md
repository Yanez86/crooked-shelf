# Claude

Il plugin per Claude Code porta una campagna nella conversazione: chi è quel personaggio, cosa è successo nell'ultima sessione, quali pagine parlano di un luogo. Claude cerca e legge le pagine da solo e, se glielo permetti, le scrive: un resoconto di sessione, un personaggio nuovo, una correzione.

Claude lavora su una campagna **solo col suo Master**: i giocatori non possono collegarlo. Vede quello che vede il Master, segreti compresi, e fa solo quello che il Master può fare.

## Installare

1. Nella wiki, entra nella campagna di cui sei Master e apri Impostazioni campagna › Claude. Spunta «Claude può anche scrivere» solo se ti serve, poi «Crea un token». Copia indirizzo e token: il token si vede una volta sola.
2. In Claude Code:

   ```bash
   claude plugin marketplace add Yanez86/crooked-shelf
   claude plugin install crooked-shelf@crooked-shelf
   ```

3. Quando Claude Code li chiede, inserisci indirizzo e token. Il token resta nel portachiavi del computer.

La wiki deve essere raggiungibile dal computer su cui gira Claude Code.

## Come connettore, su claude.ai

Da claude.ai (e dalle app di Claude) la wiki si aggiunge come connettore personalizzato, senza copiare token:

1. Nella wiki, entra nella campagna di cui sei Master e copia da Impostazioni campagna › Claude l'«Indirizzo del connettore», per esempio `https://wiki.esempio.it/mcp/2`.
2. In Claude apri Impostazioni › Connettori › Aggiungi connettore personalizzato, dagli il nome della campagna e incolla l'indirizzo. Lascia vuoti ID e segreto del client.
3. Claude apre la wiki: fai l'accesso, scegli se Claude può anche scrivere, poi «Consenti».

**Un connettore per campagna**, ognuno col suo indirizzo: il token di uno non apre le altre. In ogni chat accendi solo quello della campagna su cui lavori, così Claude non porta un segreto di una campagna nelle pagine di un'altra.

La wiki deve essere raggiungibile da internet in HTTPS (vedi [Installazione](installazione.md)): a collegarsi sono i server di Anthropic, non il tuo computer.

Il connettore ha un token suo, che non sostituisce quello del plugin. In Impostazioni campagna › Claude si vede da quali siti è collegata la campagna; «Revoca» li chiude tutti, e per tornare basta ricollegarsi da Claude.

## Il token

- Vale per una sola campagna, e solo finché ne sei il Master. Il token del plugin è uno per campagna: crearne un altro sostituisce il precedente.
- Si revoca da Impostazioni campagna › Claude. Smette di valere anche cambiando la password, se l'account viene disattivato o se non sei più il Master della campagna.
- Di base legge soltanto: per farlo scrivere va creato con la casella spuntata, e i token creati prima restano in lettura.
- Apre solo l'indirizzo `/mcp`: non vale per accedere al resto della wiki.
- Fermo da 90 giorni, smette di valere da solo. In Impostazioni campagna › Claude si vede quando è nato e quando è stato usato l'ultima volta.

Il testo delle pagine arriva a Claude, quindi ad Anthropic, come ogni contenuto di una conversazione. Crea il token solo se per il tuo gruppo va bene.

## Cosa legge

Le pagine, con la colonna a lato e l'elenco di chi le cita, e l'albero della barra a sinistra (`wiki_tree`). Non legge ancora i pin delle mappe, gli eventi delle cronologie e le schede delle bacheche.

## Cosa scrive

Il testo delle pagine, la colonna a lato, i tag e l'ordine della barra a sinistra:

| Strumento | Cosa fa |
|---|---|
| `create_page` | crea una pagina; se non chiedi altro la vedi solo tu |
| `append_to_page` | aggiunge testo in fondo; se sei Master, anche in blocchi oscurati (segreti) |
| `replace_text` | sostituisce un pezzo di testo che compare una volta sola |
| `set_sidebar` | riscrive le righe di testo della colonna a lato; le immagini restano |
| `set_tags` | sostituisce i tag di una pagina |
| `create_folder` | crea una cartella (solo il Master) |
| `move` | sposta pagine, cartelle e divisori nell'albero, come trascinandoli (solo il Master) |
| `rename` | rinomina una pagina (l'indirizzo resta) o una cartella (solo il Master) |

**Non può** eliminare pagine o cartelle, cambiare visibilità o permessi, toccare template, mappe, cronologie e bacheche, caricare file, né arrivare a impostazioni, utenti, plugin, temi o backup: per queste cose non esiste nessuno strumento. Spostare una pagina in un'altra cartella non cambia chi la vede.

Il testo passa da un convertitore che riconosce un elenco chiuso di elementi (titoli, grassetto, corsivo, elenchi, citazioni, collegamenti): HTML e codice restano testo e non vengono mai eseguiti. Valgono le regole del sito: un giocatore modifica solo le pagine che può modificare nel sito.

Ogni modifica lascia una versione nella cronologia della pagina, a tuo nome: da lì si torna indietro.

### Attenzione ai permessi di Claude Code

Claude Code chiede conferma prima di ogni scrittura, mostrando il testo: conviene lasciarla attiva, soprattutto col token del Master. Il testo delle pagine lo scrivono tutti i partecipanti, e una pagina potrebbe contenere istruzioni pensate per ingannare Claude, ad esempio copiare un segreto in una pagina che vedono i giocatori. Claude è istruito a non seguirle, ma la conferma è il controllo che resta nelle tue mani.

## Per chi sviluppa

`src/routes/mcp/[[id=id]]/+server.ts` parla MCP su HTTP, un messaggio a richiesta e senza sessione; gli strumenti sono in `src/lib/server/mcp.ts` e passano dalle stesse funzioni del sito. Chi aggiunge uno strumento di scrittura non deve toccare visibilità e permessi né eliminare: Claude non manda mai JSON dell'editor, solo Markdown che passa da `fromMarkdown` (anche nei valori della colonna a lato) e testo semplice per i tag. Il plugin è in `claude-plugin/`. Per provarlo senza installarlo: `claude --plugin-dir claude-plugin`.

Il connettore è OAuth 2.1 con PKCE: `/.well-known/oauth-protected-resource/mcp/<id>` e `/.well-known/oauth-authorization-server` per la scoperta, `/oauth/register`, il consenso in `/oauth/authorize` e `/oauth/token`, che dà un token di `api_tokens` col sito di ritorno in `client`. La campagna viene dall'indirizzo `/mcp/<id>` (il parametro `resource`), e `/mcp/<id>` accetta solo token di quella campagna. La registrazione è aperta a chiunque, quindi non salva niente e dà a tutti lo stesso client: a proteggere è la pagina di consenso, che mostra il sito a cui va il token (`src/lib/server/oauth.ts`); per un sito che non è di Claude (`claude.ai`, `claude.com`, `anthropic.com` o il computer locale) chiede una conferma in più. I token non hanno refresh, come quelli del plugin, ma smettono di valere dopo 90 giorni senza uso. `/oauth/token` lo chiamano i server di Claude senza `Origin`: per questo il controllo dei form da altri siti è in `hooks.server.ts` e non in SvelteKit.

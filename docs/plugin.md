# Creare un plugin

Un plugin è una cartella con un file `plugin.json` e dei file JSON. Contiene **solo dati**, mai codice: installarlo non dà accesso al server.

Un plugin può aggiungere:

| Cosa | Chiave in `contributes` |
|---|---|
| Temi | `themes` |
| Template di pagina | `templates` |
| Calendari pronti | `calendars` |
| Lingue o traduzioni | `locales` |
| Regole consultabili con `@` | `rules` |

L'esempio completo è in [`plugins/esempio-gotico`](../plugins/esempio-gotico): copialo e cambialo.

## Installare

1. Copia la cartella del plugin in `<cartella dei dati>/plugins/` (con Docker: dentro il volume, `/data/plugins/`).
2. Amministrazione › Plugin › «Cerca di nuovo i plugin».
3. Premi «Accendi».

I plugin sono spenti finché l'Admin non li accende. Un plugin installato con lo stesso `id` di uno incluso lo sostituisce.

## plugin.json

```json
{
	"id": "il-mio-plugin",
	"name": "Il mio plugin",
	"version": "1.0.0",
	"description": "Cosa aggiunge.",
	"author": "Il tuo nome",
	"license": "CC-BY-4.0",
	"contributes": {
		"themes": ["themes/mio-tema.json"],
		"templates": ["templates/nave.json"],
		"calendars": ["calendars/calendario.json"],
		"locales": { "es": "locales/es.json" },
		"rules": ["rules/regole.json"]
	}
}
```

- `id`: lettere minuscole, numeri e trattini.
- I percorsi sono relativi alla cartella del plugin e non possono uscirne.
- Un file non valido viene ignorato e segnalato nella pagina Plugin; il resto del plugin funziona.

## Tema

Gli stessi colori dell'editor dei temi, in formato `#rrggbb`. Il tema viene **rifiutato** se qualche testo non è leggibile (contrasto WCAG AA). Il modo più semplice: crealo nell'editor dei temi e usa «Esporta». L'immagine di sfondo dell'editor non vale per i temi dei plugin.

```json
{ "name": "Gotico", "scheme": "dark", "colors": { "bg": "#14111a", "text": "#efe9f5", "…": "…" } }
```

## Template

```json
{
	"name": "Nave",
	"description": "Una nave e il suo equipaggio.",
	"fields": ["Capitano", "Porto", "Bandiera"],
	"session": false,
	"content": { "type": "doc", "content": [ { "type": "heading", "attrs": { "level": 2 }, "content": [ { "type": "text", "text": "Equipaggio" } ] }, { "type": "paragraph" } ] }
}
```

`content` è il formato dell'editor: il modo più semplice per ottenerlo è creare il template nella wiki (Nuova pagina › Nuovo template) e copiarlo da un pacchetto mondo esportato (in `pages.json`, la pagina con `"kind": "template"`).

Accendendo il plugin, i suoi template diventano pagine della wiki, nella linguetta Template della barra a sinistra (una volta sola): da lì si modificano come ogni pagina, e restano anche se il plugin si spegne.

## Calendario

Come in `calendars/lunargento.json` dell'esempio: `months` (nome, giorni, `festival` per i giorni di festa fuori dai mesi), `weekdays`, `eras` (nome, sigla, anno di inizio), `leap` (o `null`), `today` (o `null`).

## Lingua

Un file con le stesse chiavi di `src/lib/i18n/locales/it.json`. Le chiavi mancanti ricadono sull'inglese. Per una lingua nuova metti in cima `"_meta": { "name": "Español" }`.

## Regole

Un elenco di voci consultabili con `@` e nella pagina Regole:

```json
[
	{ "kind": "rule", "key": "riposo-in-taverna", "name": "Riposo in taverna", "summary": "Regola della casa", "text": "Testo con **grassetto**.\nUna riga per paragrafo." }
]
```

`kind` è uno tra `spell`, `monster`, `condition`, `item`, `feat`, `species`, `class`, `background`, `rule`. Una voce con lo stesso nome di una dell'SRD la sostituisce (utile per traduzioni o varianti).

Attenzione alle licenze: includi solo testi tuoi o con licenza libera.

# MSVÖ Fragenkatalog – Fahrtbereich 2

Interaktiver Theorieprüfungs-Trainer für den MSVÖ-Fragenkatalog Fahrtbereich 2
(Motor- und Segelantrieb). Reine statische Single-Page-App – keine Datenbank,
kein Backend. Der Lernfortschritt wird lokal im Browser (`localStorage`)
gespeichert.

## Funktionen

- Fragen nach Sachgebiet und Kapitel filtern
- Prüfungssimulation mit wählbarer Fragenanzahl (10/20/30/50/alle)
- Auswertung gesamt, pro Sachgebiet und pro Kapitel
- Bestanden-Schwelle 75 % (MSVÖ-Richtlinie)
- Wiederholung nur noch nicht gemeisterter Fragen
- Bilder zu den Fragen werden mit angezeigt

## Projektstruktur

```
public/            Statisches Frontend (wird deployt)
  index.html
  styles.css
  app.js
  data.js          Fragenkatalog als JS (window.CATALOG)
  images/          Aus dem PDF extrahierte Abbildungen
parse.py           Extrahiert Fragen + Bilder aus catalog.pdf
catalog.pdf        Quelldokument
wrangler.jsonc     Cloudflare-Workers-Konfiguration (Static Assets)
```

## Lokal entwickeln

Voraussetzung: Node.js.

```bash
npm install
npm run dev      # startet einen lokalen Server (wrangler dev)
```

## Deployment auf Cloudflare Workers

Die Seite wird über die Static-Assets-Funktion von Cloudflare Workers aus dem
Verzeichnis `public/` ausgeliefert.

```bash
npm install
npx wrangler login
npm run deploy
```

Beim ersten Deploy ggf. den Worker-Namen in `wrangler.jsonc` anpassen.

Alternativ lässt sich das Repository im Cloudflare-Dashboard verbinden
(**Workers & Pages → Create → Workers → Connect to Git**). Build-Command leer
lassen, Deploy-Command `npx wrangler deploy`.

## Fragenkatalog neu erzeugen

`parse.py` liest `catalog.pdf` und schreibt die extrahierten Bilder nach
`public/images/` sowie `parsed.json`. Zur Ausführung:

```bash
python3 -m venv .venv
.venv/bin/pip install pymupdf
.venv/bin/python parse.py
```

## Quelle

Fragenkatalog: [crew-tauern.at](https://www.crew-tauern.at/fileadmin/user_upload/MSVOE_FB2_MS_Gesamtfragenkatalog_V01.PDF)

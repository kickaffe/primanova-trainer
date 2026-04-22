# PrimaNova Trainer

Mobiler Prototyp fuer einen Vokabeltrainer mit Karteikastenlogik.

## Idee

- Lektionen filtern, zum Beispiel `1-23`
- Karten lokal auf dem Geraet speichern
- Falsch beantwortete Karten in derselben Session schneller wiederholen
- Richtig beantwortete Karten in spaetere Session-Intervalle verschieben
- Antwortmodus als Mix aus Auswahl und freier Eingabe

## Dateien

- [index.html](/Users/robertpetters/Documents/Codex/2026-04-21-kannst-du-sprachnachrichten-auslesen/index.html)
- [styles.css](/Users/robertpetters/Documents/Codex/2026-04-21-kannst-du-sprachnachrichten-auslesen/styles.css)
- [app.js](/Users/robertpetters/Documents/Codex/2026-04-21-kannst-du-sprachnachrichten-auslesen/app.js)
- [scripts/extract_primanova.py](/Users/robertpetters/Documents/Codex/2026-04-21-kannst-du-sprachnachrichten-auslesen/scripts/extract_primanova.py)

## Daten aktualisieren

```bash
/Users/robertpetters/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/extract_primanova.py
```

## Lokal starten

```bash
python3 -m http.server 8080
```

## Stabile URL mit Netlify

Dieser Prototyp ist als statische Website vorbereitet und kann direkt auf Netlify deployt werden.

Die Konfiguration liegt in [netlify.toml](/Users/robertpetters/Documents/Codex/2026-04-21-kannst-du-sprachnachrichten-auslesen/netlify.toml).

Empfohlener Weg:

1. Dieses Verzeichnis in ein GitHub-Repository pushen.
2. Das Repository in Netlify importieren.
3. Als Production Branch `main` verwenden.
4. Kuenftige Aenderungen nur noch committen und pushen.

Dann bleibt die Live-URL stabil und jeder Push auf `main` aktualisiert automatisch die Seite.

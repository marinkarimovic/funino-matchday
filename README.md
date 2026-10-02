# ⚽ FUNiño Matchday

Mobile-first, installierbare Offline-Web-App für U7-FUNiño-Turniere mit 7 Spielen und Auf-/Abstieg.

## Funktionen

- Spielstand und Torschützen mit Spielminute erfassen; Tore korrigieren
- Countdown, Pause, Verlängerung und Zeit zurücksetzen
- Sieben Matches, Spielfeldwechsel bei Sieg/Niederlage/Remis (konfigurierbar)
- Turnierbilanz, Torverhältnis, Torschützen-Rangfolge und Feldverlauf
- CSV-Export, lokale Speicherung, Offline-Cache
- Keine Anmeldung, kein Backend, keine Tracking-Skripte

## Auf GitHub Pages veröffentlichen

1. Ein öffentliches Repository anlegen, z. B. `funino-matchday`.
2. **Alle Dateien und den Ordner `icons/` aus diesem ZIP direkt in das Stammverzeichnis des Repositories hochladen.** Nicht nur das ZIP hochladen.
3. Unter **Settings → Pages → Build and deployment → Source** die Option **Deploy from a branch** wählen. Branch `main`, Folder `/(root)`, dann **Save**.
4. GitHub zeigt die URL an, typischerweise `https://DEIN-NAME.github.io/funino-matchday/`. Die Bereitstellung kann kurz dauern.
5. Auf dem iPhone die URL in **Safari** öffnen → Teilen → **Zum Home-Bildschirm**.

## Entwicklung / Test

`index.html` lässt sich direkt im Browser öffnen; Service Worker und Installation benötigen HTTPS (GitHub Pages) oder `localhost`. Zum lokalen Test z. B. `python -m http.server 8000` und dann `http://localhost:8000`.

## Datenschutz und Speichern

Die Daten liegen ausschließlich im `localStorage` des jeweiligen Browsers/Profils. Kein Cloud-Sync. Browserdaten löschen, privaten Modus verwenden oder das Gerät wechseln kann zu Datenverlust führen. CSV nach jedem Turnier exportieren. Auf iOS kann die Speicherung je nach Browser-/App-Kontext getrennt sein.

## Turnierregel

Feld 1 ist die höchste Spielklasse. Sieg führt eine Klasse hinauf (Feldnummer -1), Niederlage eine hinunter (+1). Remis-Verhalten ist konfigurierbar; Feldgrenzen werden berücksichtigt. Prüfe, ob euer Turnier dieselben Regeln verwendet.

## Anpassungen

Alle App-Inhalte liegen in `index.html`; Offline-Liste in `sw.js`; App-Metadaten in `manifest.webmanifest`. Nach Updates die Cache-Version in `sw.js` erhöhen.

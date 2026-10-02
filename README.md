# ⚽ Matchday v3 — FUNiño + Hallenturnier

Eine installierbare **Offline-Web-App** (PWA) für U7-Trainer. Zwei Spielmodi in einer GitHub-Pages-Website. Kein Backend, keine Anmeldung, kein Tracking.

## Bereitstellung auf GitHub Pages

1. Repo anlegen, z. B. `funino-matchday` (**Public**).
2. **Den Inhalt** dieser ZIP-Datei in das **Root** des Repos hochladen, nicht die ZIP selbst. Bei einer bereits veröffentlichten v2 die vorhandenen gleichnamigen Dateien überschreiben; `hall.html` und `hall.js` ergänzen. `icons/` nicht vergessen.
3. Repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save**.
4. `https://BENUTZERNAME.github.io/funino-matchday/` in **Safari** öffnen und über Teilen **Zum Home-Bildschirm** hinzufügen.
5. Nach Updates Website neu laden; im Zweifelsfall Browsercache/PWA aktualisieren. App-Daten liegen im jeweiligen Browserprofil.

## FUNiño

Die vorhandene App aus v2 befindet sich weiterhin in `index.html` und nutzt weiterhin ihren bisherigen lokalen Speicher: 7 Spiele, Feldwechsel, Torbuttons, Torschützen, Countdown und CSV-Ausgabe. Oben ist jetzt ein Moduswechsel ergänzt.

## Hallenturnier

- `hall.html`: Hallensaison mit 13 bestätigten Terminen, getrennten Daten je Turnier.
- Spielpläne manuell anlegen oder via CSV / JSON importieren.
- Gruppen A und B pflegen und eine einfache Round-Robin-Runde erzeugen (jeder gegen jeden; **keine offiziellen Anstoßzeiten** werden automatisch angenommen).
- Tabelle 3/1/0, Tordifferenz, erzielte Tore; **offizielle Tiebreaker können anders sein**.
- Halbfinale + Finale auf Basis von 2 Gruppen (A1/B2, B1/A2) oder 1 Gruppe (1/4, 2/3). Andere Setzlisten manuell eingeben.
- Live-Match und Countdown, eigene Tore mit Spieler, Resultate der anderen Teams manuell eingeben.
- JSON-Gesamtsicherung und CSV je Turnier.
- Link zur offiziellen Online-Tabelle speichern und öffnen. Direkter Abruf einer öffentlichen CSV-/JSON-Datei auf Knopfdruck möglich, wenn CORS erlaubt ist. **Keine Live-Synchronisation normaler HTML-Webseiten**.
- JPG/PNG-WebP-Foto: OCR über extern nachgeladene *Tesseract.js*-Bibliothek, Verarbeitung des ausgewählten Fotos lokal im Browser. Das erste Laden benötigt Internet. **OCR übernimmt nur Vorschläge für Mannschaftsnamen**; überprüfe diese und ergänze Paarungen/Uhrzeiten manuell. Ergebnisse werden niemals ungeprüft übernommen.

## Importvorlagen

**Gruppen-CSV**, UTF-8 mit Semikolon:

```csv
Gruppe;Mannschaft
A;Unsere Kids
A;FC Beispiel
A;SV Muster
B;Union Nord
B;Union Süd
```

**Spielplan-CSV**, UTF-8 mit Semikolon:

```csv
Gruppe;Heim;Gast;Uhrzeit;Feld
A;Unsere Kids;FC Beispiel;09:15;Feld 1
A;SV Muster;Unsere Kids;09:45;Feld 2
B;Union Nord;Union Süd;09:30;Feld 1
```

**JSON**, z. B.:

```json
{"groups":{"A":["Unsere Kids","FC Beispiel"],"B":["Union Nord","Union Süd"]},"fixtures":[{"group":"A","home":"Unsere Kids","away":"FC Beispiel","time":"09:15","field":"Feld 1"}]}
```

Die Import-Vorschau ist vor dem Übernehmen sichtbar. Das Laden ersetzt die vorhandenen Gruppenspiele im ausgewählten Turnier; die Finalrunde bleibt bestehen.

## Datenschutz, Datenverlust und Offlinebetrieb

`localStorage` ist **geräte- und browserprofilgebunden** (Safari und installierte iOS-PWA können unterschiedliche Speicher haben). Kein serverseitiges Backup oder automatische Synchronisation. Nach jedem Turnier unter Hallenturnier → „Gesamtsaison sichern (JSON)“ exportieren; beim FUNiño zusätzlich CSV sichern. Das Löschen des Browser-Speichers kann alle lokalen Ergebnisse entfernen. Offline nach einmaligem Aufruf unter GitHub Pages funktionieren Kernfunktionen, **nicht** der initiale OCR-Download oder das Öffnen externer Seiten.

## Bekannte Grenzen dieser ersten v3

- Keine automatische Umwandlung beliebiger Turnierfotos in verlässliche Tabellen, insbesondere nicht mit mehreren Spalten oder schlecht lesbaren Texten; OCR schlägt Namen zur Prüfung vor.
- Keine automatische Integration fremder Live-Tabellen ohne eine öffentliche Daten-Schnittstelle und CORS-Freigabe.
- Keine automatische Platzierung/Spielplanung für komplizierte Mehrgruppen-/Nebenrunden-Systeme oder abweichende Wertungen; die vier Halbfinalteams können manuell angegeben werden.
- Finale wird aus den Halbfinalsiegern gefüllt; Änderungen der Halbfinals können das Finalergebnis zurücksetzen.
- Ein manuell nachgetragener Spielstand setzt die zu diesem Match erfasste Torschützenliste zurück, damit die Statistik nicht widersprüchlich wird.
- Es gibt derzeit keine gemeinsame Auswertung von FUNiño- und Hallensaison (die Modi besitzen getrennte Datenbestände).

## Lokal testen

`python3 -m http.server 8000` im Ordner starten und `http://localhost:8000` aufrufen. App-/Serviceworker-Installation braucht HTTPS oder localhost.


## v4 – Hallenturnier für alle Trainer

- Zwei große Hauptbereiche: **Turnierdaten** und **Live-Match**.
- Turnierliste beginnt bei einer Neuinstallation leer; Turniere lassen sich erstellen, bearbeiten und löschen.
- Die 13 Beispieltermine 2026/27 können bei Bedarf freiwillig übernommen werden.
- Einrichtungsablauf: Turnier wählen → Team/Kader → Spielplan anlegen/importieren → Live-Match.
- Schnellstart eines eigenen Spiels ohne Gruppenplan über Live-Match → Gegner eingeben.
- Bestehende v3-Hallenergebnisse werden aus `matchday_hall_v3` übernommen; bei der Migration werden nur tatsächlich gespeicherte Turniere sichtbar.
- Die Turnierliste und JSON-Sicherung enthalten alle selbst angelegten Turniere.
- Löschen eines Turniers entfernt dessen Matchdaten **nur auf diesem Gerät**; vorab Sicherung exportieren.
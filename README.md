# Personal English Trainer

Offline-first Progressive Web App zum Englischlernen (Deutsch → Englisch, Ziel B2) – optimiert für das iPhone, ohne Registrierung, ohne laufende Kosten, ohne Tracking.

Die App ergänzt ein persönliches English-Projekt in ChatGPT: Dort entstehen individuelle Lerninhalte, die per JSON/CSV importiert und hier mit Spaced Repetition (FSRS) gelernt werden.

> Status: **v0.1.0 – Phase 1 abgeschlossen, Teile von Phase 2 umgesetzt** (siehe [ROADMAP.md](ROADMAP.md)).

## Funktionen (v0.1.0)

| Bereich | Umgesetzt |
|---|---|
| PWA | Installierbar über Safari („Zum Home-Bildschirm“), Vollbild, eigenes Icon, offline nach dem ersten Laden, Update-Hinweis ohne Datenverlust |
| Dashboard | Tagesziel, heutige Lernzeit, fällige Wiederholungen, neu/sicher/schwierig, Lernserie, zuletzt genutzter Modus, Empfehlung, 7-Tage-Verlauf, „Jetzt lernen“ mit 5–45 min |
| Themenmodi | Everyday, Business, Engineering, Meeting, Handball (als Kategorien, mehrfach zuordenbar), Personal Weakness Mode, eigene Kategorien. Driving Mode: transparent als „Phase 3“ markiert |
| Lernmethoden | Karteikarten (EN→DE, DE→EN, zufällig; 4 Bewertungsstufen), Writing Mode (Tippfehler, Alternativen, Satzzeichen, Diff-Darstellung), Lückentext (3 Stufen), Satzbau, Listening (Auswahl & Diktat, Tempo). Speaking/Aussprache/Free Speaking: als geplant markiert |
| Wiederholung | FSRS (ts-fsrs), getrennt je Fähigkeit (Verstehen, Abrufen, Schreiben, Hören), Sitzungsschutz gegen Intervall-Aufblähung, Tagesplanung nach Zeitbudget |
| Import | JSON & CSV aus Datei (Dateien-App) oder Zwischenablage, Validierung, Vorschau, Duplikate, Aktualisierungen, Kategorien automatisch, Fortschritt bleibt erhalten, Bestätigung nötig |
| ChatGPT-Assistent | Konfigurierbarer Prompt (Anzahl, Thema, Fokus, Niveau, Inhaltsarten) zum Kopieren |
| Vokabeln | Suche, Filter (Status, Kategorie, Niveau, Typ, Sammlung), Sortierung, Favoriten, Archiv, Sammlungen, Mehrfachauswahl, Bearbeiten, Löschen mit Bestätigung, Anhören |
| Statistik | Lernzeit Tag/Woche/Monat, 7/30/90 Tage, Erfolgsquote je Methode, Fortschritt je Kategorie, Fehlerquote pro Woche, Aktivitätskalender, Serie; gemessen vs. geschätzt gekennzeichnet |
| Backup | Vollständiges versioniertes JSON-Backup, Restore mit Vorschau & Validierung, CSV/JSON-Export, Erinnerung, letzte Sicherung |
| Sprache | Sprachausgabe (Web Speech API, britisch/amerikanisch, Stimme, Tempo, Wiederholungen, Pausen); Erkennung/Aufnahme technisch vorbereitet |
| UI | Deutsch (Standard) oder Englisch, Hell/Dunkel/System, Safe Areas, große Touch-Ziele, Bottom Navigation |

## Auf dem iPhone installieren, aktualisieren, sichern

**Installieren**
1. Die App-URL in **Safari** öffnen (nicht in Chrome/In-App-Browsern).
2. Teilen-Symbol (Quadrat mit Pfeil nach oben) → **„Zum Home-Bildschirm“** → **Hinzufügen**.
3. App über das neue Icon starten. Ab jetzt läuft sie im Vollbild und offline.
4. Einmal online starten, damit alle Dateien zwischengespeichert werden. Danach im Flugmodus testen.

**Aktualisieren**
- Neue Versionen werden beim Öffnen automatisch im Hintergrund geladen.
- Es erscheint **„Neue Version verfügbar“ → „Aktualisieren“**. Lerndaten liegen getrennt vom App-Code (IndexedDB) und bleiben erhalten.
- Falls nichts erscheint: App komplett schließen (App-Umschalter hochwischen) und neu öffnen.

**Daten sichern**
- Einstellungen → **Backup & Wiederherstellung** → „Vollständiges Backup exportieren“ → **„In Dateien sichern“** (z. B. iCloud Drive).
- Wiederherstellen: dort „Backup-Datei wählen“ → Vorschau prüfen → bestätigen.
- Die App erinnert nach einstellbarer Zeit (Standard 7 Tage) an ein Backup.
- Wichtig: iOS kann Daten von Web-Apps in seltenen Fällen löschen (Speichermangel, App-Löschung vom Home-Bildschirm). Backups sind deshalb Pflicht.

## Inhalte aus ChatGPT importieren

1. Einstellungen → **ChatGPT-Import** → Prompt konfigurieren → **Prompt kopieren**.
2. In das English-Projekt in ChatGPT einfügen.
3. Die JSON-Antwort kopieren **oder** als `.json` in der Dateien-App speichern.
4. Einstellungen → **Datei / Text importieren** → Vorschau prüfen → **Import bestätigen**.

Details: [IMPORT_GUIDE.md](IMPORT_GUIDE.md), Schema: [DATA_SCHEMA.md](DATA_SCHEMA.md), Beispiele: [`docs/examples/`](docs/examples).

## Entwicklung

```bash
npm ci
npm run dev        # Dev-Server
npm run typecheck  # TypeScript
npm test           # Unit-/Integrationstests (Vitest + fake-indexeddb)
npm run build      # Produktionsbuild nach dist/ (inkl. Service Worker)
npm run e2e        # Playwright: iPhone-16-Emulation, Dark Mode, Desktop
npm run icons      # PNG-Icons aus public/icons/favicon.svg erzeugen
```

Weitere Dokumente: [ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md) · [CHANGELOG.md](CHANGELOG.md) · [TEST_PLAN.md](TEST_PLAN.md) · [CLAUDE.md](CLAUDE.md)

## Datenschutz

Keine Registrierung, keine Cloud, kein Tracking, keine Analytics. Alle Lerninhalte und -daten bleiben lokal auf dem Gerät. Das Repository enthält nur allgemeine, nicht vertrauliche Beispielinhalte. Persönliche Inhalte und Backups gehören **nicht** ins Repository (`.gitignore` schließt `*backup*.json` aus).

## Lizenzen der Abhängigkeiten

React (MIT), Dexie.js (Apache-2.0), ts-fsrs (MIT) mit @open-spaced-repetition/srs-kit (BSD-3-Clause), Workbox/vite-plugin-pwa (MIT), Vite (MIT). Die App selbst ist privat (`UNLICENSED`).

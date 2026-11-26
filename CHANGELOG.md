# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).

## [0.2.0] – 2026-11-26

Phase 2: Speaking Mode (#2).

### Hinzugefügt
- **Speaking Mode:** Deutsche Vorgabe → englische Übersetzung sprechen → erkannte Wörter werden mit der Lösung und den kontextgerechten Alternativen verglichen. Bis zu 3 Versuche, die Lösung bleibt bis dahin verborgen, Lösung anhören, Hinweis.
- Auswertung gesprochener Antworten: Kurzformen (I'm/I am, don't/do not …), Zahlen 0–12, fehlendes „to“, bestes von mehreren Erkennungsergebnissen.
- Einwilligung vor der ersten Spracherkennung (Hinweis auf Verarbeitung durch Apple/Google), in den Einstellungen widerrufbar.
- Saubere Fehlerbehandlung (kein Mikrofonzugriff, offline, nichts gehört, Engine startet nicht) mit „Stattdessen schreiben“-Fallback.
- Statistik „Sprechen & Aussprache“: Anzahl, Anteil richtig erkannt, Treffer im 1. Versuch.

### Geändert
- Speaking ist in „Lernen“ nur auswählbar, wenn Spracherkennung vorhanden und das Gerät online ist; automatische Einheiten enthalten (noch) keine Sprechübungen.

### Hinweis
- Es wird ausschließlich Worterkennung angezeigt – keine Aussprachebewertung und keine Prozentwerte für Laute.

## [0.1.0] – 2026-11-26

Erste funktionsfähige Version (Phase 1 + Teile von Phase 2).

### Hinzugefügt
- Offline-first PWA (React, TypeScript, Vite, Workbox) mit App-Icon, Vollbild und Update-Hinweis.
- Dashboard mit Tagesziel, Lernserie, Fälligkeiten, Empfehlung, 7-Tage-Diagramm und „Jetzt lernen“ (5–45 Minuten).
- Themenmodi Everyday, Business, Engineering, Meeting, Handball, Personal Weakness; eigene Kategorien.
- Lernmethoden: Karteikarten, Writing Mode, Lückentext (3 Stufen), Satzbau, Listening.
- FSRS-Wiederholungssystem (ts-fsrs) je Fähigkeit mit Sitzungsschutz.
- JSON-/CSV-Import (Datei & Zwischenablage) mit Validierung, Vorschau, Duplikat-/Update-Erkennung.
- ChatGPT-Prompt-Assistent.
- Vokabelverwaltung mit Suche, Filtern, Sammlungen, Favoriten, Archiv, Mehrfachauswahl.
- Statistik (7/30/90 Tage, Kalender, Methoden, Kategorien, Fehlerquote).
- Vollständiges Backup/Restore, CSV-/JSON-Export, Backup-Erinnerung.
- Sprachausgabe mit britischem/amerikanischem Englisch, Stimmenwahl, Tempo, Wiederholungen.
- Deutsche und englische Oberfläche, Hell/Dunkel/System.
- 65 Unit-/Integrationstests, 21 E2E-Tests (iPhone-16-Emulation), CI-Workflow, Deploy-Workflow (GitHub Pages).

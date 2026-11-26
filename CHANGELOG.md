# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).

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
- 65 Unit-/Integrationstests, 21 E2E-Tests (iPhone-16-Emulation), CI-Workflow, Deploy-Workflow (Cloudflare Pages).

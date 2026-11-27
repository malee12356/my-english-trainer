# Roadmap

Legende: ✅ umgesetzt · 🟡 teilweise/vorbereitet · ⬜ offen · 🔒 nur nach ausdrücklicher Freigabe

## Phase 1 – Funktionsfähige Basis (v0.1.0) ✅

- ✅ Projektstruktur, TypeScript, Vite, Tests, CI
- ✅ PWA (Manifest, Icon, Service Worker, offline, Update-Prompt)
- ✅ iPhone-optimiertes Design, Hell/Dunkel, Safe Areas, Bottom Navigation
- ✅ Dashboard inkl. „Jetzt lernen“ (5–45 min), Empfehlung, 7-Tage-Verlauf
- ✅ IndexedDB (Dexie) mit Migrationen
- ✅ Vokabelverwaltung (Suche, Filter, Sortierung, Sammlungen, Mehrfachauswahl, Archiv)
- ✅ JSON-/CSV-Import mit Vorschau, Duplikaten, Updates, Fortschrittserhalt
- ✅ ChatGPT-Export-Prompt
- ✅ Karteikarten mit 4 Bewertungsstufen
- ✅ Alle Themenmodi als Kategorien
- ✅ FSRS-Wiederholungssystem je Fähigkeit mit Sitzungsschutz
- ✅ Backup & Restore, CSV-Export, Backup-Erinnerung
- ✅ Basisstatistik (bereits erweitert: 7/30/90 Tage, Kalender, Methoden, Kategorien)
- ✅ Sprachausgabe (früh integriert)

## Phase 2 – Sprachfunktionen

- ✅ Text-to-Speech mit Akzent, Stimme, Tempo, Wiederholungen, Pausen
- ✅ Writing Mode (Alternativen, Tippfehler, Satzzeichen, farbige Fehler)
- ✅ Satzübungen (Satzbau) und Lückentexte (3 Stufen)
- ✅ Listening Mode (Auswahl & Diktat, Tempo, Wiederholen)
- ✅ Speech-to-Text (Web Speech API) mit Einwilligung, Fehlerbehandlung und Schreib-Fallback (v0.2.0)
- ✅ Speaking Mode (DE anzeigen → EN sprechen → Vergleich, bis zu 3 Versuche) (v0.2.0)
- ⬜ Speaking in automatischen Einheiten (erst nach erfolgreichem iPhone-Test, siehe TEST_PLAN I)
- ⬜ Pronunciation Mode (vorlesen, aufnehmen, anhören, erkannte Wörter markieren – ohne erfundene Lautbewertung)
- ⬜ Eigene Sprachaufnahmen (nur im Speicher; dauerhaft nur mit Zustimmung)
- ⬜ Test auf echtem iPhone: Spracherkennung im installierten PWA-Modus, offline

## Kindermodus (v0.4.0) ✅

- ✅ Profilwahl beim ersten Start, umschaltbar
- ✅ Maskottchen Robo, XP, Level, Sterne, Abzeichen, Tagesmissionen, buntes Design
- ✅ Kinder-Themen und ~120 Standardvokabeln (Klasse 5–6)
- ✅ Schüler-Prompt, Vokabelliste per Foto
- ⬜ Rückmeldung des Sohnes einarbeiten (Lieblingsspiele, Schwierigkeit, weitere Themen wie Sport/Hobbys)
- ⬜ Optional: Eltern-Bereich (PIN) für Einstellungen/Backup

## Phase 3 – Spezialisierte Lernfunktionen

- 🟡 Personal Weakness Mode (Schwachstellen-Score: Fehler, Vergessen, Antwortzeit, Überspringen, Importkorrekturen) – umgesetzt; Ausbau um Verwechslungs- und Sprech-Fehler
- 🟡 Intelligente tägliche Lerneinheiten (Zeitbudget, Fälligkeit, Neues, Schwächen) – umgesetzt; Feintuning nach echter Nutzung
- ⬜ Free Speaking (Fragen, Aufnahme, Transkript-Export für ChatGPT)
- ⬜ Engineering-spezifische Übungen (Ergebnisse beschreiben, Präsentationsbausteine)
- ⬜ Meeting-Simulationen ohne KI (Dialogskripte mit Rollen, Antwortbausteine)
- ⬜ Driving Mode – zuerst technische Machbarkeit (siehe ARCHITECTURE.md → iOS-Grenzen); Option: vorproduzierte Audiodateien + `<audio>` mit Media Session
- ⬜ Erweiterte Statistiken (Verwechslungen, Sprechübungen)

## Phase 4 – Optional 🔒

- 🔒 Firebase-Sync / Cloud-Backup / mehrere Geräte
- 🔒 Professionelle Aussprachebewertung (z. B. Azure AI Speech) – Schnittstelle vorbereitet
- 🔒 KI-generierte Übungen / KI-Gesprächspartner
- 🔒 Native iOS-App (falls PWA-Grenzen, v. a. Driving Mode, dies rechtfertigen)

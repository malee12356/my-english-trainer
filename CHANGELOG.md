# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).

## [0.6.0] – 2026-11-27

### Hinzugefügt – Spielzeit-Challenge (Schülerprofil)
- Startseite: **„🎮 Spielzeit verdienen“**. Die App wählt 20 Wörter, die noch nicht gut sitzen: erst schwierige und oft falsche, dann unsichere gelernte (niedrigste Erinnerungswahrscheinlichkeit), dann neue. Sicher beherrschte Wörter kommen nie dran.
- Nur aktive Antworten: **Deutsch sehen → Englisch schreiben** (oder sprechen, falls Spracherkennung verfügbar). Kein Durchklicken, kein Hinweis-Knopf, kein „War doch richtig“; keine Wiederholungsschleife, also genau N Wörter.
- **1 Minute pro richtigem Wort** (Tippfehler zählen nicht). Minutenzähler während der Runde.
- Ergebnis mit Robo, Konfetti und Liste der noch zu übenden Wörter. **„Fortschritt teilen“** öffnet das Teilen-Menü (z. B. WhatsApp) mit Ergebnisbild und Text. Zusätzlich gibt es einen direkten **WhatsApp-Knopf**.
- Startseite zeigt „Heute schon X Minuten verdient“.
- Eltern-Einstellungen (Einstellungen → Profil): Wörter pro Challenge (10–30) und Minuten pro Wort (0,5 / 1 / 2).

## [0.5.0] – 2026-11-27

### Hinzugefügt
- **Klassenstufen im Schülerprofil:** 5–6 (A1–A2), 7–8 (A2–B1), 9–10 (B1–B2). Wählbar beim ersten Start und jederzeit in den Einstellungen unter „Profil“. Die Stufe steuert den ChatGPT-Prompt (Niveau, Grammatikthemen, Alter für Erklärungen) und das geladene Vokabelpaket.
- Eigene Standardvokabeln für **Klasse 7–8** und **Klasse 9–10** (je 45 Einträge: Schule & Beruf, Familie & Freunde, Alltag & Gesellschaft).
- **Standardvokabeln entfernen:** Einstellungen → „Standardvokabeln entfernen …“ löscht mitgelieferte Pakete (Schüler oder Erwachsene) mit Bestätigung und Anzahl. Eigene Importe und selbst angelegte Einträge bleiben immer erhalten; die Antworthistorie bleibt für die Statistik.

### Geändert
- „Kinder“ heißt jetzt „Schüler“ (Profil für Klasse 5–10).

## [0.4.1] – 2026-11-27

### Behoben
- Vorlesen auf dem iPhone ohne Ton (ohne Fehlermeldung) bei eingeschaltetem **Stummmodus**: Während des Vorlesens spielt die App gleichzeitig eine lokal erzeugte stille Audiodatei ab. iOS behandelt die Ausgabe dann als Medienwiedergabe, die auch im Stummmodus hörbar ist. Sie stoppt mit dem Ende der Ansage (auf dem Gerät zu prüfen).

### Hinzugefügt
- Der Lautsprecher-Knopf leuchtet und pulsiert, solange vorgelesen wird. So ist sichtbar, ob gerade gesprochen wird.
- Diagnose „Vorlesen testen“ protokolliert zusätzlich die stille Wiedergabe (`unmute`).

### Geändert
- Profilwahl (Erwachsene / Kinder) steht jetzt ganz oben in den Einstellungen, mit Versionsanzeige.

## [0.4.0] – 2026-11-27

### Hinzugefügt – Kindermodus (Klasse 5–6)
- Beim ersten Start einer leeren App: **„Wer lernt mit dieser App?“** (Kinder / Erwachsene / „Ich habe ein Backup“). Später in den Einstellungen umschaltbar, Lernfortschritt bleibt erhalten.
- **Maskottchen „Robo“** (SVG-Roboter) mit Stimmungen. Er wächst mit dem Level in fünf Stufen: Mini-Robo → Robo → Super-Robo → Mega-Robo → Robo-Champion.
- **Gamification:** XP pro Antwort (auch für Versuche), Rundenbonus, Level, 1–3 Sterne pro Runde, Konfetti, 12 Abzeichen, 3 Tagesmissionen, XP-Zähler in der Runde, „Level erreicht!“. Alles wird aus den vorhandenen Lerndaten berechnet: kein neuer Speicher, steckt automatisch im Backup.
- **Buntes Kinder-Design** (abgerundete Schrift, kräftige Farben, hell und dunkel). Kinder-Startseite mit Missionen, Themen-Kacheln und „Los geht's!“; Tab „Erfolge“ mit Level und Abzeichen.
- **Kinder-Themen und ~120 Standardvokabeln** (A1–A2): Schule & Unterricht, Familie & Tiere, Alltag. Geplante Lernmethoden sind für Kinder ausgeblendet. Kindgerechte Standardwerte: 10 min, 8 neue Wörter pro Tag.
- **ChatGPT-Prompt für Schüler** (Klasse 5–6, kindgerecht, einfache deutsche Erklärungen) und für beide Profile die Option **„Vokabelliste (Foto/Datei)“**: Foto der Wörterliste aus dem Englischbuch anhängen, ChatGPT erzeugt die Importdatei.

### Behoben
- **Import aus ChatGPT schlug fehl**, wenn die ganze Nachricht statt des Codeblocks kopiert wurde (Markdown-Escapes wie `\[ … \]`, `\_`). Der Import repariert das jetzt automatisch, ebenso umgebenden Text, typografische Anführungszeichen und abschließende Kommas, und zeigt einen Hinweis.
- Der Prompt verlangt jetzt **einen json-Codeblock**; die Anleitung in der App erklärt den Kopier-Knopf des Codeblocks.

## [0.3.0] – 2026-11-27

### Hinzugefügt
- **Standardvokabeln fest hinterlegt:** 163 allgemeine Einträge (Wörter, Wendungen, Sätze, typische Fehler) über alle fünf Themenmodi.
- Beim **ersten Start** einer leeren App werden sie automatisch geladen, genau einmal. Gelöschte Standardvokabeln kommen nicht ungefragt zurück. Über Einstellungen → „Standardvokabeln laden“ lassen sich fehlende jederzeit ergänzen, ohne eigene Inhalte oder Fortschritt zu verändern.

### Hinweis
- Safari und die installierte Home-Bildschirm-App haben auf dem iPhone **getrennte Speicher**. Inhalte und Fortschritt aus Safari erscheinen nicht in der App und umgekehrt (Übertragung per Backup).

## [0.2.2] – 2026-11-26

### Behoben
- Vorlesen auf dem iPhone blieb stumm. Ohne ausdrücklich gewählte Stimme nutzt die App jetzt die iOS-Systemstimme der Sprache: Einige von iOS gelistete Stimmen sind nicht geladen oder aus Web-Apps nicht nutzbar und bleiben stumm.
- Audio-Sitzung wird vor dem Vorlesen auf „Wiedergabe“ gesetzt (Audio Session API, iOS 17+): Ausgabe über den Lautsprecher, auch nach einer Mikrofonnutzung. Vor der Spracherkennung wird sie zurückgesetzt.
- Kein `cancel()` direkt vor `speak()` mehr, wenn nichts läuft; WebKit verwirft die Ansage sonst. Laufende Ansagen bleiben referenziert, damit iOS sie nicht vorzeitig verwirft.

### Hinzugefügt
- Fehlermeldung statt Stille, wenn das Vorlesen scheitert.
- „Sprache testen“ (vorher „Spracherkennung testen“) mit **Vorlesen testen** und Protokoll (Stimme, Audio-Sitzung, Ereignisse).

## [0.2.1] – 2026-11-26

### Behoben
- Speaking Mode in der installierten iPhone-App: keine Reaktion bzw. „Nichts erkannt“. Die Erkennung nutzt jetzt Zwischenergebnisse, wenn WebKit kein Endergebnis liefert, beendet das Zuhören nach einer Sprechpause selbst und wertet jedes Audio-Ereignis als Start. Die Startprüfung ist auf 15 s verlängert, damit iOS die Mikrofon-Freigabe abfragen kann.

### Hinzugefügt
- Antworten mit der **Diktierfunktion der iPhone-Tastatur** als zuverlässige Alternative zum Mikrofon-Knopf, mit derselben Auswertung.
- Live-Anzeige des Gehörten während des Sprechens.
- Einstellungen → **Spracherkennung testen**: Diagnose mit Ereignisprotokoll zum Kopieren.

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

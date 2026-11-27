# Testplan

## Automatisiert

| Ebene | Werkzeug | Befehl | Abdeckung |
|---|---|---|---|
| Unit/Integration | Vitest + fake-indexeddb | `npm test` | Import JSON/CSV, fehlerhafte Dateien, Duplikate, Updates, Alternativen je Richtung, Tippfehler/Satzzeichen, Re-Import mit Fortschrittserhalt, FSRS-Berechnung, Fälligkeit, Sitzungsschutz, Planer (Zeitbudget, neu/Tag, Themen, Schwächen), Statistiken (Serie, Tage, Methoden, Fehlerquote), Backup/Restore/Validierung, CSV-Formelschutz, DB-Migration v1→v2, Prompt-Generator |
| End-to-End | Playwright (Chromium) | `npm run e2e` | iPhone-16-Emulation: Erststart, Navigation, kein horizontales Scrollen, Karteikarten-Sitzung + Persistenz nach Reload, Writing Mode, Themen-/Methodenwahl, Import (Einfügen, Datei, Abbrechen, Fehler), XSS-Schutz, Backup-Export + Restore in leere App, Prompt kopieren, **Offline** (Service Worker), Dark Mode (System + manuell), Touch-Ziele ≥ 44 px, englische UI, Fallback ohne Sprachausgabe; Desktop-Smoke-Test, Manifest/Icons |
| Statisch | TypeScript strict | `npm run typecheck` | Typen |

CI (`.github/workflows/ci.yml`) führt alles bei jedem Push/PR aus.

**Letzter Lauf (2026-11-27, v0.6.1):** Typecheck ✅ · 124/124 Unit-/Integrationstests ✅ · 44/44 E2E-Tests ✅ · Build ✅.

E2E-Tests, die eine leere App brauchen, setzen vorab `localStorage['pet.skipStarter'] = '1'` (Helfer `emptyApp`).

Speaking Mode automatisiert: Auswertung (Kurzformen, Zahlen, Alternativen, Versuche), Erkennungs-Wrapper mit simulierter Engine (Fehlercodes, Start-Timeout, Abbruch), Planer (nur bei verfügbarer Erkennung, nie automatisch); E2E mit simulierter Erkennung: Einwilligung vor erstem Mikrofonzugriff, richtige/falsche Antwort mit zweitem Versuch, Ablehnen → Schreiben, Berechtigungsfehler → Schreiben, deaktiviert ohne API bzw. offline.

### Bewusst nicht automatisiert
- **Service-Worker-Update-Ablauf** (zwei Builds nacheinander) – manuell, siehe unten.
- **Echte Sprachausgabe/Stimmen** – Browser-Emulation hat keine iOS-Stimmen.
- **Safari/WebKit** – Tests laufen in Chromium mit iPhone-Profil; das ersetzt **keinen** Test auf einem echten iPhone.

## Manuelle Abnahme auf dem iPhone 16

Version unter Einstellungen → Info prüfen. Ergebnis je Punkt abhaken.

### A. Installation & Start
- [ ] A1 URL in Safari öffnen – Seite lädt, keine Fehlermeldung
- [ ] A2 Teilen → „Zum Home-Bildschirm“ → Icon erscheint mit eigenem Symbol und Namen „English“
- [ ] A3 Start über Icon: Vollbild ohne Safari-Leisten, Statusleiste lesbar, nichts unter Notch/Dynamic Island oder Home-Indikator verdeckt
- [ ] A4 Hoch- und Querformat: kein horizontales Scrollen, keine abgeschnittenen Dialoge
- [ ] A5 Erster Start der installierten App: ~160 Standardvokabeln sind ohne Import vorhanden (Vokabeln → Anzahl)

### B. Import
- [ ] B1 Prompt kopieren → in ChatGPT einfügen → JSON-Antwort kopieren → „Aus Zwischenablage einfügen“ → Vorschau korrekt
- [ ] B2 JSON-Datei aus der Dateien-App (iCloud Drive) auswählen → Vorschau → Import bestätigen
- [ ] B3 Dieselbe Datei erneut importieren → alles „unverändert“; Lernfortschritt bleibt
- [ ] B4 Fehlerhafte Datei → verständliche Fehlermeldung, nichts importiert

### C. Lernen
- [ ] C1 Lernen → Themenmodus wählen (z. B. Meeting Mode) → nur passende Einträge
- [ ] C2 Karteikarten: Antippen dreht um, vier Bewertungen mit Intervall-Vorschau
- [ ] C3 Writing Mode: iOS-Tastatur ohne Autokorrektur/Großschreibung; Tippfehler orange, falsche Wörter rot
- [ ] C4 Lückentext, Satzbau und Listening einmal durchspielen
- [ ] C5 Sitzung mit „X“ abbrechen → Antworten bleiben gespeichert
- [ ] C6 Bedienung mit einer Hand (Daumen erreicht Bewertungsknöpfe und Tab-Leiste)

### D. Sprachausgabe
- [ ] D1 Lautsprecher-Symbol spielt englische Aussprache (Stimme vorhanden?)
- [ ] D2 Einstellungen: British/American umschalten, Stimme wählen, Tempo ändern → hörbar
- [ ] D3 Über Bluetooth (Auto/Kopfhörer) hörbar
- [ ] D4 Im Flugmodus: Sprachausgabe funktioniert weiter (Systemstimme)
- [ ] D5 **Stummschalter an**: Wird trotzdem vorgelesen (stille Medienwiedergabe + Audio-Sitzung)? Ergebnis notieren; Lautsprecher-Knopf pulsiert während der Ansage
- [ ] D7 Nach einer Speaking-Übung: Vorlesen kommt über den Lautsprecher, nicht leise über die Hörmuschel
- [ ] D8 Einstellungen → Sprache testen → „Vorlesen testen“: Protokoll zeigt `start` und `end`
- [ ] D6 Bildschirm sperren während Ausgabe → Ausgabe stoppt (erwartete iOS-Grenze, dokumentieren)

### E. Offline & Persistenz
- [ ] E1 App einmal online öffnen, dann **Flugmodus** → App schließen & neu starten → Lernen, Vokabeln, Statistik funktionieren
- [ ] E2 Lernfortschritt nach App-Neustart und nach iPhone-Neustart vorhanden
- [ ] E3 Einstellungen → Gerät & Speicher: „Dauerhafter Speicher“ – Status notieren

### F. Backup
- [ ] F1 Vollständiges Backup → „In Dateien sichern“ → Datei in iCloud Drive vorhanden
- [ ] F2 Backup-Datei wählen → Vorschau (Anzahl Einträge/Antworten) → Wiederherstellen → Daten identisch
- [ ] F3 „Letztes Backup“ wird angezeigt; Erinnerung erscheint nach Ablauf der eingestellten Tage

### G. Update ohne Datenverlust
- [ ] G1 Nach einem neuen Deployment App öffnen → Banner „Neue Version verfügbar“ → Aktualisieren
- [ ] G2 Version unter Info gestiegen, Vokabeln/Fortschritt/Einstellungen unverändert

### I. Speaking Mode (v0.2.0) – auf dem iPhone besonders wichtig
- [ ] I1 Lernen → Speaking wählen → Start. Erster Tipp auf das Mikrofon zeigt die Einwilligung; nach „Zustimmen“ erneut tippen
- [ ] I2 **In Safari** (nicht installiert): iOS fragt nach Mikrofon/Spracherkennung → erlauben → einen Satz sprechen → wird erkannt?
- [ ] I3 **Als installierte App** (Home-Bildschirm): dasselbe – funktioniert die Erkennung? Falls nein: welche Meldung erscheint? (Ergebnis in #2 notieren)
- [ ] I4 Falsche Antwort → „Nochmal sprechen“ → zweiter Versuch wird gewertet; Lösung erst danach sichtbar
- [ ] I5 Flugmodus → Speaking ist in „Lernen“ deaktiviert („Benötigt eine Internetverbindung“)
- [ ] I6 Mikrofon in iOS-Einstellungen verweigern → verständliche Meldung + „Stattdessen schreiben“ funktioniert
- [ ] I7 Während/nach der Übung: orangefarbener Mikrofon-Punkt in der Statusleiste verschwindet, sobald die Erkennung endet
- [ ] I8 Mit Bluetooth-Headset: Erkennung über Headset-Mikrofon
- [ ] I9 „Mit iPhone-Diktierfunktion antworten“: Tastatur-🎤 funktioniert in der installierten App, Antwort wird ausgewertet
- [ ] I10 Einstellungen → Spracherkennung testen: in Safari **und** in der installierten App ausführen, Protokolle vergleichen

### K. Kindermodus (v0.4.0) – auf dem iPhone des Kindes
- [ ] K1 App neu installieren bzw. in Safari frisch öffnen → Frage „Wer lernt mit dieser App?“ → „Für Kinder“
- [ ] K2 Startseite: Robo, Level, Missionen, Themen-Kacheln bunt und gut lesbar (hell und dunkel)
- [ ] K3 „Los geht's!“ → Runde spielen → Sterne, Konfetti, +XP; nach der ersten Runde Abzeichen „Erster Start“
- [ ] K4 Tab „Erfolge“: Level, Robo, Abzeichen mit Fortschritt
- [ ] K5 ChatGPT-Import: Prompt kopieren → in ChatGPT mit Foto der Vokabelliste senden → Codeblock kopieren → importieren
- [ ] K6 Kopieren der **ganzen** ChatGPT-Nachricht → Import funktioniert mit Hinweis „automatisch repariert“
- [ ] K7 Einstellungen → Profil → Klassenstufe wechseln → ChatGPT-Prompt nennt die neue Stufe
- [ ] K8 Einstellungen → „Standardvokabeln entfernen …“ → Schüler-Vokabeln entfernen → eigene Importe bleiben

### L. Spielzeit-Challenge (v0.6.0)
- [ ] L1 Schülerprofil → Startseite → „Spielzeit verdienen“ → Erklärung mit Anzahl Wörter und maximalen Minuten
- [ ] L2 „Mit Schreiben starten“ → deutsches Wort, englisch tippen; kein Hinweis-/„War doch richtig“-Knopf
- [ ] L3 Ende: Minuten = richtige Wörter × Minuten pro Wort; falsche Wörter mit Lösung
- [ ] L4 „Fortschritt teilen“ → iOS-Teilen-Menü → WhatsApp → Bild + Text kommen beim Empfänger an
- [ ] L5 „Per WhatsApp senden“ öffnet WhatsApp mit vorausgefülltem Text
- [ ] L6 Startseite zeigt „Heute schon X Minuten verdient“; Einstellungen: Wortanzahl/Minuten pro Wort ändern

### H. Darstellung & Barrierefreiheit
- [ ] H1 iOS-Dunkelmodus umschalten → App folgt automatisch
- [ ] H2 Größere Textgröße (Bedienungshilfen) → Layout bleibt nutzbar
- [ ] H3 VoiceOver: Tab-Leiste, Karteikarte und Bewertungsknöpfe werden sinnvoll vorgelesen
- [ ] H4 Haptik (iOS 18+): leichtes Feedback beim Bewerten, abschaltbar

## Abnahmekriterien v1 (Zuordnung)

| # | Kriterium | Abdeckung |
|---|---|---|
| 1 | App auf iPhone öffnen | A1 |
| 2 | Zum Home-Bildschirm hinzufügen | A2–A3 |
| 3 | JSON aus ChatGPT importieren | B1–B2, E2E import |
| 4 | Vokabeln nach Themenmodi auswählen | C1, E2E learning |
| 5 | Karteikarten lernen & bewerten | C2, E2E learning |
| 6 | Inhalte anhören | D1–D4 |
| 7 | Fortschritt dauerhaft speichern | E2, E2E reload |
| 8 | Lernen im Flugmodus | E1, E2E offline |
| 9 | Backup exportieren & wiederherstellen | F1–F2, E2E backup |
| 10 | Update ohne Datenverlust | G1–G2, Migrationstest |

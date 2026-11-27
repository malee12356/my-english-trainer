# Architektur

## Leitentscheidungen

| Entscheidung | Begründung |
|---|---|
| **React 19 + TypeScript + Vite** | Verbreitet, gute Tooling-Unterstützung, schneller Build. Keine Router-/State-Bibliothek nötig (eigener Hash-Router, React Context). |
| **IndexedDB via Dexie.js** | Robuste, versionierte Schema-Migrationen; Transaktionen; funktioniert in Safari/iOS. |
| **FSRS via ts-fsrs** (MIT, Open Spaced Repetition) | Moderner, gepflegter Algorithmus; Speicherung der Speicherzustände je Fähigkeit. |
| **vite-plugin-pwa (Workbox, generateSW)** | Precaching aller Assets, `registerType: 'prompt'` → Nutzer bestätigt Updates, keine Unterbrechung laufender Lerneinheiten. |
| **Hash-Routing** (`#/vocab`) | Funktioniert auf jedem statischen Hoster und offline ohne Server-Rewrites. |
| **Keine Backend-Pflicht** | Kostenlos, offline, privat. Firebase ist vorbereitet, aber nicht eingebunden (siehe unten). |
| **Hosting: GitHub Pages** | Kostenlos für das öffentliche Repository `my-english-trainer`, HTTPS, Deployment per GitHub Actions bei jedem Push auf `main` (`.github/workflows/deploy.yml`, `BASE_PATH=/<repo>/`). Alternativen ohne Codeänderung: Cloudflare Pages oder Firebase Hosting (beide kostenlos, auch für private Repos). |

## Struktur

```
src/
  domain/       reine Logik ohne DOM/DB – vollständig unit-getestet
    types.ts        Datenmodell (Item, Progress, ReviewLog, Settings …)
    importer.ts     Parsen, Validieren, Planen (neu/Update/Duplikat), Mergen
    csv.ts          RFC-4180-Parser/Writer (inkl. Formel-Injection-Schutz)
    answerCheck.ts  Antwortprüfung (Alternativen, Tippfehler, Satzzeichen, Diff)
    text.ts         Normalisierung, Edit-Distanz, Wort-Diff
    scheduler.ts    FSRS-Anbindung + Sitzungsschutz
    planner.ts      Tagesplanung, Schwachstellen-Score, Item-Status
    stats.ts        Statistiken (Tage, Serie, Methoden, Fehlerquote)
    summary.ts      Dashboard-Kennzahlen
    promptBuilder.ts ChatGPT-Prompt
    topics.ts       Themenmodi + Kategorie-Zuordnung
  db/           Dexie-Schema (db.ts), Zugriffsschicht (repo.ts), Backup (backup.ts)
  speech/       TTS, Fähigkeits-Erkennung, Schnittstelle für Profi-Aussprachebewertung
  screens/      Bildschirme; exercises/ = Lernmethoden
  ui/           Komponenten, Icons, Datei-Helfer
  state.tsx     App-Kontext (Settings, Routing, Toast, Daten-Reload)
```

## Datenfluss

1. UI liest per `loadSnapshot()` alle Daten (für eine persönliche App mit einigen tausend Einträgen performant).
2. Schreibzugriffe gehen über `repo.ts` (Transaktionen). Danach `bump()` → Neuladen.
3. Eine Lerneinheit: `planSession()` erzeugt Aufgaben → Übungskomponente ruft `onDone(grade)` → `recordAnswer()` aktualisiert `progress` (FSRS) und schreibt `reviewLogs`.

## Trennung von Inhalten und Lerndaten

- `items` = Inhalte (importiert/manuell/Starter). Stabile UUID, zusätzlich optionale `externalId` aus dem Import.
- `progress` = FSRS-Zustand je `itemId:skill`. Ein Re-Import schreibt **nur** `items`; Fortschritt bleibt unberührt.
- `reviewLogs`, `sessions` = Historie für Statistik (bleibt auch beim Löschen eines Items erhalten).

## Wiederholungssystem

- Fähigkeiten getrennt: `comprehension` (EN→DE), `recall` (DE→EN, Satzbau), `writing` (Writing, Lückentext), `listening`, `speaking` (Phase 2).
- Freischaltung im Automatikmodus: Verstehen → Abrufen → Schreiben/Hören.
- **Sitzungsschutz** (`scheduler.ts`):
  1. Nur die **erste** Antwort je (Item, Fähigkeit) in einer Sitzung verändert den FSRS-Zustand. Wiederholungen nach „Nicht gewusst“ sind reine Übung.
  2. Nicht fällige Karten („Vorauslernen“) ändern den Plan nur bei „Nicht gewusst“ – richtige Antworten verlängern Intervalle nicht künstlich.
  3. Karten in Lern-/Neulern-Schritten werden normal geplant.
- Parameter: Zielbehaltensquote 0,9; max. Intervall 365 Tage; Fuzz aktiv.

## Tagesplanung (`planSession`)

Reihenfolge: fällige Wiederholungen (am stärksten überfällig zuerst) → neue Inhalte (max. „Neue Einträge pro Tag“, max. ~⅓ des Zeitbudgets solange Wiederholungen anstehen) und Fähigkeits-Freischaltungen → Schwachstellen/niedrigste Erinnerungswahrscheinlichkeit als Zusatzübung. Zeitschätzung je Methode (z. B. Karteikarte 12 s, Writing 25 s). Pro Sitzung jedes Item höchstens einmal (plus Wiederholung nach Fehlern).

## PWA & Updates

- Service Worker precacht alle Assets inkl. lazy geladener Screens → vollständige Offline-Nutzung.
- Update-Prüfung beim Start, stündlich und beim Zurückkehren in die App. Neue Version wird erst nach Tipp auf „Aktualisieren“ aktiv.
- IndexedDB wird von SW-Updates nicht berührt. Schemaänderungen **nur** über neue Dexie-Versionen mit `upgrade()` (siehe `db.ts`, Test in `tests/unit/db.test.ts`).
- `navigator.storage.persist()` wird beim ersten Import angefragt.

## Sicherheit

- Importierte Inhalte sind reine Daten: Whitelist der Felder, Längenbegrenzung, Steuerzeichen entfernt, `__proto__`-Schlüssel verworfen. Darstellung ausschließlich als React-Text (kein `dangerouslySetInnerHTML`).
- CSP per Meta-Tag (`script-src 'self'`, `connect-src 'self'`, `object-src 'none'`). GitHub Pages erlaubt keine eigenen HTTP-Header; bei einem Wechsel zu Cloudflare Pages können zusätzliche Header (z. B. `frame-ancestors`) per `_headers` ergänzt werden.
- CSV-Export schützt vor Formel-Injection (`'=…`).
- Keine Secrets im Repo; keine externen Requests zur Laufzeit.
- **Das Repository ist öffentlich:** Es enthält ausschließlich Code und generische Beispielinhalte – niemals persönliche Lerninhalte, Backups oder berufliche Informationen.

## iOS-Grenzen (geprüft, Stand iOS 17/18)

| Thema | Verhalten | Konsequenz |
|---|---|---|
| Speicher | IndexedDB funktioniert; Home-Bildschirm-Apps sind vom 7-Tage-Limit für Website-Daten ausgenommen, Löschung bei Speichermangel bleibt möglich. `storage.persist()` ab Safari 17. | Backup-Erinnerung, Export in Dateien-App. |
| Sprachausgabe | `speechSynthesis` verfügbar, offline mit Systemstimmen. Start muss synchron im Tipp erfolgen. Einige gelistete Stimmen sind stumm (nicht geladen). Der Stummschalter kann die Ausgabe stummschalten; nach Mikrofonnutzung landet der Ton evtl. auf der Hörmuschel. **Stoppt bei Bildschirmsperre/Hintergrund.** | Standard: nur `lang` setzen (Systemstimme); `navigator.audioSession.type = 'playback'` vor dem Vorlesen, `'auto'` vor der Erkennung; zusätzlich stille `<audio>`-Wiedergabe (Blob-WAV, `src/speech/unmute.ts`) während der Ansage gegen den Stummschalter; kein `cancel()` vor `speak()` ohne laufende Ansage; Fehlermeldung statt Stille; Vorlese-Test in der Diagnose. |
| Spracherkennung | `webkitSpeechRecognition` ab iOS 14.5, nutzt in der Regel Server-Diktat von Apple (Internet nötig), im installierten PWA-Modus historisch unzuverlässig. | Speaking Mode nur online wählbar, Einwilligung vor erster Nutzung, Start-Timeout (5 s) gegen hängende Engines, „Stattdessen schreiben“. Nie als Aussprachebewertung darstellen. |
| Aufnahme | `MediaRecorder` ab iOS 14.5 (`audio/mp4`). Mikrofon nur auf Anforderung. | Phase 2; Aufnahmen nur im Speicher, dauerhaft nur mit Zustimmung. |
| Hintergrund/Sperrbildschirm | Web-Apps werden im Hintergrund pausiert; Media Session nur für `<audio>`, nicht für Sprachsynthese. | **Driving Mode** ist als PWA nicht zuverlässig bildschirmfrei umsetzbar → Phase 3: Variante mit vorab erzeugten Audiodateien prüfen oder native Erweiterung. |
| Bluetooth/Unterbrechungen | Ausgabe folgt der System-Route (Auto-Bluetooth funktioniert bei aktiver App). Anrufe/Navigation unterbrechen die Sprachausgabe ohne Fortsetzung. | Dokumentiert; Fortsetzung manuell. |
| Haptik | `navigator.vibrate` nicht unterstützt; ab iOS 18 Workaround über nativen Switch. | Optional, als „eingeschränkt“ gekennzeichnet. |

## Speaking Mode (v0.2.0)

- `src/speech/recognition.ts`: einmalige Erkennung (`continuous: false`, `interimResults: true`, 3 Alternativen, 12 s Maximaldauer, 15 s Start-Timeout). WebKit-Sonderfälle: Zwischenergebnis wird genutzt, wenn kein Endergebnis kommt; `stop()` bei `speechend`; jedes Audio-Ereignis zählt als Start. Fehlercodes `denied`, `network`, `no-speech`, `no-mic`, `failed` …; `abort()` beim Verlassen der Übung → Mikrofon nie dauerhaft aktiv. Ereignisprotokoll über `onEvent` (Diagnose-Seite `#/speech-test`).
- Ausweg für installierte iOS-Web-Apps: Antwort über die **Tastatur-Diktierfunktion** in ein Textfeld, Auswertung identisch (`evaluateSpeech`). Die App startet dabei selbst keine Aufnahme.
- `src/domain/speech.ts`: `normalizeSpoken()` (Kurzformen, Zahlen) + `evaluateSpeech()` (bestes Ergebnis gegen alle akzeptierten Antworten; richtig im 1. Versuch → „Gut“, später → „Schwer“, sonst „Nicht gewusst“).
- Eigene Fähigkeit `speaking` (getrennter FSRS-Zustand). Nur in Einheiten mit gewählter Methode „Speaking“, nicht im Automatikmodus (Mikrofonabfrage soll nie überraschend kommen; Zuverlässigkeit auf iOS erst prüfen).
- Fallback: Die aktuelle Aufgabe wird zur Writing-Aufgabe (Fähigkeit `writing`).
- Einwilligung `settings.sttConsent` (`granted`/`denied`/nicht gefragt). Gespeichert wird nur der erkannte Text in `reviewLogs.given` (max. 200 Zeichen), keine Audiodaten.

## Kindermodus (v0.4.0)

- Profil `settings.profile` (`adult` | `kid`). Beim ersten Start einer leeren App fragt `Welcome` danach (`resolveProfileOnStart`). Bestehende Installationen mit Inhalten bleiben ohne Nachfrage bei `adult`.
- Darstellung: `data-profile="kid"` am `<html>` schaltet Farben, Schrift (ui-rounded) und Radien um. `KidHome` ersetzt das Dashboard; der Tab „Statistik“ heißt „Erfolge“.
- Gamification (`src/domain/gamification.ts`) wird vollständig **aus vorhandenen Daten abgeleitet** (reviewLogs, sessions, progress): XP, Level (`50·n·(n−1)`), Robo-Stufe, Sterne, Abzeichen, Tagesmissionen. Kein zusätzlicher Speicher, immer konsistent, automatisch im Backup.
- Maskottchen `src/ui/Robot.tsx`: reines SVG, Stimmungen und 5 Stufen, Animationen nur ohne „Bewegung reduzieren“.
- Klassenstufen (`src/domain/grades.ts`): 5–6, 7–8, 9–10 mit Niveau, Grammatikthemen und eigenem Vokabelpaket (`source` = `starter-kids`, `starter-kids-7-8`, `starter-kids-9-10`). Mitgelieferte Pakete erkennt man an `origin = starter` + `source`; nur diese entfernt `removeStarterPack`.
- Spielzeit-Challenge (`src/domain/challenge.ts`, Route `#/challenge`, Sitzung mit `?mode=challenge`): Auswahl `planChallenge` (schwach → unsicher → neu, nie „sicher“), strenger Übungsmodus (`strict`: kein Hinweis, keine Selbstkorrektur), keine Wiederholungsschleife, Belohnung nur für die erste Antwort je Wort (`earnsReward`). Ergebnis wird in der Sitzung gespeichert (`kind`, `rewardMinutes`). Teilen über Web Share API (PNG-Karte per Canvas + Text) oder `wa.me`-Link.
- Test-/Entwickler-Schalter (nur `localStorage`, nicht in der UI): `pet.profile` = `adult`|`kid` beantwortet die Startfrage, `pet.skipStarter` = `1` lädt keine Standardvokabeln.

## Vorbereitet, nicht aktiv

- **Firebase-Sync (Phase 4, nur nach Freigabe):** Datenmodell mit stabilen IDs und `updated_at`, Backup-Format = Sync-Payload. Geplante Struktur `users/{uid}/items/{id}`, `users/{uid}/progress/{id}`, Rules nur `request.auth.uid == uid`, Emulator-Tests der Rules.
- **Profi-Aussprachebewertung:** `src/speech/pronunciationProvider.ts` – Schnittstelle ohne Implementierung; jeder Anbieter benötigt Zustimmung, keine Schlüssel im Bundle.

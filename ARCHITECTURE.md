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
| **Hosting: Cloudflare Pages (empfohlen)** | Kostenlos auch für private Repos, HTTPS, eigene Security-Header (`public/_headers`). GitHub Pages ist für private Repos nur mit kostenpflichtigem Plan möglich. Firebase Hosting wäre ebenfalls kostenlos möglich. |

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
- CSP per Meta-Tag (`script-src 'self'`, `connect-src 'self'`) + Security-Header in `public/_headers` (Cloudflare Pages).
- CSV-Export schützt vor Formel-Injection (`'=…`).
- Keine Secrets im Repo; keine externen Requests zur Laufzeit.

## iOS-Grenzen (geprüft, Stand iOS 17/18)

| Thema | Verhalten | Konsequenz |
|---|---|---|
| Speicher | IndexedDB funktioniert; Home-Bildschirm-Apps sind vom 7-Tage-Limit für Website-Daten ausgenommen, Löschung bei Speichermangel bleibt möglich. `storage.persist()` ab Safari 17. | Backup-Erinnerung, Export in Dateien-App. |
| Sprachausgabe | `speechSynthesis` verfügbar, offline mit Systemstimmen. Start muss durch Nutzer-Tipp erfolgen. **Stoppt bei Bildschirmsperre/Hintergrund.** | Vorlesen per Tipp; kein Versprechen für Hintergrundbetrieb. |
| Spracherkennung | `webkitSpeechRecognition` ab iOS 14.5, nutzt Server-Diktat (Internet nötig), im installierten PWA-Modus historisch unzuverlässig. | Phase 2 mit Fähigkeitsprüfung, Fallback auf Schreib-/Karteikartenübung. Nie als Aussprachebewertung darstellen. |
| Aufnahme | `MediaRecorder` ab iOS 14.5 (`audio/mp4`). Mikrofon nur auf Anforderung. | Phase 2; Aufnahmen nur im Speicher, dauerhaft nur mit Zustimmung. |
| Hintergrund/Sperrbildschirm | Web-Apps werden im Hintergrund pausiert; Media Session nur für `<audio>`, nicht für Sprachsynthese. | **Driving Mode** ist als PWA nicht zuverlässig bildschirmfrei umsetzbar → Phase 3: Variante mit vorab erzeugten Audiodateien prüfen oder native Erweiterung. |
| Bluetooth/Unterbrechungen | Ausgabe folgt der System-Route (Auto-Bluetooth funktioniert bei aktiver App). Anrufe/Navigation unterbrechen die Sprachausgabe ohne Fortsetzung. | Dokumentiert; Fortsetzung manuell. |
| Haptik | `navigator.vibrate` nicht unterstützt; ab iOS 18 Workaround über nativen Switch. | Optional, als „eingeschränkt“ gekennzeichnet. |

## Vorbereitet, nicht aktiv

- **Firebase-Sync (Phase 4, nur nach Freigabe):** Datenmodell mit stabilen IDs und `updated_at`, Backup-Format = Sync-Payload. Geplante Struktur `users/{uid}/items/{id}`, `users/{uid}/progress/{id}`, Rules nur `request.auth.uid == uid`, Emulator-Tests der Rules.
- **Profi-Aussprachebewertung:** `src/speech/pronunciationProvider.ts` – Schnittstelle ohne Implementierung; jeder Anbieter benötigt Zustimmung, keine Schlüssel im Bundle.

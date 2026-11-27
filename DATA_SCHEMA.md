# Datenschema

Versionen: **Import-Schema v1**, **Backup-Format v1**, **IndexedDB-Schema v2**.

## 1. Importformat (JSON)

Ein JSON-Array von Einträgen. Alternativ ein Objekt `{ "schema": "personal-english-trainer/import", "version": 1, "items": [ … ] }` oder ein einzelnes Objekt. Code-Fences (```` ```json ````) aus ChatGPT werden automatisch entfernt. Feldnamen sind nicht case-sensitiv.

### Pflichtfelder

| Feld | Typ | Beschreibung |
|---|---|---|
| `english` | string | Englisches Wort, Redewendung oder Satz (max. 1000 Zeichen) |
| `german` | string | Deutsche Übersetzung |

### Optionale Felder (abwärtskompatibel)

| Feld | Typ | Beschreibung |
|---|---|---|
| `example_en`, `example_de` | string | Beispielsatz und Übersetzung |
| `alternatives` | string[] | **Kompatibilitätsfeld**: alternative **englische** Antworten (= `alternatives_en`) |
| `alternatives_en` | string[] | Weitere korrekte englische Antworten (Richtung DE→EN) – nur kontextgerechte Synonyme |
| `alternatives_de` | string[] | Weitere korrekte deutsche Antworten (Richtung EN→DE) |
| `ipa` | string | Lautschrift |
| `category` | string \| string[] | Themenmodus/Kategorie, z. B. `"Meeting Mode"` |
| `categories` | string[] | Mehrere Kategorien |
| `level` | `A1`…`C2` | Unbekannte Werte → Warnung, ignoriert |
| `type` | `word` \| `phrase` \| `sentence` \| `grammar` \| `correction` | Fehlt/unbekannt → automatisch erkannt |
| `tags` | string[] \| string | Schlagwörter |
| `notes` | string | Notizen (max. 4000) |
| `common_mistake` | string | Typischer/eigener Fehler (bei `correction`) |
| `explanation` | string | Erklärung (max. 4000) |
| `source` | string | Herkunft, z. B. `chatgpt-project` |
| `unit` | string | Unit/Lektion im Schulbuch, z. B. `"Unit 3"` (`"3"` → `"Unit 3"`); fehlt sie bei einer Seite, wird sie von der vorherigen Seite derselben Datei übernommen |
| `page` | number \| string | Buchseite, z. B. `196` oder `"S. 196"` |
| `book` | string | Buchtitel (optional; Unit-Übernahme nur innerhalb desselben Buchs) |
| `examples` | `{en, de?}[]` \| string[] | Weitere Beispiele (max. 10) |
| `id` | string | Externe stabile ID → Abgleich bei Re-Import (auch wenn sich `english` ändert) |
| `created_at`, `updated_at` | ISO-8601 | Optional; `updated_at` wird beim Import neu gesetzt |

In CSV werden Listen mit `|` (oder `;`) getrennt; Trennzeichen der Datei (`,` `;` Tab) wird erkannt.

### Kategorie-Zuordnung

Bekannte Namen/Aliase werden den Themenmodi zugeordnet (Erwachsene: `everyday`, `business`, `engineering`, `meeting`, `handball`; Kinder: `school` „School & Classroom“, `family` „Family & Animals“, `daily` „Daily Life“), z. B. „Meeting Mode“, „meetings“, „Engineering“, „FEM“, „Handball“. Andere Namen erzeugen eine neue Kategorie mit ID `c-<slug>`.

### Duplikate & Aktualisierungen

- Abgleich: zuerst `id` (externalId), sonst normalisierter englischer Text (Kleinschreibung, Satzzeichen, führendes „to “ ignoriert).
- Status je Zeile: `new`, `update` (geänderte Felder werden gelistet), `unchanged`, `duplicate` (mehrfach in derselben Datei), `invalid`.
- Update-Regeln: übergebene Einzelfelder überschreiben; Listen (Alternativen, Tags, Kategorien, Beispiele) werden **vereinigt**; Favorit/Archiv/Sammlungen und **Lernfortschritt bleiben erhalten**.

## 2. Interne Datenbank (IndexedDB `personal-english-trainer`, Version 2)

| Store | Schlüssel | Inhalt |
|---|---|---|
| `items` | `id` (UUID) | Inhalt + `key` (Duplikat-Schlüssel), `externalId`, `origin` (`import`/`manual`/`starter`), `favorite`, `archived`, `collections[]`, `schemaVersion` |
| `progress` | `itemId:skill` | FSRS: `due`, `stability`, `difficulty`, `state` (0 neu, 1 lernen, 2 wiederholen, 3 neu lernen), `reps`, `lapses`, `last_review`, … + Statistik: `correct`, `wrong`, `skipped`, `answered`, `totalResponseMs`, `lastGrade` |
| `reviewLogs` | auto | Jede Antwort: `itemId`, `skill`, `method`, `topic`, `grade` 1–4, `correct`, `scheduled` (hat den Plan verändert?), `responseMs`, `sessionId`, `ts`, `isNew`, `given` (getippte Antwort bzw. im Speaking Mode der erkannte Text, max. 200 Zeichen – nie Audio) |
| `sessions` | `id` | `startedAt`, `endedAt`, `activeMs` (gemessen, Leerlauf je Aufgabe max. 60 s), `topic`, `method`, `answered`, `correct`, optional `kind = 'challenge'` + `rewardMinutes` (verdiente Spielzeit) |
| `categories` | `id` | Themenmodi (`builtin: true`) und eigene Kategorien |
| `collections` | `id` | Eigene Sammlungen |
| `settings` | `'settings'` | Einstellungen (Sprache, Design, Tagesziel, Stimme, Tempo, …, `lastBackupAt`, `sttConsent` = Zustimmung zur Spracherkennung, `starterAutoLoaded` = Standardvokabeln wurden beim ersten Start geladen, `profile` = `adult`/`kid`, `profileChosen`, `kidGrade` = `5-6`/`7-8`/`9-10`, `challengeWords`, `minutesPerWord`, `parentLock` = `{ v: 1, hash }` (PBKDF2-SHA-256 der Eltern-PIN)) |

Skills: `comprehension` (EN→DE), `recall` (DE→EN), `writing`, `listening`, `speaking`.

### Abgeleitete Status (Definitionen)

- **neu**: noch keine Antwort.
- **schwierig**: Schwachstellen-Score ≥ 2. Score = 2 × Vergessen + 3 × Fehlerquote (ab 2 Antworten, ≥ 34 %) + 1 bei Ø Antwortzeit > 12 s + 0,5 je Überspringen (max. 2) + 2/1 bei letzter Bewertung „Nicht gewusst“/„Schwer“ + 1 für importierte Fehlerkorrekturen.
- **sicher**: Verstehen **und** Abrufen im Wiederholungsstatus mit Stabilität ≥ 21 Tage.
- **fällig**: mindestens eine gelernte Fähigkeit mit `due ≤ jetzt`.

### Migrationen

| Version | Änderung |
|---|---|
| 1 | Erstes Schema |
| 2 | Index `key`, `externalId`, `*collections`, `[skill+due]`; Upgrade füllt `key`, `favorite`, `archived`, `collections`, leere Listen |

## 3. Backup-Format (v1)

```json
{
  "format": "personal-english-trainer-backup",
  "version": 1,
  "appVersion": "0.1.0",
  "dbVersion": 2,
  "exportedAt": "2026-11-26T18:00:00.000Z",
  "data": {
    "items": [], "progress": [], "reviewLogs": [], "sessions": [],
    "categories": [], "collections": [], "settings": {}
  }
}
```

Validierung vor Restore: Format-ID, Version ≤ unterstützt, alle Arrays vorhanden, Pflichtfelder von Items/Progress, Warnung bei verwaisten Fortschritten. Restore ersetzt alle lokalen Daten in einer Transaktion. Ältere Backups werden beim Restore normalisiert (fehlende Felder ergänzt).

## 4. CSV-Export

Spalten: `id, english, german, type, level, categories, tags, alternatives_en, alternatives_de, example_en, example_de, ipa, notes, common_mistake, explanation, source, unit, page, book` (Listen mit `|`). Re-importierbar.

## 5. Einrichtungscode (Eltern → Schüler-App)

`PET1-` + base64url(JSON), Beispielinhalt:

```json
{ "v": 1, "profile": "kid", "grade": "5-6", "words": 20, "minutesPerWord": 1, "lock": { "v": 1, "hash": "<PBKDF2-SHA-256, 43 Zeichen base64url>" } }
```

Validierung: `grade` ∈ 5-6/7-8/9-10, `words` 5–50, `minutesPerWord` > 0 und ≤ 10, `hash` 40–60 Zeichen base64url. Die PIN selbst ist nie enthalten. Der Salt ist absichtlich fest, damit gleiche PINs gleiche Hashes ergeben und Folge-Codes derselben Eltern ohne PIN-Abfrage übernommen werden. Eine 4-stellige PIN ist auf dem Gerät ohnehin nicht gegen Durchprobieren zu schützen; sie ist eine Hürde im Haushalt, keine Sicherheitsgrenze.

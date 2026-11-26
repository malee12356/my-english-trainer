# Import-Anleitung

## Wege in die App

| Weg | So geht's |
|---|---|
| ChatGPT → Zwischenablage | ChatGPT-Antwort kopieren → App: Einstellungen → *Datei / Text importieren* → *Einfügen* → *Aus Zwischenablage einfügen* (iOS fragt „Einsetzen“) |
| ChatGPT → Datei | In ChatGPT „als .json-Datei ausgeben“ lassen und in der Dateien-App sichern → App: *Datei auswählen* |
| Tabelle (Numbers/Excel) | Als CSV exportieren (Kopfzeile mit `english,german,…`) → *Datei auswählen* |
| Manuell | Vokabeln → **+** oder Einstellungen → *Manuell hinzufügen* |

Vor dem Import zeigt die App eine **Vorschau**: neue Einträge, Aktualisierungen (mit geänderten Feldern), unveränderte, Duplikate in der Datei und fehlerhafte Zeilen (mit Grund). Pro Zeile kann *Hinzufügen / Aktualisieren / Als neu anlegen / Überspringen* gewählt werden. Erst **„Import bestätigen“** schreibt Daten; *Abbrechen* verwirft alles.

## Der ChatGPT-Prompt

Einstellungen → **ChatGPT-Import** erzeugt einen Prompt mit:
- Anzahl, Thema (Themenmodus oder gemischt), Lernmodus-Fokus, Niveau,
- Inhaltsarten: Vokabeln, Redewendungen, Beispielsätze, Grammatik, persönliche Fehler, technische Begriffe,
- der Anweisung, **nur Informationen aus dem Projekt** zu verwenden (frühere Gespräche, Korrekturen) und nichts über dich zu erfinden,
- dem exakten JSON-Ausgabeformat.

Tipp: Im ChatGPT-Projekt kann man ergänzen: *„Berücksichtige besonders die Fehler aus unserem letzten Gespräch über …“*.

## Minimalbeispiel

```json
[
  { "english": "to take into account", "german": "berücksichtigen" }
]
```

## Vollständiges Beispiel

```json
[
  {
    "id": "meeting-0001",
    "english": "Could you clarify this point?",
    "german": "Könnten Sie diesen Punkt erläutern?",
    "type": "sentence",
    "category": "Meeting Mode",
    "level": "B1",
    "alternatives_en": ["Could you clarify that point?"],
    "example_en": "Sorry, could you clarify this point? I'm not sure I understood the boundary conditions.",
    "example_de": "Entschuldigung, könnten Sie diesen Punkt erläutern? Ich bin nicht sicher, ob ich die Randbedingungen verstanden habe.",
    "tags": ["questions", "polite"],
    "explanation": "Höfliche Rückfrage – gut, um Zeit zu gewinnen.",
    "source": "chatgpt-project"
  },
  {
    "english": "to make a decision",
    "german": "eine Entscheidung treffen",
    "type": "correction",
    "common_mistake": "to do a decision",
    "categories": ["Business English", "Meeting Mode"]
  }
]
```

Weitere Dateien: [`docs/examples/sample-import.json`](docs/examples/sample-import.json), [`docs/examples/sample-import.csv`](docs/examples/sample-import.csv) (auch in der App unter Import → „Beispiel JSON/CSV“).

## CSV

```csv
english,german,category,level,alternatives_en,tags
to take into account,berücksichtigen,Meeting Mode,B2,to consider|to bear in mind,meetings|verbs
```

- Kopfzeile erforderlich, Spaltennamen wie im JSON.
- Trennzeichen `,`, `;` oder Tab werden erkannt; Felder mit Komma/Zeilenumbruch in `"…"`.
- Listen mit `|`.

## Häufige Fehler

| Meldung | Ursache / Lösung |
|---|---|
| *Ungültiges JSON* | ChatGPT hat Text um das JSON geschrieben oder Kommentare/abschließende Kommas verwendet → nur das Array kopieren bzw. ChatGPT bitten „nur gültiges JSON“ |
| *missing:english / missing:german* | Pflichtfeld leer |
| *level … unknown* | Nur A1–C2 erlaubt; Feld wird ignoriert |
| *duplicate-in-file* | Gleicher englischer Eintrag mehrfach in der Datei – nur der erste wird verwendet |
| *Zu viele Einträge* | Max. 5000 pro Import – Datei teilen |

## Sicherheit

Importierte Inhalte werden ausschließlich als Text behandelt. HTML oder Skripte in Feldern werden **nicht** ausgeführt, sondern wörtlich angezeigt.

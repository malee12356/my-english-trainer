# CLAUDE.md – Arbeitsanweisungen für KI-Assistenten

Projekt: **Personal English Trainer** – private, offline-first PWA (React + TS + Vite + Dexie + ts-fsrs). Eigenständiges Projekt, keine Verbindung zu anderen Repositories.

## Vor jeder Änderung
1. `README.md`, `ARCHITECTURE.md`, `ROADMAP.md` und die betroffenen Abschnitte von `DATA_SCHEMA.md` lesen.
2. `npm ci && npm run typecheck && npm test` muss grün sein.

## Regeln
- **Daten der Nutzerin/des Nutzers sind heilig.** Schemaänderungen nur über eine neue Dexie-Version in `src/db/db.ts` mit `upgrade()` + Migrationstest in `tests/unit/db.test.ts`. Bestehende Versionsblöcke nie ändern.
- Inhalte (`items`) und Lerndaten (`progress`, `reviewLogs`, `sessions`) getrennt halten. Import darf Fortschritt nie verändern.
- Import-/Backup-Format nur abwärtskompatibel erweitern; `DATA_SCHEMA.md` + Beispiele aktualisieren.
- Domänenlogik in `src/domain/` bleibt DOM-/DB-frei und wird unit-getestet.
- Keine `dangerouslySetInnerHTML`, keine externen Laufzeit-Requests, keine Analytics, keine Secrets im Repo.
- Keine Funktionen in der UI als verfügbar darstellen, die nicht funktionieren (`status: 'planned'` in `src/domain/methods.ts`).
- Keine erfundenen Aussprache-Prozentwerte; Spracherkennung ≠ Aussprachebewertung.
- Kostenpflichtige Dienste, Cloud-Sync, KI-APIs, native App: **nur nach ausdrücklicher Freigabe** (Phase 4).
- Keine persönlichen Lerninhalte, Backups oder vertraulichen Berufsdaten committen; Beispieldaten bleiben generisch.

## Befehle
```bash
npm run dev | typecheck | test | build | e2e | icons
```

## Abschluss jeder Änderung
- Tests ergänzen/ausführen (Unit + bei UI-Änderungen E2E).
- `CHANGELOG.md` und betroffene Dokumente aktualisieren; Version in `package.json` nach SemVer.
- Manuelle iPhone-Punkte aus `TEST_PLAN.md` nennen, die neu geprüft werden müssen.

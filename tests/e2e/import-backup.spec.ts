import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { finishFlashcardSession, importPasted } from './helpers';
import { emptyApp } from './helpers';

test.beforeEach(async ({ page }) => emptyApp(page));

const SPEC = JSON.stringify([
  { english: 'to take into account', german: 'berücksichtigen', example_en: 'We need to take this into account.', example_de: 'Wir müssen das berücksichtigen.', alternatives: ['to consider'], ipa: '/tə teɪk ˈɪntuː əˈkaʊnt/', category: 'Meeting Mode', level: 'B2' },
  { english: 'boundary conditions', german: 'Randbedingungen', category: 'Engineering Mode' },
  { english: '', german: 'kaputt' },
  { english: 'Boundary conditions', german: 'Randbedingungen' },
]);

test('JSON paste import: preview, errors, duplicates and progress kept on re-import', async ({ page }) => {
  await page.goto('/');
  await importPasted(page, SPEC);
  await expect(page.getByText('2 neu')).toBeVisible();
  await expect(page.getByText('1 Duplikate')).toBeVisible();
  await expect(page.getByText('1 fehlerhaft')).toBeVisible();
  await page.getByRole('button', { name: 'Import bestätigen (2)' }).click();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await expect(page.getByText('to take into account')).toBeVisible();

  // learn both items once
  await page.goto('/#/session?topic=all&method=flashcards&min=5');
  await finishFlashcardSession(page);

  // re-import with a change → update, progress stays
  await importPasted(page, JSON.stringify([{ english: 'to take into account', german: 'berücksichtigen', notes: 'neu dazu' }, { english: 'boundary conditions', german: 'Randbedingungen', category: 'Engineering Mode' }]));
  await expect(page.getByText('1 Aktualisierungen')).toBeVisible();
  await expect(page.getByText('1 vorhanden & unverändert')).toBeVisible();
  await page.getByRole('button', { name: 'Import bestätigen (1)' }).click();
  await page.getByText('to take into account').click();
  await expect(page.getByLabel('Notizen')).toHaveValue('neu dazu');
  await expect(page.getByText(/1× wiederholt/).first()).toBeVisible();
});

test('CSV file import and cancel', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByLabel('Datei wählen').setInputFiles({
    name: 'words.csv', mimeType: 'text/csv',
    buffer: Buffer.from('english;german;category\nstrain;Dehnung;Engineering Mode\n"yield strength";Streckgrenze;Engineering Mode\n'),
  });
  await expect(page.getByText('2 neu')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await page.goto('/#/vocab');
  await expect(page.getByText('Noch keine Vokabeln')).toBeVisible();
});

test('invalid JSON is reported, imported HTML is shown as plain text (no XSS)', async ({ page }) => {
  let dialog = false;
  page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
  await page.goto('/');
  await importPasted(page, '[{"english": "broken", "german": ');
  await expect(page.getByRole('alert')).toContainText('Ungültiges JSON');
  await importPasted(page, JSON.stringify([{ english: '<img src=x onerror=alert(1)>', german: '<script>alert(2)</script>' }]));
  await page.getByRole('button', { name: 'Import bestätigen (1)' }).click();
  await expect(page.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(dialog).toBe(false);
});

test('full backup export and restore into an empty app', async ({ page, browser }) => {
  await page.goto('/');
  await importPasted(page, SPEC);
  await page.getByRole('button', { name: 'Import bestätigen (2)' }).click();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await page.goto('/#/session?topic=all&method=flashcards&min=5');
  await finishFlashcardSession(page);
  await page.goto('/#/backup');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Vollständiges Backup exportieren' }).click()]);
  const file = await download.path();
  const backup = JSON.parse(readFileSync(file!, 'utf8'));
  expect(backup.format).toBe('personal-english-trainer-backup');
  expect(backup.data.items).toHaveLength(2);
  expect(backup.data.progress.length).toBeGreaterThanOrEqual(2);
  await expect(page.getByText(/Letztes Backup/)).not.toContainText('noch keines');

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto('/');
  // a new device: the first-start question offers restoring a backup
  await p2.getByRole('button', { name: /Ich habe ein Backup/ }).click();
  await expect(p2.getByText(/Letztes Backup/)).toBeVisible();
  await p2.getByLabel('Backup-Datei wählen').setInputFiles(file!);
  await expect(p2.getByText('Backup gültig')).toBeVisible();
  await expect(p2.getByText(/2 Einträge/)).toBeVisible();
  await p2.getByRole('button', { name: 'Alle Daten durch Backup ersetzen' }).click();
  await p2.getByRole('dialog').getByRole('button', { name: 'Wiederherstellen' }).click();
  await expect(p2.getByText('Backup wiederhergestellt')).toBeVisible();
  await p2.goto('/#/vocab');
  await expect(p2.getByText('boundary conditions')).toBeVisible();
  await p2.goto('/#/stats');
  await expect(p2.getByText('Erfolgsquote nach Lernmethode')).toBeVisible();
  await ctx2.close();
});

test('ChatGPT prompt can be configured and copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  await page.goto('/#/prompt');
  await page.getByLabel('Thema').selectOption('engineering');
  await expect(page.locator('pre.prompt')).toContainText('Topic: Engineering Mode');
  await page.getByRole('button', { name: 'Prompt kopieren' }).click();
  await expect(page.getByText(/Prompt kopiert|Kopieren nicht möglich/)).toBeVisible();
});

test('ChatGPT message copied as a whole (Markdown escapes) is repaired and imported', async ({ page }) => {
  await page.goto('/');
  const pasted = '\\[ { "english": "I can\'t really judge him because I\'m no better myself.", "german": "Ich kann ihn eigentlich nicht verurteilen, weil ich selbst nicht besser bin.", "type": "correction", "category": "Everyday English", "level": "B1", "example\\_en": "I can\'t really judge others because I\'m no better myself.", "example\\_de": "Ich kann andere nicht verurteilen." } \\]';
  await importPasted(page, pasted);
  await expect(page.getByText('1 neu')).toBeVisible();
  await expect(page.getByText(/automatisch repariert/)).toBeVisible();
  await page.getByRole('button', { name: 'Import bestätigen (1)' }).click();
  await expect(page.getByText("I can't really judge him because I'm no better myself.")).toBeVisible();
});

test('heavily damaged ChatGPT paste (typographic quotes, lost list brackets) is imported', async ({ page }) => {
  const damaged = readFileSync(new URL('../fixtures/chatgpt-damaged-paste.txt', import.meta.url), 'utf8');
  await page.goto('/');
  await importPasted(page, damaged);
  await expect(page.getByText('4 neu')).toBeVisible();
  await expect(page.getByText('0 fehlerhaft')).toBeVisible();
  await expect(page.getByText(/automatisch repariert/)).toBeVisible();
  await page.getByRole('button', { name: 'Import bestätigen (4)' }).click();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Suchen' }).fill('carry on');
  await expect(page.getByText('We can continue tomorrow.')).toBeVisible();
});

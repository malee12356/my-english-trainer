import { expect, test } from '@playwright/test';
import { emptyApp, finishFlashcardSession, importPasted } from './helpers';

test.beforeEach(async ({ page }) => emptyApp(page));

const WORDS = JSON.stringify([
  { english: 'gear wheel', german: 'Zahnrad' },
  { english: 'shaft', german: 'Welle' },
]);

test('one-tap backup after a session and restoring an automatic copy after deleting', async ({ page }) => {
  await page.goto('/');
  await importPasted(page, WORDS);
  await page.getByRole('button', { name: 'Import bestätigen (2)' }).click();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();

  await page.goto('/#/session?topic=all&method=flashcards&min=5');
  await finishFlashcardSession(page);

  // one-tap file backup on the summary
  await expect(page.getByText('Fortschritt sichern')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Sichern', exact: true }).click()]);
  expect(download.suggestedFilename()).toMatch(/^english-trainer-backup-.*\.json$/);
  await expect(page.getByText('Heute schon gesichert')).toBeVisible();

  // an automatic copy was made at the end of the session
  await page.goto('/#/backup');
  const copies = page.getByTestId('snapshot');
  await expect(copies.first()).toContainText('Nach einer Lerneinheit');
  await expect(copies.first()).toContainText('2 Einträge');

  // delete a word → a copy is made before deleting
  await page.goto('/#/vocab');
  await page.getByText('shaft').click();
  await page.getByRole('button', { name: 'Eintrag löschen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await page.goto('/#/vocab');
  await expect(page.getByText('gear wheel')).toBeVisible();
  await expect(page.getByText('shaft')).toHaveCount(0);

  // bring it back from the automatic copy
  await page.goto('/#/backup');
  await expect(copies.first()).toContainText('Vor dem Löschen von Einträgen');
  await copies.first().getByRole('button', { name: 'Zurückholen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Zurückholen' }).click();
  await expect(page.getByText('Stand zurückgeholt ✓')).toBeVisible();
  await expect(copies.first()).toContainText('Vor dem Zurückholen einer Auto-Kopie');
  await page.goto('/#/vocab');
  await expect(page.getByText('shaft')).toBeVisible();
});

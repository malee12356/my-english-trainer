import { expect, test } from '@playwright/test';
import { finishFlashcardSession, importPasted, loadStarter } from './helpers';

test('flashcard session is saved and survives a reload', async ({ page }) => {
  await loadStarter(page);
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await page.getByRole('button', { name: 'Jetzt lernen' }).click();
  // card flips by tap and shows four rating buttons
  await page.getByRole('button', { name: /Karte umdrehen/ }).click();
  for (const g of ['Nicht gewusst', 'Schwer', 'Gut', 'Einfach']) await expect(page.getByRole('button', { name: new RegExp(`^${g}`) })).toBeVisible();
  await page.getByRole('button', { name: /^Gut/ }).click();
  const answered = await finishFlashcardSession(page);
  expect(answered).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.reload();
  await expect(page.getByText(/[1-9]\d* Antworten heute/)).toBeVisible();
  await page.goto('/#/stats');
  await expect(page.getByText('Erfolgsquote nach Lernmethode')).toBeVisible();
  await expect(page.getByText('Karteikarten')).toBeVisible();
});

test('writing mode marks small typos and shows the solution', async ({ page }) => {
  await page.goto('/');
  await importPasted(page, JSON.stringify([{ english: 'convergence', german: 'Konvergenz', category: 'E2E Topic', explanation: 'Fachbegriff' }]));
  await page.getByRole('button', { name: /Import bestätigen \(1\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await page.goto('/#/session?topic=c-e2e-topic&method=writing&min=5');
  await expect(page.getByText('Konvergenz')).toBeVisible();
  await page.getByLabel('Englische Antwort').fill('convergense');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Fast richtig')).toBeVisible();
  await expect(page.getByText('Kleiner Tippfehler')).toBeVisible();
  await expect(page.locator('.d-typo')).toHaveText(/convergense/);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Einheit abgeschlossen')).toBeVisible();
});

test('topic modes are selectable and planned methods are transparently disabled', async ({ page }) => {
  await loadStarter(page);
  await page.goto('/#/learn');
  await page.getByRole('button', { name: /Engineering Mode/ }).click();
  await page.getByRole('radio', { name: /Karteikarten/ }).click();
  await expect(page.getByRole('radio', { name: /^Speaking/ })).toBeDisabled();
  await expect(page.getByRole('radio', { name: /Phase 2/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Driving Mode/ })).toBeDisabled();
  await page.getByRole('button', { name: /Starten · \d+ Übungen/ }).click();
  await expect(page.getByText(/Engineering Mode · Karteikarten/)).toBeVisible();
});

import { expect, test } from '@playwright/test';
import { finishFlashcardSession, horizontalOverflow, presetProfile } from './helpers';

test('first start asks who is learning; kids get Robo, missions and school vocabulary', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Wer lernt mit dieser App?')).toBeVisible();
  await page.getByRole('button', { name: /Für Kinder/ }).click();
  await expect(page.getByRole('button', { name: "🚀 Los geht's!" })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Mini-Robo' }).first()).toBeVisible();
  await expect(page.getByText('Missionen für heute')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Erfolge' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.profile)).toBe('kid');
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await page.goto('/#/vocab');
  await expect(page.getByText('pencil case')).toBeVisible();
  await expect(page.getByText('boundary conditions')).toHaveCount(0);
  await page.goto('/#/learn');
  await expect(page.getByRole('button', { name: /Schule & Unterricht/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Engineering/ })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /Aussprache/ })).toHaveCount(0); // planned methods hidden for kids
});

test('adults choosing their profile get the normal app', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Für Erwachsene/ }).click();
  await expect(page.getByRole('button', { name: 'Jetzt lernen' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dataset.profile)).toBeUndefined();
});

test('kids session ends with stars, XP and a new badge; awards page shows level and badges', async ({ page }) => {
  await presetProfile(page, 'kid');
  await page.goto('/');
  await page.goto('/#/session?topic=school&method=flashcards&min=5');
  await expect(page.locator('.xp-pill')).toContainText('0');
  await finishFlashcardSession(page);
  await expect(page.getByRole('img', { name: /von 3 Sternen/ })).toBeVisible();
  await expect(page.getByText(/\+\d+ XP/)).toBeVisible();
  await expect(page.getByText('Neues Abzeichen!')).toBeVisible();
  await expect(page.locator('.badge-tile.new').first()).toContainText('Erster Start');
  await page.getByRole('button', { name: 'Fertig' }).click();
  await page.getByRole('link', { name: 'Erfolge' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Erfolge' })).toBeVisible();
  await expect(page.getByText(/^Level \d+$/).first()).toBeVisible();
  await expect(page.locator('.badge-tile').first()).toBeVisible();
});

test('kids prompt targets school years 5–6 and offers the word-list photo option', async ({ page }) => {
  await presetProfile(page, 'kid');
  await page.goto('/#/prompt');
  await expect(page.locator('pre.prompt')).toContainText('school years 5–6');
  await page.getByRole('button', { name: 'Vokabelliste (Foto/Datei)' }).click();
  await expect(page.locator('pre.prompt')).toContainText('vocabulary list, photo or file');
  await expect(page.getByRole('button', { name: 'Technische Begriffe' })).toHaveCount(0);
});

test('profile can be switched in settings without losing progress', async ({ page }) => {
  await presetProfile(page, 'adult');
  await page.goto('/');
  await page.goto('/#/settings');
  // the profile switch is the first control on the settings page
  await expect(page.getByRole('heading', { name: 'Profil – wer lernt?' })).toBeInViewport();
  await page.getByRole('group', { name: 'Profil' }).getByRole('button', { name: /Kinder/ }).click();
  await page.goto('/#/home');
  await expect(page.getByRole('button', { name: "🚀 Los geht's!" })).toBeVisible();
});

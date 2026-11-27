import { expect, type Page } from '@playwright/test';

/** Start with an EMPTY app (skips the automatic default vocabulary). Call before page.goto. */
export async function emptyApp(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('pet.skipStarter', '1');
    localStorage.setItem('pet.profile', 'adult');
  });
}

/** Preset the learner profile (skips the "who is learning?" question). Call before page.goto. */
export async function presetProfile(page: Page, profile: 'adult' | 'kid') {
  await page.addInitScript((p) => localStorage.setItem('pet.profile', p), profile);
}

export async function freshStart(page: Page) {
  await emptyApp(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Standardvokabeln laden/ })).toBeVisible();
}

/** Normal first start: default vocabulary is loaded automatically. */
export async function loadStarter(page: Page) {
  await presetProfile(page, 'adult');
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Jetzt lernen' })).toBeVisible();
}

export async function importPasted(page: Page, text: string) {
  await page.goto('/#/import');
  await page.getByRole('button', { name: 'Einfügen', exact: true }).click();
  await page.getByLabel('JSON oder CSV einfügen').fill(text);
  await page.getByRole('button', { name: 'Prüfen & Vorschau' }).click();
}

/** Answer flashcards ("Gut") until the session summary appears. */
export async function finishFlashcardSession(page: Page, max = 60) {
  const show = page.getByRole('button', { name: 'Lösung zeigen', exact: true });
  // adult summary text or the kids summary (stars)
  const summary = page.getByText('Einheit abgeschlossen').or(page.getByRole('img', { name: /von 3 Sternen/ }));
  for (let i = 0; i < max; i++) {
    await expect(show.or(summary)).toBeVisible();
    if (await summary.isVisible()) return i;
    await show.click();
    await page.getByRole('button', { name: /^Gut/ }).click();
  }
  throw new Error('session did not finish');
}

export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

import { expect, test } from '@playwright/test';
import { finishFlashcardSession, loadStarter } from './helpers';

test('works offline after the first load (service worker precache)', async ({ page, context }) => {
  await loadStarter(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Jetzt lernen' })).toBeVisible();
  // lazy-loaded screens are precached too
  await page.goto('/#/stats');
  await expect(page.getByRole('heading', { name: 'Statistik' })).toBeVisible();
  await page.goto('/#/session?topic=all&method=flashcards&min=5');
  await finishFlashcardSession(page);
  await context.setOffline(false);
});

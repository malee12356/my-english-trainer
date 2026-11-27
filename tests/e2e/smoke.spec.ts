import { expect, test } from '@playwright/test';
import { freshStart, horizontalOverflow, loadStarter } from './helpers';

test('default vocabulary is loaded automatically on first start', async ({ page }) => {
  await loadStarter(page);
  await page.goto('/#/vocab');
  await expect(page.getByText(/1[5-9]\d Einträge/)).toBeVisible();
  await page.reload();
  await page.goto('/#/vocab');
  await expect(page.getByText(/1[5-9]\d Einträge/)).toBeVisible();
});

test('first start, navigation and no horizontal scrolling', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await freshStart(page);
  await page.getByRole('button', { name: /Standardvokabeln laden/ }).click();
  await expect(page.getByRole('button', { name: 'Jetzt lernen' })).toBeVisible();
  for (const [tab, heading] of [['Lernen', 'Lernen'], ['Vokabeln', 'Vokabeln'], ['Statistik', 'Statistik'], ['Einstellungen', 'Einstellungen'], ['Home', null]] as const) {
    await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: tab }).click();
    if (heading) await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test('manifest and icons are served', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.display).toBe('standalone');
  expect(m.icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of m.icons) expect((await request.get(`/${icon.src}`)).ok()).toBe(true);
  expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
  expect((await request.get('/examples/sample-import.json')).ok()).toBe(true);
});

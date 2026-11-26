import { expect, test } from '@playwright/test';
import { horizontalOverflow, loadStarter } from './helpers';

test('follows the system colour scheme and can be overridden', async ({ page }) => {
  await loadStarter(page);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const dark = test.info().project.name.includes('dark');
  expect(await bg()).toBe(dark ? 'rgb(0, 0, 0)' : 'rgb(242, 242, 247)');
  await page.goto('/#/settings');
  await page.getByRole('group', { name: 'Design' }).getByRole('button', { name: dark ? 'Hell' : 'Dunkel' }).click();
  await expect.poll(bg).toBe(dark ? 'rgb(242, 242, 247)' : 'rgb(0, 0, 0)');
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test('touch targets of navigation and rating buttons are at least 44 px', async ({ page }) => {
  await loadStarter(page);
  for (const link of await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link').all()) {
    const b = (await link.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Jetzt lernen' }).click();
  await page.getByRole('button', { name: 'Lösung zeigen', exact: true }).tap();
  for (const g of ['Nicht gewusst', 'Schwer', 'Gut', 'Einfach']) {
    const b = (await page.getByRole('button', { name: new RegExp(`^${g}`) }).boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
});

test('english UI can be selected', async ({ page }) => {
  await loadStarter(page);
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.goto('/#/home');
  await expect(page.getByRole('button', { name: 'Start learning' })).toBeVisible();
});

test('without speech synthesis, listening is disabled and no speaker buttons appear', async ({ page }) => {
  await page.addInitScript(() => {
    // simulate a device without the Web Speech API
    delete (window as unknown as Record<string, unknown>).speechSynthesis;
    delete (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
  });
  await loadStarter(page);
  await page.goto('/#/learn');
  await expect(page.getByRole('radio', { name: /Listening/ })).toBeDisabled();
  await expect(page.getByText('Keine Sprachausgabe auf diesem Gerät')).toBeVisible();
  await page.goto('/#/vocab');
  expect(await page.getByRole('button', { name: 'Vorlesen' }).count()).toBe(0);
});

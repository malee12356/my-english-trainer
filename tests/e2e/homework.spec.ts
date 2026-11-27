import { expect, test } from '@playwright/test';
import { importPasted } from './helpers';

const BOOK = [
  { english: 'pencil', german: 'Bleistift', unit: 'Unit 1', page: 196 },
  { english: 'ruler', german: 'Lineal', page: 197 },
  { english: 'rubber', german: 'Radiergummi', page: 198 },
  { english: 'dog', german: 'Hund', unit: 'Unit 2', page: 199 },
  { english: 'cat', german: 'Katze', page: 200 },
];
const DE_EN: Record<string, string> = Object.fromEntries(BOOK.map((b) => [b.german, b.english]));

test('import a school book list with units/pages and practise one unit as homework', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pet.skipStarter', '1');
    localStorage.setItem('pet.profile', 'kid');
  });
  await page.goto('/');
  await importPasted(page, JSON.stringify(BOOK));
  await expect(page.getByText('5 neu')).toBeVisible();
  await page.getByRole('button', { name: 'Import bestätigen (5)' }).click();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  // page 197/198 had no heading → Unit 1
  await page.getByRole('searchbox', { name: 'Suchen' }).fill('ruler');
  await expect(page.locator('.list-item').first()).toContainText('Unit 1');
  await expect(page.locator('.list-item').first()).toContainText('S. 197');

  await page.goto('/#/home');
  await page.getByRole('button', { name: /Hausaufgabe üben/ }).click();
  await page.getByRole('button', { name: /^Unit 1/ }).click();
  await expect(page.locator('.banner[role=status]')).toContainText('Unit 1: 3 Wörter');
  // page range instead of unit
  await page.getByLabel('von Seite').fill('198');
  await page.getByLabel('bis Seite').fill('200');
  await expect(page.locator('.banner[role=status]')).toContainText('S. 198–200: 3 Wörter');
  await page.getByRole('button', { name: /^Unit 1/ }).click();
  await page.getByRole('button', { name: /Alle Wörter schreiben/ }).click();

  const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    await expect(page.getByText(`${i + 1}/3`)).toBeVisible();
    await expect(page.getByLabel('Englische Antwort')).toBeVisible();
    let shown = '';
    for (const g of Object.keys(DE_EN)) if (await page.getByText(g, { exact: true }).isVisible()) shown = g;
    expect(['Bleistift', 'Lineal', 'Radiergummi']).toContain(shown);
    seen.push(shown);
    await page.getByLabel('Englische Antwort').fill(DE_EN[shown]);
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
  }
  expect(seen.sort()).toEqual(['Bleistift', 'Lineal', 'Radiergummi']);
  await expect(page.getByRole('img', { name: /von 3 Sternen/ })).toBeVisible();
});

test('without units/pages the homework screen explains how to get them', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pet.profile', 'kid'));
  await page.goto('/#/homework');
  await expect(page.getByText('Noch keine Units oder Seiten gespeichert')).toBeVisible();
  await expect(page.getByRole('link', { name: /Zum ChatGPT-Prompt/ })).toBeVisible();
});

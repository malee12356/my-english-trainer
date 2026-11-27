import { expect, test } from '@playwright/test';
import { importPasted } from './helpers';

const WORDS: Record<string, string> = { Hund: 'dog', Katze: 'cat', Pferd: 'horse' };

test('screen-time challenge: write the English word, earn minutes, share via WhatsApp', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pet.skipStarter', '1');
    localStorage.setItem('pet.profile', 'kid');
    const w = window as unknown as { __shared: unknown[] };
    w.__shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: ShareData) => { w.__shared.push({ text: d.text, files: (d.files ?? []).map((f) => f.name) }); } });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  });
  await page.goto('/');
  await importPasted(page, JSON.stringify(Object.entries(WORDS).map(([german, english]) => ({ english, german, category: 'Family & Animals' }))));
  await page.getByRole('button', { name: 'Import bestätigen (3)' }).click();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();

  await page.goto('/#/home');
  await page.getByRole('button', { name: /Spielzeit verdienen/ }).click();
  await expect(page.getByText(/Übe 3 Wörter/)).toBeVisible();
  await page.getByRole('button', { name: /Mit Schreiben starten/ }).click();

  for (let i = 0; i < 3; i++) {
    await expect(page.getByText(`${i + 1}/3`)).toBeVisible();
    let shown = '';
    for (const g of Object.keys(WORDS)) if (await page.getByText(g, { exact: true }).isVisible()) shown = g;
    expect(shown).not.toBe('');
    // strict mode: no hint and no "I was right" button
    await expect(page.getByRole('button', { name: 'Hinweis zeigen' })).toHaveCount(0);
    const answer = shown === 'Pferd' ? 'hors' : WORDS[shown]; // one small typo → no minute
    await page.getByLabel('Englische Antwort').fill(answer);
    await page.getByRole('button', { name: 'Prüfen' }).click();
    await expect(page.getByRole('button', { name: 'War doch richtig' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Weiter' }).click();
  }

  await expect(page.getByLabel('Ergebnis')).toContainText('🎮 2 min');
  await expect(page.getByText('2 von 3 Wörtern richtig')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Diese Wörter üben wir noch' })).toContainText('horse');
  const wa = page.getByRole('link', { name: /Per WhatsApp senden/ });
  expect(await wa.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=.*Verdiente%20Spielzeit%3A%202%20Minuten/);

  await page.getByRole('button', { name: /Fortschritt teilen/ }).click();
  await expect(page.getByText('Geteilt ✓')).toBeVisible();
  const shared = await page.evaluate(() => (window as unknown as { __shared: { text: string; files: string[] }[] }).__shared);
  expect(shared[0].text).toContain('2 von 3 Wörtern richtig geschrieben');
  expect(shared[0].files).toEqual(['english-challenge.png']);

  await page.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.getByText('Heute schon 2 Minuten verdient')).toBeVisible();
});

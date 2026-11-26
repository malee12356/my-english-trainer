import { expect, test, type Page } from '@playwright/test';
import { importPasted } from './helpers';

/**
 * Speech recognition is simulated: the fake engine returns the next queued
 * transcript (or error) from window.__speech. Real recognition must be
 * verified on the iPhone (TEST_PLAN.md, section I).
 */
async function fakeRecognition(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __speech: { transcripts: string[]; errors: string[] }; webkitSpeechRecognition: unknown; SpeechRecognition: unknown; __started: number };
    w.__speech = { transcripts: [], errors: [] };
    w.__started = 0;
    w.SpeechRecognition = w.webkitSpeechRecognition = class {
      lang = '';
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      start() {
        w.__started++;
        setTimeout(() => {
          this.onstart?.();
          const err = w.__speech.errors.shift();
          if (err) this.onerror?.({ error: err });
          else this.onresult?.({ results: [Object.assign([{ transcript: w.__speech.transcripts.shift() ?? '', confidence: 0.9 }], { isFinal: true })] });
          this.onend?.();
        }, 80);
      }
      stop() {}
      abort() {}
    };
  });
}
const queue = (page: Page, kind: 'transcripts' | 'errors', v: string) =>
  page.evaluate(([k, x]) => (window as unknown as { __speech: Record<string, string[]> }).__speech[k].push(x), [kind, v] as const);

async function setup(page: Page) {
  await fakeRecognition(page);
  await page.goto('/');
  await importPasted(page, JSON.stringify([{ english: "I'm not entirely sure about that.", german: 'Da bin ich mir nicht ganz sicher.', category: 'Speak Test' }]));
  await page.getByRole('button', { name: 'Import bestätigen (1)' }).click();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await page.goto('/#/session?topic=c-speak-test&method=speaking&min=5');
  await expect(page.getByText('Da bin ich mir nicht ganz sicher.')).toBeVisible();
}

test('asks for consent before the first recognition, then evaluates the transcript', async ({ page }) => {
  await setup(page);
  await queue(page, 'transcripts', 'I am not entirely sure about that');
  await page.getByRole('button', { name: 'Sprechen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Spracherkennung erlauben?' })).toContainText('Apple');
  expect(await page.evaluate(() => (window as unknown as { __started: number }).__started)).toBe(0); // no mic before consent
  await page.getByRole('button', { name: 'Zustimmen' }).click();
  await page.getByRole('button', { name: 'Sprechen', exact: true }).click();
  await expect(page.getByText('Richtig erkannt!')).toBeVisible();
  await expect(page.getByText('keine Bewertung deiner Aussprache')).toBeVisible();
  await expect(page.getByText(/%/)).toHaveCount(0); // no invented scores
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Einheit abgeschlossen')).toBeVisible();
  await page.goto('/#/stats');
  await expect(page.getByText('richtig erkannt')).toBeVisible();
});

test('wrong answer allows another attempt; the solution stays hidden until then', async ({ page }) => {
  await setup(page);
  await page.goto('/#/settings');
  await page.getByRole('switch', { name: 'Zustimmung Spracherkennung' }).click({ force: true });
  await expect(page.getByRole('switch', { name: 'Zustimmung Spracherkennung' })).toBeChecked();
  await page.goto('/#/session?topic=c-speak-test&method=speaking&min=5');
  await queue(page, 'transcripts', 'I am sure');
  await queue(page, 'transcripts', "I'm not entirely sure about that");
  await page.getByRole('button', { name: 'Sprechen', exact: true }).click();
  await expect(page.getByText('Nicht ganz')).toBeVisible();
  await expect(page.getByText('Versuch 2 von 3')).toBeVisible();
  await expect(page.getByText("I'm not entirely sure about that.", { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nochmal sprechen' }).click();
  await expect(page.getByText('Richtig erkannt!')).toBeVisible();
  await expect(page.getByText("I'm not entirely sure about that.", { exact: true })).toBeVisible();
});

test('declining consent or recognition errors fall back to typing', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Sprechen', exact: true }).click();
  await page.getByRole('button', { name: /Ablehnen/ }).click();
  await expect(page.getByLabel('Englische Antwort')).toBeVisible();

  // with consent, a permission error offers the same fallback
  await page.goto('/#/settings');
  await page.getByRole('switch', { name: 'Zustimmung Spracherkennung' }).click({ force: true });
  await expect(page.getByRole('switch', { name: 'Zustimmung Spracherkennung' })).toBeChecked();
  await page.goto('/#/session?topic=c-speak-test&method=speaking&min=5');
  await queue(page, 'errors', 'not-allowed');
  await page.getByRole('button', { name: 'Sprechen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Kein Zugriff auf Mikrofon');
  await page.getByRole('button', { name: 'Stattdessen schreiben' }).click();
  await page.getByLabel('Englische Antwort').fill("I'm not entirely sure about that");
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Richtig!')).toBeVisible();
});

test('speaking is disabled without recognition API or when offline', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Starter-Inhalte laden/ }).click();
  await page.goto('/#/learn');
  // Chromium in tests has no recognition API
  const hasApi = await page.evaluate(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  if (!hasApi) {
    await expect(page.getByRole('radio', { name: /^Speaking/ })).toBeDisabled();
    await expect(page.getByText('Keine Spracherkennung auf diesem Gerät/Browser')).toBeVisible();
  }
  const p2 = await context.newPage();
  await fakeRecognition(p2);
  await p2.goto('/#/learn');
  await expect(p2.getByRole('radio', { name: /^Speaking/ })).toBeEnabled();
  await context.setOffline(true);
  await expect(p2.getByText('Benötigt eine Internetverbindung')).toBeVisible();
  await expect(p2.getByRole('radio', { name: /^Speaking/ })).toBeDisabled();
  await context.setOffline(false);
});

test('keyboard dictation works as a reliable alternative to the microphone button', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Mit iPhone-Diktierfunktion antworten' }).click();
  await page.getByLabel('Diktierte Antwort').fill('I am not entirely sure about that');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Richtig erkannt!')).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Einheit abgeschlossen')).toBeVisible();
});

test('a recogniser that never starts shows the dictation alternative', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    // engine that accepts start() but never fires any event (seen in installed iOS web apps)
    w.SpeechRecognition = w.webkitSpeechRecognition = class { start() {} stop() {} abort() {} };
  });
  await page.goto('/');
  await importPasted(page, JSON.stringify([{ english: 'mesh', german: 'Netz', category: 'Speak Test' }]));
  await page.getByRole('button', { name: 'Import bestätigen (1)' }).click();
  await expect(page.getByRole('heading', { name: 'Vokabeln' })).toBeVisible();
  await page.goto('/#/speech-test');
  await page.getByRole('button', { name: 'Zustimmen' }).click();
  await expect(page.locator('pre.prompt')).toContainText('API: SpeechRecognition');
  await page.goto('/#/session?topic=c-speak-test&method=speaking&min=5');
  await page.getByRole('button', { name: 'Sprechen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Diktierfunktion', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Mit iPhone-Diktierfunktion antworten' }).click();
  await page.getByLabel('Diktierte Antwort').fill('mesh');
  await page.getByRole('button', { name: 'Prüfen' }).click();
  await expect(page.getByText('Richtig erkannt!')).toBeVisible();
});

test('speech test screen logs engine events', async ({ page }) => {
  await fakeRecognition(page);
  await page.goto('/#/speech-test');
  await page.getByRole('button', { name: 'Zustimmen' }).click();
  await queue(page, 'transcripts', 'could you clarify this point');
  await page.getByRole('button', { name: 'Test starten' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Erkannt' })).toContainText('could you clarify this point');
  await expect(page.locator('pre.prompt')).toContainText('result-final');
  await expect(page.locator('pre.prompt')).toContainText('start-called');
});

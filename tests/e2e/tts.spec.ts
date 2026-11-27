import { expect, test, type Page } from '@playwright/test';
import { loadStarter, presetProfile } from './helpers';

/** Replaces speechSynthesis with a recorder; window.__ttsMode controls the outcome. */
async function fakeTts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & { __tts: { lang: string; voice: unknown; text: string }[]; __ttsMode: string };
    w.__tts = [];
    w.__ttsMode = 'ok';
    const synth = {
      speaking: false, pending: false, paused: false,
      getVoices: () => [{ name: 'Daniel', lang: 'en-GB', voiceURI: 'daniel', localService: true, default: true }],
      addEventListener: () => undefined,
      cancel: () => undefined,
      resume: () => undefined,
      speak(u: { lang: string; voice: unknown; text: string; onstart?: () => void; onend?: () => void; onerror?: (e: unknown) => void }) {
        w.__tts.push({ lang: u.lang, voice: u.voice, text: u.text });
        setTimeout(() => {
          if (w.__ttsMode === 'error') u.onerror?.({ error: 'synthesis-failed' });
          else { u.onstart?.(); u.onend?.(); }
        }, 20);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  });
}

test('speaker button uses the system voice for the chosen accent', async ({ page }) => {
  await fakeTts(page);
  await loadStarter(page);
  await page.goto('/#/vocab');
  await page.getByRole('button', { name: 'Vorlesen' }).first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tts: unknown[] }).__tts.length)).toBe(1);
  const call = await page.evaluate(() => (window as unknown as { __tts: { lang: string; voice: unknown }[] }).__tts[0]);
  expect(call.lang).toBe('en-GB');
  expect(call.voice).toBeNull();
});

test('a failing speech output is reported instead of staying silent', async ({ page }) => {
  await fakeTts(page);
  await loadStarter(page);
  await page.evaluate(() => ((window as unknown as { __ttsMode: string }).__ttsMode = 'error'));
  await page.goto('/#/vocab');
  await page.getByRole('button', { name: 'Vorlesen' }).first().click();
  await expect(page.getByText(/Vorlesen fehlgeschlagen \(synthesis-failed\)/)).toBeVisible();
});

test('speech test screen can test the speech output', async ({ page }) => {
  await fakeTts(page);
  await presetProfile(page, 'adult');
  await page.goto('/#/speech-test');
  await page.getByRole('button', { name: 'Vorlesen testen' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Vorlesen gestartet und beendet' })).toBeVisible();
  await expect(page.locator('pre.prompt')).toContainText('tts speak-called: en-GB · system voice');
});

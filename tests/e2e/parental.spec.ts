import { expect, test, type Page } from '@playwright/test';
import { presetProfile } from './helpers';

async function createSetupMessage(page: Page, pin: string, minutes = '1') {
  await page.goto('/#/settings');
  await page.getByRole('button', { name: /Schüler-App für mein Kind einrichten/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Schüler-App einrichten' });
  await sheet.getByRole('button', { name: 'Klasse 7–8' }).click();
  await sheet.getByLabel('Minuten pro richtigem Wort').selectOption(minutes);
  await sheet.getByLabel('Eltern-PIN (4–8 Ziffern)').fill(pin);
  await sheet.getByLabel('PIN wiederholen').fill(pin);
  await sheet.getByRole('button', { name: 'Einrichtungs-Nachricht erzeugen' }).click();
  const msg = await sheet.getByLabel('Einrichtungs-Nachricht').innerText();
  expect(msg).toContain('PET1-');
  expect(msg).not.toContain(pin);
  await expect(sheet.getByRole('link', { name: /Per WhatsApp senden/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  return msg;
}

async function pasteCode(page: Page, msg: string) {
  const sheet = page.getByRole('dialog', { name: 'Einrichtungscode einfügen' });
  await sheet.getByLabel('Nachricht mit Einrichtungscode').fill(msg);
  await expect(sheet.getByText(/Schüler · Klasse 7–8/)).toBeVisible();
  return sheet;
}

test('parent creates a setup message; the pupil app applies it and is locked', async ({ page, browser }) => {
  // parent's phone
  await presetProfile(page, 'adult');
  await page.goto('/');
  const msg = await createSetupMessage(page, '2468', '2');

  // pupil's phone: first start → paste setup code
  const kidCtx = await browser.newContext();
  const kid = await kidCtx.newPage();
  await kid.goto('/');
  await kid.getByRole('button', { name: /Einrichtungscode von den Eltern einfügen/ }).click();
  const sheet = await pasteCode(kid, msg);
  await sheet.getByRole('button', { name: 'Einrichtung übernehmen' }).click();
  await expect(kid.getByRole('button', { name: "🚀 Los geht's!" })).toBeVisible();
  await kid.getByRole('button', { name: /Spielzeit verdienen/ }).click();
  await expect(kid.getByText(/2 Minuten Spielzeit/)).toBeVisible();

  // settings are locked: no profile switch, no pack removal, no restore
  await kid.goto('/#/settings');
  await expect(kid.getByText('Von den Eltern eingestellt')).toBeVisible();
  await expect(kid.getByRole('group', { name: 'Profil' })).toHaveCount(0);
  await expect(kid.getByRole('button', { name: /Standardvokabeln entfernen/ })).toHaveCount(0);
  await kid.goto('/#/backup');
  await expect(kid.getByText('Wiederherstellen ist durch die Eltern-PIN geschützt.')).toBeVisible();

  // wrong PIN, then the right one unlocks
  await kid.goto('/#/settings');
  await kid.getByRole('button', { name: /Elternbereich entsperren/ }).click();
  const unlock = kid.getByRole('dialog', { name: 'Elternbereich entsperren' });
  await unlock.getByLabel('Eltern-PIN').fill('1111');
  await unlock.getByRole('button', { name: 'Entsperren' }).click();
  await expect(unlock.getByRole('alert')).toHaveText('Falsche PIN.');
  await unlock.getByLabel('Eltern-PIN').fill('2468');
  await unlock.getByRole('button', { name: 'Entsperren' }).click();
  await expect(kid.getByRole('group', { name: 'Profil' })).toBeVisible();
  await kid.getByRole('button', { name: 'Jetzt sperren' }).click();
  await expect(kid.getByRole('group', { name: 'Profil' })).toHaveCount(0);
  await kidCtx.close();
});

test('new rules with the same PIN are accepted without PIN; a different PIN needs the old one', async ({ page, browser }) => {
  await presetProfile(page, 'adult');
  await page.goto('/');
  const first = await createSetupMessage(page, '2468', '1');
  const samePin = await createSetupMessage(page, '2468', '2');
  const otherPin = await createSetupMessage(page, '9999', '0.5');

  const kidCtx = await browser.newContext();
  const kid = await kidCtx.newPage();
  await kid.goto('/');
  await kid.getByRole('button', { name: /Einrichtungscode von den Eltern einfügen/ }).click();
  await (await pasteCode(kid, first)).getByRole('button', { name: 'Einrichtung übernehmen' }).click();
  await expect(kid.getByRole('button', { name: "🚀 Los geht's!" })).toBeVisible();

  await kid.goto('/#/settings');
  await kid.getByRole('button', { name: /Einrichtungscode einfügen/ }).click();
  await (await pasteCode(kid, samePin)).getByRole('button', { name: 'Einrichtung übernehmen' }).click();
  await expect(kid.getByText(/2 Min\. pro Wort/)).toBeVisible();

  await kid.goto('/#/settings');
  await kid.getByRole('button', { name: /Einrichtungscode einfügen/ }).click();
  const s = await pasteCode(kid, otherPin);
  await expect(s.getByText(/andere PIN/)).toBeVisible();
  await s.getByRole('button', { name: 'Mit bisheriger PIN entsperren' }).click();
  const unlock = kid.getByRole('dialog', { name: 'Elternbereich entsperren' });
  await unlock.getByLabel('Eltern-PIN').fill('2468');
  await unlock.getByRole('button', { name: 'Entsperren' }).click();
  await expect(kid.getByText('Einrichtung übernommen 🎉')).toBeVisible();
  await kid.goto('/#/settings');
  await expect(kid.getByLabel('Minuten pro richtigem Wort')).toHaveValue('0.5');
  await kidCtx.close();
});

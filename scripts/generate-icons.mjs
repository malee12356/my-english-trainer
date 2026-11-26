// Renders public/icons/favicon.svg into the PNG sizes required by iOS / the manifest.
// Usage: npm run icons   (uses the locally installed Playwright Chromium)
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('../public/icons/favicon.svg', import.meta.url), 'utf8');
const targets = [
  { file: 'apple-touch-icon.png', size: 180, pad: 0, bg: '#4f46e5', square: true }, // iOS applies its own mask
  { file: 'icon-192.png', size: 192, pad: 0, bg: null },
  { file: 'icon-512.png', size: 512, pad: 0, bg: null },
  // maskable: full-bleed background, content inside the 80% safe zone
  { file: 'icon-maskable-512.png', size: 512, pad: 0.1, bg: '#4f46e5' },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - 2 * t.pad));
  const svgSized = t.pad || t.square ? svg.replace('rx="112"', 'rx="0"') : svg;
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:${t.bg ?? 'transparent'};display:grid;place-items:center;width:${t.size}px;height:${t.size}px"><div style="width:${inner}px;height:${inner}px">${svgSized.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  const buf = await page.screenshot({ omitBackground: !t.bg, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  writeFileSync(new URL(`../public/icons/${t.file}`, import.meta.url), buf);
  console.log('wrote', t.file);
}
await browser.close();

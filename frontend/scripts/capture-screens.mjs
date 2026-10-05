// Captures de l'application réelle pour la vitrine. Le script démarre Vite sur
// le code de src/, répond à chaque appel /api/* avec les données d'exemple de
// capture-data.mjs, et photographie les écrans dans le Chrome du poste. Seules
// les polices Google de l'application sont téléchargées : toute autre requête
// sortante, API comprise, est bloquée.
//
// Lancement : npm run captures (les variantes AVIF et WebP sont tirées ensuite
// par optimize-images.mjs). À relancer quand l'interface change.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { respond } from './capture-data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(here, '.captures');
const PORT = 5199;

const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((path) => path && existsSync(path));
if (!executablePath) throw new Error('Chrome introuvable : indiquez son chemin dans CHROME_PATH.');

const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const SCREENS = [
  { name: 'dashboard', tab: null },
  { name: 'patients', tab: 'Patients' },
  { name: 'patient-detail', tab: 'Patients', then: (page) => page.locator('[title="Consulter le dossier"]:visible').first().click() },
  { name: 'laboratory', tab: 'Laboratoire' },
  { name: 'pharmacy', tab: 'Pharmacie' },
  { name: 'accounting', tab: 'Comptabilité', then: (page) => page.getByText('Grand Livre & Journal des Recettes').first().click() },
];

await mkdir(outDir, { recursive: true });
const vite = await createServer({ root, logLevel: 'error', server: { port: PORT, strictPort: true } });
await vite.listen();
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];

const openApp = async (device) => {
  const context = await browser.newContext({ ...DEVICES[device], locale: 'fr-FR', timezoneId: 'Africa/Abidjan', colorScheme: 'light', reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('mediclinic_token', 'jeton-de-capture');
    localStorage.setItem('theme', 'light');
    window.print = () => {};
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/api/')) {
      const body = route.request().method() === 'GET' ? respond(url.pathname, url.searchParams) : { success: true };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (url.hostname === 'localhost' || FONT_HOSTS.test(url.href)) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${device} : ${error.message}`));
  page.setDefaultTimeout(10000);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { context, page };
};

const openTab = async (page, device, tab) => {
  if (!tab) return;
  if (device === 'mobile') {
    await page.getByRole('button', { name: 'Menu principal' }).click();
    await page.waitForTimeout(400);
  }
  await page.getByRole('button', { name: tab, exact: true }).first().click();
  await page.waitForTimeout(1200);
};

for (const device of Object.keys(DEVICES)) {
  for (const screen of SCREENS) {
    const { context, page } = await openApp(device);
    await openTab(page, device, screen.tab);
    if (screen.then) {
      await screen.then(page);
      await page.waitForTimeout(1200);
    }
    await page.mouse.move(0, 0);
    const file = join(outDir, `${screen.name}${device === 'mobile' ? '-mobile' : ''}.png`);
    await page.screenshot({ path: file });
    console.log(file);
    await context.close();
  }
}

// Le reçu réimprimé depuis le grand livre, dans sa propre fenêtre d'impression.
{
  const { context, page } = await openApp('desktop');
  await openTab(page, 'desktop', 'Comptabilité');
  await page.getByText('Grand Livre & Journal des Recettes').first().click();
  await page.waitForTimeout(900);
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: /Reçu/ }).first().click()]);
  await popup.waitForLoadState('load');
  await popup.setViewportSize({ width: 820, height: 1100 });
  await popup.waitForTimeout(500);
  await popup.screenshot({ path: join(outDir, 'receipt.png') });
  console.log(join(outDir, 'receipt.png'));
  await context.close();
}

// Image de partage 1200 × 630 : logo, titre du héros et capture réelle.
{
  const dataUrl = async (file, type) => `data:${type};base64,${(await readFile(file)).toString('base64')}`;
  const font = await dataUrl(join(root, 'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'), 'font/woff2');
  const logo = await dataUrl(join(root, 'public/logo-horizontal.svg'), 'image/svg+xml');
  const shot = await dataUrl(join(outDir, 'dashboard.png'), 'image/png');
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    @font-face { font-family: Geist; src: url(${font}) format('woff2'); font-weight: 100 900; }
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; overflow: hidden; position: relative; background: #f5f7f6; color: #0f1a17; font-family: Geist, sans-serif; }
    .copy { position: absolute; left: 72px; top: 80px; width: 480px; }
    .copy img { height: 34px; width: auto; }
    h1 { margin-top: 58px; font-size: 56px; line-height: 1.03; letter-spacing: -0.042em; font-weight: 600; }
    p { margin-top: 26px; font-size: 22px; color: #3a4743; }
    .shot { position: absolute; left: 610px; top: 92px; width: 780px; border-radius: 14px; overflow: hidden; border: 1px solid #ccd6d1; background: #fff; box-shadow: 0 40px 80px -30px rgba(20, 62, 50, 0.35); }
    .bar { height: 30px; background: #eef2f0; border-bottom: 1px solid #e0e6e3; }
    .shot img { display: block; width: 100%; }
  </style></head><body>
    <div class="copy"><img src="${logo}" alt=""><h1>Toute votre clinique, de l'accueil à la caisse.</h1><p>Logiciel de gestion de clinique pour la Côte d'Ivoire.</p></div>
    <div class="shot"><div class="bar"></div><img src="${shot}" alt=""></div>
  </body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(outDir, 'og-image.png') });
  console.log(join(outDir, 'og-image.png'));
  await context.close();
}

await browser.close();
await vite.close();
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) JavaScript pendant les captures :\n${errors.join('\n')}`);
  process.exit(1);
}

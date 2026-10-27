/* global process, localStorage, console */
/**
 * Capturas de la página de presentación, sacadas de la app real con la silla de la plantilla.
 * Con la app compilada y servida (`npm run build -w apps/web` y `npx vite preview --port 4173` en apps/web), correr:
 *   NODE_PATH=$(npm root -g) node apps/web/scripts/capturas-inicio.mjs [http://localhost:4173/]
 * Deja cada captura en apps/web/public/inicio/<idioma>/<nombre>.jpg, en español y en inglés.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

for (const lang of ['es', 'en']) {
  const out = resolve(import.meta.dirname, `../public/inicio/${lang}`);
  mkdirSync(out, { recursive: true });
  const shot = (page, name, clip) => page.screenshot({ path: resolve(out, `${name}.jpg`), type: 'jpeg', quality: 82, clip });
  const init = (l) => {
    localStorage.setItem('kit-idioma', l);
    localStorage.setItem('kitc:ayuda-elegir', '1');
  };

  // Compu: la silla en el Modelo, y sus uniones, cortes, plano y armado.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: lang === 'es' ? 'es-AR' : 'en-US' });
  await ctx.addInitScript(init, lang);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('Error en la página:', e.message));
  await page.goto(`${BASE}#/nuevo/silla`);
  await page.getByRole('button', { name: lang === 'es' ? /^Crear/ : /^Create/ }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(4500);
  await shot(page, 'modelo');
  const id = decodeURIComponent(page.url().match(/#\/proyecto\/([^/]+)/)[1]);
  for (const section of ['uniones', 'cortes', 'plano', 'armado']) {
    await page.goto(`${BASE}#/proyecto/${encodeURIComponent(id)}/${section}`);
    await page.waitForTimeout(section === 'plano' ? 6000 : 3500);
    await shot(page, section);
  }
  await ctx.close();

  // Celular: el modo taller, que acompaña paso a paso.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: lang === 'es' ? 'es-AR' : 'en-US' });
  await phone.addInitScript(init, lang);
  const cel = await phone.newPage();
  await cel.goto(`${BASE}#/nuevo/silla`);
  await cel.getByRole('button', { name: lang === 'es' ? /^Crear/ : /^Create/ }).click();
  await cel.waitForURL(/#\/proyecto\//);
  await cel.waitForTimeout(3000);
  await cel.goto(cel.url() + '/taller');
  await cel.waitForTimeout(3000);
  await shot(cel, 'taller');
  await phone.close();
}
await browser.close();

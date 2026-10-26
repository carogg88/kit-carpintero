/* global process, localStorage, console, document */
/**
 * Capturas del Centro de ayuda, sacadas de la app real. Con la app compilada y servida
 * (`npm run build -w apps/web` y `npx vite preview --port 4173` en apps/web), correr:
 *   node apps/web/scripts/capturas-ayuda.mjs [http://localhost:4173/]
 * Necesita Playwright con Chromium. Deja cada captura en apps/web/public/ayuda/<nombre>.jpg, en español.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// Playwright no es dependencia del proyecto: se usa el instalado (si es global, con NODE_PATH=$(npm root -g)).
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = resolve(import.meta.dirname, '../public/ayuda');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const desktop = { viewport: { width: 1440, height: 665 }, locale: 'es-AR' };
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'es-AR' };

async function open(options) {
  const ctx = await browser.newContext(options);
  await ctx.addInitScript(() => {
    localStorage.setItem('kit-idioma', 'es');
    // La ayuda de Elegir ya vista: no tapa el modelo.
    localStorage.setItem('kitc:ayuda-elegir', '1');
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('Error en la página:', e.message));
  return page;
}

const shot = (page, name) => page.screenshot({ path: resolve(OUT, `${name}.jpg`), type: 'jpeg', quality: 80 });

/** Marca una parte de la pantalla: un borde color madera y el resto un poco más oscuro. */
async function mark(page, selector) {
  await page.evaluate((sel) => {
    document.getElementById('marca-ayuda')?.remove();
    const el = document.querySelector(sel);
    if (!el) throw new Error(`No está ${sel}`);
    const r = el.getBoundingClientRect();
    const box = document.createElement('div');
    box.id = 'marca-ayuda';
    Object.assign(box.style, {
      position: 'fixed', zIndex: 9999, pointerEvents: 'none', left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px`,
      border: '3px solid #c98a4e', borderRadius: '14px', boxShadow: '0 0 0 9999px rgb(20 26 18 / 0.28)',
    });
    document.body.append(box);
  }, selector);
}
const unmark = (page) => page.evaluate(() => document.getElementById('marca-ayuda')?.remove());

async function createTable(page) {
  await page.goto(`${BASE}#/nuevo/mesa`);
  await page.getByRole('button', { name: 'Crear mesa' }).waitFor();
  await page.waitForTimeout(1500);
  return page;
}

// Compu: plantilla, editor por partes, unidades, inicio, menú del proyecto y foto.
{
  const page = await open(desktop);
  await createTable(page);
  await shot(page, 'plantilla');
  await page.getByRole('button', { name: 'Crear mesa' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3500);
  await shot(page, 'editor');
  for (const [name, sel] of [
    ['editor-barra', 'header'],
    ['editor-herramientas', '[data-tour="tools"]'],
    ['editor-vistas', '[data-tour="views"]'],
    ['editor-panel', '[data-tour="panel"]'],
    ['unidades', '[role="group"][aria-label="Unidades"]'],
  ]) {
    await mark(page, sel);
    await shot(page, name);
    await unmark(page);
  }
  // Un segundo proyecto, para que el inicio tenga lista.
  await page.goto(`${BASE}#/nuevo/banco`);
  await page.getByRole('button', { name: /^Crear/ }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.goto(`${BASE}#/`);
  await page.getByRole('heading', { name: '¿Qué mueble vas a hacer?' }).waitFor();
  await page.waitForTimeout(800);
  await shot(page, 'inicio');
  await page.getByRole('button', { name: /^Más opciones de/ }).first().click();
  await page.waitForTimeout(300);
  await mark(page, '[role="menu"]');
  await shot(page, 'guardar');
  await unmark(page);
  await page.goto(`${BASE}#/foto`);
  await page.waitForTimeout(1200);
  await shot(page, 'foto');
  await page.context().close();
}

// Celular: el editor con la mesa.
{
  const page = await open(phone);
  await createTable(page);
  await page.getByRole('button', { name: 'Crear mesa' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3500);
  await shot(page, 'editor-celular');
  await page.context().close();
}

await browser.close();
console.log(`Capturas en ${OUT}`);

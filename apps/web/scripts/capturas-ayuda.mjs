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

// Compu: cada herramienta del Modelo sobre la mesa, en la vista Frente (las patas delanteras quedan a los costados).
{
  const page = await open(desktop);
  const tool = (name) => page.locator('[data-tour="tools"]').getByRole('button', { name: new RegExp(`^${name}`) }).click();
  const view = (name) => page.locator('[data-tour="views"]').getByRole('button', { name, exact: true }).click();
  const drag = async (x1, y1, x2, y2) => {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x1 + ((x2 - x1) * i) / 10, y1 + ((y2 - y1) * i) / 10);
    await page.waitForTimeout(300);
    await page.mouse.up();
  };
  const undo = async (times = 1) => {
    for (let i = 0; i < times; i++) await page.keyboard.press('Control+z');
    await page.waitForTimeout(400);
  };
  const leftLeg = [140, 400];
  const rightLeg = [925, 400];
  await createTable(page);
  await page.getByRole('button', { name: 'Crear mesa' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3000);
  await view('Frente');
  await page.waitForTimeout(1200);
  // Guía al mover: el faldón delantero 6 cm más corto. Arrastrado hacia la pata, el cartel dice qué unión sale.
  const apron = [500, 232];
  await page.mouse.click(...apron);
  await page.waitForTimeout(600);
  const width = page.getByLabel('Ancho', { exact: true }).first();
  await width.fill('154');
  await width.press('Enter');
  // Que se vaya el aviso de abajo.
  await page.waitForTimeout(7500);
  await page.keyboard.down('Shift');
  await page.mouse.click(...rightLeg);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(800);
  await mark(page, '[aria-label^="Unir "]');
  await shot(page, 'mover-unir');
  await unmark(page);
  // Un toque en el fondo suelta las dos, para mover solo el faldón.
  await page.mouse.click(560, 400);
  await tool('Mover');
  await page.mouse.move(...apron);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(apron[0] + 2 * i, apron[1]);
  await page.waitForTimeout(600);
  await shot(page, 'mover-guia');
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await undo(2);
  await tool('Seleccionar');
  await page.mouse.click(...leftLeg);
  await page.waitForTimeout(800);
  await shot(page, 'elegir');
  await page.keyboard.down('Shift');
  await page.mouse.click(...rightLeg);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(800);
  await shot(page, 'elegir-varias');
  await page.mouse.click(...leftLeg);
  await tool('Empujar');
  await page.waitForTimeout(600);
  await shot(page, 'estirar');
  await tool('Mover');
  await drag(...leftLeg, leftLeg[0] + 60, leftLeg[1]);
  await page.waitForTimeout(1500);
  await shot(page, 'mover');
  await page.keyboard.press('Escape');
  await undo();
  // Dibujar: se toca el faldón (la vista se pone de frente) y se arrastra un rectángulo.
  await tool('Dibujar');
  await page.mouse.click(540, 235);
  await page.waitForTimeout(1500);
  await drag(470, 355, 610, 383);
  await page.waitForTimeout(800);
  await shot(page, 'dibujar');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await undo();
  // Perfil a mano en el mismo faldón: cuatro puntos y el último siguiendo al puntero, sobre el otro borde.
  await tool('Dibujar');
  await page.mouse.click(540, 235);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Perfil a mano' }).click();
  for (const [x, y] of [
    [129, 378],
    [330, 372],
    [530, 365],
    [730, 372],
  ]) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(250);
  }
  await page.mouse.move(937, 378);
  await page.waitForTimeout(600);
  await shot(page, 'perfil');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await tool('Seleccionar');
  await view('Frente');
  await page.waitForTimeout(1200);
  await page.mouse.click(...leftLeg);
  await tool('Biselar');
  await page.waitForTimeout(600);
  await shot(page, 'biselar');
  await tool('Agrandar');
  await drag(leftLeg[0], 330, leftLeg[0], 450);
  await page.waitForTimeout(1200);
  await page.getByText(/^Tramos \(/).scrollIntoViewIfNeeded();
  await shot(page, 'tramo');
  await undo();
  await tool('Tornear');
  await page.mouse.click(...leftLeg);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Pata de mesa' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('img', { name: 'Perfil del torneado' }).scrollIntoViewIfNeeded();
  await shot(page, 'tornear');
  await undo(2);
  await tool('Medir');
  await page.mouse.click(...leftLeg);
  await page.waitForTimeout(600);
  await page.mouse.click(...rightLeg);
  await page.waitForTimeout(1000);
  await shot(page, 'medir');
  await page.keyboard.press('Escape');
  await tool('Seleccionar');
  await view('3D');
  await page.waitForTimeout(800);
  // Sin nada elegido y un poco más cerca, para que se vean las espigas adentro de las patas.
  await page.mouse.click(700, 600);
  await page.keyboard.press('x');
  await page.mouse.move(660, 420);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1500);
  await shot(page, 'rayos-x');
  await page.context().close();
}

// Compu: Probar cajones y puertas, en una alacena y una cajonera.
{
  const page = await open(desktop);
  await page.goto(`${BASE}#/nuevo/alacena`);
  await page.getByRole('button', { name: 'Crear alacena' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3500);
  await page.keyboard.press('a');
  await page.getByRole('button', { name: /Puerta 1/ }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'probar');
  await page.goto(`${BASE}#/nuevo/cajonera`);
  await page.getByRole('button', { name: 'Crear cajonera' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3500);
  await page.keyboard.press('a');
  await page.locator('input[type=range]').first().fill('60');
  await page.getByRole('group', { name: 'Corte' }).getByRole('button', { name: 'Costado' }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'probar-corte');
  await page.context().close();
}

// Compu: piezas y mueble, y las demás secciones, sobre una mesa nueva.
{
  const page = await open(desktop);
  const view = (name) => page.locator('[data-tour="views"]').getByRole('button', { name, exact: true }).click();
  const accordion = (name) => page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  const leftLeg = [140, 400];
  const rightLeg = [925, 400];
  await createTable(page);
  await page.getByRole('button', { name: 'Crear mesa' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3000);
  await view('Frente');
  await page.waitForTimeout(1200);
  await page.mouse.click(...leftLeg);
  await page.waitForTimeout(800);
  await shot(page, 'panel-pieza');
  await page.keyboard.press('s');
  await page.waitForTimeout(1200);
  await shot(page, 'ocultar');
  await page.keyboard.press('s');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'duplicar');
  // La vista previa reencuadra: se cancela y se vuelve al frente antes de elegir las dos patas.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await view('Frente');
  await page.waitForTimeout(1200);
  await page.mouse.click(...leftLeg);
  await page.waitForTimeout(300);
  await page.keyboard.down('Shift');
  await page.mouse.click(...rightLeg);
  await page.keyboard.up('Shift');
  await page.getByRole('button', { name: 'Agrupar', exact: true }).click();
  await page.waitForTimeout(1000);
  await shot(page, 'grupo');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await view('3D');
  await page.waitForTimeout(1000);
  const width = page.locator('[data-tour="panel"] input').first();
  await width.fill('200');
  await page.waitForTimeout(1200);
  await shot(page, 'medidas-mueble');
  await width.press('Enter');
  // Que se vaya el aviso de abajo.
  await page.waitForTimeout(7500);
  await shot(page, 'vista-previa');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await accordion('Medidas del mueble');
  await accordion('Piezas');
  await accordion('Proporción áurea');
  await page.waitForTimeout(600);
  await shot(page, 'aurea');
  await accordion('Proporción áurea');
  await accordion('Terminación');
  await page.getByLabel('Terminación del mueble').selectOption('tinte-nogal');
  await page.waitForTimeout(7500);
  await shot(page, 'terminacion');
  await page.keyboard.press('Control+z');
  await accordion('Terminación');
  await accordion('Medidas del mueble');
  await accordion('Piezas');
  await page.locator('[data-tour="add"]').click();
  await page.waitForTimeout(500);
  await shot(page, 'agregar-pieza');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: /^Uniones/ }).first().click();
  await page.waitForTimeout(3000);
  await shot(page, 'uniones');
  const length = page.getByLabel('Largo', { exact: true }).first();
  await length.fill('5');
  await length.press('Tab');
  await page.waitForTimeout(1500);
  await shot(page, 'uniones-medidas');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Separar piezas' }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'uniones-cerca');
  await page.getByRole('button', { name: 'Juntar' }).click();
  await page.getByRole('link', { name: 'Cortes' }).first().click();
  await page.waitForTimeout(1500);
  await shot(page, 'cortes');
  await page.getByRole('tab', { name: 'Presupuesto' }).click();
  await page.waitForTimeout(600);
  await shot(page, 'presupuesto');
  await page.getByRole('link', { name: 'Plano' }).first().click();
  await page.waitForTimeout(4000);
  await shot(page, 'plano');
  await page.getByRole('link', { name: 'Armado' }).first().click();
  await page.waitForTimeout(1500);
  await shot(page, 'armado');
  await page.locator('[data-tour="share"]').click();
  await page.waitForTimeout(1500);
  await shot(page, 'compartir');
  await page.keyboard.press('Escape');
  await page.locator('[data-tour="photo"]').click();
  await page.getByRole('button', { name: 'Guardar foto' }).waitFor();
  await page.waitForTimeout(6000);
  await shot(page, 'foto-mueble');
  await page.context().close();
}

// Compu: la biblioteca, que tiene un aviso en la revisión, y un cajón nuevo.
{
  const page = await open(desktop);
  await page.goto(`${BASE}#/nuevo/biblioteca`);
  await page.getByRole('button', { name: /^Crear/ }).first().click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /^Revisión del diseño/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Medidas del mueble/ }).click();
  await page.getByRole('button', { name: 'Se puede volcar' }).click();
  await page.waitForTimeout(600);
  await shot(page, 'revision');
  await page.locator('[data-tour="add"]').click();
  await page.waitForTimeout(400);
  await page.getByRole('menuitem', { name: /^Cajón/ }).click();
  await page.waitForTimeout(2000);
  await shot(page, 'cajon');
  await page.context().close();
}

// Compu: la silla, con las patas inclinadas, y sus ángulos en Cortes y en el Plano.
{
  const page = await open(desktop);
  await page.goto(`${BASE}#/nuevo/silla`);
  await page.getByRole('button', { name: 'Crear silla' }).waitFor();
  await page.waitForTimeout(1500);
  await shot(page, 'plantilla-silla');
  await page.getByRole('button', { name: 'Crear silla' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3500);
  // La pata delantera derecha, y el panel corrido hasta Inclinar la pata.
  await page.mouse.click(540, 540);
  await page.waitForTimeout(1000);
  await page.getByText('Inclinar la pata').evaluate((el) => el.closest('fieldset').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  await shot(page, 'patas-inclinadas');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Cortes' }).first().click();
  await page.waitForTimeout(2000);
  await shot(page, 'patas-cortes');
  await page.getByRole('link', { name: 'Plano' }).first().click();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: /Despiece 1/ }).click();
  await page.waitForTimeout(2500);
  await shot(page, 'patas-plano');
  await page.context().close();
}

// Compu: espiga doble en las uniones de pata con faldón de la mesa, con las piezas separadas.
{
  const page = await open(desktop);
  await createTable(page);
  await page.getByRole('button', { name: 'Crear mesa' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3000);
  await page.getByRole('link', { name: /^Uniones/ }).first().click();
  await page.waitForTimeout(3000);
  await page.getByLabel('Espigas').selectOption('2');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^Aplicar/ }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Separar piezas' }).click();
  await page.waitForTimeout(2000);
  await shot(page, 'espiga-doble');
  await page.context().close();
}

// Compu: espiga pasante con cuñas en una unión de pata con faldón de la mesa, con las piezas separadas.
{
  const page = await open(desktop);
  await createTable(page);
  await page.getByRole('button', { name: 'Crear mesa' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3000);
  await page.getByRole('link', { name: /^Uniones/ }).first().click();
  await page.waitForTimeout(3000);
  // Solo en esta unión: la espiga ciega del faldón de costado se acorta sola para no cruzarse con la pasante.
  await page.getByLabel(/^Aplicar a las/).uncheck();
  await page.getByLabel('Cómo se traba').selectOption('2');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Separar piezas' }).click();
  await page.waitForTimeout(2500);
  await shot(page, 'espiga-cunas');
  await page.context().close();
}

// Compu: la tapa de la mesa sujeta con botones de madera, vista desde adentro y desde abajo.
{
  const page = await open(desktop);
  await createTable(page);
  await page.getByRole('button', { name: 'Crear mesa' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3000);
  await page.getByRole('link', { name: /^Uniones/ }).first().click();
  await page.waitForTimeout(2500);
  await page.getByText('Tapa con faldón').first().click();
  await page.waitForTimeout(800);
  await page.locator('li button').filter({ hasText: 'T1 ↔ F1' }).first().click();
  await page.waitForTimeout(3000);
  await shot(page, 'tapa-botones');
  await page.context().close();
}

// Compu: la mesa con testero, con la lengüeta y los tarugos separados.
{
  const page = await open(desktop);
  await createTable(page);
  await page.getByText('Puntas de la tapa').first().click().catch(() => {});
  await page.getByText('Con testero', { exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Crear mesa' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3000);
  await page.getByRole('link', { name: /^Uniones/ }).first().click();
  await page.waitForTimeout(2500);
  await page.getByText('Testero con tapa').first().click();
  await page.waitForTimeout(800);
  await page.locator('li button').filter({ hasText: 'C1 ↔ T1' }).first().click();
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Separar piezas' }).click();
  await page.waitForTimeout(2500);
  await shot(page, 'testero');
  await page.context().close();
}

// Celular: el editor con la mesa y el modo taller.
{
  const page = await open(phone);
  await createTable(page);
  await page.getByRole('button', { name: 'Crear mesa' }).click();
  await page.locator('[data-tour="tools"]').waitFor();
  await page.waitForTimeout(3500);
  await shot(page, 'editor-celular');
  await page.goto(page.url().replace(/#\/proyecto\/([^/]+).*/, '#/proyecto/$1/taller'));
  await page.waitForTimeout(2000);
  await shot(page, 'taller');
  await page.context().close();
}

await browser.close();
console.log(`Capturas en ${OUT}`);

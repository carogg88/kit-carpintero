import { boxSize, copyBox, otherAxes, type Box, type Vec3 } from '../geometry';
import { box, endJoint, type EndJoint, type JointGeometry, type Solid } from './common';
import { tk } from '../i18n';

/**
 * Cómo se sujeta una pieza que va a tope: sobre todo una tapa maciza sobre sus faldones. La madera se mueve a lo
 * ancho con la humedad (una tapa de 90 cm, cerca de 1 cm entre verano e invierno), así que la tapa no se encola ni
 * se atornilla fija: se toma con piezas que la dejan correr.
 */

/** El número va en `params.hold`. 'libre' (0, o si falta) es apoyada sin decir cómo se sujeta. */
export const HOLDS = ['libre', 'cola', 'tornillos', 'botones', 'ovalados', 'grampas'] as const;
export type Hold = (typeof HOLDS)[number];

export const HOLD_NAMES: Record<Hold, string> = {
  libre: tk('Sin elegir'),
  cola: tk('Encolada'),
  tornillos: tk('Tornillos fijos'),
  botones: tk('Botones de madera'),
  ovalados: tk('Tornillos en agujero ovalado'),
  grampas: tk('Grampas en 8'),
};

/** Por qué se elige cada una, en una línea. */
export const HOLD_ABOUT: Record<Hold, string> = {
  libre: tk('Apoyada, sin decir cómo se sujeta.'),
  cola: tk('Cola en toda la superficie: fuerte, pero traba la madera. Solo para piezas angostas o de placa.'),
  tornillos: tk('Tornillos en agujeros redondos: traban la madera igual que la cola.'),
  botones: tk('Tacos con una lengüeta que entra en una ranura del faldón y se atornillan a la tapa. La tapa corre en la ranura.'),
  ovalados: tk('Tornillos de bolsillo con el agujero alargado para el lado en que se mueve la tapa.'),
  grampas: tk('Una chapa en forma de 8: un ojo se atornilla en un rebaje del faldón y el otro a la tapa, y gira cuando la tapa se mueve.'),
};

export const holdOf = (p: { hold?: number }): Hold => HOLDS[p.hold ?? 0] ?? 'libre';

/** Las que dejan que la madera se mueva. */
export const FLOATING_HOLDS: ReadonlySet<Hold> = new Set<Hold>(['botones', 'ovalados', 'grampas']);

const width = (j: EndJoint) => j.section.max[j.wide] - j.section.min[j.wide];
const thick = (b: Box, j: EndJoint) => boxSize(b)[j.thin];

/** Ranura de los botones: 6 mm de alto, 8 de hondo, a 12 mm de la tapa, y 25 mm antes de cada punta. */
export const BUTTON_SLOT = { height: 6, depth: 8, below: 12, stop: 25 };
/** Un botón cada 25 cm, una grampa o un tornillo cada 30. */
const BUTTON_STEP = 250;
const SCREW_STEP = 300;
/** Grampa en 8: ojo de 20 mm y chapa de 3,5. */
export const FIGURE8 = { radius: 10, depth: 3.5 };
const POCKET_ANGLE = (15 * Math.PI) / 180;
/** Lo que se alarga el agujero del tornillo hacia donde se mueve la tapa. */
const SLOT_RUN = 4;

/** Si se puede sujetar así: los botones y las grampas piden un faldón (alto y con espesor), no una pata. */
export function holdFits(a: Box, b: Box, hold: Hold): boolean {
  if (!FLOATING_HOLDS.has(hold)) return true;
  const j = endJoint(a, b);
  if (!j || width(j) < 100 || thick(b, j) < 15) return false;
  const tall = boxSize(b)[j.axis];
  if (hold === 'botones') return tall >= BUTTON_SLOT.below + BUTTON_SLOT.height + 20 && width(j) > 2 * BUTTON_SLOT.stop + 50;
  if (hold === 'ovalados') return tall >= 60;
  return tall >= 30;
}

/** Cuántos botones, grampas o tornillos lleva una unión, según el largo del faldón. */
export function holdCount(a: Box, b: Box, hold: Hold): number {
  const j = endJoint(a, b);
  if (!j || !FLOATING_HOLDS.has(hold)) return 0;
  return Math.max(2, Math.round(width(j) / (hold === 'botones' ? BUTTON_STEP : SCREW_STEP)));
}

/** La mejor sujeción que entra entre la tapa A y la pieza B: botones si se puede, si no, grampas. */
export function bestHold(a: Box, b: Box): Hold | null {
  return (['botones', 'grampas', 'ovalados'] as const).find((h) => holdFits(a, b, h)) ?? null;
}

/** Hacia dónde se mueve A: a lo ancho, el eje de la cara de contacto en que es más corta. */
const moveAxis = (a: Box, j: EndJoint) => {
  const [k1, k2] = otherAxes(j.axis);
  const s = boxSize(a);
  return s[k1] <= s[k2] ? k1 : k2;
};

/** La cara de B que mira al centro de A: la de adentro del mueble, donde va lo que no se tiene que ver. */
function inner(a: Box, b: Box, j: EndJoint): { at: number; sign: 1 | -1 } {
  const midB = (b.min[j.thin] + b.max[j.thin]) / 2;
  const fromMin = (a.min[j.thin] + a.max[j.thin]) / 2 >= midB;
  return fromMin ? { at: b.max[j.thin], sign: -1 } : { at: b.min[j.thin], sign: 1 };
}

/** Qué se le corta a B (el faldón) para sujetar a A (la tapa). A no lleva cortes: los tornillos se abren camino solos. */
export function holdGeometry(a: Box, b: Box, hold: Hold): JointGeometry {
  const none = { cutA: [], cutB: [], addB: [] };
  const j = endJoint(a, b);
  if (!j || !holdFits(a, b, hold)) return none;
  const into = -j.dir as 1 | -1;
  const side = inner(a, b, j);
  const n = holdCount(a, b, hold);
  const cutB: Solid[] = [];
  if (hold === 'botones') {
    const s = copyBox(j.section);
    const y0 = j.face + into * BUTTON_SLOT.below;
    const y1 = y0 + into * BUTTON_SLOT.height;
    s.min[j.axis] = Math.min(y0, y1);
    s.max[j.axis] = Math.max(y0, y1);
    const depth = Math.min(BUTTON_SLOT.depth, thick(b, j) / 2);
    s.min[j.thin] = side.sign > 0 ? side.at : side.at - depth;
    s.max[j.thin] = side.sign > 0 ? side.at + depth : side.at;
    s.min[j.wide] += BUTTON_SLOT.stop;
    s.max[j.wide] -= BUTTON_SLOT.stop;
    cutB.push(box(s));
  } else if (hold === 'grampas') {
    for (let i = 0; i < n; i++) {
      const start: Vec3 = [0, 0, 0];
      start[j.axis] = j.face;
      start[j.thin] = side.at + side.sign * (FIGURE8.radius - 2);
      start[j.wide] = j.section.min[j.wide] + (width(j) * (i + 0.5)) / n;
      cutB.push({ kind: 'cylinder', start, axis: j.axis, dir: into, radius: FIGURE8.radius, length: FIGURE8.depth });
    }
  } else if (hold === 'ovalados') {
    // Como un tornillo de bolsillo, con la guía repetida corrida hacia donde se mueve la tapa: queda un óvalo.
    const midB = (b.min[j.thin] + b.max[j.thin]) / 2;
    const dir: Vec3 = [0, 0, 0];
    dir[j.axis] = j.dir * Math.cos(POCKET_ANGLE);
    dir[j.thin] = side.sign * Math.sin(POCKET_ANGLE);
    const run = Math.abs(midB - side.at) / Math.sin(POCKET_ANGLE);
    const counterbore = Math.max(4, run - 14);
    const move = moveAxis(a, j);
    for (let i = 0; i < n; i++) {
      const exit: Vec3 = [0, 0, 0];
      exit[j.axis] = j.face;
      exit[j.thin] = midB;
      exit[j.wide] = j.section.min[j.wide] + (width(j) * (i + 0.5)) / n;
      const at = (t: number, shift = 0) => exit.map((v, k) => v - dir[k]! * t + (k === move ? shift : 0)) as Vec3;
      cutB.push({ kind: 'bore', start: at(run + 8), dir, radius: 4.75, length: 8 + counterbore });
      for (const shift of [-SLOT_RUN / 2, SLOT_RUN / 2])
        cutB.push({ kind: 'bore', start: at(run - counterbore + 0.5, shift), dir, radius: 2.25, length: run - counterbore + 0.5 });
    }
  }
  return { cutA: [], cutB, addB: [] };
}

/** Una unión que no lleva ningún corte: a tope, apoyada, encolada o atornillada sin más. */
export const plainJoint = (j: { type: string; params: { hold?: number } }): boolean => j.type === 'tope' && !FLOATING_HOLDS.has(holdOf(j.params));

/** Botón de madera: 40 mm de ancho, el cuerpo de 18 de alto y 25 de largo, con la lengüeta de 6 que entra en la ranura. */
const BUTTON = { width: 40, reach: 25, gap: 2 };

/**
 * Los botones como quedan armados, para verlos en el detalle de la unión: el cuerpo contra la tapa, del lado de
 * adentro del faldón, y la lengüeta metida en la ranura sin llegar al fondo. Dos cajas por botón.
 */
export function buttonBlocks(a: Box, b: Box): Box[] {
  const j = endJoint(a, b);
  if (!j || !holdFits(a, b, 'botones')) return [];
  const into = -j.dir;
  const side = inner(a, b, j);
  const n = holdCount(a, b, 'botones');
  const span = (from: number, to: number): [number, number] => [Math.min(from, to), Math.max(from, to)];
  const bottom = j.face + into * (BUTTON_SLOT.below + BUTTON_SLOT.height);
  const blocks: Box[] = [];
  const length = width(j) - 2 * BUTTON_SLOT.stop;
  for (let i = 0; i < n; i++) {
    const c = j.section.min[j.wide] + BUTTON_SLOT.stop + (length * (i + 0.5)) / n;
    const body = { min: [0, 0, 0], max: [0, 0, 0] } as Box;
    const tongue = { min: [0, 0, 0], max: [0, 0, 0] } as Box;
    [body.min[j.axis], body.max[j.axis]] = span(j.face, bottom);
    [body.min[j.thin], body.max[j.thin]] = span(side.at - side.sign * BUTTON.gap, side.at - side.sign * (BUTTON.gap + BUTTON.reach));
    [tongue.min[j.axis], tongue.max[j.axis]] = span(j.face + into * BUTTON_SLOT.below + into * 0.5, bottom - into * 0.5);
    [tongue.min[j.thin], tongue.max[j.thin]] = span(side.at - side.sign * BUTTON.gap, side.at + side.sign * (BUTTON_SLOT.depth - 2));
    for (const x of [body, tongue]) [x.min[j.wide], x.max[j.wide]] = [c - BUTTON.width / 2, c + BUTTON.width / 2];
    blocks.push(body, tongue);
  }
  return blocks;
}

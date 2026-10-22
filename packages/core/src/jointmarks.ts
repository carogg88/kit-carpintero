import { partAxesBySize } from './edit';
import { boxSize, otherAxes, partBox, type Axis, type Box } from './geometry';
import { jointGeometry, solidBox, type Solid } from './joints';
import { faceLabelOf } from './pockets';
import type { JointType, Part, Project } from './project';
import { t, tk } from './i18n';

/**
 * Dónde marcar cada encastre de una pieza: en qué cara, a qué distancia de la punta y del borde, y cuánto mide.
 * Es lo que se pasa a la madera con escuadra y gramil, así que se dice con palabras y no solo con cotas.
 */

/** Lo que una unión le hace a la pieza: cortes (mortajas, agujeros) o lo que le sale (espigas, lengüetas). */
export interface JointMark {
  jointId: string;
  type: JointType;
  /** La otra pieza de la unión. */
  other: string;
  /** Cortes que se sacan de la pieza, o lo que sobresale de ella. */
  role: 'cut' | 'add';
  /** Cuántos sólidos iguales: agujeros de tarugos, ranuras de galleta. */
  count: number;
  /**
   * Cara donde abre (o de donde sale): eje y lado. `out` dice si mira hacia afuera del mueble (true), hacia el medio
   * (false) o si no se puede decir (null: es vertical, o la pieza está en el medio).
   */
  face: Side;
  /**
   * Distancia a la punta o al borde más cercano sobre cada eje de la cara (al centro, si son agujeros redondos).
   * `through`: el corte va de punta a punta (o de borde a borde) sobre ese eje.
   */
  from: (Side & { mm: number; centered: boolean; through?: boolean })[];
  /** Medida sobre cada eje de la cara, en el mismo orden que `from`. */
  size: number[];
  /** Hondo del corte o largo de lo que sale. */
  depth: number;
  /** Diámetro, si son agujeros redondos. */
  diameter?: number;
  /** Separación entre centros, si son varios en fila. */
  spacing?: number;
  /** Encastres de forma (colas, dedos, ingletes): se marcan con la hoja de encastres, no con una distancia. */
  shaped: boolean;
  /** Varios iguales a distintas alturas del largo: cada distancia desde la punta de abajo, la izquierda o la de atrás. */
  along?: number[];
  /** Uno en cada punta del largo, iguales. */
  bothEnds?: boolean;
  /** Dos iguales sobre la misma cara, a esta distancia de cada punta del largo. */
  fromEachEnd?: number;
  /** Cómo se llama el corte en el taller, si no es el del encastre: un canal que sale por la punta es un rebaje. */
  cutName?: JointType;
}

const TOL = 0.5;

interface Side {
  axis: Axis;
  side: 1 | -1;
  out: boolean | null;
}

/** Nombre de lo que se marca, en singular y en plural (este, en minúscula: va después del número). */
const CUT_NAMES: Partial<Record<JointType, [string, string]>> = {
  mortaja: [tk('Mortaja'), tk('mortajas')],
  canal: [tk('Canal'), tk('canales')],
  rebaje: [tk('Rebaje'), tk('rebajes')],
  'media-madera': [tk('Rebaje de media madera'), tk('rebajes de media madera')],
  clavija: [tk('Agujero para tarugo'), tk('agujeros para tarugos')],
  'cola-milano': [tk('Pines de cola de milano'), tk('pines de cola de milano')],
  dedos: [tk('Dedos'), tk('dedos')],
  brida: [tk('Rebaje de brida'), tk('rebajes de brida')],
  inglete: [tk('Corte a inglete'), tk('cortes a inglete')],
  galleta: [tk('Ranura para galleta'), tk('ranuras para galleta')],
  machiembrado: [tk('Canal de machimbre'), tk('canales de machimbre')],
  bolsillo: [tk('Agujeros de bolsillo'), tk('agujeros de bolsillo')],
};

const ADD_NAMES: Partial<Record<JointType, [string, string]>> = {
  mortaja: [tk('Espiga'), tk('espigas')],
  canal: [tk('Lengüeta'), tk('lengüetas')],
  rebaje: [tk('Lengüeta'), tk('lengüetas')],
  machiembrado: [tk('Lengüeta de machimbre'), tk('lengüetas de machimbre')],
  'cola-milano': [tk('Colas de milano'), tk('colas de milano')],
  dedos: [tk('Dedos'), tk('dedos')],
  inglete: [tk('Corte a inglete'), tk('cortes a inglete')],
};

/** Los que no se marcan con una distancia: se trazan con plantilla o falsa escuadra. */
const SHAPED = new Set<JointType>(['cola-milano', 'dedos', 'inglete', 'bolsillo']);

const union = (boxes: Box[]): Box => ({
  min: [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b.min[k]!))) as Box['min'],
  max: [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k]!))) as Box['max'],
});

/** Cara de la pieza donde abre un corte: la que toca, y si toca varias, la del eje en que es menos hondo. */
function openFace(body: Box, s: Box): { axis: Axis; side: 1 | -1 } {
  const size = boxSize(body);
  const touches: { axis: Axis; side: 1 | -1; ratio: number }[] = [];
  for (const k of [0, 1, 2] as Axis[]) {
    const ratio = (s.max[k] - s.min[k]) / (size[k] || 1);
    if (Math.abs(s.max[k] - body.max[k]) < TOL) touches.push({ axis: k, side: 1, ratio });
    if (Math.abs(s.min[k] - body.min[k]) < TOL) touches.push({ axis: k, side: -1, ratio });
  }
  // Un corte que atraviesa toca las dos caras de un eje: se marca desde la de adelante o la de arriba.
  touches.sort((a, b) => a.ratio - b.ratio || b.side - a.side);
  const thin = ([0, 1, 2] as Axis[]).sort((a, b) => size[a] - size[b])[0]!;
  // En una tabla, los canales y rebajes se hacen desde la cara ancha aunque salgan por una punta: es donde se apoya
  // la fresa o la sierra, y desde ahí se mide lo hondo.
  const board = size[thin] < 0.8 * Math.min(...([0, 1, 2] as Axis[]).filter((k) => k !== thin).map((k) => size[k]));
  const onFace = board ? touches.find((x) => x.axis === thin && x.ratio < 1 - 1e-6) : undefined;
  // Si no toca ninguna (un agujero ciego por dentro), desde la cara más ancha.
  return onFace ?? touches[0] ?? { axis: thin, side: 1 };
}

/** Cara de la pieza de la que sale algo: la que queda del otro lado del sólido. */
function outFace(body: Box, s: Box): { axis: Axis; side: 1 | -1 } | null {
  for (const k of [0, 1, 2] as Axis[]) {
    if (s.min[k] >= body.max[k] - TOL) return { axis: k, side: 1 };
    if (s.max[k] <= body.min[k] + TOL) return { axis: k, side: -1 };
  }
  return null;
}

/** Hacia afuera o hacia el medio del mueble, sobre un eje horizontal: lo que no cambia entre piezas en espejo. */
const outward = (body: Box, center: number[], axis: Axis, side: 1 | -1): boolean | null => {
  if (axis === 1) return null;
  const off = (body.min[axis] + body.max[axis]) / 2 - center[axis]!;
  return Math.abs(off) < TOL ? null : Math.sign(off) === side;
};

function markOf(
  body: Box,
  center: number[],
  solids: Solid[],
  role: 'cut' | 'add',
  base: Omit<JointMark, 'role' | 'count' | 'face' | 'from' | 'size' | 'depth' | 'shaped'>,
): JointMark | null {
  if (!solids.length) return null;
  const boxes = solids.map(solidBox);
  const shaped = SHAPED.has(base.type);
  const env = union(boxes);
  const f = role === 'cut' ? openFace(body, shaped ? env : boxes[0]!) : outFace(body, boxes[0]!);
  if (!f) return null;
  const face: Side = { ...f, out: outward(body, center, f.axis, f.side) };
  const s0 = solids[0]!;
  const radius = s0.kind === 'cylinder' || s0.kind === 'bore' ? s0.radius : undefined;
  const [a1, a2] = otherAxes(face.axis);
  // El primero en fila desde la esquina de abajo, a la izquierda y atrás: es el que se marca con la distancia.
  const sorted = [...boxes].sort((x, y) => x.min[a1] - y.min[a1] || x.min[a2] - y.min[a2]);
  const first = shaped ? env : sorted[0]!;
  const from = [a1, a2].map((k) => {
    const lo = first.min[k] - body.min[k];
    const hi = body.max[k] - first.max[k];
    const side: 1 | -1 = hi < lo - TOL ? 1 : -1;
    const mm = Math.max(0, side > 0 ? hi : lo) + (radius ?? 0);
    const through = !shaped && radius === undefined && lo < TOL && hi < TOL;
    return { axis: k, side, out: outward(body, center, k, side), mm, centered: Math.abs(lo - hi) < TOL && lo > TOL, through };
  });
  const size = [a1, a2].map((k) => first.max[k] - first.min[k]);
  // Un canal que sale por una punta sobre su ancho (no sobre su largo) es un rebaje: el estante de arriba apoya en la
  // punta del lateral, no en una ranura.
  const narrow = size[0]! <= size[1]! ? 0 : 1;
  const f0 = from[narrow]!;
  const cutName: JointType | undefined =
    role === 'cut' && base.type === 'canal' && !f0.through && f0.mm < TOL && size[narrow]! < size[1 - narrow]! - TOL ? 'rebaje' : undefined;
  const depth = first.max[face.axis] - first.min[face.axis];
  const diameter = radius !== undefined ? 2 * radius : undefined;
  let spacing: number | undefined;
  if (sorted.length > 1) {
    const c = (b: Box, k: Axis) => (b.min[k] + b.max[k]) / 2;
    const k = Math.abs(c(sorted[1]!, a1) - c(sorted[0]!, a1)) > TOL ? a1 : a2;
    spacing = Math.abs(c(sorted[1]!, k) - c(sorted[0]!, k));
  }
  return {
    ...base,
    role,
    count: solids.length,
    face,
    from,
    size,
    depth,
    shaped,
    ...(diameter !== undefined ? { diameter } : {}),
    ...(spacing ? { spacing } : {}),
    ...(cutName ? { cutName } : {}),
  };
}

/** Los encastres de una pieza, en orden: primero los cortes, después lo que sobresale. */
export function partJointMarks(project: Project, part: Part): JointMark[] {
  if (part.base.kind !== 'box') return [];
  const body = partBox(part);
  const all = project.parts.map(partBox);
  const center = [0, 1, 2].map((k) => (Math.min(...all.map((b) => b.min[k]!)) + Math.max(...all.map((b) => b.max[k]!))) / 2);
  const marks: JointMark[] = [];
  for (const j of project.joints) {
    if (j.type === 'tope' || (j.partA !== part.id && j.partB !== part.id)) continue;
    const a = project.parts.find((p) => p.id === j.partA);
    const b = project.parts.find((p) => p.id === j.partB);
    if (!a || !b || a.base.kind !== 'box' || b.base.kind !== 'box') continue;
    const g = jointGeometry(j.type, partBox(a), partBox(b), j.params);
    if (!g) continue;
    const isA = j.partA === part.id;
    const base = { jointId: j.id, type: j.type, other: isA ? b.id : a.id };
    const cut = markOf(body, center, isA ? g.cutA : g.cutB, 'cut', base);
    const add = isA ? null : markOf(body, center, g.addB, 'add', base);
    if (cut) marks.push(cut);
    if (add) marks.push(add);
  }
  return marks.sort((x, y) => (x.role === y.role ? 0 : x.role === 'cut' ? -1 : 1));
}

const ENDS = [
  [tk('de la punta izquierda'), tk('de la punta derecha')],
  [tk('de la punta de abajo'), tk('de la punta de arriba')],
  [tk('de la punta de atrás'), tk('de la punta de adelante')],
] as const;

const EDGES = [
  [tk('del borde izquierdo'), tk('del borde derecho')],
  [tk('del borde de abajo'), tk('del borde de arriba')],
  [tk('del borde de atrás'), tk('del borde de adelante')],
] as const;

/** "7, 49,8 y 85,5": una lista con "y" antes del último. */
const list = (xs: string[]) => (xs.length > 1 ? t('{a} y {b}', { a: xs.slice(0, -1).join(', '), b: xs[xs.length - 1]! }) : (xs[0] ?? ''));

/** Sobre los ejes horizontales, afuera y adentro del mueble: valen igual para las piezas en espejo. */
const EDGE_OUT = [tk('del borde de adentro'), tk('del borde de afuera')] as const;
const FACE_OUT = [tk('la cara de adentro'), tk('la cara de afuera')] as const;

/** Cortes que cruzan la pieza entera sobre un eje: largo, ancho o espesor. */
const THROUGH = [tk('de punta a punta'), tk('de borde a borde'), tk('en todo el espesor')] as const;

/** "la punta de arriba": la punta como lugar, sin el "de" de la distancia. */
const END_PLACES = [
  [tk('la punta izquierda'), tk('la punta derecha')],
  [tk('la punta de abajo'), tk('la punta de arriba')],
  [tk('la punta de atrás'), tk('la punta de adelante')],
] as const;

/**
 * El encastre en una frase, para marcar la pieza: "Mortaja para F1 en el frente: a 1 de la punta de arriba y a 1,9
 * del borde izquierdo. Mide 7,5 × 0,7 y 4,2 de hondo."
 */
export function describeJointMark(part: Part, m: JointMark, n: (mm: number) => string): string {
  const [length, width] = partAxesBySize(part);
  const names = (m.role === 'cut' ? CUT_NAMES : ADD_NAMES)[m.cutName ?? m.type] ?? (m.role === 'cut' ? [tk('Corte'), tk('cortes')] : [tk('Saliente'), tk('salientes')]);
  const where = m.bothEnds
    ? t('cada punta')
    : m.face.axis === length
      ? t(END_PLACES[m.face.axis][m.face.side > 0 ? 1 : 0])
      : m.face.out !== null
        ? t(FACE_OUT[m.face.out ? 1 : 0])
        : faceLabelOf(m.face.axis, m.face.side);
  const many = m.count > 1 && !m.shaped;
  const head = many
    ? t('{n} {what} para {other} en {face}', { n: m.count, what: t(names[1]), other: m.other, face: where })
    : t('{what} para {other} en {face}', { what: t(names[0]), other: m.other, face: where });
  if (m.shaped) return t('{head}: se marca con la hoja de encastres.', { head });
  // Lo que sale con la sección entera de la pieza no se marca: es la punta, que entra en la otra pieza.
  if (m.role === 'add' && m.from.every((f) => f.through))
    return t('{head}: no se rebaja, la pieza entra entera {depth} en la otra. La medida de corte ya lo incluye.', { head, depth: n(m.depth) });
  const place = m.from.map((f) => {
    if (f.through) return t(THROUGH[f.axis === length ? 0 : f.axis === width ? 1 : 2]);
    if (f.axis === length && m.fromEachEnd !== undefined)
      return m.fromEachEnd < TOL ? t('al ras de cada punta') : t('a {n} de cada punta', { n: n(m.fromEachEnd) });
    if (f.axis === length && m.along && m.along.length > 1) return t('a {n} {ref}', { n: list(m.along.map(n)), ref: t(ENDS[f.axis][0]) });
    if (f.centered) return f.axis === length ? t('a la mitad del largo') : f.axis === width ? t('a la mitad del ancho') : t('a la mitad del espesor');
    const ref = t(f.axis === length ? ENDS[f.axis][f.side > 0 ? 1 : 0] : f.out !== null ? EDGE_OUT[f.out ? 1 : 0] : EDGES[f.axis][f.side > 0 ? 1 : 0]);
    return f.mm < TOL ? t('al ras {ref}', { ref }) : t('a {n} {ref}', { n: n(f.mm), ref });
  });
  // Lo que va sobre el largo de la pieza primero: es lo primero que se marca con la escuadra.
  // Si ninguno es el largo, el ancho antes que el espesor.
  const first = (f: Side) => (f.axis === length ? 2 : f.axis === width ? 1 : 0);
  const order = first(m.from[1]!) > first(m.from[0]!) ? [1, 0] : [0, 1];
  const [a, b] = order.map((i) => place[i]!) as [string, string];
  const size = m.diameter !== undefined ? `Ø ${n(m.diameter)}` : order.map((i) => n(m.size[i]!)).join(' × ');
  const parts = [
    // Los agujeros redondos se marcan por el centro.
    m.diameter !== undefined ? t('{head}: con el centro {a} y {b}.', { head, a, b }) : t('{head}: {a} y {b}.', { head, a, b }),
    m.role === 'cut' ? t('Mide {size} y {depth} de hondo.', { size, depth: n(m.depth) }) : t('Mide {size} y sale {depth}.', { size, depth: n(m.depth) }),
  ];
  if (many && m.spacing) parts.push(t('A {n} entre centros.', { n: n(m.spacing) }));
  return parts.join(' ');
}

/**
 * Las frases de todos los encastres de una pieza, juntando los que son iguales: las dos mortajas de una pata van en
 * una frase ("2 mortajas para F2 y F3…"), y los canales de un lateral, que cambian solo de altura, también ("a 7, 49,8 y
 * 85,5 de la punta de abajo").
 */
export function describePartJoints(project: Project, part: Part, n: (mm: number) => string): string[] {
  const length = partAxesBySize(part)[0];
  const len = boxSize(partBox(part))[length];
  // Distancia desde la punta de abajo, la izquierda o la de atrás, para poder ponerlas en una misma lista.
  const fromLow = (m: JointMark): number | null => {
    const i = m.from.findIndex((f) => f.axis === length);
    const f = m.from[i];
    if (!f) return null;
    if (f.side < 0) return f.mm;
    return m.diameter !== undefined ? len - f.mm : len - f.mm - m.size[i]!;
  };
  const groups = new Map<string, JointMark[]>();
  for (const m of partJointMarks(project, part)) {
    const free = fromLow(m) === null ? m.from : m.from.map((f) => (f.axis === length ? { ...f, mm: 0, side: -1 as const, centered: false } : f));
    const face = m.face.axis === length ? { ...m.face, side: 1 as const } : m.face;
    const key = describeJointMark(part, { ...m, other: '\u0000', count: 1, from: free, face }, n);
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.values()].map((ms) => {
    if (ms.length === 1) return describeJointMark(part, ms[0]!, n);
    const others = [...new Set(ms.map((m) => m.other))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    const count = ms.reduce((sum, m) => sum + m.count, 0);
    const at = [...new Set(ms.map((m) => Math.round(fromLow(m) ?? 0)))].sort((a, b) => a - b);
    const bothEnds = ms[0]!.face.axis === length && new Set(ms.map((m) => m.face.side)).size === 2;
    const base = { ...ms[0]!, other: list(others), count, bothEnds };
    // Dos iguales, uno cerca de cada punta y a la misma distancia: "al ras de cada punta", no "a 0 y 23".
    const i = ms[0]!.from.findIndex((f) => f.axis === length);
    const w = ms[0]!.diameter !== undefined ? 0 : (ms[0]!.size[i] ?? 0);
    if (at.length === 2 && i >= 0 && Math.abs(at[0]! - (len - at[1]! - w)) < 1)
      return describeJointMark(part, { ...base, fromEachEnd: ms[0]!.diameter !== undefined ? at[0]! : Math.max(0, at[0]!) }, n);
    return at.length > 1 ? describeJointMark(part, { ...base, along: at }, n) : describeJointMark(part, base, n);
  });
}

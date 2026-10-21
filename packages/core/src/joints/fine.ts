import { boxSize, copyBox, type Box, type Vec3 } from '../geometry';
import { box, endJoint, half, slab, type EndJoint, type JointGeometry, type Solid } from './common';
import { nearestEdge } from './others';

/**
 * Encastres de carpintería fina. Todos son de punta contra cara: B apoya una punta (o un canto) sobre A,
 * como en `endJoint`. A recibe, B entra.
 */

const width = (j: EndJoint) => j.section.max[j.wide] - j.section.min[j.wide];
const thick = (b: Box, j: EndJoint) => boxSize(b)[j.thin];
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Sección de B con el espesor recortado a [t0, t1]. */
function band(j: EndJoint, t0: number, t1: number): Box {
  const s = copyBox(j.section);
  s.min[j.thin] = t0;
  s.max[j.thin] = t1;
  return s;
}

/** Polígono en el plano (ancho de B, eje de entrada), con el espesor de B. */
function faceProfile(j: EndJoint, points: [number, number][]): Solid {
  return { kind: 'prism', axis: j.thin, from: j.section.min[j.thin], to: j.section.max[j.thin], u: j.wide, v: j.axis, points };
}

// ---------- Cola de milano ----------

export interface DovetailParams {
  /** Cantidad de colas. */
  count: number;
  /** Pendiente 1:n (8 para maderas duras, 6 para blandas). */
  slope: number;
  /** Largo de las colas; con el espesor de A es pasante. */
  depth: number;
}

/** Colas de unos 6 cm, pendiente 1:8 y pasantes. */
export function defaultDovetailParams(a: Box, b: Box): DovetailParams | null {
  const j = endJoint(a, b);
  if (!j || width(j) < 30 || thick(b, j) < 6) return null;
  return { count: clamp(Math.round(width(j) / 60), 1, 8), slope: 8, depth: half(boxSize(a)[j.axis]) };
}

/** Las colas de B, más anchas en la punta, y los mismos huecos en A (lo que queda de A son los pines). */
export function dovetailGeometry(a: Box, b: Box, p: DovetailParams): JointGeometry | null {
  const j = endJoint(a, b);
  if (!j || p.count < 1) return null;
  const pitch = width(j) / p.count;
  const tip = j.face + j.dir * p.depth;
  const narrowing = (2 * p.depth) / Math.max(1, p.slope);
  // La cola ocupa 2/3 del paso en la punta; en la base queda al menos 1/5 del paso.
  const tipW = pitch * 0.66;
  const baseW = Math.max(pitch * 0.2, tipW - narrowing);
  const tails: Solid[] = [];
  for (let i = 0; i < p.count; i++) {
    const c = j.section.min[j.wide] + pitch * (i + 0.5);
    tails.push(
      faceProfile(j, [
        [c - baseW / 2, j.face],
        [c + baseW / 2, j.face],
        [c + tipW / 2, tip],
        [c - tipW / 2, tip],
      ]),
    );
  }
  return { cutA: tails, cutB: [], addB: tails };
}

// ---------- Ensamble de dedos ----------

export interface FingerParams {
  /** Dedos de B; A queda con uno menos. */
  count: number;
  depth: number;
}

/** Dedos del ancho del espesor de la madera, pasantes. */
export function defaultFingerParams(a: Box, b: Box): FingerParams | null {
  const j = endJoint(a, b);
  if (!j || width(j) < 20 || thick(b, j) < 6) return null;
  const segments = Math.max(3, Math.round(width(j) / thick(b, j)) | 1);
  return { count: clamp((segments + 1) / 2, 2, 12), depth: half(boxSize(a)[j.axis]) };
}

export function fingerGeometry(a: Box, b: Box, p: FingerParams): JointGeometry | null {
  const j = endJoint(a, b);
  if (!j || p.count < 1) return null;
  const seg = width(j) / (2 * p.count - 1);
  const fingers: Solid[] = [];
  for (let i = 0; i < p.count; i++) {
    const s = slab(j, p.depth);
    s.min[j.wide] = j.section.min[j.wide] + 2 * i * seg;
    s.max[j.wide] = s.min[j.wide] + seg;
    fingers.push(box(s));
  }
  return { cutA: fingers, cutB: [], addB: fingers };
}

// ---------- Brida ----------

export interface BridleParams {
  /** Lo que queda de A en el medio, dentro de la horquilla de B. */
  thickness: number;
  depth: number;
}

/** Brida en T: B abraza a A con una horquilla; A pierde dos tercios del espesor de B. */
export function defaultBridleParams(a: Box, b: Box): BridleParams | null {
  const j = endJoint(a, b);
  if (!j || thick(b, j) < 12) return null;
  return { thickness: half(thick(b, j) / 3), depth: half(boxSize(a)[j.axis]) };
}

export function bridleGeometry(a: Box, b: Box, p: BridleParams): JointGeometry | null {
  const j = endJoint(a, b);
  if (!j) return null;
  const mid = (j.section.min[j.thin] + j.section.max[j.thin]) / 2;
  const cheeks = [band(j, j.section.min[j.thin], mid - p.thickness / 2), band(j, mid + p.thickness / 2, j.section.max[j.thin])].map((s) =>
    box(slab(j, p.depth, s)),
  );
  return { cutA: cheeks, cutB: [], addB: cheeks };
}

// ---------- Inglete ----------

/** Inglete: solo en una esquina, con B al ras del canto de A. */
export function miterFits(a: Box, b: Box): boolean {
  const j = endJoint(a, b);
  return !!j && nearestEdge(a, j).gap <= 0.6;
}

/**
 * Las dos piezas llegan a la esquina de afuera y se cortan en diagonal. B gana el triángulo de su lado
 * y A lo pierde. Con espesores iguales el corte queda a 45°.
 */
export function miterGeometry(a: Box, b: Box): JointGeometry | null {
  const j = endJoint(a, b);
  if (!j || !miterFits(a, b)) return null;
  const edge = nearestEdge(a, j);
  const outer = edge.side === 'min' ? a.min[j.thin] : a.max[j.thin];
  const inner = edge.side === 'min' ? j.section.max[j.thin] : j.section.min[j.thin];
  const tip = j.face + j.dir * boxSize(a)[j.axis];
  const corner: Solid = {
    kind: 'prism',
    axis: j.wide,
    from: j.section.min[j.wide],
    to: j.section.max[j.wide],
    u: j.axis,
    v: j.thin,
    points: [
      [tip, outer],
      [j.face, outer],
      [j.face, inner],
    ],
  };
  return { cutA: [corner], cutB: [], addB: [corner] };
}

// ---------- Galleta ----------

/** Galletas estándar: número, largo y ancho en mm. */
export const BISCUITS: [number, number, number][] = [
  [0, 47, 15],
  [10, 53, 19],
  [20, 56, 23],
];

export interface BiscuitParams {
  /** Número de galleta: 0, 10 o 20. */
  size: number;
  count: number;
}

/** La galleta más grande que entra en el ancho, una cada 15 cm. */
export function defaultBiscuitParams(a: Box, b: Box): BiscuitParams | null {
  const j = endJoint(a, b);
  if (!j || thick(b, j) < 12 || boxSize(a)[j.axis] < 14) return null;
  const fits = BISCUITS.filter(([, len]) => len + 20 <= width(j));
  const best = fits[fits.length - 1];
  if (!best) return null;
  return { size: best[0], count: clamp(Math.round(width(j) / 150), 1, 6) };
}

/** Ranuras de 4 mm, 6 mm más largas que la galleta y la mitad de su ancho (más 1 mm) en cada pieza. */
export function biscuitGeometry(a: Box, b: Box, p: BiscuitParams): JointGeometry | null {
  const j = endJoint(a, b);
  const spec = BISCUITS.find(([n]) => n === p.size) ?? BISCUITS[BISCUITS.length - 1]!;
  if (!j || p.count < 1) return null;
  const [, len, wide] = spec;
  const mid = (j.section.min[j.thin] + j.section.max[j.thin]) / 2;
  const depth = wide / 2 + 1;
  const cutA: Solid[] = [];
  const cutB: Solid[] = [];
  for (let i = 0; i < p.count; i++) {
    const c = j.section.min[j.wide] + (width(j) * (i + 0.5)) / p.count;
    const s = band(j, mid - 2, mid + 2);
    s.min[j.wide] = c - (len + 6) / 2;
    s.max[j.wide] = c + (len + 6) / 2;
    cutA.push(box(slab(j, depth, s)));
    const back = slab(j, depth, s);
    back.min[j.axis] = j.dir === 1 ? j.face - depth : j.face;
    back.max[j.axis] = j.dir === 1 ? j.face : j.face + depth;
    cutB.push(box(back));
  }
  return { cutA, cutB, addB: [] };
}

// ---------- Machimbre ----------

export interface TongueParams {
  /** Espesor de la lengüeta. */
  thickness: number;
  depth: number;
}

/** Machimbre: tablas de espesor parecido unidas canto con canto. */
export function defaultTongueParams(a: Box, b: Box): TongueParams | null {
  const j = endJoint(a, b);
  if (!j || thick(b, j) < 9 || width(j) < 50) return null;
  const ta = boxSize(a)[j.thin];
  if (ta > thick(b, j) * 1.6 || ta < thick(b, j) * 0.6) return null;
  return { thickness: half(thick(b, j) / 3), depth: half(clamp(thick(b, j) / 2, 5, 12)) };
}

/** Lengüeta centrada en B y canal en A, 1 mm más hondo. */
export function tongueGeometry(a: Box, b: Box, p: TongueParams): JointGeometry | null {
  const j = endJoint(a, b);
  if (!j) return null;
  const mid = (j.section.min[j.thin] + j.section.max[j.thin]) / 2;
  const s = band(j, mid - p.thickness / 2, mid + p.thickness / 2);
  return { cutA: [box(slab(j, p.depth + 1, s))], cutB: [], addB: [box(slab(j, p.depth, s))] };
}

// ---------- Tornillo de bolsillo ----------

export interface PocketParams {
  count: number;
}

/** Bolsillos a 15°: uno cada 12 cm, en maderas de 12 mm o más. */
export function defaultPocketParams(a: Box, b: Box): PocketParams | null {
  const j = endJoint(a, b);
  if (!j || thick(b, j) < 12 || boxSize(b)[j.axis] < 60 || width(j) < 25) return null;
  return { count: clamp(Math.round(width(j) / 120), 1, 6) };
}

const POCKET_ANGLE = (15 * Math.PI) / 180;

/**
 * Agujero escalonado en B, inclinado 15°: avellanado de 9,5 mm desde la cara de adentro y guía de 4 mm
 * que sale al centro de la punta. El tornillo se abre camino solo en A, así que A no lleva cortes.
 */
export function pocketGeometry(a: Box, b: Box, p: PocketParams): JointGeometry | null {
  const j = endJoint(a, b);
  if (!j || p.count < 1) return null;
  // La cara de los bolsillos es la que mira al centro de A: queda adentro del mueble.
  const midB = (b.min[j.thin] + b.max[j.thin]) / 2;
  const fromMin = (a.min[j.thin] + a.max[j.thin]) / 2 >= midB;
  const entry = fromMin ? b.max[j.thin] : b.min[j.thin];
  const sign = fromMin ? -1 : 1;
  const dir: Vec3 = [0, 0, 0];
  dir[j.axis] = j.dir * Math.cos(POCKET_ANGLE);
  dir[j.thin] = sign * Math.sin(POCKET_ANGLE);
  const run = Math.abs(midB - entry) / Math.sin(POCKET_ANGLE);
  const cutB: Solid[] = [];
  for (let i = 0; i < p.count; i++) {
    const exit: Vec3 = [0, 0, 0];
    exit[j.axis] = j.face;
    exit[j.thin] = midB;
    exit[j.wide] = j.section.min[j.wide] + (width(j) * (i + 0.5)) / p.count;
    const at = (t: number) => exit.map((v, k) => v - dir[k]! * t) as Vec3;
    const counterbore = Math.max(4, run - 14);
    cutB.push({ kind: 'bore', start: at(run + 8), dir, radius: 4.75, length: 8 + counterbore });
    cutB.push({ kind: 'bore', start: at(run - counterbore + 0.5), dir, radius: 2, length: run - counterbore + 0.5 });
  }
  return { cutA: [], cutB, addB: [] };
}

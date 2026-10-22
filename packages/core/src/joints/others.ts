import { boxSize, copyBox, overlapBox, type Axis, type Box, type Vec3 } from '../geometry';
import { box, endJoint, half, slab, type EndJoint, type JointGeometry, type Solid } from './common';

/** Canal (ranura): B entra entera en una ranura de A, de un tercio del espesor de A. */
export function defaultGrooveParams(a: Box, b: Box): { depth: number } | null {
  const j = endJoint(a, b);
  return j && { depth: half(Math.min(12, boxSize(a)[j.axis] / 3)) };
}

export function grooveGeometry(a: Box, b: Box, p: { depth: number }): JointGeometry | null {
  const j = endJoint(a, b);
  if (!j) return null;
  const g = slab(j, p.depth);
  return { cutA: [box(g)], cutB: [], addB: [box(g)] };
}

/** Lado del canto de A más cercano a B sobre el eje del espesor de B, y cuánto queda hasta él. */
export function nearestEdge(a: Box, j: EndJoint): { side: 'min' | 'max'; gap: number } {
  const toMin = j.section.min[j.thin] - a.min[j.thin];
  const toMax = a.max[j.thin] - j.section.max[j.thin];
  return toMin <= toMax ? { side: 'min', gap: toMin } : { side: 'max', gap: toMax };
}

/**
 * Rebaje: como el canal, pero abierto hacia el canto de A. Solo si B llega al canto o queda apenas adentro (un fondo
 * retirado unos milímetros): más adentro, el rebaje dejaría un escalón vacío a la vista y va un canal.
 */
export function rabbetFits(a: Box, b: Box): boolean {
  const j = endJoint(a, b);
  return !!j && nearestEdge(a, j).gap <= boxSize(b)[j.thin] / 2;
}

export const defaultRabbetParams = defaultGrooveParams;

export function rabbetGeometry(a: Box, b: Box, p: { depth: number }): JointGeometry | null {
  const j = endJoint(a, b);
  if (!j || !rabbetFits(a, b)) return null;
  const tongue = slab(j, p.depth);
  const cut = copyBox(tongue);
  const edge = nearestEdge(a, j);
  if (edge.side === 'min') cut.min[j.thin] = a.min[j.thin];
  else cut.max[j.thin] = a.max[j.thin];
  return { cutA: [box(cut)], cutB: [], addB: [box(tongue)] };
}

/** Eje en que dos piezas cruzadas se apilan: el de menor solape. */
function lapAxis(o: Box): Axis {
  const s = boxSize(o);
  return s[0] <= s[1] && s[0] <= s[2] ? 0 : s[1] <= s[2] ? 1 : 2;
}

/** Media madera: cada pieza pierde la parte del cruce que ocupa la otra. `ratio` es lo que pierde A. */
export function lapGeometry(a: Box, b: Box, p: { ratio: number }): JointGeometry | null {
  const o = overlapBox(a, b);
  if (!o) return null;
  const axis = lapAxis(o);
  const split = o.max[axis] - boxSize(o)[axis] * p.ratio;
  const cutA = copyBox(o);
  cutA.min[axis] = split;
  const cutB = copyBox(o);
  cutB.max[axis] = split;
  return { cutA: [box(cutA)], cutB: [box(cutB)], addB: [] };
}

export interface DowelParams {
  diameter: number;
  count: number;
  /** Profundidad del agujero en A. */
  depthA: number;
  /** Profundidad del agujero en B. */
  depthB: number;
}

const DOWELS = [6, 8, 10, 12];

/** Tarugos estándar: diámetro cerca de 2/5 del espesor de B, uno cada 5 cm de ancho. */
export function defaultDowelParams(a: Box, b: Box): DowelParams | null {
  const j = endJoint(a, b);
  if (!j) return null;
  const sb = boxSize(b);
  const target = sb[j.thin] / 2.5;
  const diameter = DOWELS.reduce((best, d) => (Math.abs(d - target) < Math.abs(best - target) ? d : best));
  const wide = j.section.max[j.wide] - j.section.min[j.wide];
  return {
    diameter,
    count: Math.min(8, Math.max(1, Math.round(wide / 50))),
    depthA: half(Math.min(30, boxSize(a)[j.axis] * 0.6)),
    depthB: half(Math.min(30, sb[j.axis] * 0.4)),
  };
}

/** Agujeros para tarugos en las dos piezas, repartidos a lo ancho de B (1 mm extra para la cola). */
export function dowelGeometry(a: Box, b: Box, p: DowelParams): JointGeometry | null {
  const j = endJoint(a, b);
  if (!j) return null;
  const { section: s } = j;
  const mid = (s.min[j.thin] + s.max[j.thin]) / 2;
  const width = s.max[j.wide] - s.min[j.wide];
  const cutA: Solid[] = [];
  const cutB: Solid[] = [];
  for (let i = 0; i < p.count; i++) {
    const start: Vec3 = [0, 0, 0];
    start[j.axis] = j.face;
    start[j.thin] = mid;
    start[j.wide] = s.min[j.wide] + (width * (i + 0.5)) / p.count;
    const r = p.diameter / 2;
    cutA.push({ kind: 'cylinder', start, axis: j.axis, dir: j.dir, radius: r, length: p.depthA + 1 });
    cutB.push({ kind: 'cylinder', start, axis: j.axis, dir: j.dir === 1 ? -1 : 1, radius: r, length: p.depthB + 1 });
  }
  return { cutA, cutB, addB: [] };
}

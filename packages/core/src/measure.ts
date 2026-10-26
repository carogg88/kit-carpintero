import { otherAxes, type Axis, type Box, type Vec3 } from './geometry';

/**
 * Medir entre piezas: cuánto las separa sobre cada eje, cuánto le sobra a cada lado a una pieza que queda adentro
 * de otra (o del mueble) y cuánto correrla para que quede al medio. Todo en mm, con cajas alineadas a los ejes.
 */

/** Diferencia que todavía se considera centrada. */
export const CENTER_TOL = 0.5;

export type AxisRelation =
  /** No se cruzan sobre el eje: `gap` es el aire entre las dos (0 si se tocan); `aFirst`, si A queda del lado del mínimo. */
  | { kind: 'gap'; gap: number; aFirst: boolean }
  /** A queda adentro de B: lo que sobra antes (del lado del mínimo) y después. */
  | { kind: 'inside'; before: number; after: number }
  /** B queda adentro de A. */
  | { kind: 'around'; before: number; after: number }
  /** Se meten una en otra en parte: cuánto. */
  | { kind: 'cross'; overlap: number };

export function axisRelation(a: Box, b: Box, k: Axis): AxisRelation {
  if (a.max[k] <= b.min[k] + 0.01) return { kind: 'gap', gap: Math.max(0, b.min[k] - a.max[k]), aFirst: true };
  if (b.max[k] <= a.min[k] + 0.01) return { kind: 'gap', gap: Math.max(0, a.min[k] - b.max[k]), aFirst: false };
  if (a.min[k] >= b.min[k] - 0.01 && a.max[k] <= b.max[k] + 0.01) return { kind: 'inside', before: a.min[k] - b.min[k], after: b.max[k] - a.max[k] };
  if (b.min[k] >= a.min[k] - 0.01 && b.max[k] <= a.max[k] + 0.01) return { kind: 'around', before: b.min[k] - a.min[k], after: a.max[k] - b.max[k] };
  return { kind: 'cross', overlap: Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) };
}

export const isCentered = (r: AxisRelation) => (r.kind === 'inside' || r.kind === 'around') && Math.abs(r.before - r.after) <= CENTER_TOL;

/** Cuánto correr A sobre el eje para que quede al medio de B (o B al medio de A); null si no se puede. */
export function centerShift(r: AxisRelation): number | null {
  if (r.kind === 'inside') return (r.after - r.before) / 2;
  if (r.kind === 'around') return (r.before - r.after) / 2;
  return null;
}

/** Distancia entre dos caras paralelas (el mismo eje), o null si no lo son. */
export function faceDistance(a: Box, fa: { axis: Axis; side: 1 | -1 }, b: Box, fb: { axis: Axis; side: 1 | -1 }): number | null {
  if (fa.axis !== fb.axis) return null;
  const plane = (x: Box, side: 1 | -1) => (side > 0 ? x.max[fa.axis] : x.min[fa.axis]);
  return Math.abs(plane(a, fa.side) - plane(b, fb.side));
}

/** Una cota para dibujar: de un punto a otro sobre un eje. */
export interface Dimension {
  axis: Axis;
  from: Vec3;
  to: Vec3;
}

/** Las cotas entre A y B: el aire que las separa y, si una queda adentro de la otra, lo que sobra a cada lado. */
export function dimensions(a: Box, b: Box): Dimension[] {
  const out: Dimension[] = [];
  for (const k of [0, 1, 2] as Axis[]) {
    const r = axisRelation(a, b, k);
    // Sobre los otros dos ejes, por el medio de lo que comparten; si no comparten nada, por el medio de A.
    const at = [0, 0, 0] as Vec3;
    for (const j of otherAxes(k)) {
      const lo = Math.max(a.min[j], b.min[j]);
      const hi = Math.min(a.max[j], b.max[j]);
      at[j] = hi > lo ? (lo + hi) / 2 : (a.min[j] + a.max[j]) / 2;
    }
    const seg = (x: number, y: number) => {
      if (Math.abs(y - x) <= CENTER_TOL) return;
      const from = [...at] as Vec3;
      const to = [...at] as Vec3;
      from[k] = x;
      to[k] = y;
      out.push({ axis: k, from, to });
    };
    if (r.kind === 'gap') seg(r.aFirst ? a.max[k] : b.max[k], r.aFirst ? b.min[k] : a.min[k]);
    else if (r.kind === 'inside') {
      seg(b.min[k], a.min[k]);
      seg(a.max[k], b.max[k]);
    } else if (r.kind === 'around') {
      seg(a.min[k], b.min[k]);
      seg(b.max[k], a.max[k]);
    }
  }
  return out;
}

/** La pieza más cercana de cada lado sobre un eje, entre las que quedan enfrentadas (se cruzan en los otros dos). */
export interface Neighbor {
  id: string;
  gap: number;
}

export function neighbors(moving: Box, others: readonly { id: string; box: Box }[], k: Axis): { before: Neighbor | null; after: Neighbor | null } {
  let before: Neighbor | null = null;
  let after: Neighbor | null = null;
  for (const o of others) {
    const facing = otherAxes(k).every((j) => Math.min(moving.max[j], o.box.max[j]) - Math.max(moving.min[j], o.box.min[j]) > 0.5);
    if (!facing) continue;
    const down = moving.min[k] - o.box.max[k];
    const up = o.box.min[k] - moving.max[k];
    if (down >= -0.01 && (!before || down < before.gap)) before = { id: o.id, gap: Math.max(0, down) };
    if (up >= -0.01 && (!after || up < after.gap)) after = { id: o.id, gap: Math.max(0, up) };
  }
  return { before, after };
}

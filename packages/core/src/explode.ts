import { partBox, type Axis, type Box } from './geometry';
import { placedBox } from './follow';
import { leanFrame } from './lean';
import type { Joint, Project } from './project';

/**
 * Despiece de una unión: hacia dónde y cuánto separar la pieza que entra (`b`) de la que la recibe (`a`) para ver
 * la espiga afuera y la caja vacía. Sale por el eje en que `b` más sobresale de `a`, hacia ese lado, lo que tiene
 * metido más un poco de aire.
 */
export interface Explode {
  axis: Axis;
  sign: 1 | -1;
  /** Milímetros que se corre `b`. */
  distance: number;
  /** El corrimiento como vector, listo para sumar a la posición. */
  offset: [number, number, number];
}

/** Aire entre las dos piezas separadas, además de lo que estaba metido. */
const AIR = 40;

export function explodeJoint(a: Box, b: Box): Explode {
  let best = { axis: 0 as Axis, sign: 1 as 1 | -1, out: -1 };
  for (const k of [0, 1, 2] as Axis[]) {
    const below = Math.max(0, a.min[k] - b.min[k]);
    const above = Math.max(0, b.max[k] - a.max[k]);
    const out = Math.max(below, above);
    if (out > best.out + 0.01) best = { axis: k, sign: above >= below ? 1 : -1, out };
  }
  const { axis, sign } = best;
  // Lo metido sobre ese eje: la espiga, el dado o nada (una unión a tope).
  const inside = Math.max(0, Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]));
  const distance = Math.round(inside + AIR);
  const offset: [number, number, number] = [0, 0, 0];
  offset[axis] = sign * distance;
  return { axis, sign, distance, offset };
}

/**
 * La unión como queda armada: las cajas donde están de verdad las dos piezas (inclinadas, o siguiendo a una
 * inclinada) y el despiece. Una pieza inclinada que entra sale a lo largo de ella misma, como se la saca de la caja.
 */
export function placedJoint(project: Pick<Project, 'parts' | 'joints'>, joint: Joint): { a: Box; b: Box; explode: Explode } | null {
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  if (!a || !b) return null;
  const explode = explodeJoint(partBox(a), partBox(b));
  const f = leanFrame(b);
  if (f) {
    // Hacia el mismo lado que saldría derecha: hacia abajo una pata, hacia arriba un parante.
    const s = f.dir[explode.axis] * explode.sign >= 0 ? 1 : -1;
    explode.offset = f.dir.map((v) => Math.round(v * s * explode.distance) + 0) as [number, number, number];
  }
  return { a: placedBox(project, a), b: placedBox(project, b), explode };
}

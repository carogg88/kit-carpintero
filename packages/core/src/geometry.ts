/** Caja alineada a los ejes, en mm. X ancho, Y alto, Z fondo. */
export type Vec3 = [number, number, number];
export interface Box {
  min: Vec3;
  max: Vec3;
}

export function boxSize(b: Box): Vec3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

/**
 * Si `b` toca a `a` con una de sus puntas (una cara de `b` apoyada sobre una cara de `a`),
 * devuelve el eje y el sentido hacia `a`. Sirve para encastres de punta contra cara.
 */
export function endContact(a: Box, b: Box, tol = 0.6): { axis: 0 | 1 | 2; dir: 1 | -1 } | null {
  for (const axis of [0, 1, 2] as const) {
    const others = ([0, 1, 2] as const).filter((k) => k !== axis);
    const overlaps = others.every((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 5);
    if (!overlaps) continue;
    if (Math.abs(b.max[axis] - a.min[axis]) <= tol) return { axis, dir: 1 };
    if (Math.abs(b.min[axis] - a.max[axis]) <= tol) return { axis, dir: -1 };
  }
  return null;
}

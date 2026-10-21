import type { Part, Project } from './project';
import { t } from './i18n';

/** Caja alineada a los ejes, en mm. X ancho, Y alto, Z fondo. */
export type Vec3 = [number, number, number];
export type Axis = 0 | 1 | 2;
export interface Box {
  min: Vec3;
  max: Vec3;
}

export function boxSize(b: Box): Vec3 {
  return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

export function copyBox(b: Box): Box {
  return { min: [...b.min], max: [...b.max] };
}

/** Los otros dos ejes, en orden. */
export function otherAxes(axis: Axis): [Axis, Axis] {
  return axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
}

/** Volumen que comparten dos cajas, o null si no se meten una en la otra. */
export function overlapBox(a: Box, b: Box, tol = 0.01): Box | null {
  const o: Box = {
    min: [Math.max(a.min[0], b.min[0]), Math.max(a.min[1], b.min[1]), Math.max(a.min[2], b.min[2])],
    max: [Math.min(a.max[0], b.max[0]), Math.min(a.max[1], b.max[1]), Math.min(a.max[2], b.max[2])],
  };
  return boxSize(o).every((s) => s > tol) ? o : null;
}

/**
 * Si `b` toca a `a` con una de sus puntas (una cara de `b` apoyada sobre una cara de `a`),
 * devuelve el eje y el sentido hacia `a`. Sirve para encastres de punta contra cara.
 */
export function endContact(a: Box, b: Box, tol = 0.6): { axis: Axis; dir: 1 | -1 } | null {
  for (const axis of [0, 1, 2] as const) {
    const overlaps = otherAxes(axis).every((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 5);
    if (!overlaps) continue;
    if (Math.abs(b.max[axis] - a.min[axis]) <= tol) return { axis, dir: 1 };
    if (Math.abs(b.min[axis] - a.max[axis]) <= tol) return { axis, dir: -1 };
  }
  return null;
}

/** Caja de una pieza sin rotar. */
export function partBox(p: Part): Box {
  if (p.base.kind !== 'box') throw new Error(t('La pieza {id} no es una caja', { id: p.id }));
  const [x, y, z] = p.position;
  const [w, h, d] = p.base.size;
  return { min: [x, y, z], max: [x + w, y + h, z + d] };
}

/**
 * Lo que define la forma exacta de una pieza: su receta y los encastres que la tocan, con las cajas
 * de las piezas vecinas. Si no cambia, el motor no tiene que volver a armarla.
 */
export function partKey(project: Project, id: string): string {
  const part = project.parts.find((p) => p.id === id);
  if (!part) return '';
  const joints = project.joints
    .filter((j) => j.partA === id || j.partB === id)
    .map((j) => {
      const other = project.parts.find((p) => p.id === (j.partA === id ? j.partB : j.partA));
      return [j.type, j.partA, j.partB, j.params, other && other.base.kind === 'box' ? partBox(other) : null];
    });
  return JSON.stringify([part.base, part.position, part.rotation, part.ops, part.pockets, part.bevels, part.sections, part.turning ?? null, joints]);
}

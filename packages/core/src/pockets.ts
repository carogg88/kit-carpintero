import { boxSize, otherAxes, partBox, type Axis, type Vec3 } from './geometry';
import type { Solid } from './joints';
import type { Part, Pocket, PocketShape } from './project';

/** Nombre de cada cara, por eje y lado. */
export function faceName(axis: Axis, side: 1 | -1): string {
  return [
    ['cara izquierda', 'cara derecha'],
    ['cara de abajo', 'cara de arriba'],
    ['cara de atrás', 'frente'],
  ][axis]![side > 0 ? 1 : 0]!;
}

/** Desde dónde se mide sobre cada eje: la esquina mínima de la pieza. */
export const MEASURED_FROM = ['la izquierda', 'abajo', 'atrás'] as const;

/** Medidas de la cara: los dos ejes que la forman y cuánto mide sobre cada uno. */
export function faceSize(part: Part, axis: Axis): { axes: [Axis, Axis]; size: [number, number] } {
  const s = boxSize(partBox(part));
  const axes = otherAxes(axis);
  return { axes, size: [s[axes[0]], s[axes[1]]] };
}

/** Espesor de la pieza bajo la cara. */
export const depthUnder = (part: Part, axis: Axis) => boxSize(partBox(part))[axis];

/** Primer id libre para un vaciado de la pieza: V1, V2… */
export function nextPocketId(part: Part): string {
  const used = new Set(part.pockets.map((p) => p.id));
  let n = 1;
  while (used.has(`V${n}`)) n++;
  return `V${n}`;
}

const half = (mm: number) => Math.round(mm * 2) / 2;

/**
 * Vaciado nuevo: los círculos atraviesan la pieza (pasacables, calados) y los rectángulos bajan hasta
 * la mitad del espesor, que es lo que se hace con la fresadora.
 */
export function newPocket(part: Part, axis: Axis, side: 1 | -1, shape: PocketShape): Pocket {
  const through = shape.kind === 'circle';
  return { id: nextPocketId(part), axis, side, shape, depth: half(depthUnder(part, axis) / 2), through };
}

/** Lo que el vaciado saca de la pieza, en coordenadas del mueble. Sale 1 mm por la cara para cortar limpio. */
export function pocketSolid(part: Part, p: Pocket): Solid {
  const box = partBox(part);
  const [ua, va] = otherAxes(p.axis);
  const face = p.side > 0 ? box.max[p.axis] : box.min[p.axis];
  const depth = p.through ? box.max[p.axis] - box.min[p.axis] + 1 : p.depth;
  const inner = face - p.side * depth;
  const outer = face + p.side;
  if (p.shape.kind === 'circle') {
    const start: Vec3 = [0, 0, 0];
    start[p.axis] = outer;
    start[ua] = box.min[ua] + p.shape.u;
    start[va] = box.min[va] + p.shape.v;
    return { kind: 'cylinder', start, axis: p.axis, dir: p.side > 0 ? -1 : 1, radius: p.shape.d / 2, length: Math.abs(outer - inner) };
  }
  const min: Vec3 = [0, 0, 0];
  const max: Vec3 = [0, 0, 0];
  min[p.axis] = Math.min(inner, outer);
  max[p.axis] = Math.max(inner, outer);
  min[ua] = box.min[ua] + p.shape.u;
  max[ua] = min[ua] + p.shape.w;
  min[va] = box.min[va] + p.shape.v;
  max[va] = min[va] + p.shape.h;
  return { kind: 'box', box: { min, max } };
}

/** En palabras de taller: "calado Ø 35 mm en la cara de arriba". */
export function describePocket(p: Pocket, n: (mm: number) => string): string {
  const what = p.through ? 'calado' : 'vaciado';
  const size = p.shape.kind === 'circle' ? `Ø ${n(p.shape.d)}` : `${n(p.shape.w)} × ${n(p.shape.h)}`;
  const deep = p.through ? '' : `, ${n(p.depth)} de hondo`;
  return `${what} ${size}${deep} en la ${faceName(p.axis, p.side)}`.replace('en la frente', 'en el frente');
}

/** Ajusta un punto de la cara a los bordes, al centro o a la grilla de 5 mm. `tol` en mm. */
export function snapOnFace(raw: number, size: number, tol: number): { value: number; to: 'borde' | 'centro' | null } {
  const value = Math.min(size, Math.max(0, raw));
  for (const [at, to] of [
    [0, 'borde'],
    [size, 'borde'],
    [size / 2, 'centro'],
  ] as const) {
    if (Math.abs(value - at) <= tol) return { value: at, to };
  }
  return { value: Math.min(size, Math.max(0, Math.round(value / 5) * 5)), to: null };
}

import { boxSize, otherAxes, partBox, type Axis, type Vec3 } from './geometry';
import { circleThrough, type Solid } from './joints';
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

type ArcShape = Extract<PocketShape, { kind: 'arc' }>;

/** Medidas de un arco: largo de la cuerda, radio, punto medio del arco y centro. */
export function arcInfo(s: ArcShape): { chord: number; radius: number; mid: [number, number]; center: [number, number] } {
  const du = s.u2 - s.u;
  const dv = s.v2 - s.v;
  const chord = Math.hypot(du, dv);
  // Normal a la izquierda de la cuerda: hacia ahí va una flecha positiva.
  const mid: [number, number] = [(s.u + s.u2) / 2 - (dv / chord) * s.bulge, (s.v + s.v2) / 2 + (du / chord) * s.bulge];
  const h = Math.abs(s.bulge);
  const radius = (chord * chord) / (8 * h) + h / 2;
  const c = circleThrough([s.u, s.v], mid, [s.u2, s.v2]);
  return { chord, radius, mid, center: c?.center ?? mid };
}

/**
 * Qué lado del arco se saca si nadie lo eligió: si el centro del círculo cae dentro de la cara, el arco
 * redondea una esquina y se saca lo de afuera; si no (un faldón arqueado), el segmento.
 */
export function arcOutsideByDefault(part: Part, axis: Axis, s: ArcShape): boolean {
  const { size } = faceSize(part, axis);
  const { center } = arcInfo(s);
  return center[0] > 0.5 && center[0] < size[0] - 0.5 && center[1] > 0.5 && center[1] < size[1] - 0.5;
}

/**
 * Vaciado nuevo: los círculos atraviesan la pieza (pasacables, calados) y los rectángulos bajan hasta
 * la mitad del espesor, que es lo que se hace con la fresadora.
 */
export function newPocket(part: Part, axis: Axis, side: 1 | -1, shape: PocketShape): Pocket {
  const through = shape.kind !== 'rect';
  const s = shape.kind === 'arc' ? { ...shape, outside: arcOutsideByDefault(part, axis, shape) } : shape;
  return { id: nextPocketId(part), axis, side, shape: s, depth: half(depthUnder(part, axis) / 2), through };
}

/** Lo que el vaciado saca de la pieza, en coordenadas del mueble. Sale 1 mm por la cara para cortar limpio. */
export function pocketSolid(part: Part, p: Pocket): Solid {
  const box = partBox(part);
  const [ua, va] = otherAxes(p.axis);
  const face = p.side > 0 ? box.max[p.axis] : box.min[p.axis];
  const depth = p.through ? box.max[p.axis] - box.min[p.axis] + 1 : p.depth;
  const inner = face - p.side * depth;
  const outer = face + p.side;
  if (p.shape.kind === 'arc') {
    const sh = p.shape;
    const { mid } = arcInfo(sh);
    const at = (pt: readonly [number, number]): [number, number] => [box.min[ua] + pt[0], box.min[va] + pt[1]];
    const a = at([sh.u, sh.v]);
    const b = at([sh.u2, sh.v2]);
    let rest: [number, number][] = [];
    if (sh.outside) {
      // Más allá del arco: se cierra con dos puntos lejos de la cuerda, del lado de la flecha.
      const { chord } = arcInfo(sh);
      const k = Math.hypot(box.max[ua] - box.min[ua], box.max[va] - box.min[va]) + 10;
      const n: [number, number] = [(-(sh.v2 - sh.v) / chord) * Math.sign(sh.bulge), ((sh.u2 - sh.u) / chord) * Math.sign(sh.bulge)];
      rest = [
        [b[0] + n[0] * k, b[1] + n[1] * k],
        [a[0] + n[0] * k, a[1] + n[1] * k],
      ];
    }
    return { kind: 'arc', axis: p.axis, from: Math.min(inner, outer), to: Math.max(inner, outer), u: ua, v: va, a, mid: at(mid), b, rest };
  }
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
  if (p.shape.kind === 'arc') {
    const { radius } = arcInfo(p.shape);
    const deep = p.through ? '' : `, ${n(p.depth)} de hondo`;
    const where = `en la ${faceName(p.axis, p.side)}`.replace('en la frente', 'en el frente');
    return `${p.through ? 'corte' : 'rebaje'} en arco R ${n(radius)}, flecha ${n(Math.abs(p.shape.bulge))}${deep} ${where}`;
  }
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

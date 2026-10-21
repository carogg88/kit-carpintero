import { boxSize, otherAxes, partBox, type Axis, type Vec3 } from './geometry';
import { arcPoints, circleThrough, type Solid } from './joints';
import type { Part, Pocket, PocketShape } from './project';
import { t, tk } from './i18n';

const FACE_NAMES = [
  [tk('cara izquierda'), tk('cara derecha')],
  [tk('cara de abajo'), tk('cara de arriba')],
  [tk('cara de atrás'), tk('frente')],
] as const;

/** Nombre de cada cara, por eje y lado, en el idioma actual. */
export function faceName(axis: Axis, side: 1 | -1): string {
  return t(FACE_NAMES[axis][side > 0 ? 1 : 0]);
}

const FACE_LABELS = [
  [tk('la cara izquierda'), tk('la cara derecha')],
  [tk('la cara de abajo'), tk('la cara de arriba')],
  [tk('la cara de atrás'), tk('el frente')],
] as const;

/** "la cara de arriba", "el frente": la cara con su artículo, en el idioma actual. */
export function faceLabelOf(axis: Axis, side: 1 | -1): string {
  return t(FACE_LABELS[axis][side > 0 ? 1 : 0]);
}

/** Desde dónde se mide sobre cada eje: la esquina mínima de la pieza. Se traduce al mostrarlo, con `t`. */
export const MEASURED_FROM = [tk('la izquierda'), tk('abajo'), tk('atrás')] as const;

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
 * Plantilla de un arco, acostada: la cuerda va de (0, 0) a (cuerda, 0) y el arco sube hasta la flecha.
 * Así se imprime a tamaño real y se apoya la cuerda sobre la línea trazada en la madera.
 */
export function arcTemplate(s: ArcShape, n = 240): { chord: number; sagitta: number; radius: number; points: [number, number][] } {
  const { chord, radius } = arcInfo(s);
  const sagitta = Math.abs(s.bulge);
  return { chord, sagitta, radius, points: arcPoints([0, 0], [chord / 2, sagitta], [chord, 0], n) };
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
  const face = faceLabelOf(p.axis, p.side);
  const depth = n(p.depth);
  if (p.shape.kind === 'arc') {
    const r = n(arcInfo(p.shape).radius);
    const s = n(Math.abs(p.shape.bulge));
    return p.through
      ? t('corte en arco R {r}, flecha {s} en {face}', { r, s, face })
      : t('rebaje en arco R {r}, flecha {s}, {depth} de hondo en {face}', { r, s, depth, face });
  }
  if (p.shape.kind === 'circle') {
    const d = n(p.shape.d);
    return p.through ? t('calado Ø {d} en {face}', { d, face }) : t('vaciado Ø {d}, {depth} de hondo en {face}', { d, depth, face });
  }
  const w = n(p.shape.w);
  const h = n(p.shape.h);
  return p.through ? t('calado {w} × {h} en {face}', { w, h, face }) : t('vaciado {w} × {h}, {depth} de hondo en {face}', { w, h, depth, face });
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

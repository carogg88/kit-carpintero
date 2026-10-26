import { boxSize, otherAxes, overlapBox, partBox, type Axis, type Vec3 } from './geometry';
import { arcPoints, circleThrough, type Solid } from './joints';
import type { Part, Pocket, PocketShape } from './project';
import { t, tk } from './i18n';
import { pathCurved, pathRegion } from './profile';

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

/** Un calado que tapa toda la cara atraviesa la pieza entera: no queda nada de ella. */
export function pocketTakesWholePart(part: Part, pocket: Pocket): boolean {
  if (!pocket.through) return false;
  const [w, h] = faceSize(part, pocket.axis).size;
  const s = pocket.shape;
  if (s.kind === 'rect') return s.u <= 0 && s.v <= 0 && s.u + s.w >= w && s.v + s.h >= h;
  if (s.kind === 'circle') {
    // Con cantos redondeados o con chaflán, las esquinas de la cara quedan adentro: un listón redondo cabe en su círculo.
    const op = part.ops[0];
    const r = op?.kind === 'round' ? Math.min(op.radius, w / 2, h / 2) : 0;
    const c = op?.kind === 'chamfer' ? Math.min(op.size, w / 2, h / 2) : 0;
    const far = ([x, y]: [number, number]) => {
      const sx = x === 0 ? 1 : -1;
      const sy = y === 0 ? 1 : -1;
      if (r) return Math.hypot(x + sx * r - s.u, y + sy * r - s.v) + r;
      if (c) return Math.max(Math.hypot(x + sx * c - s.u, y - s.v), Math.hypot(x - s.u, y + sy * c - s.v));
      return Math.hypot(x - s.u, y - s.v);
    };
    const corners: [number, number][] = [[0, 0], [w, 0], [0, h], [w, h]];
    return corners.every((p) => far(p) <= s.d / 2 + 0.01);
  }
  return false;
}

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
 * Qué lado del arco se saca si nadie lo eligió: si el centro del círculo cae dentro de la cara y el arco se
 * curva hacia el lado chico (la esquina), redondea esa esquina y se saca lo de afuera; si no (un faldón
 * arqueado, o una curva que se mete en la pieza), el segmento.
 */
export function arcOutsideByDefault(part: Part, axis: Axis, s: ArcShape): boolean {
  const { size } = faceSize(part, axis);
  const { center } = arcInfo(s);
  if (!(center[0] > 0.5 && center[0] < size[0] - 0.5 && center[1] > 0.5 && center[1] < size[1] - 0.5)) return false;
  return area(beyondChord(s, size)) < (size[0] * size[1]) / 2;
}

const area = (pts: [number, number][]) => Math.abs(pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * p[1], 0)) / 2;

/** La parte de la cara del lado hacia donde se curva el arco, más allá de la cuerda. */
function beyondChord(s: ArcShape, size: [number, number]): [number, number][] {
  const chord = Math.hypot(s.u2 - s.u, s.v2 - s.v);
  const k = Math.hypot(size[0], size[1]) + 10;
  const n: [number, number] = [(-(s.v2 - s.v) / chord) * Math.sign(s.bulge), ((s.u2 - s.u) / chord) * Math.sign(s.bulge)];
  // La cuerda estirada de punta a punta de la cara, y de ahí lejos hacia la flecha.
  const d: [number, number] = [((s.u2 - s.u) / chord) * k, ((s.v2 - s.v) / chord) * k];
  const a: [number, number] = [s.u - d[0], s.v - d[1]];
  const b: [number, number] = [s.u2 + d[0], s.v2 + d[1]];
  return clipToFace([a, b, [b[0] + n[0] * k, b[1] + n[1] * k], [a[0] + n[0] * k, a[1] + n[1] * k]], size[0], size[1]);
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

/** Recorta un polígono con el rectángulo de la cara (0..w, 0..h). */
export function clipToFace(poly: [number, number][], w: number, h: number): [number, number][] {
  const edges: [(p: [number, number]) => number][] = [[(p) => p[0]], [(p) => w - p[0]], [(p) => p[1]], [(p) => h - p[1]]];
  let out = poly;
  for (const [inside] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const p = src[i]!;
      const q = src[(i + 1) % src.length]!;
      const [dp, dq] = [inside(p), inside(q)];
      if (dp >= 0) out.push(p);
      if (dp >= 0 !== dq >= 0) {
        const k = dp / (dp - dq);
        out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    }
  }
  return out;
}

/** El arco empieza o termina en un borde de la cara: le da forma a ese borde o redondea una esquina. */
export function arcTouchesEdge(part: Part, axis: Axis, s: ArcShape, tol = 1): boolean {
  const { size } = faceSize(part, axis);
  const onEdge = (u: number, v: number) => Math.min(u, size[0] - u, v, size[1] - v) <= tol;
  return onEdge(s.u, s.v) || onEdge(s.u2, s.v2);
}

/**
 * Lo que se va a sacar de la cara, como polígono en coordenadas de la cara: sirve para verlo sombreado
 * antes de soltar. Un arco que redondea saca todo lo que queda más allá de la curva, hasta el borde.
 * `outside`: de qué lado del arco; si no se dice, el que elegiría un vaciado nuevo.
 */
export function pocketRegion(part: Part, axis: Axis, shape: PocketShape, outside?: boolean): [number, number][] {
  const { size } = faceSize(part, axis);
  if (shape.kind === 'rect') {
    const { u, v, w, h } = shape;
    return clipToFace(
      [
        [u, v],
        [u + w, v],
        [u + w, v + h],
        [u, v + h],
      ],
      size[0],
      size[1],
    );
  }
  if (shape.kind === 'circle') {
    const r = shape.d / 2;
    const pts = Array.from({ length: 48 }, (_, i): [number, number] => [
      shape.u + r * Math.cos((i / 48) * 2 * Math.PI),
      shape.v + r * Math.sin((i / 48) * 2 * Math.PI),
    ]);
    return clipToFace(pts, size[0], size[1]);
  }
  if (shape.kind === 'path') return clipToFace(pathRegion(shape, size[0], size[1]), size[0], size[1]);
  if (shape.bulge === 0) return [];
  const { mid, chord } = arcInfo(shape);
  const arc = arcPoints([shape.u, shape.v], mid, [shape.u2, shape.v2], 48);
  if (!(outside ?? arcOutsideByDefault(part, axis, shape))) return clipToFace(arc, size[0], size[1]);
  const k = Math.hypot(size[0], size[1]) + 10;
  const n: [number, number] = [(-(shape.v2 - shape.v) / chord) * Math.sign(shape.bulge), ((shape.u2 - shape.u) / chord) * Math.sign(shape.bulge)];
  const b = arc[arc.length - 1]!;
  const a = arc[0]!;
  return clipToFace([...arc, [b[0] + n[0] * k, b[1] + n[1] * k], [a[0] + n[0] * k, a[1] + n[1] * k]], size[0], size[1]);
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
  if (p.shape.kind === 'path') {
    const region = pocketRegion(part, p.axis, p.shape);
    const points = region.map(([u, v]): [number, number] => [box.min[ua] + u, box.min[va] + v]);
    // Lo que va de borde a borde se estira 1 mm afuera de la pieza, para que el corte no deje una lámina en el canto.
    const [w, h] = [box.max[ua] - box.min[ua], box.max[va] - box.min[va]];
    const grow = (x: number, lo: number, len: number) => (Math.abs(x - lo) < 0.01 ? x - 1 : Math.abs(x - lo - len) < 0.01 ? x + 1 : x);
    const out = points.map(([u, v]): [number, number] => [grow(u, box.min[ua], w), grow(v, box.min[va], h)]);
    return { kind: 'prism', axis: p.axis, from: Math.min(inner, outer), to: Math.max(inner, outer), u: ua, v: va, points: out };
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

/** Si el punto (en coordenadas del mueble) cae en lo que saca el vaciado. */
export function pointInPocket(part: Part, p: Pocket, pt: Vec3): boolean {
  const box = partBox(part);
  const face = p.side > 0 ? box.max[p.axis] : box.min[p.axis];
  const into = (face - pt[p.axis]) * p.side;
  const depth = p.through ? box.max[p.axis] - box.min[p.axis] : p.depth;
  if (into < 0 || into > depth) return false;
  const [ua, va] = otherAxes(p.axis);
  const poly = pocketRegion(part, p.axis, p.shape, p.shape.kind === 'arc' ? p.shape.outside : undefined);
  const [x, y] = [pt[ua] - box.min[ua], pt[va] - box.min[va]];
  let inside = false;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const [xi, yi] = poly[i]!;
    const [xk, yk] = poly[k]!;
    if (yi > y !== yk > y && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Dos piezas que se cruzan donde una ya tiene una muesca dibujada (un listón apoyado en el calado de un faldón):
 * la muesca hace de encastre, no hace falta rebajar a media madera.
 */
export function crossingInNotch(a: Part, b: Part): boolean {
  if (a.base.kind !== 'box' || b.base.kind !== 'box') return false;
  const o = overlapBox(partBox(a), partBox(b));
  if (!o) return false;
  const c: Vec3 = [(o.min[0] + o.max[0]) / 2, (o.min[1] + o.max[1]) / 2, (o.min[2] + o.max[2]) / 2];
  return [a, b].some((part) => part.pockets.some((p) => pointInPocket(part, p, c)));
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
  if (p.shape.kind === 'path') {
    if (!p.shape.closed) return p.through ? t('corte con perfil a mano en {face}', { face }) : t('rebaje con perfil a mano, {depth} de hondo en {face}', { depth, face });
    if (pathCurved(p.shape)) return p.through ? t('calado con perfil a mano en {face}', { face }) : t('vaciado con perfil a mano, {depth} de hondo en {face}', { depth, face });
    return p.through ? t('calado de lados rectos en {face}', { face }) : t('vaciado de lados rectos, {depth} de hondo en {face}', { depth, face });
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

import type { PathPoint, PocketShape } from './project';

/**
 * Perfil a mano: una línea de puntos sobre una cara, con curvas suaves entre ellos. Cerrado, saca lo de adentro
 * (un calado con forma). Abierto, empieza y termina en bordes de la cara, y saca lo que queda de un lado:
 * el borde curvo de un faldón, el contorno de un respaldo, la silueta de una pata.
 */

export type PathShape = Extract<PocketShape, { kind: 'path' }>;
type Pt = [number, number];

/** Tramos de curva por cada par de puntos: alcanza para que la curva se vea lisa y la plantilla salga bien. */
const STEPS = 16;

/**
 * Cada tramo del perfil (del punto i al siguiente), como puntos seguidos que arrancan en el punto i y no repiten el
 * siguiente. Entre dos puntos va una curva de Catmull-Rom; donde un punto es esquina, la curva llega derecho a él,
 * así que entre dos esquinas queda una recta.
 */
export function pathSegments(points: readonly PathPoint[], closed: boolean, steps = STEPS): Pt[][] {
  const n = points.length;
  if (n < 2) return [];
  const at = (i: number): PathPoint => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]!;
  const dist = (i: number, j: number) => Math.hypot(at(j).u - at(i).u, at(j).v - at(i).v) || 1;
  // Tangente en el punto i para el tramo que va hacia `toward`, a escala del largo de ese tramo: así un punto agregado
  // en el medio de una curva casi no la cambia, aunque los puntos queden a distancias distintas.
  const tangent = (i: number, toward: 1 | -1): Pt => {
    const p = at(i);
    const q = at(i + toward);
    const chord: Pt = [(q.u - p.u) * toward, (q.v - p.v) * toward];
    // Esquina: apunta al punto vecino del tramo, así ese tramo sale recto si el otro extremo también es esquina.
    if (p.corner) return chord;
    // Punta suelta de un perfil abierto: la curva llega sin torcerse (spline natural), según cómo sigue en el vecino.
    if (!closed && (i === 0 || i === n - 1)) {
      if (n === 2 || q.corner) return chord;
      const m = tangent(i + toward, (-toward) as 1 | -1);
      return [1.5 * chord[0] - 0.5 * m[0], 1.5 * chord[1] - 0.5 * m[1]];
    }
    const a = at(i - 1);
    const b = at(i + 1);
    const k = dist(i, i + toward) / (dist(i - 1, i) + dist(i, i + 1));
    return [(b.u - a.u) * k, (b.v - a.v) * k];
  };
  const out: Pt[][] = [];
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = at(i);
    const p1 = at(i + 1);
    const m0 = tangent(i, 1);
    const m1 = tangent(i + 1, -1);
    const k = p0.corner && p1.corner ? 1 : steps;
    const seg: Pt[] = [];
    for (let j = 0; j < k; j++) {
      const s = j / k;
      const s2 = s * s;
      const s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1;
      const h10 = s3 - 2 * s2 + s;
      const h01 = -2 * s3 + 3 * s2;
      const h11 = s3 - s2;
      seg.push([h00 * p0.u + h10 * m0[0] + h01 * p1.u + h11 * m1[0], h00 * p0.v + h10 * m0[1] + h01 * p1.v + h11 * m1[1]]);
    }
    out.push(seg);
  }
  return out;
}

/** La línea del perfil, como puntos seguidos. */
export function pathCurve(points: readonly PathPoint[], closed: boolean, steps = STEPS): Pt[] {
  if (points.length < 2) return points.map((p) => [p.u, p.v]);
  const out = pathSegments(points, closed, steps).flat();
  if (!closed) out.push([points[points.length - 1]!.u, points[points.length - 1]!.v]);
  return out;
}

/**
 * El lugar de la línea más cerca de (u, v): en qué tramo cae (va del punto `segment` al siguiente), el punto de la
 * curva y a qué distancia está.
 */
export function pathNearest(shape: PathShape, u: number, v: number): { segment: number; at: Pt; distance: number } | null {
  const segs = pathSegments(shape.points, shape.closed);
  const n = shape.points.length;
  let best: { segment: number; at: Pt; distance: number } | null = null;
  segs.forEach((seg, i) => {
    const next = shape.points[(i + 1) % n]!;
    const pts = [...seg, [next.u, next.v] as Pt];
    for (let k = 0; k + 1 < pts.length; k++) {
      const [a, b] = [pts[k]!, pts[k + 1]!];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / len2));
      const at: Pt = [a[0] + dx * t, a[1] + dy * t];
      const distance = Math.hypot(u - at[0], v - at[1]);
      if (!best || distance < best.distance) best = { segment: i, at, distance };
    }
  });
  return best;
}

/** El perfil con un punto nuevo en el tramo `segment`, en (u, v). Va en curva salvo que el tramo sea recto. */
export function insertPathPoint(shape: PathShape, segment: number, u: number, v: number): PathShape {
  const a = shape.points[segment]!;
  const b = shape.points[(segment + 1) % shape.points.length]!;
  const point: PathPoint = { u, v, corner: a.corner && b.corner };
  return { ...shape, points: [...shape.points.slice(0, segment + 1), point, ...shape.points.slice(segment + 1)] };
}

/** El punto del medio del tramo `segment`, sobre la curva: donde se agrega un punto desde el panel. */
export function segmentMiddle(shape: PathShape, segment: number): Pt {
  const seg = pathSegments(shape.points, shape.closed)[segment]!;
  if (seg.length > 1) return seg[Math.floor(seg.length / 2)]!;
  const a = shape.points[segment]!;
  const b = shape.points[(segment + 1) % shape.points.length]!;
  return [(a.u + b.u) / 2, (a.v + b.v) / 2];
}

/** Si el punto está sobre un borde de la cara (de w × h). */
export function onFaceEdge(p: { u: number; v: number }, w: number, h: number, tol = 0.5): boolean {
  return Math.min(p.u, w - p.u, p.v, h - p.v) <= tol;
}

/** Dónde cae un punto del borde si se recorre la cara en contra del reloj desde la esquina (0, 0). */
function perimeterAt([u, v]: Pt, w: number, h: number): number {
  const d = [v, w - u, h - v, u];
  const side = d.indexOf(Math.min(...d));
  if (side === 0) return u;
  if (side === 1) return w + v;
  if (side === 2) return w + h + (w - u);
  return 2 * w + h + (h - v);
}

const area = (pts: Pt[]) => Math.abs(pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * p[1], 0)) / 2;

/**
 * Lo que saca el perfil, como polígono en coordenadas de la cara. Abierto: la curva y, para cerrarla, el borde de
 * la cara de un lado o del otro; se saca el lado chico, o el grande con `flip`. Si no toca dos bordes, nada.
 */
export function pathRegion(shape: PathShape, w: number, h: number): Pt[] {
  const curve = pathCurve(shape.points, shape.closed);
  if (shape.closed) return shape.points.length >= 3 ? curve : [];
  const first = shape.points[0]!;
  const last = shape.points[shape.points.length - 1]!;
  if (!onFaceEdge(first, w, h) || !onFaceEdge(last, w, h)) return [];
  const total = 2 * (w + h);
  const corners: [number, Pt][] = [
    [0, [0, 0]],
    [w, [w, 0]],
    [w + h, [w, h]],
    [2 * w + h, [0, h]],
  ];
  const ta = perimeterAt([first.u, first.v], w, h);
  const tb = perimeterAt([last.u, last.v], w, h);
  // Del final al principio por el borde, en un sentido o en el otro, pasando por las esquinas que haya en el medio.
  const walk = (dir: 1 | -1): Pt[] => {
    const span = (((ta - tb) * dir) % total + total) % total;
    return corners
      .map(([t, p]) => ({ p, d: (((t - tb) * dir) % total + total) % total }))
      .filter((c) => c.d > 1e-6 && c.d < span - 1e-6)
      .sort((a, b) => a.d - b.d)
      .map((c) => c.p);
  };
  const one = [...curve, ...walk(1)];
  const two = [...curve, ...walk(-1)];
  const small = area(one) <= area(two);
  return small !== shape.flip ? one : two;
}

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Si la línea se cruza consigo misma: así no hay una forma que sacar. */
export function pathCrosses(shape: PathShape): boolean {
  const pts = pathCurve(shape.points, shape.closed);
  const segs: [Pt, Pt][] = pts.slice(0, -1).map((p, i) => [p, pts[i + 1]!]);
  if (shape.closed && pts.length > 2) segs.push([pts[pts.length - 1]!, pts[0]!]);
  const m = segs.length;
  for (let i = 0; i < m; i++) {
    for (let j = i + 2; j < m; j++) {
      // El primero y el último de un lazo cerrado se tocan en la punta: no es un cruce.
      if (shape.closed && i === 0 && j === m - 1) continue;
      const [a, b] = segs[i]!;
      const [c, d] = segs[j]!;
      const d1 = cross(c, d, a);
      const d2 = cross(c, d, b);
      const d3 = cross(a, b, c);
      const d4 = cross(a, b, d);
      if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    }
  }
  return false;
}

/** Si el perfil ya forma algo que sacar: cerrado con tres puntos, o abierto de borde a borde. Sin cruces. */
export function pathReady(shape: PathShape, w: number, h: number): boolean {
  return pathRegion(shape, w, h).length >= 3 && !pathCrosses(shape);
}

/** Si tiene alguna curva o es todo de rectas. */
export const pathCurved = (shape: PathShape) => shape.points.some((p) => !p.corner);

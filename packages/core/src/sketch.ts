import type { PathPoint } from './project';
import { pathCrosses, pathRegion, type PathShape } from './profile';

/**
 * Dibujar más fácil: un trazo a mano alzada que se vuelve un perfil de pocos puntos, y las formas de esquina listas
 * (redondeo, chaflán, escalón, cóncavo, gola) armadas como perfil abierto. Todo queda como perfil a mano: después se
 * mueven los puntos igual que siempre y el archivo no cambia.
 */

type Pt = [number, number];

/** Cuántos puntos como mucho deja un trazo: más, y moverlos después se vuelve un trabajo. */
const MAX_POINTS = 14;

const round = (x: number) => Math.round(x * 2) / 2;

/** Douglas-Peucker: los puntos que hacen falta para que la línea no se aparte más de `eps` del trazo. */
function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0]!, pts[pts.length - 1]!];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let far = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const d = len < 1e-9 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (d > far) [far, at] = [d, i];
  }
  if (far <= eps) return [a, b];
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)];
}

/** El punto llevado al borde más cercano de la cara. */
function toEdge([u, v]: Pt, w: number, h: number): Pt {
  const d = [u, w - u, v, h - v];
  const k = d.indexOf(Math.min(...d));
  return k === 0 ? [0, v] : k === 1 ? [w, v] : k === 2 ? [u, 0] : [u, h];
}
const edgeGap = ([u, v]: Pt, w: number, h: number) => Math.min(u, w - u, v, h - v);

/** Ángulo del giro en `b` yendo de `a` a `c`, en grados: 0 es seguir derecho. */
function turn(a: Pt, b: Pt, c: Pt): number {
  const [x1, y1] = [b[0] - a[0], b[1] - a[1]];
  const [x2, y2] = [c[0] - b[0], c[1] - b[1]];
  const cos = (x1 * x2 + y1 * y2) / (Math.hypot(x1, y1) * Math.hypot(x2, y2) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

export interface Stroke {
  shape: PathShape;
  /**
   * `edges`: va de un borde a otro, listo para sacar un lado. `closed`: volvió al principio, saca lo de adentro.
   * `loose`: quedó suelto en el medio; sigue como perfil a mano, marcando puntos hasta un borde o el primero.
   */
  kind: 'edges' | 'closed' | 'loose';
}

/**
 * Un trazo a mano alzada sobre una cara de `w` × `h` (puntos en mm, ya adentro de la cara) como perfil de pocos
 * puntos suaves. Las puntas que quedan cerca de un borde se pegan a él; si termina cerca de donde empezó, se cierra.
 * Donde el trazo dobla fuerte queda una esquina. `reach`: el imán, en mm. Null si el trazo es muy corto.
 */
export function strokeToPath(raw: readonly Pt[], w: number, h: number, reach: number): Stroke | null {
  const pts = raw.filter((p, i) => i === 0 || Math.hypot(p[0] - raw[i - 1]![0], p[1] - raw[i - 1]![1]) > 0.2);
  if (pts.length < 2) return null;
  const length = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]), 0);
  if (length < Math.max(6, reach * 2)) return null;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const near = reach * 2;
  const edges = edgeGap(first, w, h) <= near && edgeGap(last, w, h) <= near;
  const closed = !edges && Math.hypot(last[0] - first[0], last[1] - first[1]) <= Math.max(near, length * 0.08);
  if (edges) {
    pts[0] = toEdge(first, w, h);
    pts[pts.length - 1] = toEdge(last, w, h);
  }
  if (closed) pts.pop();
  // Con tolerancia chica sigue el trazo de cerca; si quedan muchos puntos, se afloja hasta que entren.
  let eps = Math.max(0.8, Math.max(w, h) * 0.01);
  let kept = simplify(closed ? [...pts, pts[0]!] : pts, eps);
  while (kept.length > MAX_POINTS + (closed ? 1 : 0)) {
    eps *= 1.4;
    kept = simplify(closed ? [...pts, pts[0]!] : pts, eps);
  }
  if (closed) kept.pop();
  if (closed && kept.length < 3) return null;
  const n = kept.length;
  const points: PathPoint[] = kept.map((p, i) => {
    const prev = closed ? kept[(i - 1 + n) % n] : kept[i - 1];
    const next = closed ? kept[(i + 1) % n] : kept[i + 1];
    return { u: round(p[0]), v: round(p[1]), corner: !!prev && !!next && turn(prev, p, next) > 75 };
  });
  // Dos puntos solos son una recta: que quede recta y no una curva con panza.
  if (n === 2) points.forEach((p) => (p.corner = true));
  const shape: PathShape = { kind: 'path', points, closed, flip: false };
  if (pathCrosses(shape)) return null;
  return { shape, kind: edges ? 'edges' : closed ? 'closed' : 'loose' };
}

export const CORNER_KINDS = ['redondeo', 'chaflan', 'escalon', 'concavo', 'gola'] as const;
export type CornerKind = (typeof CORNER_KINDS)[number];

/** Esquina de la cara: 0 (u 0, v 0), 1 (u w, v 0), 2 (u 0, v h), 3 (u w, v h). */
export type FaceCorner = 0 | 1 | 2 | 3;

/** La esquina más cercana a (u, v). */
export function nearestCorner(u: number, v: number, w: number, h: number): FaceCorner {
  return ((u > w / 2 ? 1 : 0) + (v > h / 2 ? 2 : 0)) as FaceCorner;
}

/** Medidas para empezar: un poco menos de la mitad del lado corto, redondeado a 5 mm. */
export function cornerDefault(w: number, h: number): number {
  return Math.max(5, Math.round((Math.min(w, h) * 0.4) / 5) * 5);
}

/**
 * La forma de esquina como perfil abierto: de un punto a `a` mm de la esquina por el borde de u a otro a `b` mm por
 * el borde de v. Saca la esquina (o, si la forma se come más de media cara, igual la esquina, con `flip`).
 * Las curvas van con varios puntos para que se vean parejas.
 */
export function cornerPath(kind: CornerKind, corner: FaceCorner, a: number, b: number, w: number, h: number): PathShape {
  const A = Math.max(1, Math.min(a, w));
  const B = Math.max(1, Math.min(b, h));
  // En la esquina (0, 0), con la cara hacia +u y +v; después se da vuelta según la esquina.
  const quarter = (cu: number, cv: number, from: number, to: number): Pt[] =>
    Array.from({ length: 5 }, (_, i) => {
      const th = from + ((to - from) * i) / 4;
      return [cu + A * Math.cos(th), cv + B * Math.sin(th)];
    });
  let local: { p: Pt; corner: boolean }[];
  switch (kind) {
    case 'chaflan':
      local = [
        { p: [A, 0], corner: true },
        { p: [0, B], corner: true },
      ];
      break;
    case 'escalon':
      local = [
        { p: [A, 0], corner: true },
        { p: [A, B], corner: true },
        { p: [0, B], corner: true },
      ];
      break;
    case 'concavo':
      // Cuarto de círculo con centro en la esquina: entra hacia la pieza.
      local = quarter(0, 0, 0, Math.PI / 2).map((p) => ({ p, corner: false }));
      break;
    case 'gola':
      // Curva en S: arranca tangente al borde de u y llega al de v de frente.
      local = Array.from({ length: 6 }, (_, i) => {
        const s = i / 5;
        return { p: [A * (1 - s), (B * (1 - Math.cos(Math.PI * s))) / 2] as Pt, corner: false };
      });
      break;
    default:
      // Redondeo: cuarto de círculo con centro adentro, a (A, B): la esquina queda redonda.
      local = quarter(A, B, -Math.PI / 2, -Math.PI).map((p) => ({ p, corner: false }));
  }
  const flipU = corner === 1 || corner === 3;
  const flipV = corner === 2 || corner === 3;
  const points: PathPoint[] = local.map(({ p: [x, y], corner: c }) => ({ u: round(flipU ? w - x : x), v: round(flipV ? h - y : y), corner: c }));
  const shape: PathShape = { kind: 'path', points, closed: false, flip: false };
  // pathRegion saca el lado chico: si la esquina es el lado grande, se da vuelta.
  const region = pathRegion(shape, w, h);
  const [cu, cv] = [flipU ? w : 0, flipV ? h : 0];
  const inside = region.some(([u, v]) => Math.abs(u - cu) < 0.01 && Math.abs(v - cv) < 0.01);
  return inside ? shape : { ...shape, flip: true };
}

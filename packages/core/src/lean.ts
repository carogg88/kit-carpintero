import { boxSize, partBox, type Box, type Vec3 } from './geometry';
import type { Part } from './project';
import { t } from './i18n';
import { formatAngle } from './bevels';

/**
 * Patas inclinadas: una pata derecha que se abre hacia afuera, como en un taburete de patas
 * abiertas. La pieza se arma derecha y se gira sobre el centro de su punta de arriba; después se cortan las dos
 * puntas horizontales, a la altura de la pieza derecha: arriba apoya plana contra el asiento y abajo, en el piso.
 * Por eso la madera tiene que ser un poco más larga que la altura, y cada punta se corta en ángulo.
 *
 * Los ángulos son los que se ven de frente y de costado, los que se toman con la falsa escuadra sobre el dibujo.
 */

export interface LeanFrame {
  /** Centro de la punta de arriba: sobre él gira la pata. */
  pivot: Vec3;
  /** Eje y ángulo del giro (en grados) que lleva la pata derecha a la inclinada. */
  axis: Vec3;
  angle: number;
  /** Hacia dónde baja la pata, de largo 1. */
  dir: Vec3;
  /** Alto de la pieza derecha: lo que mide de alto la inclinada. */
  height: number;
  /** Largo de madera que hace falta, de punta larga a punta larga. */
  length: number;
  /** Cuánto sube la punta larga de arriba por encima del centro (y cuánto baja la de abajo bajo el piso del centro). */
  rise: number;
  /** Cuánto se alarga la pieza derecha arriba y abajo antes de girarla, para que después de cortar llegue a todo. */
  extend: { top: number; bottom: number };
  /** Ángulo del corte de cada punta visto sobre la cara del ancho (X) y sobre la del espesor (Z), en grados. */
  cut: [number, number];
  /** Cuánto se aparta del vertical en total, en grados. */
  tilt: number;
}

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/** Si la pieza se puede inclinar: una caja parada (lo más largo es el alto), sin tornear. */
export function leanable(part: Part): boolean {
  if (part.base.kind !== 'box' || part.turning) return false;
  const [w, h, d] = part.base.size;
  return h >= w && h >= d;
}

/** Si la pieza está inclinada de verdad (no en cero) y se puede. */
export const isLeaning = (part: Part): boolean => !!part.lean && leanable(part) && part.lean.some((a) => Math.abs(a) > 0.01);

/** Gira el vector `v` sobre el eje `k` (de largo 1) `angle` grados (fórmula de Rodrigues). */
export function rotateVec(v: Vec3, k: Vec3, angle: number): Vec3 {
  const th = rad(angle);
  const c = Math.cos(th);
  const s = Math.sin(th);
  const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const cross: Vec3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map((i) => v[i]! * c + cross[i]! * s + k[i]! * kv * (1 - c)) as Vec3;
}

/** Cómo está inclinada la pieza, o null si está derecha. */
export function leanFrame(part: Part): LeanFrame | null {
  if (!isLeaning(part)) return null;
  const [front, side] = part.lean!;
  const box = partBox(part);
  const [w, height, t] = boxSize(box);
  const raw: Vec3 = [Math.tan(rad(front)), -1, Math.tan(rad(side))];
  const norm = Math.hypot(...raw);
  const dir = raw.map((x) => x / norm) as Vec3;
  // El giro más corto que lleva "hacia abajo" a `dir`: eje = abajo × dir.
  const across = Math.hypot(dir[0], dir[2]);
  const axis: Vec3 = [-dir[2] / across, 0, dir[0] / across];
  const angle = deg(Math.acos(Math.min(1, -dir[1])));
  const dy = -dir[1];
  // Las caras de la pata giradas: cuánto suben o bajan a lo ancho (X) y a lo grueso (Z). Eso hace la punta larga.
  const e1 = rotateVec([1, 0, 0], axis, angle);
  const e2 = rotateVec([0, 0, 1], axis, angle);
  const rise = ((w / 2) * Math.abs(e1[1]) + (t / 2) * Math.abs(e2[1])) / dy;
  const length = height / dy + 2 * rise;
  return {
    pivot: [(box.min[0] + box.max[0]) / 2, box.max[1], (box.min[2] + box.max[2]) / 2],
    axis,
    angle,
    dir,
    height,
    length,
    rise,
    extend: { top: rise + 1, bottom: length - rise - height + 1 },
    cut: [deg(Math.atan(Math.abs(e1[1]) / dy)), deg(Math.atan(Math.abs(e2[1]) / dy))],
    tilt: angle,
  };
}

/** Lleva un punto de la pieza derecha a donde queda en la inclinada. */
export function leanPoint(f: LeanFrame, p: Vec3): Vec3 {
  const r = rotateVec([p[0] - f.pivot[0], p[1] - f.pivot[1], p[2] - f.pivot[2]], f.axis, f.angle);
  return [r[0] + f.pivot[0], r[1] + f.pivot[1], r[2] + f.pivot[2]];
}

/** La pieza derecha alargada que se gira: después del giro se corta a la altura de `partBox`. */
export function leanStock(part: Part, f: LeanFrame): Box {
  const b = partBox(part);
  return { min: [b.min[0], b.min[1] - f.extend.bottom, b.min[2]], max: [b.max[0], b.max[1] + f.extend.top, b.max[2]] };
}

/** Caja que envuelve la pieza inclinada ya cortada: lo que ocupa en el piso y en el plano. */
export function leanedBox(part: Part): Box {
  const f = leanFrame(part);
  const b = partBox(part);
  if (!f) return b;
  const s = leanStock(part, f);
  // Las aristas largas cortadas a la altura de la pieza: dónde cruzan el plano de arriba y el de abajo.
  const cuts: Vec3[] = [];
  for (const x of [s.min[0], s.max[0]]) {
    for (const z of [s.min[2], s.max[2]]) {
      const top = leanPoint(f, [x, s.max[1], z]);
      const bottom = leanPoint(f, [x, s.min[1], z]);
      for (const y of [b.min[1], b.max[1]]) {
        const k = (y - top[1]) / (bottom[1] - top[1]);
        cuts.push([top[0] + (bottom[0] - top[0]) * k, y, top[2] + (bottom[2] - top[2]) * k]);
      }
    }
  }
  return {
    min: [Math.min(...cuts.map((p) => p[0])), b.min[1], Math.min(...cuts.map((p) => p[2]))],
    max: [Math.max(...cuts.map((p) => p[0])), b.max[1], Math.max(...cuts.map((p) => p[2]))],
  };
}

/** Una caja chica de la pieza derecha (una espiga) corrida a donde queda en la inclinada, sin girarla. */
export function leanShift(f: LeanFrame, b: Box): Box {
  const c: Vec3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
  const p = leanPoint(f, c);
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  return { min: b.min.map((v, k) => v + d[k]!) as Vec3, max: b.max.map((v, k) => v + d[k]!) as Vec3 };
}

/**
 * Dónde cae de verdad el agujero que deja una pieza inclinada en la pieza en que entra: corrido lo que se corre la
 * inclinada a la altura de la cara de entrada. Una pata que entra por arriba no se corre (gira sobre esa punta);
 * un parante de respaldo que entra por abajo en el asiento, sí.
 */
export function leanHole(f: LeanFrame, hole: Box, leaning: Box): Box {
  const above = (leaning.min[1] + leaning.max[1]) / 2 > (hole.min[1] + hole.max[1]) / 2;
  const c: Vec3 = [(hole.min[0] + hole.max[0]) / 2, above ? hole.max[1] : hole.min[1], (hole.min[2] + hole.max[2]) / 2];
  const p = leanPoint(f, c);
  const d = [p[0] - c[0], 0, p[2] - c[2]];
  return { min: hole.min.map((v, k) => v + d[k]!) as Vec3, max: hole.max.map((v, k) => v + d[k]!) as Vec3 };
}

/** "puntas cortadas paralelas, a 8°: falsa escuadra a 82° del canto": lo que hay que hacerle a la pata, para la lista de cortes. */
export function leanWork(f: LeanFrame): string {
  const half = (a: number) => Math.round(a * 2) / 2;
  const [a, b] = f.cut.map(half) as [number, number];
  if (!a || !b) {
    const c = Math.max(a, b);
    return t('puntas cortadas paralelas, a {a}: falsa escuadra a {g} del canto', { a: formatAngle(c), g: formatAngle(90 - c) });
  }
  return t('puntas cortadas paralelas, a {a} sobre una cara y {b} sobre la otra: falsa escuadra a {ga} y {gb} del canto', {
    a: formatAngle(a),
    b: formatAngle(b),
    ga: formatAngle(90 - a),
    gb: formatAngle(90 - b),
  });
}

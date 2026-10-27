import { otherAxes, type Axis, type Vec3 } from './geometry';
import type { Part, PocketShape } from './project';

/**
 * Girar una pieza 90° sobre uno de los ejes, por su centro. La pieza sigue siendo una caja alineada a los ejes:
 * cambian sus medidas y, con ellas, cada vaciado, bisel, tramo y torneado pasa a la cara y al lugar que le toca.
 * Todo en coordenadas de la pieza (desde su esquina mínima), en mm.
 */

type Side = 1 | -1;

/** Los otros dos ejes en orden cíclico: girar `about` lleva el primero hacia el segundo. */
const cyclic = (about: Axis): [Axis, Axis] => [((about + 1) % 3) as Axis, ((about + 2) % 3) as Axis];

/** Adónde va cada eje al girar, y si queda dado vuelta (lo que estaba en el mínimo pasa al máximo). */
function axisMap(about: Axis): { to: Axis; flip: boolean }[] {
  const [a, b] = cyclic(about);
  const m: { to: Axis; flip: boolean }[] = [];
  m[about] = { to: about, flip: false };
  // a → b sin dar vuelta; b → a dado vuelta: (a, b) pasa a (−b, a).
  m[a] = { to: b, flip: false };
  m[b] = { to: a, flip: true };
  return m;
}

/** Gira la pieza en el lugar, 90° sobre el eje `about`. */
export function rotatePart(part: Part, about: Axis): void {
  remapPart(part, axisMap(about));
}

/**
 * Orientación de una copia de un componente respecto de la forma común: para cada eje de la forma común, a qué eje
 * de la pieza va (1, 2 o 3) y con signo menos si queda dado vuelta. [1, 2, 3] es la forma tal cual; [-1, 2, 3], la
 * misma reflejada de izquierda a derecha. Así cada pata lleva el bisel en su arista de afuera.
 */
export type Orient = [number, number, number];
export const SAME_ORIENT: Orient = [1, 2, 3];

type AxisMap = { to: Axis; flip: boolean }[];
const toMap = (o: Orient): AxisMap => o.map((v) => ({ to: (Math.abs(v) - 1) as Axis, flip: v < 0 }));
const fromMap = (m: AxisMap): Orient => m.map((x) => (x.to + 1) * (x.flip ? -1 : 1)) as Orient;

/** Primero `first` y después `then`. */
export function composeOrient(then: Orient, first: Orient): Orient {
  return first.map((v) => {
    const w = then[Math.abs(v) - 1]!;
    return Math.sign(v) * Math.sign(w) * Math.abs(w);
  }) as Orient;
}

export function invertOrient(o: Orient): Orient {
  const out = [0, 0, 0] as Orient;
  o.forEach((v, i) => (out[Math.abs(v) - 1] = Math.sign(v) * (i + 1)));
  return out;
}

export const isSameOrient = (o?: Orient) => !o || o.every((v, i) => v === i + 1);

/** La orientación de girar 90° sobre `about`, y la de reflejar sobre `axis`. */
export const rotationOrient = (about: Axis): Orient => fromMap(axisMap(about));
export const mirrorOrient = (axis: Axis): Orient => SAME_ORIENT.map((v, i) => (i === axis ? -v : v)) as Orient;

/** Lleva la forma de la pieza por esa orientación, en el lugar y por su centro. */
export function orientPart(part: Part, o: Orient): void {
  if (!isSameOrient(o)) remapPart(part, toMap(o));
}

/** Refleja la forma de la pieza sobre un eje, en el lugar: lo de la izquierda pasa a la derecha. */
export function mirrorShape(part: Part, axis: Axis): void {
  remapPart(part, toMap(mirrorOrient(axis)));
}

/** Pasa la forma por un cambio de ejes (giro o reflejo), por el centro de la pieza. */
function remapPart(part: Part, map: AxisMap): void {
  if (part.base.kind !== 'box') return;
  const size = [...part.base.size] as Vec3;
  const next = [0, 0, 0] as Vec3;
  for (const k of [0, 1, 2] as Axis[]) next[map[k]!.to] = size[k]!;
  const point = (p: Vec3): Vec3 => {
    const out = [0, 0, 0] as Vec3;
    for (const k of [0, 1, 2] as Axis[]) out[map[k]!.to] = map[k]!.flip ? size[k]! - p[k]! : p[k]!;
    return out;
  };
  const face = (axis: Axis, side: Side): { axis: Axis; side: Side } => ({ axis: map[axis]!.to, side: (map[axis]!.flip ? -side : side) as Side });

  part.pockets = part.pockets.map((pk) => {
    const f = face(pk.axis, pk.side);
    return { ...pk, axis: f.axis, side: f.side, shape: mapShape(pk.shape, pk.axis, f.axis, point) };
  });
  part.bevels = part.bevels.map((bv) => {
    const a = face(bv.a.axis, bv.a.side);
    const b = face(bv.b.axis, bv.b.side);
    return { ...bv, a, b };
  });
  part.sections = part.sections.map((s) => {
    const { to, flip } = map[s.axis]!;
    const len = size[s.axis]!;
    // Las medidas de la sección van en el orden de los otros dos ejes: si se cruzan, se cruzan también.
    const sizeOut: [number, number] = map[otherAxes(s.axis)[0]]!.to === otherAxes(to)[0] ? [s.size[0], s.size[1]] : [s.size[1], s.size[0]];
    return { ...s, axis: to, from: flip ? len - s.to : s.from, to: flip ? len - s.from : s.to, size: sizeOut };
  });
  if (part.turning) {
    const { to, flip } = map[part.turning.axis]!;
    const len = size[part.turning.axis]!;
    let stations = part.turning.stations;
    if (flip) {
      // Dado vuelta, el perfil se lee de la otra punta: cada tramo lleva cómo se llega desde la estación anterior.
      const n = stations.length;
      stations = stations.map((_, j) => {
        const old = stations[n - 1 - j]!;
        const how = j === 0 ? stations[0]! : stations[n - j]!;
        return { ...old, at: len - old.at, to: how.to, bulge: how.bulge };
      });
    }
    part.turning = { axis: to, stations };
  }
  // Por el centro: la pieza no se va de donde estaba.
  for (const k of [0, 1, 2] as Axis[]) part.position[k] = part.position[k]! + (size[k]! - next[k]!) / 2;
  part.base.size = next;
}

/** Pasa una figura dibujada en una cara a la cara girada. */
function mapShape(shape: PocketShape, from: Axis, to: Axis, point: (p: Vec3) => Vec3): PocketShape {
  const [ua, va] = otherAxes(from);
  const [ub, vb] = otherAxes(to);
  const at = (u: number, v: number) => {
    const p = [0, 0, 0] as Vec3;
    p[ua] = u;
    p[va] = v;
    const q = point(p);
    return [q[ub]!, q[vb]!] as const;
  };
  if (shape.kind === 'circle') {
    const [u, v] = at(shape.u, shape.v);
    return { ...shape, u, v };
  }
  if (shape.kind === 'path') {
    const points = shape.points.map((p) => {
      const [u, v] = at(p.u, p.v);
      return { ...p, u, v };
    });
    return { ...shape, points };
  }
  if (shape.kind === 'rect') {
    const [u1, v1] = at(shape.u, shape.v);
    const [u2, v2] = at(shape.u + shape.w, shape.v + shape.h);
    return { ...shape, u: Math.min(u1, u2), v: Math.min(v1, v2), w: Math.abs(u2 - u1), h: Math.abs(v2 - v1) };
  }
  const [u, v] = at(shape.u, shape.v);
  const [u2, v2] = at(shape.u2, shape.v2);
  // Si la cara queda espejada en su dibujo (u y v cambian de mano), la flecha pasa al otro lado de la cuerda.
  const [o0, o1] = at(0, 0);
  const [x0, x1] = at(1, 0);
  const [y0, y1] = at(0, 1);
  const det = (x0 - o0) * (y1 - o1) - (x1 - o1) * (y0 - o0);
  return { ...shape, u, v, u2, v2, bulge: det < 0 ? -shape.bulge : shape.bulge };
}

/**
 * Girar una pieza desde el panel: si es copia de un componente, gira solo esa copia (las demás quedan como
 * estaban) y guarda el giro, para que lo que se le haga después a cualquier copia le llegue en su lugar.
 */
export function turnPart(part: Part, about: Axis): void {
  rotatePart(part, about);
  setOrient(part, rotationOrient(about));
}

/**
 * Espejar una pieza desde el panel, en su lugar: lo de la izquierda pasa a la derecha (eje 0), lo de abajo arriba (1)
 * o lo de atrás adelante (2). Pasan los vaciados, biseles, tramos y torneado; una pata inclinada se abre hacia el
 * otro lado. Si es copia de un componente, se espeja solo esa copia, como al girar.
 */
export function flipPart(part: Part, axis: Axis): void {
  mirrorShape(part, axis);
  setOrient(part, mirrorOrient(axis));
  // La inclinación es de la punta de abajo, de frente (X) y de costado (Z); dada vuelta de arriba abajo no cambia.
  if (part.lean && axis !== 1) part.lean[axis === 0 ? 0 : 1] *= -1;
}

/** Suma un giro o un reflejo a la orientación de la copia (solo en componentes). */
export function setOrient(part: Part, change: Orient): void {
  if (!part.component) return void delete part.orient;
  const o = composeOrient(change, (part.orient as Orient | undefined) ?? SAME_ORIENT);
  if (isSameOrient(o)) delete part.orient;
  else part.orient = o;
}

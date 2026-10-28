import { overlapBox, partBox, type Axis, type Box, type Vec3 } from './geometry';
import { placedBox } from './follow';
import { leanFrame } from './lean';
import type { Joint, Project } from './project';

/**
 * Despiece de una unión: hacia dónde y cuánto separar la pieza que entra (`b`) de la que la recibe (`a`) para ver
 * la espiga afuera y la caja vacía. Sale por el eje en que `b` más sobresale de `a`, hacia ese lado, lo que tiene
 * metido más un poco de aire.
 */
export interface Explode {
  axis: Axis;
  sign: 1 | -1;
  /** Milímetros que se corre `b`. */
  distance: number;
  /** El corrimiento como vector, listo para sumar a la posición. */
  offset: [number, number, number];
}

/** Aire entre las dos piezas separadas, además de lo que estaba metido. */
const AIR = 40;

export function explodeJoint(a: Box, b: Box): Explode {
  let best = { axis: 0 as Axis, sign: 1 as 1 | -1, out: -1 };
  for (const k of [0, 1, 2] as Axis[]) {
    const below = Math.max(0, a.min[k] - b.min[k]);
    const above = Math.max(0, b.max[k] - a.max[k]);
    const out = Math.max(below, above);
    if (out > best.out + 0.01) best = { axis: k, sign: above >= below ? 1 : -1, out };
  }
  const { axis, sign } = best;
  // Lo metido sobre ese eje: la espiga, el dado o nada (una unión a tope).
  const inside = Math.max(0, Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]));
  const distance = Math.round(inside + AIR);
  const offset: [number, number, number] = [0, 0, 0];
  offset[axis] = sign * distance;
  return { axis, sign, distance, offset };
}

/**
 * La unión como queda armada: las cajas donde están de verdad las dos piezas (inclinadas, o siguiendo a una
 * inclinada) y el despiece. Una pieza inclinada que entra sale a lo largo de ella misma, como se la saca de la caja.
 */
export function placedJoint(project: Pick<Project, 'parts' | 'joints'>, joint: Joint): { a: Box; b: Box; explode: Explode } | null {
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  if (!a || !b) return null;
  const explode = explodeJoint(partBox(a), partBox(b));
  const f = leanFrame(b);
  if (f) {
    // Hacia el mismo lado que saldría derecha: hacia abajo una pata, hacia arriba un parante.
    const s = f.dir[explode.axis] * explode.sign >= 0 ? 1 : -1;
    explode.offset = f.dir.map((v) => Math.round(v * s * explode.distance) + 0) as [number, number, number];
  }
  return { a: placedBox(project, a), b: placedBox(project, b), explode };
}

/**
 * Despiece de todo el mueble, para la hoja del plano: cuánto correr cada pieza. En cada eje, las piezas cortas sobre
 * ese eje se juntan en niveles (las patas de un lado con los faldones que entran en ellas, la tapa sola arriba) y
 * cada nivel se separa del vecino lo mismo, abriéndose desde el medio (en la altura, hacia arriba desde el piso).
 * Las piezas largas sobre el eje, como un faldón a lo largo del frente o una pata a lo alto, van con los niveles
 * que tienen a los costados: así las espigas salen de sus cajas.
 */
export function explodeParts(project: Pick<Project, 'parts' | 'joints'>): Map<string, Vec3> {
  const boxes = project.parts.map((p) => ({ id: p.id, box: placedBox(project, p) }));
  const out = new Map<string, Vec3>(boxes.map((b) => [b.id, [0, 0, 0]]));
  if (!boxes.length) return out;
  const size = ([0, 1, 2] as Axis[]).map((k) => Math.max(...boxes.map((b) => b.box.max[k])) - Math.min(...boxes.map((b) => b.box.min[k])));
  const big = Math.max(...size);
  for (const k of [0, 1, 2] as Axis[]) {
    const short = boxes
      .filter((b) => b.box.max[k] - b.box.min[k] < size[k]! * 0.4)
      .map((b) => ({ id: b.id, min: b.box.min[k], max: b.box.max[k] }))
      .sort((x, y) => x.min - y.min);
    // Una pieza va al nivel de antes si la mitad de ella, o del nivel, se superpone: el faldón metido en la pata.
    const levels: { ids: string[]; min: number; max: number }[] = [];
    for (const x of short) {
      const last = levels[levels.length - 1];
      const shared = last ? Math.min(last.max, x.max) - Math.max(last.min, x.min) : -1;
      if (last && shared >= Math.min(last.max - last.min, x.max - x.min) / 2) {
        last.ids.push(x.id);
        last.max = Math.max(last.max, x.max);
      } else levels.push({ ids: [x.id], min: x.min, max: x.max });
    }
    const n = levels.length - 1;
    if (n < 1) continue;
    // Entre niveles, poco más de un décimo del mueble, sin que el despiece crezca más de la mitad en ese eje.
    const gap = Math.min(big * 0.15, (size[k]! * 0.6) / n);
    // En la altura lo de abajo queda en el piso y lo demás sube, así los faldones siguen a la altura de sus cajas.
    const from = k === 1 ? 0 : n / 2;
    const at = levels.map((l, i) => ({ c: (l.min + l.max) / 2, o: (i - from) * gap }));
    for (const b of boxes) {
      const i = levels.findIndex((l) => l.ids.includes(b.id));
      let o = i >= 0 ? at[i]!.o : 0;
      if (i < 0) {
        // Una pieza larga va con los niveles que tiene a los costados de su centro: el tablero entre sus peinazos.
        const c = (b.box.min[k] + b.box.max[k]) / 2;
        const j = at.findIndex((x) => x.c > c);
        o = j < 0 ? at[n]!.o : j === 0 ? at[0]!.o : at[j - 1]!.o + ((c - at[j - 1]!.c) / (at[j]!.c - at[j - 1]!.c)) * (at[j]!.o - at[j - 1]!.o);
      }
      out.get(b.id)![k] = Math.round(o);
    }
  }
  return out;
}

/** Dónde se tocan las dos piezas de una unión, en el mueble armado: el medio del contacto. Null si no se tocan. */
export function jointCenter(project: Pick<Project, 'parts' | 'joints'>, joint: Joint): Vec3 | null {
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  if (!a || !b) return null;
  const ba = placedBox(project, a);
  const grown: Box = { min: ba.min.map((v) => v - 1) as Vec3, max: ba.max.map((v) => v + 1) as Vec3 };
  const touch = overlapBox(grown, placedBox(project, b));
  if (!touch) return null;
  return touch.min.map((v, k) => (v + touch.max[k]!) / 2) as Vec3;
}

/** La misma unión en el despiece: entre las dos piezas ya separadas, donde va su número. */
export function explodedJointCenter(project: Pick<Project, 'parts' | 'joints'>, joint: Joint, offsets: ReadonlyMap<string, Vec3>): Vec3 | null {
  const c = jointCenter(project, joint);
  const oa = offsets.get(joint.partA);
  const ob = offsets.get(joint.partB);
  if (!c || !oa || !ob) return null;
  return c.map((v, k) => v + (oa[k]! + ob[k]!) / 2) as Vec3;
}

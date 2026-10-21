import { boxSize, partBox, type Axis, type Box } from './geometry';
import type { Solid } from './joints';
import { faceName } from './pockets';
import type { Bevel, Part } from './project';

type Face = Bevel['a'];

const faceAt = (box: Box, f: Face) => (f.side > 0 ? box.max[f.axis] : box.min[f.axis]);
const third = (a: Axis, b: Axis) => (3 - a - b) as Axis;

/** Primer id libre para un bisel de la pieza: B1, B2… */
export function nextBevelId(part: Part): string {
  const used = new Set(part.bevels.map((b) => b.id));
  let n = 1;
  while (used.has(`B${n}`)) n++;
  return `B${n}`;
}

/** Cuánto mide la pieza a través de la cara `a`, desde la arista con `b` hasta el otro borde. */
export const acrossFace = (part: Part, b: Face) => boxSize(partBox(part))[b.axis];

/** Arista más cercana a un punto de la cara `a`: la cara vecina y a qué distancia está el punto de ella. */
export function edgeNear(part: Part, a: Face, point: readonly [number, number, number]): { b: Face; distance: number } {
  const box = partBox(part);
  let best: { b: Face; distance: number } | null = null;
  for (const axis of [0, 1, 2] as Axis[]) {
    if (axis === a.axis) continue;
    for (const side of [1, -1] as const) {
      const distance = Math.abs(faceAt(box, { axis, side }) - point[axis]);
      if (!best || distance < best.distance) best = { b: { axis, side }, distance };
    }
  }
  return best!;
}

/**
 * Bisel nuevo marcado `da` mm sobre la cara a: a 45°, salvo que la cara b no dé para tanto.
 * Redondeado, `da` es el radio y no puede pasar ninguna de las dos caras.
 */
export function newBevel(part: Part, a: Face, b: Face, da: number, round = false): Bevel {
  const size = boxSize(partBox(part));
  if (round) {
    const r = Math.min(da, size[a.axis], size[b.axis]);
    return { id: nextBevelId(part), a, b, da: r, db: r, round: true };
  }
  const db = Math.min(da, size[a.axis]);
  return { id: nextBevelId(part), a, b, da, db, round: false };
}

/**
 * Esquina más cercana a un punto de la cara `a`, si el punto está a menos de `tol` de dos aristas a la vez:
 * la arista que va de punta a punta de la pieza perpendicular a la cara, entre las dos caras vecinas.
 * `da` y `db` dicen a qué distancia está el punto de cada una.
 */
export function cornerNear(part: Part, a: Face, point: readonly [number, number, number], tol: number): { a: Face; b: Face; da: number; db: number } | null {
  const box = partBox(part);
  const near: { f: Face; d: number }[] = [];
  for (const axis of [0, 1, 2] as Axis[]) {
    if (axis === a.axis) continue;
    const side = point[axis] - box.min[axis] < box.max[axis] - point[axis] ? -1 : 1;
    const f = { axis, side } as const;
    near.push({ f, d: Math.abs(faceAt(box, f) - point[axis]) });
  }
  if (near.length !== 2 || near.some((x) => x.d > tol)) return null;
  // La cara de la arista más cercana va primero: es la que se ve más de frente al marcar.
  const [x, y] = near.sort((m, n) => m.d - n.d) as [{ f: Face; d: number }, { f: Face; d: number }];
  return { a: y.f, b: x.f, da: x.d, db: y.d };
}

/** Lo que el bisel saca de la pieza: un prisma de tres lados que sobra un poco por afuera para cortar limpio. */
export function bevelSolid(part: Part, bv: Bevel): Solid {
  const box = partBox(part);
  const u = bv.a.axis;
  const v = bv.b.axis;
  const t = third(u, v);
  const eu = faceAt(box, bv.a);
  const ev = faceAt(box, bv.b);
  if (bv.round) {
    // Lo que queda entre el cuarto de círculo y la arista, con un poco de sobra hacia afuera.
    const r = bv.da;
    const cu = eu - bv.a.side * r;
    const cv = ev - bv.b.side * r;
    const k = Math.SQRT1_2 * r;
    return {
      kind: 'arc',
      axis: t,
      from: box.min[t] - 1,
      to: box.max[t] + 1,
      u,
      v,
      a: [eu, cv],
      mid: [cu + bv.a.side * k, cv + bv.b.side * k],
      b: [cu, ev],
      rest: [
        [cu, ev + bv.b.side],
        [eu + bv.a.side, ev + bv.b.side],
        [eu + bv.a.side, cv],
      ],
    };
  }
  // P1 queda sobre la cara a, P2 sobre la cara b; la recta P1-P2 es el corte.
  const p1: [number, number] = [eu, ev - bv.b.side * bv.da];
  const p2: [number, number] = [eu - bv.a.side * bv.db, ev];
  const len = Math.hypot(bv.da, bv.db);
  const dir = [(p1[0] - p2[0]) / len, (p1[1] - p2[1]) / len];
  const reach = bv.da + bv.db + 2;
  const points: [number, number][] = [
    [p1[0] + dir[0]!, p1[1] + dir[1]!],
    [p2[0] - dir[0]!, p2[1] - dir[1]!],
    [eu + bv.a.side * reach, ev + bv.b.side * reach],
  ];
  return { kind: 'prism', axis: t, from: box.min[t] - 1, to: box.max[t] + 1, u, v, points };
}

/** Ángulo del corte con la cara a, en grados. */
export const bevelAngle = (bv: Pick<Bevel, 'da' | 'db'>) => (Math.atan2(bv.db, bv.da) * 180) / Math.PI;

/** Corte en ángulo: cruza toda una de las dos caras. Si no, es un bisel. */
export const isAngleCut = (part: Part, bv: Bevel) =>
  !bv.round && bv.da >= acrossFace(part, bv.b) - 0.01 || bv.db >= boxSize(partBox(part))[bv.a.axis] - 0.01;

/** "la cara de arriba", "el frente". */
export const faceLabel = (f: Face) => {
  const name = faceName(f.axis, f.side);
  return name === 'frente' ? 'el frente' : `la ${name}`;
};

/** En palabras de taller: "bisel de 12 × 12 mm a 45° entre la cara de arriba y el frente", "redondeo R 50 mm entre…". */
export function describeBevel(part: Part, bv: Bevel, n: (mm: number) => string): string {
  if (bv.round) return `redondeo R ${n(bv.da)} entre ${faceLabel(bv.a)} y ${faceLabel(bv.b)}`;
  const what = isAngleCut(part, bv) ? 'corte en ángulo' : 'bisel';
  return `${what} de ${n(bv.da)} × ${n(bv.db)} a ${formatAngle(bevelAngle(bv))} entre ${faceLabel(bv.a)} y ${faceLabel(bv.b)}`;
}

export const formatAngle = (deg: number) => `${(Math.round(deg * 10) / 10).toString().replace('.', ',')}°`;

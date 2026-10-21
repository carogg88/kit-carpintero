import { boxSize, copyBox, endContact, otherAxes, type Axis, type Box, type Vec3 } from '../geometry';

/** Sólido simple que un encastre suma o resta. Medidas en mm. */
export type Solid =
  | { kind: 'box'; box: Box }
  /** Cilindro que arranca en `start` y avanza `length` mm sobre `axis`, en el sentido `dir`. */
  | { kind: 'cylinder'; start: Vec3; axis: Axis; dir: 1 | -1; radius: number; length: number }
  /** Polígono en el plano (u, v) estirado sobre `axis`, de `from` a `to`. Colas de milano, ingletes. */
  | { kind: 'prism'; axis: Axis; from: number; to: number; u: Axis; v: Axis; points: [number, number][] }
  /** Agujero en cualquier dirección (`dir` de largo 1): los de tornillo de bolsillo van inclinados. */
  | { kind: 'bore'; start: Vec3; dir: Vec3; radius: number; length: number }
  /** Perfil de un arco (de `a` a `b` pasando por `mid`) y una línea quebrada `rest` que vuelve a `a`, estirado como el prisma. */
  | { kind: 'arc'; axis: Axis; from: number; to: number; u: Axis; v: Axis; a: [number, number]; mid: [number, number]; b: [number, number]; rest: [number, number][] };

/** Lo que un encastre le hace a cada pieza: A recibe, B entra. */
export interface JointGeometry {
  cutA: Solid[];
  cutB: Solid[];
  addB: Solid[];
}

export const box = (b: Box): Solid => ({ kind: 'box', box: b });

/** Contacto de punta: B apoya una punta sobre una cara de A. */
export interface EndJoint {
  /** Eje en que B entra en A. */
  axis: Axis;
  /** Sentido en que B entra en A. */
  dir: 1 | -1;
  /** Eje del espesor de B en la cara de contacto. */
  thin: Axis;
  /** Eje del ancho de B en la cara de contacto. */
  wide: Axis;
  /** Coordenada de la cara de contacto sobre `axis`. */
  face: number;
  /** Sección de B que apoya sobre A, recortada a la cara de A. */
  section: Box;
}

export function endJoint(a: Box, b: Box): EndJoint | null {
  const c = endContact(a, b);
  if (!c) return null;
  const size = boxSize(b);
  const [k1, k2] = otherAxes(c.axis);
  const [thin, wide] = size[k1] <= size[k2] ? [k1, k2] : [k2, k1];
  const section = copyBox(b);
  for (const k of [k1, k2]) {
    section.min[k] = Math.max(a.min[k], b.min[k]);
    section.max[k] = Math.min(a.max[k], b.max[k]);
  }
  return { axis: c.axis, dir: c.dir, thin, wide, face: c.dir === 1 ? b.max[c.axis] : b.min[c.axis], section };
}

/** Caja con la sección de `base` que sale de la cara de contacto `depth` mm hacia adentro de A. */
export function slab(j: EndJoint, depth: number, base: Box = j.section): Box {
  const s = copyBox(base);
  s.min[j.axis] = j.dir === 1 ? j.face : j.face - depth;
  s.max[j.axis] = j.dir === 1 ? j.face + depth : j.face;
  return s;
}

/** Redondea a medio milímetro, la precisión de una buena regla de taller. */
export const half = (mm: number) => Math.round(mm * 2) / 2;

/** Puntos a lo largo del arco que pasa por a, mid y b (n tramos), para dibujarlo o medirlo. */
export function arcPoints(a: [number, number], mid: [number, number], b: [number, number], n: number): [number, number][] {
  const c = circleThrough(a, mid, b);
  if (!c) return [a, b];
  const ang = (p: [number, number]) => Math.atan2(p[1] - c.center[1], p[0] - c.center[0]);
  const a0 = ang(a);
  let a1 = ang(b);
  const am = ang(mid);
  // Recorre el sentido que pasa por mid.
  const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const ccw = norm(am - a0) < norm(a1 - a0);
  a1 = ccw ? a0 + norm(a1 - a0) : a0 - norm(a0 - a1);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = a0 + ((a1 - a0) * i) / n;
    return [c.center[0] + c.radius * Math.cos(t), c.center[1] + c.radius * Math.sin(t)];
  });
}

/** Círculo que pasa por tres puntos, o null si están alineados. */
export function circleThrough(a: [number, number], b: [number, number], c: [number, number]): { center: [number, number]; radius: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return null;
  const s = (p: [number, number]) => p[0] * p[0] + p[1] * p[1];
  const ux = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d;
  const uy = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
  return { center: [ux, uy], radius: Math.hypot(a[0] - ux, a[1] - uy) };
}

/** Caja que envuelve un sólido (los cilindros y agujeros, como su caja). */
export function solidBox(s: Solid): Box {
  switch (s.kind) {
    case 'box':
      return s.box;
    case 'cylinder': {
      const min = [...s.start] as Vec3;
      const max = [...s.start] as Vec3;
      for (const k of [0, 1, 2] as Axis[]) {
        if (k === s.axis) {
          if (s.dir > 0) max[k] += s.length;
          else min[k] -= s.length;
        } else {
          min[k] -= s.radius;
          max[k] += s.radius;
        }
      }
      return { min, max };
    }
    case 'prism': {
      const min: Vec3 = [0, 0, 0];
      const max: Vec3 = [0, 0, 0];
      min[s.axis] = Math.min(s.from, s.to);
      max[s.axis] = Math.max(s.from, s.to);
      min[s.u] = Math.min(...s.points.map((p) => p[0]));
      max[s.u] = Math.max(...s.points.map((p) => p[0]));
      min[s.v] = Math.min(...s.points.map((p) => p[1]));
      max[s.v] = Math.max(...s.points.map((p) => p[1]));
      return { min, max };
    }
    case 'arc': {
      const pts = [...arcPoints(s.a, s.mid, s.b, 32), ...s.rest];
      const min: Vec3 = [0, 0, 0];
      const max: Vec3 = [0, 0, 0];
      min[s.axis] = Math.min(s.from, s.to);
      max[s.axis] = Math.max(s.from, s.to);
      min[s.u] = Math.min(...pts.map((p) => p[0]));
      max[s.u] = Math.max(...pts.map((p) => p[0]));
      min[s.v] = Math.min(...pts.map((p) => p[1]));
      max[s.v] = Math.max(...pts.map((p) => p[1]));
      return { min, max };
    }
    case 'bore': {
      const end = s.start.map((v, k) => v + s.dir[k]! * s.length);
      // Un disco de radio r perpendicular a dir se extiende r·√(1 − dir_k²) sobre cada eje.
      const ext = s.dir.map((d) => s.radius * Math.sqrt(Math.max(0, 1 - d * d)));
      return {
        min: [0, 1, 2].map((k) => Math.min(s.start[k]!, end[k]!) - ext[k]!) as Vec3,
        max: [0, 1, 2].map((k) => Math.max(s.start[k]!, end[k]!) + ext[k]!) as Vec3,
      };
    }
  }
}

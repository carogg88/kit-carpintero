import { boxSize, copyBox, endContact, otherAxes, type Axis, type Box, type Vec3 } from '../geometry';

/** Sólido simple que un encastre suma o resta. Medidas en mm. */
export type Solid =
  | { kind: 'box'; box: Box }
  /** Cilindro que arranca en `start` y avanza `length` mm sobre `axis`, en el sentido `dir`. */
  | { kind: 'cylinder'; start: Vec3; axis: Axis; dir: 1 | -1; radius: number; length: number };

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

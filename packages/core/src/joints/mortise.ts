import { boxSize, type Box } from '../geometry';
import { box, endJoint, slab, type JointGeometry } from './common';

export interface MortiseParams {
  /** Largo de la espiga, en mm. */
  length: number;
  /** Espesor de la espiga; por la regla del tercio, un tercio del espesor de la pieza. */
  thickness: number;
  /** Hombro a cada lado de la espiga, en mm. */
  shoulder: number;
}

/** Medidas de taller para una mortaja: espiga de un tercio, hasta 40 mm de largo, hombros de 10 mm. */
export function defaultMortiseParams(mortisePart: Box, tenonPart: Box): MortiseParams | null {
  const j = endJoint(mortisePart, tenonPart);
  if (!j) return null;
  const size = boxSize(tenonPart);
  const depthAvailable = boxSize(mortisePart)[j.axis];
  return {
    length: Math.round(Math.min(40, depthAvailable * 0.65)),
    thickness: Math.round((size[j.thin] / 3) * 10) / 10,
    shoulder: 10,
  };
}

/**
 * Geometría de una mortaja y espiga: la espiga que se suma a `tenonPart` y la mortaja que se resta
 * de `mortisePart` (2 mm más profunda, para la cola sobrante).
 */
export function mortiseAndTenon(mortisePart: Box, tenonPart: Box, p: MortiseParams): { tenon: Box; mortise: Box } | null {
  const j = endJoint(mortisePart, tenonPart);
  if (!j) return null;
  const section = slab(j, 0, tenonPart);
  const mid = (tenonPart.min[j.thin] + tenonPart.max[j.thin]) / 2;
  section.min[j.thin] = mid - p.thickness / 2;
  section.max[j.thin] = mid + p.thickness / 2;
  section.min[j.wide] = tenonPart.min[j.wide] + p.shoulder;
  section.max[j.wide] = tenonPart.max[j.wide] - p.shoulder;
  return { tenon: slab(j, p.length, section), mortise: slab(j, p.length + 2, section) };
}

export function mortiseGeometry(a: Box, b: Box, p: MortiseParams): JointGeometry | null {
  const g = mortiseAndTenon(a, b, p);
  return g && { cutA: [box(g.mortise)], cutB: [], addB: [box(g.tenon)] };
}

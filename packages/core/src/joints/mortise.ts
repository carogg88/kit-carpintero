import { boxSize, endContact, type Box } from '../geometry';

export interface MortiseParams {
  /** Largo de la espiga, en mm. */
  length: number;
  /** Espesor de la espiga; por la regla del tercio, un tercio del espesor de la pieza. */
  thickness: number;
  /** Hombro a cada lado de la espiga, en mm. */
  shoulder: number;
}

/** Medidas por defecto para una espiga en la pieza `tenonPart` que entra en `mortisePart`. */
export function defaultMortiseParams(mortisePart: Box, tenonPart: Box): MortiseParams | null {
  const c = endContact(mortisePart, tenonPart);
  if (!c) return null;
  const receiving = boxSize(mortisePart)[c.axis];
  const cross = boxSize(tenonPart).filter((_, k) => k !== c.axis);
  const thin = Math.min(...cross);
  return {
    length: Math.round(Math.min(40, receiving * 0.65)),
    thickness: Math.round((thin / 3) * 10) / 10,
    shoulder: 10,
  };
}

/**
 * Geometría de una mortaja y espiga: la espiga que se suma a `tenonPart` y la mortaja que se resta
 * de `mortisePart` (2 mm más profunda, para la cola sobrante).
 */
export function mortiseAndTenon(mortisePart: Box, tenonPart: Box, p: MortiseParams): { tenon: Box; mortise: Box } | null {
  const c = endContact(mortisePart, tenonPart);
  if (!c) return null;
  const size = boxSize(tenonPart);
  const [a1, a2]: [0 | 1 | 2, 0 | 1 | 2] = c.axis === 0 ? [1, 2] : c.axis === 1 ? [0, 2] : [0, 1];
  const [thinAxis, wideAxis] = size[a1] <= size[a2] ? [a1, a2] : [a2, a1];

  const tenon: Box = { min: [...tenonPart.min], max: [...tenonPart.max] };
  const face = c.dir === 1 ? tenonPart.max[c.axis] : tenonPart.min[c.axis];
  tenon.min[c.axis] = c.dir === 1 ? face : face - p.length;
  tenon.max[c.axis] = c.dir === 1 ? face + p.length : face;
  const mid = (tenonPart.min[thinAxis] + tenonPart.max[thinAxis]) / 2;
  tenon.min[thinAxis] = mid - p.thickness / 2;
  tenon.max[thinAxis] = mid + p.thickness / 2;
  tenon.min[wideAxis] = tenonPart.min[wideAxis] + p.shoulder;
  tenon.max[wideAxis] = tenonPart.max[wideAxis] - p.shoulder;

  const mortise: Box = { min: [...tenon.min], max: [...tenon.max] };
  if (c.dir === 1) mortise.max[c.axis] += 2;
  else mortise.min[c.axis] -= 2;
  return { tenon, mortise };
}

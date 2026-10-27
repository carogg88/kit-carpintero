import { boxSize, copyBox, type Box } from '../geometry';
import { box, endJoint, half, slab, type JointGeometry } from './common';

export interface MortiseParams {
  /** Largo de la espiga, en mm. */
  length: number;
  /** Espesor de la espiga; por la regla del tercio, un tercio del espesor de la pieza. */
  thickness: number;
  /** Hombro a cada lado de la espiga, en mm. */
  shoulder: number;
  /**
   * Espigas: 1, o 2 lado a lado en una pieza ancha (un faldón alto), con `gap` mm de madera entre las dos. Dos espigas
   * angostas se mueven menos con la madera que una ancha y no debilitan tanto la pata. Si falta, es una.
   */
  count?: number;
  gap?: number;
}

/** Desde este ancho de espiga conviene partirla en dos. */
export const DOUBLE_TENON_FROM = 90;

/** Separación entre las dos espigas, para empezar: un tercio del ancho, redondeado a medio milímetro. */
export const defaultTenonGap = (width: number) => half(width / 3);

/**
 * Dónde va cada espiga a lo ancho, entre `from` y `to` (ya sin los hombros): una sola, o dos con `gap` en el medio.
 * Si el hueco no deja madera para las dos, queda una.
 */
export function tenonSpans(from: number, to: number, count = 1, gap?: number): [number, number][] {
  const width = to - from;
  if (count < 2 || width <= 0) return [[from, to]];
  const g = Math.max(1, gap ?? defaultTenonGap(width));
  const each = (width - g) / 2;
  if (each < 3) return [[from, to]];
  return [
    [from, from + each],
    [to - each, to],
  ];
}

/** Ancho de cada espiga, en mm: con dos, el de una de ellas. */
export function tenonWidth(wide: number, p: Pick<MortiseParams, 'shoulder' | 'count' | 'gap'>): number {
  const [first] = tenonSpans(0, wide - 2 * p.shoulder, p.count, p.gap);
  return first![1] - first![0];
}

/**
 * Medidas de taller para una mortaja: espiga de un tercio, hasta 40 mm de largo, hombros de 10 mm. En piezas angostas
 * (un travesaño de 3 cm) el hombro baja a un sexto del ancho, para que la espiga no quede de 1 cm y se quiebre.
 */
export function defaultMortiseParams(mortisePart: Box, tenonPart: Box): MortiseParams | null {
  const j = endJoint(mortisePart, tenonPart);
  if (!j) return null;
  const size = boxSize(tenonPart);
  const depthAvailable = boxSize(mortisePart)[j.axis];
  const wide = j.section.max[j.wide] - j.section.min[j.wide];
  const shoulder = Math.min(10, Math.max(3, half(wide / 6)));
  return {
    length: Math.round(Math.min(40, depthAvailable * 0.65)),
    thickness: Math.round((size[j.thin] / 3) * 10) / 10,
    shoulder,
    // Una espiga; si se pasa a doble, con esta separación.
    count: 1,
    gap: defaultTenonGap(wide - 2 * shoulder),
  };
}

/** Por debajo de este ancho, una espiga se quiebra con facilidad. */
export const MIN_TENON_WIDTH = 15;

/**
 * Geometría de una mortaja y espiga: la espiga que se suma a `tenonPart` y la mortaja que se resta
 * de `mortisePart` (2 mm más profunda, para la cola sobrante). Con espiga doble, es lo que ocupan las dos juntas.
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

/** Cada espiga con su mortaja: una, o las dos de una espiga doble. */
export function splitTenons<T extends { tenon: Box; mortise: Box }>(g: T, axis: number, p: Pick<MortiseParams, 'count' | 'gap'>): { tenon: Box; mortise: Box }[] {
  return tenonSpans(g.tenon.min[axis]!, g.tenon.max[axis]!, p.count, p.gap).map(([lo, hi]) => {
    const tenon = copyBox(g.tenon);
    const mortise = copyBox(g.mortise);
    tenon.min[axis] = mortise.min[axis] = lo;
    tenon.max[axis] = mortise.max[axis] = hi;
    return { tenon, mortise };
  });
}

export function mortiseGeometry(a: Box, b: Box, p: MortiseParams): JointGeometry | null {
  const g = mortiseAndTenon(a, b, p);
  const j = endJoint(a, b);
  if (!g || !j) return null;
  const pieces = splitTenons(g, j.wide, p);
  return { cutA: pieces.map((x) => box(x.mortise)), cutB: [], addB: pieces.map((x) => box(x.tenon)) };
}

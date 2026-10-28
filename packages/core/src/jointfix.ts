import { boxSize, copyBox, otherAxes, overlapBox, partBox, type Axis, type Box } from './geometry';
import { BISCUITS, defaultJointParams, endJoint, half, nearestEdge, recommendedJoint } from './joints';
import { fitJointDepths } from './jointfit';
import { partAxesBySize } from './edit';
import { applyReviewFix, type ReviewFix } from './review';
import { JOINT_TYPES, type JointType, type Part, type Project } from './project';
import { t } from './i18n';

/**
 * Por qué un encastre no se puede entre dos piezas, y qué cambiar para que se pueda. Las reglas son las mismas que
 * deciden si se puede (`defaultJointParams`): acá solo se dicen en palabras de taller y se busca el arreglo más chico.
 */

/** Un arreglo es una pieza que cambia de medida o de lugar sobre un eje, como los de la revisión. */
export type PartFix = Extract<ReviewFix, { kind: 'part' }>;

export interface JointOption {
  type: JointType;
  ok: boolean;
  /** Qué le falta, cuando no se puede. */
  reason?: string;
  /** El cambio que lo hace posible, si hay uno solo razonable. */
  fix?: PartFix;
}

type Model = Pick<Project, 'parts' | 'joints'>;

/** Medidas mínimas de cada encastre, las mismas de sus reglas. */
const MIN_THICK: Partial<Record<JointType, number>> = { 'cola-milano': 6, dedos: 6, brida: 12, galleta: 12, machiembrado: 9, bolsillo: 12 };
const MIN_WIDE: Partial<Record<JointType, number>> = { 'cola-milano': 30, dedos: 20, galleta: BISCUITS[0]![1] + 20, machiembrado: 50, bolsillo: 25 };

/** Lo que una pieza puede cambiar sin romper algo que no se ve en su caja. */
const plain = (p: Part) => p.base.kind === 'box' && !p.lean && !p.turning;

const sizeOf = (b: Box, k: Axis) => b.max[k] - b.min[k];

/** La caja después del arreglo. */
function fixedBox(b: Box, fix: PartFix): Box {
  const c = copyBox(b);
  c.min[fix.axis] = fix.min;
  c.max[fix.axis] = fix.min + fix.size;
  return c;
}

/** Más grueso o más ancho sobre `axis`, parejo de los dos lados. */
function grow(part: Part, b: Box, axis: Axis, size: number, label: string): PartFix {
  const mid = (b.min[axis] + b.max[axis]) / 2;
  return { kind: 'part', label, part: part.id, axis, min: half(mid - size / 2), size };
}

/**
 * Dos piezas que se cruzan: si la punta de una queda adentro de la otra, se recorta hasta la cara donde empieza la
 * otra. Del par, el que recorta a lo largo y, si no, el más corto. Si se cruzan de lado a lado, no hay recorte.
 */
export function trimToFace(a: Part, b: Part): { fix: PartFix; trimmed: Part; other: Part; depth: number } | null {
  const ba = partBox(a);
  const bb = partBox(b);
  if (!overlapBox(ba, bb)) return null;
  let best: { fix: PartFix; trimmed: Part; other: Part; depth: number } | null = null;
  // Se recorta a lo largo de la pieza (un travesaño que se pasó), no a lo ancho; entre esos, el recorte más corto.
  const along = (p: Part, k: Axis) => partAxesBySize(p)[0] === k;
  const better = (p: Part, k: Axis, depth: number) =>
    !best || (along(p, k) && !along(best.trimmed, best.fix.axis)) || (along(p, k) === along(best.trimmed, best.fix.axis) && depth < best.depth);
  for (const [p, q] of [
    [b, a],
    [a, b],
  ] as const) {
    if (!plain(p)) continue;
    const P = partBox(p);
    const Q = partBox(q);
    for (const k of [0, 1, 2] as Axis[]) {
      // Para que después se toquen de punta, las otras dos medidas tienen que compartir algo.
      if (!otherAxes(k).every((o) => Math.min(P.max[o], Q.max[o]) - Math.max(P.min[o], Q.min[o]) > 5)) continue;
      const label = t('Recortar {p} hasta la cara de {q}', { p: p.id, q: q.id });
      // Entra por abajo de Q y la punta queda adentro.
      if (P.min[k] < Q.min[k] && P.max[k] > Q.min[k] && P.max[k] <= Q.max[k] + 0.01) {
        const size = Q.min[k] - P.min[k];
        const depth = P.max[k] - Q.min[k];
        if (size >= 10 && better(p, k, depth)) best = { fix: { kind: 'part', label, part: p.id, axis: k, min: P.min[k], size }, trimmed: p, other: q, depth };
      }
      // Entra por arriba.
      if (P.max[k] > Q.max[k] && P.min[k] < Q.max[k] && P.min[k] >= Q.min[k] - 0.01) {
        const size = P.max[k] - Q.max[k];
        const depth = Q.max[k] - P.min[k];
        if (size >= 10 && better(p, k, depth)) best = { fix: { kind: 'part', label, part: p.id, axis: k, min: Q.max[k], size }, trimmed: p, other: q, depth };
      }
    }
  }
  return best;
}

/** Por qué no, y el arreglo, para un encastre entre piezas que se tocan de punta. */
function endReason(type: JointType, a: Part, b: Part, n: (mm: number) => string): Omit<JointOption, 'type' | 'ok'> {
  const ba = partBox(a);
  const bb = partBox(b);
  const j = endJoint(ba, bb)!;
  const thick = sizeOf(bb, j.thin);
  const wide = sizeOf(j.section, j.wide);
  const ok = (fix: PartFix) => {
    const fb = fixedBox(bb, fix);
    return defaultJointParams(type, ba, fb) !== null;
  };
  const offer = (fix: PartFix | null) => (fix && plain(b) && ok(fix) ? { fix } : {});
  if (type === 'media-madera') return { reason: t('La media madera es para piezas que se cruzan, y estas se tocan sin cruzarse.') };
  const minThick = MIN_THICK[type];
  if (minThick && thick < minThick)
    return {
      reason: t('{b} tiene {w} de espesor; este encastre pide por lo menos {min}.', { b: b.id, w: n(thick), min: n(minThick) }),
      ...offer(grow(b, bb, j.thin, minThick, t('Engrosar {b} a {mm}', { b: b.id, mm: n(minThick) }))),
    };
  const minWide = MIN_WIDE[type];
  if (minWide && wide < minWide) {
    const size = sizeOf(bb, j.wide) + (minWide - wide);
    return {
      reason: t('{b} apoya {w} de ancho en {a}; este encastre pide por lo menos {min}.', { a: a.id, b: b.id, w: n(wide), min: n(minWide) }),
      ...offer(grow(b, bb, j.wide, size, t('Ensanchar {b} a {mm}', { b: b.id, mm: n(size) }))),
    };
  }
  if (type === 'galleta' && sizeOf(ba, j.axis) < 14)
    return { reason: t('{a} tiene {w} donde entra la galleta; hace falta por lo menos {min}.', { a: a.id, w: n(sizeOf(ba, j.axis)), min: n(14) }) };
  if (type === 'bolsillo' && sizeOf(bb, j.axis) < 60)
    return { reason: t('{b} tiene {w} de largo; el tornillo de bolsillo pide por lo menos {min}.', { b: b.id, w: n(sizeOf(bb, j.axis)), min: n(60) }) };
  if (type === 'machiembrado')
    return { reason: t('Es para tablas de espesor parecido: {a} tiene {x} y {b} tiene {y}.', { a: a.id, b: b.id, x: n(sizeOf(ba, j.thin)), y: n(thick) }) };
  if (type === 'inglete' || type === 'rebaje') {
    const edge = nearestEdge(ba, j);
    const to = edge.side === 'min' ? ba.min[j.thin] : ba.max[j.thin] - thick;
    const fix: PartFix = { kind: 'part', label: t('Llevar {b} al ras del canto de {a}', { a: a.id, b: b.id }), part: b.id, axis: j.thin, min: half(to), size: thick };
    return {
      reason:
        type === 'inglete'
          ? t('{b} queda {mm} adentro del canto de {a}. El inglete va en la esquina, con las dos piezas al ras.', { a: a.id, b: b.id, mm: n(edge.gap) })
          : t('{b} queda {mm} adentro del canto de {a}; tan adentro va un canal, no un rebaje.', { a: a.id, b: b.id, mm: n(edge.gap) }),
      ...offer(fix),
    };
  }
  return { reason: t('No se puede entre estas dos piezas.') };
}

/**
 * Todos los encastres entre A (recibe) y B (entra): los que se pueden, y los que no con el motivo y, si hay, el arreglo.
 * `n` escribe una medida en las unidades del proyecto.
 */
export function jointChoices(a: Part, b: Part, n: (mm: number) => string): JointOption[] {
  const ba = partBox(a);
  const bb = partBox(b);
  const crossing = !!overlapBox(ba, bb);
  const touching = crossing || !!endJoint(ba, bb);
  const trim = crossing ? trimToFace(a, b) : null;
  return JOINT_TYPES.map((type): JointOption => {
    if (defaultJointParams(type, ba, bb) !== null) return { type, ok: true };
    if (!touching) return { type, ok: false, reason: t('{a} y {b} no se tocan.', { a: a.id, b: b.id }) };
    if (crossing) {
      if (!trim) return { type, ok: false, reason: t('Se cruzan de lado a lado: así solo salen media madera o apoyado en muesca.') };
      const reason = t('Se cruzan: {p} se mete {mm} adentro de {q}. Para este encastre, la punta de {p} tiene que llegar justo a la cara de {q}.', {
        p: trim.trimmed.id,
        q: trim.other.id,
        mm: n(trim.depth),
      });
      const other = partBox(trim.other);
      const cut = fixedBox(partBox(trim.trimmed), trim.fix);
      return { type, ok: false, reason, ...(defaultJointParams(type, other, cut) !== null ? { fix: trim.fix } : {}) };
    }
    return { type, ok: false, ...endReason(type, a, b, n) };
  });
}

/**
 * Aplica el arreglo y deja la unión con el encastre pedido, con el mismo nombre. Si el arreglo fue recortar una pieza,
 * esa pieza pasa a ser la que entra.
 */
export function applyJointFix(d: Model, jointId: string, type: JointType, fix: PartFix): void {
  const joint = d.joints.find((x) => x.id === jointId);
  if (!joint) return;
  applyReviewFix(d, fix);
  const a = d.parts.find((p) => p.id === joint.partA);
  const b = d.parts.find((p) => p.id === joint.partB);
  if (!a || !b) return;
  // La pieza recortada es la que apoya la punta.
  if (fix.part === joint.partA && defaultJointParams(type, partBox(b), partBox(a)) !== null) [joint.partA, joint.partB] = [joint.partB, joint.partA];
  joint.type = type;
  joint.params = {};
  fitJointDepths(d, new Set([joint.id]));
}

/**
 * Cambia cuál de las dos piezas recibe: la que entraba pasa a tener la caja, el rebaje o los huecos. Si el encastre no
 * se puede al revés, pasa al que se recomienda al revés.
 */
export function swapJoint(d: Model, jointId: string): void {
  const joint = d.joints.find((x) => x.id === jointId);
  const a = d.parts.find((p) => p.id === joint?.partA);
  const b = d.parts.find((p) => p.id === joint?.partB);
  if (!joint || !a || !b) return;
  const [na, nb] = [partBox(b), partBox(a)];
  [joint.partA, joint.partB] = [joint.partB, joint.partA];
  if (defaultJointParams(joint.type, na, nb) === null) joint.type = recommendedJoint(na, nb) ?? 'tope';
  joint.params = {};
  fitJointDepths(d, new Set([joint.id]));
}

/** Se puede cambiar quién recibe: al revés sale algún encastre que corta algo. */
export function canSwap(a: Part, b: Part): boolean {
  const ba = partBox(a);
  const bb = partBox(b);
  return JOINT_TYPES.some((type) => type !== 'tope' && defaultJointParams(type, bb, ba) !== null);
}

/** Dos piezas que casi se tocan: les falta poco para tener una unión. */
export interface NearMiss {
  a: string;
  b: string;
  gap: number;
  /** Estirar la pieza que apunta a la otra hasta tocarla. */
  fix: PartFix;
}

/** Lo que se toma como “casi”: menos que esto es un descuido; más, una separación buscada. */
export const NEAR_GAP = 5;

/**
 * Pares de piezas sin unión separados por una luz chica (hasta `maxGap` mm), con el arreglo: estirar la punta de una
 * hasta la cara de la otra (`n` escribe la medida). Se estira la que tiene el largo en esa dirección; así su otra punta no se mueve.
 */
export function nearMisses(project: Model, n: (mm: number) => string, maxGap = NEAR_GAP): NearMiss[] {
  const parts = project.parts.filter(plain);
  const joined = new Set(project.joints.map((j) => [j.partA, j.partB].sort().join('|')));
  const out: NearMiss[] = [];
  for (let i = 0; i < parts.length; i++) {
    for (let k = i + 1; k < parts.length; k++) {
      const p = parts[i]!;
      const q = parts[k]!;
      if (joined.has([p.id, q.id].sort().join('|'))) continue;
      const P = partBox(p);
      const Q = partBox(q);
      for (const axis of [0, 1, 2] as Axis[]) {
        if (!otherAxes(axis).every((o) => Math.min(P.max[o], Q.max[o]) - Math.max(P.min[o], Q.min[o]) > 5)) continue;
        const gapPQ = Q.min[axis] - P.max[axis];
        const gapQP = P.min[axis] - Q.max[axis];
        const gap = gapPQ > 0 ? gapPQ : gapQP;
        if (!(gap > 0.6 && gap <= maxGap)) continue;
        // Se estira la pieza larga en esa dirección; si las dos o ninguna, la más chica.
        const long = (x: Part) => partAxesBySize(x)[0] === axis;
        const vol = (b: Box) => sizeOf(b, 0) * sizeOf(b, 1) * sizeOf(b, 2);
        const pickP = long(p) !== long(q) ? long(p) : vol(P) <= vol(Q);
        const [s, o, S] = pickP ? [p, q, P] : [q, p, Q];
        // Hacia dónde está la otra pieza.
        const toMax = pickP ? gapPQ > 0 : gapQP > 0;
        const fix: PartFix = {
          kind: 'part',
          label: t('Estirar {p} {mm} hasta {q}', { p: s.id, q: o.id, mm: n(gap) }),
          part: s.id,
          axis,
          min: toMax ? S.min[axis] : S.min[axis] - gap,
          size: boxSize(S)[axis] + gap,
        };
        out.push({ a: o.id, b: s.id, gap, fix });
        break;
      }
    }
  }
  return out;
}

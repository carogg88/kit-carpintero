import { boxSize, endContact, otherAxes, overlapBox, partBox, type Axis, type Box } from './geometry';
import { defaultJointParams, jointName, recommendedJoint } from './joints';
import { partAxesBySize } from './edit';
import { NEAR_GAP, trimToFace, type PartFix } from './jointfix';
import { JOINT_TYPES, type JointType, type Part, type Project } from './project';
import { t } from './i18n';

/**
 * Guía al mover: mientras una pieza se arrastra, qué unión sale con la vecina que toca, si quedó una luz chica que no
 * da unión o si se mete en otra. Y, para dos piezas elegidas, cómo llevarlas a que se unan.
 */

type Model = Pick<Project, 'parts' | 'joints'>;

const box = (p: Part) => p.base.kind === 'box';
const sizeOf = (b: Box, k: Axis) => b.max[k] - b.min[k];
const vol = (b: Box) => sizeOf(b, 0) * sizeOf(b, 1) * sizeOf(b, 2);
/** Las otras dos medidas comparten algo: quedan enfrentadas sobre `k`. */
const facing = (a: Box, b: Box, k: Axis) => otherAxes(k).every((o) => Math.min(a.max[o], b.max[o]) - Math.max(a.min[o], b.min[o]) > 5);

/** Los encastres que salen entre dos cajas, cualquiera reciba; el recomendado primero y a tope solo si no hay otro. */
export function jointsBetween(a: Box, b: Box): JointType[] {
  const ok = JOINT_TYPES.filter((type) => type !== 'tope' && (defaultJointParams(type, a, b) !== null || defaultJointParams(type, b, a) !== null));
  const best = recommendedJoint(a, b) ?? recommendedJoint(b, a);
  if (best && best !== 'tope' && ok.includes(best)) ok.sort((x, y) => Number(y === best) - Number(x === best));
  return ok.length ? ok : JOINT_TYPES.filter((type) => type === 'tope' && defaultJointParams(type, a, b) !== null);
}

/** “Mortaja y espiga, tarugos y 4 más”. */
export function jointList(types: JointType[], crossing = false, max = 2): string {
  const names = types.slice(0, max).map((type) => t(jointName(type, crossing)).toLocaleLowerCase());
  const rest = types.length - names.length;
  if (rest > 0) return t('{list} y {n} más', { list: names.join(', '), n: rest });
  return names.length === 2 ? t('{a} o {b}', { a: names[0]!, b: names[1]! }) : (names[0] ?? '');
}

export interface MoveGuide {
  /** La unión que sale con la vecina que toca. */
  joint?: string;
  /** Algo que no da unión, o choca. */
  warn?: string;
  /** Dónde se mete en otra pieza, para pintarlo. */
  clash: Box[];
}

/** Cruces que son a propósito: ya tienen su media madera o su muesca. */
const CROSSING: JointType[] = ['media-madera', 'tope'];

/**
 * Lo que pasa con las piezas `ids` en el lugar donde están ahora, contra el resto: con quién se tocan y qué unión sale,
 * con quién se cruzan (y dónde) y a quién le quedó una luz chica. `n` escribe una medida.
 */
export function moveGuide(project: Model, ids: readonly string[], n: (mm: number) => string): MoveGuide {
  const moving = project.parts.filter((p) => ids.includes(p.id) && box(p));
  const others = project.parts.filter((p) => !ids.includes(p.id) && box(p));
  const joined = new Map(project.joints.map((j) => [[j.partA, j.partB].sort().join('|'), j.type]));
  const out: MoveGuide = { clash: [] };
  let gap: string | undefined;
  let contact: { o: Part; O: Box; M: Box; end: boolean } | undefined;
  for (const m of moving) {
    const M = partBox(m);
    for (const o of others) {
      const O = partBox(o);
      const cross = overlapBox(M, O);
      if (cross) {
        const had = joined.get([m.id, o.id].sort().join('|'));
        if (had && CROSSING.includes(had)) {
          out.joint ??= t('Cruza {o}: {joint}', { o: o.id, joint: t(jointName(had, true)).toLocaleLowerCase() });
          continue;
        }
        out.clash.push(cross);
        const trim = trimToFace(o, m);
        out.warn ??=
          trim && trim.trimmed.id === m.id
            ? t('Se mete {mm} en {o}: dejala en la cara para una caja y espiga', { o: o.id, mm: n(trim.depth) })
            : t('Se cruza con {o}: solo sale media madera o apoyado en muesca', { o: o.id });
        continue;
      }
      const touch = endContact(O, M) ?? endContact(M, O);
      if (touch) {
        // Manda la punta de la pieza (un travesaño que llega a la pata) sobre lo que apoya de costado (la tapa).
        const end = partAxesBySize(m)[0] === touch.axis;
        if (!contact || (end && !contact.end)) contact = { o, O, M, end };
        continue;
      }
      for (const k of [0, 1, 2] as Axis[]) {
        if (!facing(M, O, k)) continue;
        const d = Math.max(O.min[k] - M.max[k], M.min[k] - O.max[k]);
        if (d > 0.6 && d <= NEAR_GAP) gap ??= t('Queda a {mm} de {o}: así no hay unión', { o: o.id, mm: n(d) });
      }
    }
  }
  // Metida en otra, la unión con la que toca no es lo que importa.
  if (contact && !out.joint && !out.clash.length) {
    const { o, O, M } = contact;
    const types = jointsBetween(O, M);
    out.joint = types.length ? t('Toca {o}: {list}', { o: o.id, list: jointList(types) }) : t('Toca {o}, pero no sale ninguna unión', { o: o.id });
  }
  out.warn ??= gap;
  return out;
}

export interface JoinPlan {
  /** La que se queda. */
  a: string;
  /** La que va hacia la otra. */
  b: string;
  touching: boolean;
  /** Los encastres que salen ya, o después del arreglo. */
  joints: JointType[];
  crossing: boolean;
  /** Llevarla hasta la cara, o estirar la que apunta a la otra (cada uno con su etiqueta). */
  fixes: PartFix[];
  /** Por qué no hay arreglo. */
  reason?: string;
}

/**
 * Dos piezas que se quieren unir: si ya se tocan, qué unión sale; si no, cómo llevar la más chica hasta la cara de la
 * otra (o estirar la que apunta) y qué unión saldría así. `n` escribe una medida.
 */
export function joinPlan(p: Part, q: Part, n: (mm: number) => string): JoinPlan | null {
  if (!box(p) || !box(q)) return null;
  const P = partBox(p);
  const Q = partBox(q);
  // Se mueve la más chica: un travesaño hacia la pata, no la pata.
  const [a, b, A, B] = vol(P) >= vol(Q) ? [p, q, P, Q] : [q, p, Q, P];
  const base = { a: a.id, b: b.id };
  const cross = overlapBox(A, B);
  if (cross || endContact(A, B) || endContact(B, A)) {
    const trim = cross ? trimToFace(a, b) : null;
    return { ...base, touching: true, crossing: !!cross, joints: jointsBetween(A, B), fixes: trim ? [trim.fix] : [] };
  }
  const k = ([0, 1, 2] as Axis[]).find((x) => facing(A, B, x));
  if (k === undefined)
    return { ...base, touching: false, crossing: false, joints: [], fixes: [], reason: t('No quedan enfrentadas: corré {b} hasta que quede frente a {a}.', base) };
  const toMax = B.max[k] <= A.min[k];
  const gap = toMax ? A.min[k] - B.max[k] : B.min[k] - A.max[k];
  const size = boxSize(B)[k];
  const fixes: PartFix[] = [
    { kind: 'part', label: t('Llevar {b} hasta {a}', base), part: b.id, axis: k, min: toMax ? A.min[k] - size : A.max[k], size },
  ];
  // Estirar sirve si la pieza tiene el largo en esa dirección: su otra punta no se mueve.
  const long = (x: Part) => partAxesBySize(x)[0] === k;
  const stretcher = long(b) ? b : long(a) ? a : null;
  if (stretcher) {
    const S = stretcher === b ? B : A;
    const up = stretcher === b ? toMax : !toMax;
    const other = stretcher === b ? a : b;
    fixes.push({
      kind: 'part',
      label: t('Estirar {p} {mm} hasta {q}', { p: stretcher.id, q: other.id, mm: n(gap) }),
      part: stretcher.id,
      axis: k,
      min: up ? S.min[k] : S.min[k] - gap,
      size: sizeOf(S, k) + gap,
    });
  }
  const moved: Box = { min: [...B.min], max: [...B.max] };
  moved.min[k] = fixes[0]!.min;
  moved.max[k] = fixes[0]!.min + size;
  return { ...base, touching: false, crossing: false, joints: jointsBetween(A, moved), fixes };
}

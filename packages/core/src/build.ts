import { boxSize, type Box, type Vec3 } from './geometry';
import { placedBox } from './follow';
import { placedJoint } from './explode';
import { findMotions, type MotionKind } from './motion';
import type { Joint, Project } from './project';

/**
 * El orden de armado y por dónde entra cada pieza, para animar el armado y abrir el mueble en despiece. Sale de
 * desarmarlo: se saca primero lo que sale sin trabarse con nada (la tapa hacia arriba, una pata del extremo a lo largo
 * de su faldón) y, cuando ninguna pieza sale sola, una parte entera (los dos pies y su travesaño). Armar es hacerlo al
 * revés. Cada unión dice por dónde se puede separar: la espiga a lo largo de la espiga, lo que va a tope hacia
 * cualquier lado que no se meta en la otra pieza. Cajones, puertas y la tapa de una caja entran al final, ya armados.
 * No cambia el proyecto. Medidas en mm; el frente mira a +Z.
 */

export type BuildKind = 'base' | 'pieza' | 'parte' | MotionKind;

export interface BuildStep {
  /** Fijo para el mismo modelo. */
  key: string;
  kind: BuildKind;
  /** Lo que se mueve en este paso: una pieza, o una parte ya armada en pasos anteriores. */
  parts: string[];
  /** Las piezas ya puestas con las que se une en este paso. */
  onto: string[];
  /** Las uniones que cierra. */
  joints: string[];
  /** Entra en lo que ya está (es la espiga de alguna unión); si no, lo recibe (la pata que se calza en el faldón). */
  enters: boolean;
  /** Solo se apoya (todas sus uniones van a tope o atornilladas): la tapa sobre el armazón. */
  rests: boolean;
  /** Hacia dónde se mueve para entrar, de largo 1 (cero en la base). */
  dir: Vec3;
  /** Desde cuán lejos llega, en mm: lo que tiene que recorrer para entrar más un poco de aire. */
  distance: number;
  /** En qué se arma: 'mueble', o la primera pieza de la parte o del cajón que se arma aparte. */
  unit: string;
  /** No hubo forma de sacarla sin atravesar otra: entra derecho desde arriba. */
  forced?: boolean;
}

/** Una pieza o una parte que se sacó al desarmar, hacia `dir`, con su propio desarme si es una parte. */
interface Removal {
  parts: string[];
  dir: Vec3;
  distance: number;
  kind: BuildKind;
  sub?: Removal[];
  forced?: boolean;
}

/** Qué deja separar cada unión: una sola dirección (la espiga) o cualquiera que no se meta en la otra (a tope). */
interface Free {
  joint: Joint;
  /** Hacia dónde se aleja `b` de `a`. */
  v: Vec3;
  /** Medio espacio: vale cualquier dirección que no vaya contra `v`. */
  half: boolean;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Vec3): Vec3 => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n) as Vec3;
};
const moved = (b: Box, d: Vec3, s: number): Box => ({ min: b.min.map((v, k) => v + d[k]! * s) as Vec3, max: b.max.map((v, k) => v + d[k]! * s) as Vec3 });
/** Lo que comparten dos cajas, en mm³ (cero si apenas se tocan). */
function shared(a: Box, b: Box): number {
  let v = 1;
  for (let k = 0; k < 3; k++) {
    const e = Math.min(a.max[k]!, b.max[k]!) - Math.max(a.min[k]!, b.min[k]!);
    if (e <= 0.01) return 0;
    v *= e;
  }
  return v;
}
/** Se tocan o se meten: con medio milímetro de tolerancia. */
function touch(a: Box, b: Box): boolean {
  for (let k = 0; k < 3; k++) if (Math.min(a.max[k]!, b.max[k]!) - Math.max(a.min[k]!, b.min[k]!) < -0.5) return false;
  return true;
}

/** Las seis direcciones de los ejes, la de subir primero: lo de arriba sale levantándolo. */
const AXES: Vec3[] = [
  [0, 1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [0, -1, 0],
];

/** Cómo se separa cada unión. Lo que va a tope sale por la cara que se toca; la media madera, por el espesor. */
function freeOf(project: Pick<Project, 'parts' | 'joints'>, boxes: Map<string, Box>, j: Joint): Free | null {
  const a = boxes.get(j.partA);
  const b = boxes.get(j.partB);
  if (!a || !b) return null;
  if (j.type === 'tope' || j.type === 'bolsillo') {
    // La cara de contacto: el eje en que menos se superponen.
    let axis = 0;
    let least = Infinity;
    for (let k = 0; k < 3; k++) {
      const e = Math.min(a.max[k]!, b.max[k]!) - Math.max(a.min[k]!, b.min[k]!);
      if (e < least) [least, axis] = [e, k];
    }
    const v: Vec3 = [0, 0, 0];
    v[axis] = b.min[axis]! + b.max[axis]! >= a.min[axis]! + a.max[axis]! ? 1 : -1;
    return { joint: j, v, half: true };
  }
  if (j.type === 'media-madera') {
    // Las dos piezas se cruzan: se separan por el eje en que ninguna sobresale de la otra, la de entrar desde arriba.
    let axis = 1;
    let least = Infinity;
    for (let k = 0; k < 3; k++) {
      const out = Math.max(0, a.min[k]! - b.min[k]!) + Math.max(0, b.max[k]! - a.max[k]!) + Math.max(0, b.min[k]! - a.min[k]!) + Math.max(0, a.max[k]! - b.max[k]!);
      if (out < least - 0.01) [least, axis] = [out, k];
    }
    const v: Vec3 = [0, 0, 0];
    v[axis] = 1;
    return { joint: j, v, half: false };
  }
  const placed = placedJoint(project, j);
  if (!placed) return null;
  return { joint: j, v: unit(placed.explode.offset), half: j.type === 'inglete' };
}

interface Ctx {
  boxes: Map<string, Box>;
  free: Free[];
  /** Aire entre lo que sale y lo que queda. */
  air: number;
}

/** Cuánto hay que correr el grupo hacia `d` para que ya no toque nada de lo que queda; -1 si choca en el camino. */
function clearance(ctx: Ctx, group: string[], rest: string[], d: Vec3): number {
  const gs = group.map((id) => ctx.boxes.get(id)!);
  const rs = rest.map((id) => ctx.boxes.get(id)!);
  const start = gs.map((g) => rs.map((r) => shared(g, r)));
  const near = gs.map((g) => rs.map((r) => touch(g, r)));
  const span = Math.max(...gs.map((g) => Math.abs(dot(boxSize(g), d)))) + 10;
  const step = Math.max(2, span / 60);
  for (let s = step; s <= span + step; s += step) {
    let clear = true;
    for (let i = 0; i < gs.length; i++) {
      const m = moved(gs[i]!, d, s);
      for (let k = 0; k < rs.length; k++) {
        const now = shared(m, rs[k]!);
        // Lo que estaba metido puede salir; lo que se mete más es un choque.
        if (now > start[i]![k]! * 1.002 + 50) return -1;
        if (near[i]![k] && touch(m, rs[k]!)) clear = false;
      }
    }
    if (clear) {
      // Lo que no se tocaba tampoco puede quedar en el camino del aire que se le suma.
      for (const g of gs) {
        const far = moved(g, d, s + ctx.air);
        if (rs.some((r) => shared(far, r) > 50 && shared(g, r) === 0)) return -1;
      }
      return s;
    }
  }
  return span;
}

/** Si el grupo puede salir hacia alguna dirección: la de las espigas, o la primera libre de los ejes. */
function exit(ctx: Ctx, group: Set<string>, rest: string[]): { dir: Vec3; distance: number; joints: number } | null {
  const crossing = ctx.free.filter((f) => group.has(f.joint.partA) !== group.has(f.joint.partB) && (rest.includes(f.joint.partA) || rest.includes(f.joint.partB)));
  const need = crossing.map((f) => ({ ...f, v: (group.has(f.joint.partB) ? f.v : f.v.map((x) => -x)) as Vec3 }));
  const fixed = need.filter((f) => !f.half);
  // Espigas que no van paralelas (patas abiertas en un asiento): entran juntas, por el medio, si se abren poco.
  const mean = unit(fixed.reduce<Vec3>((m, f) => [m[0] + f.v[0], m[1] + f.v[1], m[2] + f.v[2]], [0, 0, 0]));
  const together = fixed.length > 1 && fixed.every((f) => dot(f.v, mean) >= SPLAY);
  const tries = together ? [mean] : fixed.length ? [fixed[0]!.v] : AXES;
  const ids = [...group];
  for (const d of tries) {
    if (fixed.some((f) => dot(f.v, d) < (together ? SPLAY : 0.98))) continue;
    if (need.some((f) => f.half && dot(f.v, d) < -0.02)) continue;
    const s = clearance(ctx, ids, rest, d);
    if (s >= 0) return { dir: d, distance: Math.round(s + ctx.air), joints: crossing.length };
  }
  return null;
}

/** Cuánto pueden abrirse entre sí las espigas que entran juntas: unos 30°. */
const SPLAY = 0.86;

const byId = (x: string, y: string) => x.localeCompare(y, 'es', { numeric: true });

/** Desarma estas piezas: qué sale primero y hacia dónde. La última que queda es la base. */
function disassemble(ctx: Ctx, ids: string[], axes: number[]): Removal[] {
  const out: Removal[] = [];
  let rest = [...ids].sort(byId);
  while (rest.length > 1) {
    // Una pieza sola: la de más arriba que sale, si no la de menos uniones con lo que queda, de la última a la primera.
    let best: { ids: string[]; dir: Vec3; distance: number; score: number } | null = null;
    for (const id of [...rest].reverse()) {
      const others = rest.filter((x) => x !== id);
      const e = exit(ctx, new Set([id]), others);
      if (!e) continue;
      // Lo que recibe (la pata con sus mortajas, el costado con sus canales) queda para el final: es la base.
      const receives = ctx.free.filter((f) => f.joint.partA === id && others.includes(f.joint.partB)).length;
      const score = (e.dir[1] > 0.9 ? 0 : 100) + e.joints + receives * 10;
      if (!best || score < best.score) best = { ids: [id], dir: e.dir, distance: e.distance, score };
    }
    if (!best) {
      // Ninguna sale sola: una parte entera, cortando el mueble por un plano. Primero por el eje más largo.
      for (const k of axes) {
        const sorted = [...rest].sort((x, y) => center(ctx, x, k) - center(ctx, y, k));
        for (let i = 1; i < sorted.length; i++) {
          if (center(ctx, sorted[i]!, k) - center(ctx, sorted[i - 1]!, k) < 1) continue;
          for (const [part, sign] of [
            [sorted.slice(i), 1],
            [sorted.slice(0, i), -1],
          ] as const) {
            const others = rest.filter((x) => !part.includes(x));
            const e = exit(ctx, new Set(part), others);
            if (!e || dot(e.dir, axisDir(k, sign)) < 0.98) continue;
            // La parte más chica, con menos uniones que cortar.
            const score = part.length * 10 + e.joints;
            if (!best || score < best.score) best = { ids: part, dir: e.dir, distance: e.distance, score };
          }
        }
      }
    }
    if (best) {
      const r: Removal = { parts: best.ids, dir: best.dir, distance: best.distance, kind: best.ids.length > 1 ? 'parte' : 'pieza' };
      if (best.ids.length > 1) r.sub = disassemble(ctx, best.ids, axes);
      out.push(r);
      rest = rest.filter((x) => !best!.ids.includes(x));
      continue;
    }
    // Trabado de todos lados (piezas que se atraviesan): la de más arriba sale derecho hacia arriba.
    const top = [...rest].sort((x, y) => ctx.boxes.get(y)!.max[1] - ctx.boxes.get(x)!.max[1] || byId(y, x))[0]!;
    const size = boxSize(ctx.boxes.get(top)!);
    out.push({ parts: [top], dir: [0, 1, 0], distance: Math.round(size[1] + ctx.air), kind: 'pieza', forced: true });
    rest = rest.filter((x) => x !== top);
  }
  if (rest.length) out.push({ parts: rest, dir: [0, 0, 0], distance: 0, kind: 'base' });
  return out;
}

const center = (ctx: Ctx, id: string, k: number) => {
  const b = ctx.boxes.get(id)!;
  return (b.min[k]! + b.max[k]!) / 2;
};
const axisDir = (k: number, sign: 1 | -1): Vec3 => {
  const v: Vec3 = [0, 0, 0];
  v[k] = sign;
  return v;
};

/** El orden de armado: cada paso, qué entra, en qué, por dónde y desde cuán lejos. Las partes se arman antes de entrar. */
export function buildSteps(project: Pick<Project, 'parts' | 'joints' | 'groups'>): BuildStep[] {
  const boxes = new Map<string, Box>();
  for (const p of project.parts) {
    try {
      boxes.set(p.id, placedBox(project, p));
    } catch {
      // Una pieza que no es una caja no entra en el despiece.
    }
  }
  if (!boxes.size) return [];
  const all = [...boxes.values()];
  const size = [0, 1, 2].map((k) => Math.max(...all.map((b) => b.max[k]!)) - Math.min(...all.map((b) => b.min[k]!)));
  const big = Math.max(...size);
  const free = project.joints.map((j) => freeOf(project, boxes, j)).filter((f): f is Free => !!f);
  const ctx: Ctx = { boxes, free, air: Math.round(Math.max(40, big * 0.12)) };
  // Los ejes de corte de las partes, del más largo al más corto: primero se separan los pies de una mesa larga.
  const axes = [0, 2, 1].sort((x, y) => size[y]! - size[x]!);

  // Lo que se abre entra al final, ya armado: el cajón desde adelante, la puerta y la tapa sobre sus bisagras.
  const units: Removal[] = [];
  const inUnit = new Set<string>();
  for (const m of findMotions(project)) {
    const parts = m.parts.filter((id) => boxes.has(id));
    if (!parts.length) continue;
    parts.forEach((id) => inUnit.add(id));
    const dir: Vec3 = m.kind === 'tapa' ? [0, 1, 0] : [0, 0, 1];
    const depth = Math.abs(dot(boxSize(m.box), dir));
    const r: Removal = { parts, dir, distance: Math.round(depth + ctx.air), kind: m.kind };
    if (parts.length > 1) r.sub = disassemble(ctx, parts, axes);
    units.push(r);
  }
  const body = disassemble(
    ctx,
    [...boxes.keys()].filter((id) => !inUnit.has(id)),
    axes,
  );
  const removals = [...units.reverse(), ...body];

  const steps: BuildStep[] = [];
  const placed = new Set<string>();
  // Cada parte se arma aparte, antes de entrar: lo que ya está en el mueble no cuenta para sus uniones internas.
  const emit = (list: Removal[], unitKey: string) => {
    for (const r of [...list].reverse()) {
      if (r.sub) {
        const saved = [...placed];
        placed.clear();
        emit(r.sub, r.parts[0]!);
        placed.clear();
        saved.forEach((id) => placed.add(id));
      }
      const mine = new Set(r.parts);
      const joints = project.joints.filter((j) => (mine.has(j.partA) && placed.has(j.partB)) || (mine.has(j.partB) && placed.has(j.partA)));
      const onto = [...new Set(joints.map((j) => (mine.has(j.partA) ? j.partB : j.partA)))].sort(byId);
      steps.push({
        key: `${unitKey}:${r.parts[0]}`,
        kind: r.kind,
        parts: [...r.parts].sort(byId),
        onto,
        joints: joints.map((j) => j.id),
        enters: !joints.length || joints.some((j) => mine.has(j.partB)),
        rests: joints.length > 0 && joints.every((j) => j.type === 'tope' || j.type === 'bolsillo'),
        // Para entrar se mueve al revés de como salió.
        dir: r.dir.map((x) => (x ? -x : 0)) as Vec3,
        distance: r.distance,
        unit: unitKey,
        ...(r.forced ? { forced: true } : {}),
      });
      r.parts.forEach((id) => placed.add(id));
    }
  };
  emit(removals, 'mueble');
  spread(steps, boxes, project.joints, ctx.air);
  return steps;
}

/**
 * Que el despiece no deje una pieza metida en otra: si al separar todo dos piezas se pisan (la pata y el faldón que
 * salen hacia el mismo lado), la que entra después se aleja un poco más por su camino, hasta que queden libres.
 */
function spread(steps: BuildStep[], boxes: Map<string, Box>, joints: readonly Joint[], air: number) {
  const joined = new Set(joints.flatMap((j) => [`${j.partA}|${j.partB}`, `${j.partB}|${j.partA}`]));
  const ids = [...boxes.keys()];
  // Lo que ya se mete armado sin ser una unión (un modelo con piezas encimadas) no se cuenta.
  const loose = (a: string, b: string) => !joined.has(`${a}|${b}`) && shared(boxes.get(a)!, boxes.get(b)!) > 0;
  // El paso que separa a `m` de `o`: el último que mueve a `m` sin mover a `o`.
  const mover = (m: string, o: string) => {
    let at = -1;
    steps.forEach((s, i) => {
      if (s.parts.includes(m) && !s.parts.includes(o)) at = i;
    });
    return at;
  };
  for (let pass = 0; pass < 40; pass++) {
    const off = buildOffsets(steps, 0);
    const at = new Map(ids.map((id) => [id, moved(boxes.get(id)!, off.get(id) ?? [0, 0, 0], 1)]));
    const push = new Set<number>();
    for (let i = 0; i < ids.length; i++)
      for (let k = i + 1; k < ids.length; k++) {
        const [m, o] = [ids[i]!, ids[k]!];
        if (loose(m, o) || shared(at.get(m)!, at.get(o)!) <= 60) continue;
        const a = mover(m, o);
        const b = mover(o, m);
        const later = a > b ? a : b;
        const step = steps[later]?.distance ? later : steps[a > b ? b : a]?.distance ? (a > b ? b : a) : -1;
        if (step >= 0) push.add(step);
      }
    if (!push.size) return;
    for (const i of push) steps[i]!.distance += Math.round(air / 2);
  }
}

/**
 * Dónde está cada pieza con el armado en `progress` (de 0, todo separado, a la cantidad de pasos, todo armado): lo
 * que corre cada pieza desde su lugar. Una pieza de una parte suma su propio camino y el de la parte.
 */
export function buildOffsets(steps: readonly BuildStep[], progress: number): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  steps.forEach((s, i) => {
    const left = 1 - Math.min(1, Math.max(0, progress - i));
    if (!left || !s.distance) {
      for (const id of s.parts) if (!out.has(id)) out.set(id, [0, 0, 0]);
      return;
    }
    for (const id of s.parts) {
      const o = out.get(id) ?? [0, 0, 0];
      out.set(id, o.map((v, k) => v - s.dir[k]! * s.distance * left) as Vec3);
    }
  });
  return out;
}

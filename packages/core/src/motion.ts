import { boxSize, overlapBox, partBox, type Box, type Vec3 } from './geometry';
import type { Part, Project } from './project';

/**
 * Lo que se mueve en un mueble: cajones que corren hacia adelante, puertas que giran sobre la bisagra y tapas que se
 * levantan. Cada movimiento junta sus piezas (el cajón entero, la hoja con su marco y tablero) y dice hacia dónde y
 * cuánto se abre. No cambia el proyecto: las piezas siguen cerradas, y la vista las corre con `motionMatrix`.
 * El frente del mueble mira a +Z. Medidas en mm.
 */

export type MotionKind = 'cajon' | 'puerta' | 'tapa';
export type Hinge = 'izq' | 'der' | 'arriba' | 'abajo';
export type Opens = NonNullable<Part['opens']>;

export interface Motion {
  /** El id de su primera pieza: sirve de clave mientras no se rearme. */
  id: string;
  kind: MotionKind;
  parts: string[];
  /** Se eligió a mano (Se abre como…), no salió solo del botón de cajones y puertas. */
  manual: boolean;
  /** Lado de la bisagra de una puerta. */
  hinge?: Hinge;
  /** Lado de la bisagra que sale solo, para saber si la elegida es la de siempre. */
  autoHinge?: Hinge;
  box: Box;
  /** Un cajón corre esto, abierto del todo. */
  slide?: Vec3;
  /** Una puerta o una tapa gira sobre esta recta, hasta este ángulo (en radianes, con signo). */
  pivot?: Vec3;
  axis?: Vec3;
  angle?: number;
}

/** Largos de correderas metálicas que se consiguen, en mm. */
export const SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550, 600];

export const isDrawerPart = (p: Part) => /^K\d+$/.test(p.id);
export const isDoorPart = (p: Part) => /^D\d+$/.test(p.id);

const TOL = 0.6;
const grow = (b: Box, d: number): Box => ({ min: b.min.map((v) => v - d) as Vec3, max: b.max.map((v) => v + d) as Vec3 });
const touches = (a: Box, b: Box) => overlapBox(grow(a, TOL), b) !== null;

/** Piezas que se tocan, agrupadas: cada grupo es un cajón o una hoja de puerta. */
export function touchingClusters(parts: Part[]): Part[][] {
  const left = [...parts];
  const out: Part[][] = [];
  while (left.length) {
    const group = [left.shift()!];
    for (let i = 0; i < group.length; i++) {
      const b = partBox(group[i]!);
      for (let j = left.length - 1; j >= 0; j--) {
        if (touches(b, partBox(left[j]!))) group.push(...left.splice(j, 1));
      }
    }
    out.push(group);
  }
  return out;
}

export function unionBox(parts: Part[]): Box {
  const bs = parts.map(partBox);
  return {
    min: [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k]!))) as Vec3,
    max: [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k]!))) as Vec3,
  };
}

/**
 * La tapa suelta de una caja chica (hasta 40 cm de alto): la pieza de más arriba que cubre toda la caja y apoya a tope.
 * Va con bisagras chicas por atrás.
 */
export function boxLid(project: Pick<Project, 'parts' | 'joints'>): Part | undefined {
  const boxes = project.parts.filter((p) => p.base.kind === 'box');
  if (!boxes.length) return undefined;
  const all = unionBox(boxes);
  if (all.max[1] - all.min[1] > 400) return undefined;
  const lid = boxes.find((p) => {
    const b = partBox(p);
    return b.max[1] === all.max[1] && b.min[0] <= all.min[0] + TOL && b.max[0] >= all.max[0] - TOL && b.min[2] <= all.min[2] + TOL && b.max[2] >= all.max[2] - TOL;
  });
  if (!lid || !project.joints.some((j) => j.type === 'tope' && (j.partA === lid.id || j.partB === lid.id))) return undefined;
  return lid;
}

/** Cómo se abre la pieza sola, sin elegirlo a mano: por su código (K cajón, D puerta) o por ser la tapa de una caja. */
function autoKind(p: Part, lid: Part | undefined): MotionKind | null {
  if (isDrawerPart(p)) return 'cajon';
  if (isDoorPart(p)) return 'puerta';
  return p === lid ? 'tapa' : null;
}

/** Cuánto gira: una puerta de costado, una que se rebate hacia abajo y una tapa. */
const DOOR_ANGLE = (110 * Math.PI) / 180;
const FLAP_ANGLE = Math.PI / 2;
const LID_ANGLE = (100 * Math.PI) / 180;

/** Todo lo que se abre en el proyecto, de abajo hacia arriba y de izquierda a derecha. */
export function findMotions(project: Pick<Project, 'parts' | 'joints' | 'groups'>): Motion[] {
  const lid = boxLid(project);
  const kindOf = new Map<string, { kind: MotionKind; manual: boolean }>();
  for (const p of project.parts) {
    const manual = p.opens?.kind;
    if (manual === 'no') continue;
    const kind = manual ?? autoKind(p, lid);
    if (kind) kindOf.set(p.id, { kind, manual: !!manual });
  }
  const byId = new Map(project.parts.map((p) => [p.id, p]));
  const used = new Set<string>();
  const units: { kind: MotionKind; manual: boolean; parts: Part[] }[] = [];
  // Un grupo con algo que se abre se mueve entero: así un tirador agrupado con su puerta gira con ella.
  for (const g of project.groups) {
    const first = g.parts.find((id) => kindOf.has(id));
    if (!first) continue;
    const parts = g.parts.map((id) => byId.get(id)).filter((p): p is Part => !!p);
    for (const p of parts) used.add(p.id);
    units.push({ ...kindOf.get(first)!, manual: parts.some((p) => kindOf.get(p.id)?.manual), parts });
  }
  for (const kind of ['cajon', 'puerta', 'tapa'] as const) {
    const loose = project.parts.filter((p) => !used.has(p.id) && kindOf.get(p.id)?.kind === kind);
    for (const parts of touchingClusters(loose)) units.push({ kind, manual: parts.some((p) => kindOf.get(p.id)!.manual), parts });
  }
  const moving = new Set(units.flatMap((u) => u.parts.map((p) => p.id)));
  const carcass = project.parts.filter((p) => !moving.has(p.id)).map(partBox);
  const boxes = units.map((u) => unionBox(u.parts));

  const motions = units.map((u, i): Motion => {
    const box = boxes[i]!;
    const parts = u.parts.map((p) => p.id);
    const base = { id: parts[0]!, kind: u.kind, parts, manual: u.manual, box };
    if (u.kind === 'cajon') return { ...base, slide: [0, 0, drawerTravel(u.parts, box, carcass)] };
    if (u.kind === 'tapa') {
      const pivot: Vec3 = [(box.min[0] + box.max[0]) / 2, box.min[1], box.min[2]];
      return { ...base, pivot, axis: [1, 0, 0], angle: signed(box, pivot, [1, 0, 0], LID_ANGLE, 1) };
    }
    const autoHinge = defaultHinge(box, boxes.filter((_, j) => j !== i && units[j]!.kind === 'puerta'));
    const hinge = u.parts.map((p) => p.opens?.hinge).find((h) => !!h) ?? autoHinge;
    return { ...base, hinge, autoHinge, ...doorSwing(box, hinge) };
  });
  return motions.sort((a, b) => a.box.min[1] - b.box.min[1] || a.box.min[0] - b.box.min[0]);
}

/** Lo que corre un cajón: el largo de la corredera si tiene lugar para una a los costados, o tres cuartos del fondo. */
function drawerTravel(parts: Part[], box: Box, carcass: Box[]): number {
  const front = parts.reduce((a, b) => (partBox(b).max[2] > partBox(a).max[2] ? b : a));
  const body = parts.filter((p) => p !== front);
  const inner = body.length ? unionBox(body) : box;
  const depth = inner.max[2] - inner.min[2];
  if (!body.length) return Math.round(Math.max(100, depth * 0.75));
  if (slideGap(inner, carcass) >= 10) return SLIDE_LENGTHS.filter((l) => l <= depth + 5).at(-1) ?? SLIDE_LENGTHS[0]!;
  return Math.round(depth * 0.75);
}

/** Lugar libre a los costados del cajón, hasta las piezas del mueble que tiene al lado: con 1 cm entra una corredera metálica. */
export function slideGap(box: Box, carcass: Box[]): number {
  return Math.min(
    ...carcass
      .filter((c) => c.max[1] > box.min[1] && c.min[1] < box.max[1] && c.max[2] > box.min[2] && c.min[2] < box.max[2])
      .flatMap((c) => [box.min[0] - c.max[0], c.min[0] - box.max[0]])
      .filter((g) => g > -TOL),
  );
}

/** Una puerta de un par abre hacia su lado: la de la izquierda con la bisagra a la izquierda. Una sola, a la izquierda. */
function defaultHinge(box: Box, doors: Box[]): Hinge {
  const beside = (b: Box) => Math.min(box.max[1], b.max[1]) - Math.max(box.min[1], b.min[1]) > (box.max[1] - box.min[1]) / 2;
  const right = doors.some((b) => beside(b) && b.min[0] >= box.max[0] - TOL && b.min[0] - box.max[0] <= 12);
  const left = doors.some((b) => beside(b) && b.max[0] <= box.min[0] + TOL && box.min[0] - b.max[0] <= 12);
  return left && !right ? 'der' : 'izq';
}

/**
 * Una puerta gira sobre el canto de adelante del lado de la bisagra, así el canto no se mete en el costado del mueble.
 * Las de costado abren 110°, como una bisagra de cazoleta; la que se rebate hacia abajo queda horizontal.
 */
function doorSwing(box: Box, hinge: Hinge): Pick<Motion, 'pivot' | 'axis' | 'angle'> {
  const mid = box.min.map((v, k) => (v + box.max[k]!) / 2) as Vec3;
  const front = box.max[2];
  const pivot: Vec3 =
    hinge === 'izq' ? [box.min[0], mid[1], front] : hinge === 'der' ? [box.max[0], mid[1], front] : [mid[0], hinge === 'arriba' ? box.max[1] : box.min[1], front];
  const axis: Vec3 = hinge === 'izq' || hinge === 'der' ? [0, 1, 0] : [1, 0, 0];
  const full = hinge === 'abajo' ? FLAP_ANGLE : DOOR_ANGLE;
  return { pivot, axis, angle: signed(box, pivot, axis, full, 2) };
}

/** El giro va hacia donde el centro de la pieza sale (hacia adelante, o hacia arriba en una tapa). */
function signed(box: Box, pivot: Vec3, axis: Vec3, angle: number, out: 1 | 2): number {
  const mid = box.min.map((v, k) => (v + box.max[k]!) / 2) as Vec3;
  const turned = transformPoint(rotationAbout(pivot, axis, angle * 0.25), mid);
  return turned[out] >= mid[out] ? angle : -angle;
}

/** Matriz 4×4 por columnas (como la de three) que corre una pieza a una apertura de 0 (cerrado) a 1 (abierto del todo). */
export function motionMatrix(m: Motion, open: number): number[] {
  const f = Math.max(0, Math.min(1, open));
  if (m.slide) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, m.slide[0] * f, m.slide[1] * f, m.slide[2] * f, 1];
  if (m.pivot && m.axis && m.angle) return rotationAbout(m.pivot, m.axis, m.angle * f);
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** Giro de `angle` radianes alrededor de la recta que pasa por `pivot` en la dirección `axis` (unitaria). */
function rotationAbout(pivot: Vec3, axis: Vec3, angle: number): number[] {
  const [x, y, z] = axis;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  // Rodrigues, por filas.
  const r = [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
  const tr = [0, 1, 2].map((i) => pivot[i]! - (r[i]![0]! * pivot[0] + r[i]![1]! * pivot[1] + r[i]![2]! * pivot[2]));
  return [r[0]![0]!, r[1]![0]!, r[2]![0]!, 0, r[0]![1]!, r[1]![1]!, r[2]![1]!, 0, r[0]![2]!, r[1]![2]!, r[2]![2]!, 0, tr[0]!, tr[1]!, tr[2]!, 1];
}

export function transformPoint(m: readonly number[], p: Vec3): Vec3 {
  return [0, 1, 2].map((i) => m[i]! * p[0] + m[4 + i]! * p[1] + m[8 + i]! * p[2] + m[12 + i]!) as Vec3;
}

/** Gira solo la dirección, sin correrla: para llevar la veta con la pieza. */
export function transformDirection(m: readonly number[], v: Vec3): Vec3 {
  return [0, 1, 2].map((i) => m[i]! * v[0] + m[4 + i]! * v[1] + m[8 + i]! * v[2]) as Vec3;
}

/** El movimiento que lleva a esta pieza, si se abre. */
export function motionOf(motions: readonly Motion[], partId: string): Motion | undefined {
  return motions.find((m) => m.parts.includes(partId));
}

/**
 * Las piezas que cambian al elegir cómo se abre esta: todo su cajón o su puerta si ya se abre, todo su grupo si está
 * en uno, o ella sola.
 */
export function opensTargets(project: Pick<Project, 'parts' | 'joints' | 'groups'>, partId: string): string[] {
  const m = motionOf(findMotions(project), partId);
  if (m) return m.parts;
  return project.groups.find((g) => g.parts.includes(partId))?.parts ?? [partId];
}

/**
 * Elige cómo se abren estas piezas (`null` vuelve a lo que sale solo). Lo que coincide con lo que saldría solo no se
 * guarda, así una puerta armada con el botón sigue siendo automática. Trabaja sobre el proyecto en el lugar.
 */
export function setOpens(project: Pick<Project, 'parts' | 'joints' | 'groups'>, ids: readonly string[], opens: Opens | null): void {
  const parts = project.parts.filter((p) => ids.includes(p.id));
  for (const p of parts) delete p.opens;
  if (!opens) return;
  const lid = boxLid(project);
  const auto = parts.every((p) => (autoKind(p, lid) ?? 'no') === opens.kind);
  if (auto && opens.hinge) {
    // La bisagra elegida es la de siempre: no hace falta guardarla.
    const m = motionOf(findMotions(project), parts[0]!.id);
    if (m?.autoHinge === opens.hinge) return;
  }
  if (auto && !opens.hinge) return;
  for (const p of parts) p.opens = { ...opens };
}

/** Al espejar una pieza, la bisagra pasa al otro lado. */
export function mirrorHinge(part: Part, axis: 0 | 1 | 2): void {
  const h = part.opens?.hinge;
  if (!h) return;
  const swap: Record<Hinge, Hinge> = axis === 0 ? { izq: 'der', der: 'izq', arriba: 'arriba', abajo: 'abajo' } : axis === 1 ? { izq: 'izq', der: 'der', arriba: 'abajo', abajo: 'arriba' } : { izq: 'izq', der: 'der', arriba: 'arriba', abajo: 'abajo' };
  part.opens!.hinge = swap[h];
}

/** Lo largo del canto con bisagras: el alto en una puerta de costado, el ancho en una que se rebate. */
export function hingeEdge(m: Motion): number {
  const [w, h] = boxSize(m.box);
  return m.hinge === 'arriba' || m.hinge === 'abajo' ? w : h;
}

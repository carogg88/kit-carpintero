import { boxSize, otherAxes, partBox, type Axis, type Box, type Vec3 } from './geometry';
import { defaultMortiseParams, endJoint } from './joints';
import { isLeaning, leanedBox, leanFrame, leanPoint, rotateVec, type LeanFrame } from './lean';
import type { Joint, Part, Project } from './project';
import { t } from './i18n';
import { formatAngle } from './bevels';

/**
 * Faldones y travesaños entre patas inclinadas. En el proyecto quedan como se dibujaron, entre las patas derechas;
 * al armarlos siguen a las patas: se corren con ellas (las de adelante se van hacia adelante) y se estiran o se
 * acortan hasta la cara de cada pata, a su altura. La punta queda con el hombro en ángulo, cortada por la cara
 * inclinada de la pata, y la espiga sale derecha, a lo largo de la pieza: la mortaja de la pata va horizontal.
 */

export interface FollowEnd {
  joint: Joint;
  leg: Part;
  frame: LeanFrame;
  /** Eje de la pieza y sentido en que entra en la pata. */
  axis: Axis;
  dir: 1 | -1;
  /** Normal de la cara de la pata que mira a la pieza, ya inclinada. */
  normal: Vec3;
  /** Un punto de esa cara. */
  point: Vec3;
  /** Dónde corta la cara al eje de la pieza (coordenada sobre `axis`). */
  face: number;
  /** Dónde queda la punta más larga del hombro (coordenada sobre `axis`). */
  tip: number;
  /** Cuánto se aparta el hombro de la escuadra: visto de costado de la pieza (contra el alto) y visto desde arriba. */
  shoulder: [number, number];
}

export interface Follow {
  /** La pieza corrida, estirada hasta el medio de cada pata inclinada: se recorta con la pata al armarla. */
  box: Box;
  /** Cuánto se corrió de costado (sobre los ejes que no son el largo). */
  shift: Vec3;
  ends: FollowEnd[];
  /** Eje del largo de la pieza y su largo de punta larga a punta larga, sin espigas. */
  axis: Axis;
  length: number;
}

const deg = (r: number) => (r * 180) / Math.PI;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const center = (b: Box): Vec3 => [0, 1, 2].map((k) => (b.min[k]! + b.max[k]!) / 2) as Vec3;

/** Dónde corta el plano (normal, punto) a la recta que pasa por `from` a lo largo del eje `axis`. */
function along(normal: Vec3, point: Vec3, from: Vec3, axis: Axis): number {
  const d: Vec3 = [point[0] - from[0], point[1] - from[1], point[2] - from[2]];
  return from[axis] + dot(normal, d) / normal[axis];
}

/** Cómo sigue la pieza a las patas inclinadas en las que entra, o null si no entra en ninguna. */
export function leanFollow(project: Pick<Project, 'parts' | 'joints'>, part: Part): Follow | null {
  if (part.base.kind !== 'box' || isLeaning(part)) return null;
  const own = partBox(part);
  const raw: { joint: Joint; leg: Part; frame: LeanFrame; axis: Axis; dir: 1 | -1; contact: number; delta: Vec3 }[] = [];
  for (const joint of project.joints) {
    if (joint.partB !== part.id) continue;
    const leg = project.parts.find((p) => p.id === joint.partA);
    const frame = leg && leanFrame(leg);
    if (!leg || !frame) continue;
    const e = endJoint(partBox(leg), own);
    // Una pieza que apoya de punta arriba o abajo de la pata (no de costado) no se corre.
    if (!e || e.axis === 1) continue;
    // El eje de la pata a la altura del medio de la pieza, comparado con el de la pata derecha.
    const y = (own.min[1] + own.max[1]) / 2;
    const s = (y - frame.pivot[1]) / frame.dir[1];
    const delta: Vec3 = [frame.dir[0] * s, 0, frame.dir[2] * s];
    raw.push({ joint, leg, frame, axis: e.axis, dir: e.dir, contact: e.face, delta });
  }
  if (!raw.length) return null;
  const axis = raw[0]!.axis;
  // De costado se corre lo que se corren, en promedio, las patas en que entra.
  const shift: Vec3 = [0, 0, 0];
  for (const k of [0, 2] as Axis[]) {
    const ds = raw.filter((r) => r.axis !== k).map((r) => r.delta[k]);
    if (ds.length) shift[k] = ds.reduce((a, b) => a + b, 0) / ds.length;
  }
  const box: Box = { min: own.min.map((v, k) => v + shift[k]!) as Vec3, max: own.max.map((v, k) => v + shift[k]!) as Vec3 };
  const mid = center(box);
  const [u, v] = otherAxes(axis);
  const half = boxSize(box);
  const corners: Vec3[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      const c: Vec3 = [...mid];
      c[u] += (a * half[u]) / 2;
      c[v] += (b * half[v]) / 2;
      corners.push(c);
    }
  }
  const ends: FollowEnd[] = [];
  for (const r of raw) {
    if (r.axis !== axis) continue;
    const out: Vec3 = [0, 0, 0];
    out[axis] = -r.dir;
    const normal = rotateVec(out, r.frame.axis, r.frame.angle);
    const onFace: Vec3 = [r.frame.pivot[0], r.frame.pivot[1], r.frame.pivot[2]];
    onFace[axis] = r.contact;
    const point = leanPoint(r.frame, onFace);
    const face = along(normal, point, mid, axis);
    const hits = corners.map((c) => along(normal, point, c, axis));
    const tip = r.dir > 0 ? Math.max(...hits) : Math.min(...hits);
    // Hasta el medio de la pata: de ahí la recorta la pata misma.
    const legSize = boxSize(partBox(r.leg))[axis];
    if (r.dir > 0) box.max[axis] = face + legSize / 2;
    else box.min[axis] = face - legSize / 2;
    const side = otherAxes(axis).find((k) => k !== 1)!;
    const shoulder: [number, number] = [deg(Math.atan(Math.abs(normal[1] / normal[axis]))), deg(Math.atan(Math.abs(normal[side] / normal[axis])))];
    ends.push({ joint: r.joint, leg: r.leg, frame: r.frame, axis, dir: r.dir, normal, point, face, tip, shoulder });
  }
  const hi = ends.find((e) => e.dir > 0)?.tip ?? own.max[axis];
  const lo = ends.find((e) => e.dir < 0)?.tip ?? own.min[axis];
  return { box, shift, ends, axis, length: hi - lo };
}

/**
 * Espiga y mortaja entre una pieza que sigue a la pata y la pata inclinada: derechas, a lo largo de la pieza,
 * desde la cara de la pata. La espiga arranca un poco antes del hombro, adentro de la pieza, para que no quede
 * corta de un lado; la mortaja es 2 mm más honda, como las demás.
 */
export function followMortise(f: Follow, end: FollowEnd, part: Part): { tenon: Box; mortise: Box } | null {
  const legBox = partBox(end.leg);
  const own = partBox(part);
  const d = defaultMortiseParams(legBox, own);
  const e = endJoint(legBox, own);
  if (!d || !e) return null;
  const p = { ...d, ...end.joint.params };
  const section: Box = { min: [...f.box.min], max: [...f.box.max] };
  const mid = center(f.box);
  section.min[e.thin] = mid[e.thin] - p.thickness / 2;
  section.max[e.thin] = mid[e.thin] + p.thickness / 2;
  section.min[e.wide] = f.box.min[e.wide] + p.shoulder;
  section.max[e.wide] = f.box.max[e.wide] - p.shoulder;
  const back = end.face - end.dir * (Math.abs(end.tip - end.face) + 1);
  const span = (to: number): Box => {
    const b: Box = { min: [...section.min], max: [...section.max] };
    b.min[end.axis] = Math.min(back, to);
    b.max[end.axis] = Math.max(back, to);
    return b;
  };
  return { tenon: span(end.face + end.dir * p.length), mortise: span(end.face + end.dir * (p.length + 2)) };
}

/** Encastres que ya siguen a la pata inclinada: los demás todavía no se cortan. */
export const FOLLOW_JOINTS = new Set(['tope', 'mortaja']);

/** "hombros en ángulo, a 8°: falsa escuadra a 82° del canto" para la lista de cortes. */
export function followWork(f: Follow): string | null {
  // Menos de un grado no se marca a mano: el hombro va a escuadra de ese lado.
  const half = (a: number) => (a < 1 ? 0 : Math.round(a * 2) / 2);
  const angles = f.ends.map((e) => e.shoulder.map(half) as [number, number]).filter(([a, b]) => a || b);
  if (!angles.length) return null;
  const [a, b] = angles.reduce((m, x) => [Math.max(m[0], x[0]), Math.max(m[1], x[1])], [0, 0]);
  if (!a || !b) {
    const c = Math.max(a, b);
    return t('hombros en ángulo, a {a}: falsa escuadra a {g} del canto', { a: formatAngle(c), g: formatAngle(90 - c) });
  }
  return t('hombros en ángulo compuesto, {a} contra el alto y {b} de costado: falsa escuadra a {ga} y {gb} del canto', {
    a: formatAngle(a),
    b: formatAngle(b),
    ga: formatAngle(90 - a),
    gb: formatAngle(90 - b),
  });
}

/** Un plano: su normal y un punto. */
export interface EndPlane {
  n: Vec3;
  p: Vec3;
}

/** Las puntas en ángulo de una pieza, para dibujarla en el despiece. */
export interface PartEnds {
  /** Se dibuja derecha, sin la inclinación (una pata): el motor la desgira antes de proyectarla. */
  local: boolean;
  /** Eje del largo, y la pieza de punta larga a punta larga en el marco del dibujo. */
  along: Axis;
  box: Box;
  /** Plano de cada punta en ángulo (la del lado menor y la del mayor sobre `along`). */
  lo?: EndPlane;
  hi?: EndPlane;
}

/** Dónde corta un plano a la recta que pasa por `q` a lo largo de `axis`, o la punta de la caja si no hay plano. */
export const endAt = (plane: EndPlane | undefined, q: Vec3, axis: Axis, fallback: number) => (plane ? along(plane.n, plane.p, q, axis) : fallback);

/** Lleva un punto de la pata inclinada a donde estaría en la pata derecha. */
export function unleanPoint(f: LeanFrame, p: Vec3): Vec3 {
  const r = rotateVec([p[0] - f.pivot[0], p[1] - f.pivot[1], p[2] - f.pivot[2]], f.axis, -f.angle);
  return [r[0] + f.pivot[0], r[1] + f.pivot[1], r[2] + f.pivot[2]];
}

/**
 * Las puntas en ángulo de una pata inclinada (vista derecha, con las dos puntas cortadas en ángulo) o de un faldón
 * o travesaño que la sigue (con los hombros en ángulo). null si la pieza tiene las puntas a escuadra.
 */
export function partEnds(project: Pick<Project, 'parts' | 'joints'>, part: Part): PartEnds | null {
  const f = leanFrame(part);
  if (f) {
    // Derecha: el piso y el asiento quedan como planos inclinados que cortan las puntas.
    const n = rotateVec([0, 1, 0], f.axis, -f.angle);
    const s = (f.pivot[1] - f.height - f.pivot[1]) / f.dir[1];
    const bottom: Vec3 = [f.pivot[0], f.pivot[1] - s, f.pivot[2]];
    const b = partBox(part);
    const box: Box = { min: [...b.min], max: [...b.max] };
    box.min[1] = f.pivot[1] + f.rise - f.length;
    box.max[1] = f.pivot[1] + f.rise;
    return { local: true, along: 1, box, lo: { n, p: bottom }, hi: { n, p: [...f.pivot] } };
  }
  const fl = leanFollow(project, part);
  if (!fl) return null;
  const k = fl.axis;
  const own = partBox(part);
  const box: Box = { min: [...fl.box.min], max: [...fl.box.max] };
  const hiEnd = fl.ends.find((e) => e.dir > 0);
  const loEnd = fl.ends.find((e) => e.dir < 0);
  box.max[k] = hiEnd?.tip ?? own.max[k] + fl.shift[k];
  box.min[k] = loEnd?.tip ?? own.min[k] + fl.shift[k];
  return {
    local: false,
    along: k,
    box,
    ...(loEnd ? { lo: { n: loEnd.normal, p: loEnd.point } } : {}),
    ...(hiEnd ? { hi: { n: hiEnd.normal, p: hiEnd.point } } : {}),
  };
}

/** La caja que ocupa la pieza en el mueble armado: inclinada, corrida o como está. */
export function placedBox(project: Pick<Project, 'parts' | 'joints'>, part: Part): Box {
  if (leanFrame(part)) return leanedBox(part);
  const e = partEnds(project, part);
  return e ? e.box : partBox(part);
}

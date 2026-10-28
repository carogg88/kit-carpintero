import { partAxesBySize } from './edit';
import { endJoint, jointGeometry, solidBox } from './joints';
import { boxSize, otherAxes, partBox, partKey, type Axis, type Box, type Vec3 } from './geometry';
import { arcInfo, pocketSolid } from './pockets';
import { sectionBox } from './sections';
import type { Part, Project } from './project';
import { endAt, followMortise, leanFollow, partEnds, placedBox, unleanPoint, type PartEnds } from './follow';
import { isLeaning, leanFrame, leanHole, leanShift, type LeanFrame } from './lean';

/**
 * Dibujo técnico de cajas: proyección ortogonal, contornos visibles y líneas ocultas.
 * Todo en mm del mueble; la hoja decide la escala.
 */

/** Rectángulo en el plano del dibujo (u a la derecha, v hacia arriba). */
export interface Rect2 {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/** Cómo se mira: qué eje del mueble va a la derecha, cuál hacia arriba y cuál hacia el que mira. */
export interface Projection {
  u: Axis;
  uSign: 1 | -1;
  v: Axis;
  vSign: 1 | -1;
  depth: Axis;
  /** 1 si quien mira está del lado positivo del eje de profundidad. */
  depthSign: 1 | -1;
}

export type ViewName = 'front' | 'side' | 'top';

/** Frente desde +Z, lateral desde +X (lado derecho), planta desde arriba con el frente abajo. */
export const VIEWS: Record<ViewName, Projection> = {
  front: { u: 0, uSign: 1, v: 1, vSign: 1, depth: 2, depthSign: 1 },
  side: { u: 2, uSign: -1, v: 1, vSign: 1, depth: 0, depthSign: 1 },
  top: { u: 0, uSign: 1, v: 2, vSign: -1, depth: 1, depthSign: 1 },
};

/** Algo a dibujar: una pieza, o un sólido de encastre que pertenece a una pieza. */
export interface DrawItem {
  id: string;
  box: Box;
  /** Sólido de encastre: espiga, lengüeta, mortaja o agujero. */
  joint?: boolean;
  /** Pieza dentro de la que está el sólido; no la tapa a ella misma. */
  owner?: string;
  /** Hueco: siempre se dibuja con línea oculta. */
  hole?: boolean;
  /** Tramo con otra sección: se dibuja como la pieza pero no se resalta como encastre. */
  section?: boolean;
}

export interface Line2 {
  a: [number, number];
  b: [number, number];
  hidden: boolean;
  joint: boolean;
}

export interface Drawing {
  lines: Line2[];
  /** Rectángulos de encastres, para resaltarlos. */
  joints: Rect2[];
  /** Nombre de cada pieza donde se ve. */
  labels: { id: string; at: [number, number] }[];
  /** Rectángulo de cada pieza (no de los encastres), para acotar. */
  rects: { id: string; rect: Rect2 }[];
  bounds: Rect2;
  /** Arcos que se ven de frente, para acotar el radio. */
  arcs?: ArcMark[];
  /** Dónde empiezan y terminan los tramos con otra sección, a lo largo de cada eje del dibujo, para acotarlos en cadena. */
  stops?: { u: number[]; v: number[] };
  /** Estaciones del torneado a lo largo del dibujo: dónde (u), a qué distancia de la punta y qué diámetro. */
  turns?: TurnMark[];
  /** Qué tiene que proyectar el motor para cambiar estas líneas por las de la forma exacta. */
  engine?: EngineView;
  /** Ángulos de las puntas cortadas en ángulo: los que se toman con la falsa escuadra. */
  angles?: AngleMark[];
}

/** Ángulo entre el canto (`a`, unitario) y la punta (`b`, unitario) en la esquina `at`, en grados. */
export interface AngleMark {
  at: [number, number];
  a: [number, number];
  b: [number, number];
  deg: number;
}

/** Cota de radio de un arco: dónde está el medio del arco y hacia qué lado queda la madera (unitario). */
export interface ArcMark {
  id: string;
  at: [number, number];
  toward: [number, number];
  radius: number;
}

/** Estación de un torneado que corre a lo ancho del dibujo: `at` es la distancia desde la punta de la pieza. */
export interface TurnMark {
  u: number;
  v: number;
  at: number;
  d: number;
  /** De un lado o del otro queda cuadrado: el diámetro no se acota ahí. */
  square: boolean;
}

/** Pedido al motor: proyectar estas piezas exactas, con líneas ocultas, y quedarse con lo que cae en la ventana. */
export interface EngineView {
  parts: string[];
  projection: Projection;
  window?: Rect2;
  /** Pata inclinada que se dibuja derecha: el motor le deshace la inclinación antes de proyectarla. */
  local?: string;
}

interface Projected {
  item: DrawItem;
  rect: Rect2;
  /** Cuán cerca de quien mira está la cara de adelante. */
  near: number;
}

function project(item: DrawItem, p: Projection): Projected {
  const range = (axis: Axis, sign: 1 | -1): [number, number] =>
    sign > 0 ? [item.box.min[axis], item.box.max[axis]] : [-item.box.max[axis], -item.box.min[axis]];
  const [u0, u1] = range(p.u, p.uSign);
  const [v0, v1] = range(p.v, p.vSign);
  const near = p.depthSign > 0 ? item.box.max[p.depth] : -item.box.min[p.depth];
  return { item, rect: { u0, v0, u1, v1 }, near };
}

const EPS = 0.05;

/** Tramos de [a, b] que no quedan dentro de ningún intervalo. Devuelve [libres, tapados]. */
function split(a: number, b: number, covers: [number, number][]): [[number, number][], [number, number][]] {
  const cs = covers
    .map(([x, y]) => [Math.max(a, x), Math.min(b, y)] as [number, number])
    .filter(([x, y]) => y - x > EPS)
    .sort((m, n) => m[0] - n[0]);
  const merged: [number, number][] = [];
  for (const c of cs) {
    const last = merged[merged.length - 1];
    if (last && c[0] <= last[1] + EPS) last[1] = Math.max(last[1], c[1]);
    else merged.push([...c]);
  }
  const free: [number, number][] = [];
  let at = a;
  for (const [x, y] of merged) {
    if (x - at > EPS) free.push([at, x]);
    at = Math.max(at, y);
  }
  if (b - at > EPS) free.push([at, b]);
  return [free, merged];
}

/** Recorta un tramo horizontal o vertical a una ventana. */
function clip(l: Line2, w: Rect2): Line2 | null {
  const a: [number, number] = [Math.max(w.u0, Math.min(l.a[0], l.b[0])), Math.max(w.v0, Math.min(l.a[1], l.b[1]))];
  const b: [number, number] = [Math.min(w.u1, Math.max(l.a[0], l.b[0])), Math.min(w.v1, Math.max(l.a[1], l.b[1]))];
  const horizontal = Math.abs(l.a[1] - l.b[1]) < EPS;
  if (horizontal ? l.a[1] < w.v0 - EPS || l.a[1] > w.v1 + EPS || b[0] - a[0] <= EPS : l.a[0] < w.u0 - EPS || l.a[0] > w.u1 + EPS || b[1] - a[1] <= EPS) {
    return null;
  }
  return { ...l, a, b };
}

const intersects = (r: Rect2, w: Rect2) => r.u0 < w.u1 && r.u1 > w.u0 && r.v0 < w.v1 && r.v1 > w.v0;

/** Dibuja cajas con líneas ocultas. Con `window`, solo lo que cae adentro (para detalles). */
export function drawItems(items: DrawItem[], p: Projection, window?: Rect2): Drawing {
  const all = items.map((i) => project(i, p));
  const solids = all.filter((x) => !x.item.joint);
  const lines: Line2[] = [];
  for (const x of all) {
    const r = x.rect;
    const coverers = solids.filter((q) => q !== x && q.item.id !== x.item.owner && q.near > x.near + EPS);
    const edges: { fixed: number; from: number; to: number; horizontal: boolean }[] = [
      { fixed: r.v0, from: r.u0, to: r.u1, horizontal: true },
      { fixed: r.v1, from: r.u0, to: r.u1, horizontal: true },
      { fixed: r.u0, from: r.v0, to: r.v1, horizontal: false },
      { fixed: r.u1, from: r.v0, to: r.v1, horizontal: false },
    ];
    for (const e of edges) {
      const covers = coverers
        .filter((q) => (e.horizontal ? q.rect.v0 < e.fixed - EPS && q.rect.v1 > e.fixed + EPS : q.rect.u0 < e.fixed - EPS && q.rect.u1 > e.fixed + EPS))
        .map((q) => (e.horizontal ? [q.rect.u0, q.rect.u1] : [q.rect.v0, q.rect.v1]) as [number, number]);
      const [free, covered] = x.item.hole ? [[], [[e.from, e.to] as [number, number]]] : split(e.from, e.to, covers);
      const mk = (s: number, t: number, hidden: boolean): Line2 =>
        e.horizontal
          ? { a: [s, e.fixed], b: [t, e.fixed], hidden, joint: !!x.item.joint }
          : { a: [e.fixed, s], b: [e.fixed, t], hidden, joint: !!x.item.joint };
      for (const [s, t] of free) lines.push(mk(s, t, false));
      for (const [s, t] of covered) lines.push(mk(s, t, true));
    }
  }

  const visible = (pt: [number, number], self: Projected) =>
    !solids.some((q) => q !== self && q.near > self.near + EPS && q.rect.u0 < pt[0] && q.rect.u1 > pt[0] && q.rect.v0 < pt[1] && q.rect.v1 > pt[1]);
  const shown = (r: Rect2): Rect2 =>
    window ? { u0: Math.max(r.u0, window.u0), v0: Math.max(r.v0, window.v0), u1: Math.min(r.u1, window.u1), v1: Math.min(r.v1, window.v1) } : r;
  const labels = solids
    .map((x) => {
      const r = shown(x.rect);
      return { x, at: [(r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2] as [number, number] };
    })
    .filter(({ x, at }) => visible(at, x) && (!window || intersects(x.rect, window)))
    .map(({ x, at }) => ({ id: x.item.id, at }));

  const kept = window ? lines.map((l) => clip(l, window)).filter((l): l is Line2 => l !== null) : lines;
  // Un encastre que sale de la ventana (la ranura de los botones, que corre todo el faldón) no se acota: la cota
  // cortada diría otra medida.
  const inside = (r: Rect2) => !window || (r.u0 >= window.u0 - EPS && r.u1 <= window.u1 + EPS && r.v0 >= window.v0 - EPS && r.v1 <= window.v1 + EPS);
  const jointRects = all.filter((x) => x.item.joint && !x.item.section && inside(x.rect)).map((x) => x.rect);
  const rects = solids.map((x) => ({ id: x.item.id, rect: x.rect }));
  const pts = kept.flatMap((l) => [l.a, l.b]);
  const bounds = window ?? {
    u0: Math.min(...pts.map((q) => q[0])),
    v0: Math.min(...pts.map((q) => q[1])),
    u1: Math.max(...pts.map((q) => q[0])),
    v1: Math.max(...pts.map((q) => q[1])),
  };
  return { lines: kept, joints: jointRects, labels, rects, bounds: pts.length || window ? bounds : { u0: 0, v0: 0, u1: 0, v1: 0 } };
}

/** Caja girada de vuelta a la pata derecha: el centro va a su lugar y las medidas quedan (alcanza para dibujar). */
function unleanBox(f: LeanFrame, b: Box): Box {
  const c = unleanPoint(f, [0, 1, 2].map((k) => (b.min[k]! + b.max[k]!) / 2) as Vec3);
  const s = boxSize(b);
  return { min: c.map((v, k) => v - s[k]! / 2) as Vec3, max: c.map((v, k) => v + s[k]! / 2) as Vec3 };
}

/**
 * Sólidos de encastres de una pieza: lo que se le suma y lo que se le saca. Con `local`, una pata inclinada se
 * dibuja derecha: sus encastres van como en la pata derecha.
 */
export function partJointItems(project: Project, part: Part, local = false): DrawItem[] {
  const own = local ? leanFrame(part) : null;
  const items: DrawItem[] = [];
  for (const j of project.joints) {
    if (j.partA !== part.id && j.partB !== part.id) continue;
    const a = project.parts.find((p) => p.id === j.partA);
    const b = project.parts.find((p) => p.id === j.partB);
    if (!a || !b || a.base.kind !== 'box' || b.base.kind !== 'box') continue;
    // Un faldón o travesaño que entra en una pata inclinada: espiga y mortaja derechas, a lo largo de la pieza.
    if (leanFrame(a)) {
      const f = isLeaning(b) ? null : leanFollow(project, b);
      const end = f?.ends.find((e) => e.joint.id === j.id);
      const m = f && end && j.type === 'mortaja' ? followMortise(f, end, b) : null;
      if (!m || !end) continue;
      m.forEach((x, i) => {
        if (j.partB === part.id) return void items.push({ id: `${j.id}+${i}`, box: x.tenon, joint: true, owner: part.id });
        // La mortaja arranca un poco afuera de la pata para no quedar corta; en el dibujo, desde la cara.
        const hole: Box = { min: [...x.mortise.min], max: [...x.mortise.max] };
        if (end.dir > 0) hole.min[end.axis] = end.face;
        else hole.max[end.axis] = end.face;
        items.push({ id: `${j.id}-a${i}`, box: own ? unleanBox(own, hole) : hole, joint: true, owner: part.id, hole: true });
      });
      continue;
    }
    const g = jointGeometry(j.type, partBox(a), partBox(b), j.params);
    if (!g) continue;
    if (j.partB === part.id) {
      // En el mueble armado, la espiga de una pieza inclinada va donde queda la pieza; en su despiece, derecha.
      const fb = local ? null : leanFrame(b);
      const at = (s: Parameters<typeof solidBox>[0]) => (fb ? leanShift(fb, solidBox(s)) : solidBox(s));
      g.addB.forEach((s, i) => items.push({ id: `${j.id}+${i}`, box: at(s), joint: true, owner: part.id }));
      g.cutB.forEach((s, i) => items.push({ id: `${j.id}-b${i}`, box: at(s), joint: true, owner: part.id, hole: true }));
    } else {
      const fb = leanFrame(b);
      g.cutA.forEach((s, i) => items.push({ id: `${j.id}-a${i}`, box: fb ? leanHole(fb, solidBox(s), partBox(b)) : solidBox(s), joint: true, owner: part.id, hole: true }));
    }
  }
  return items;
}

/** Tramos con otra sección: con las cajas alcanzan para encuadrar y acotar hasta que llegan las líneas del motor. */
export const partSectionItems = (part: Part): DrawItem[] =>
  part.sections.map((s) => ({ id: `${part.id}-${s.id}`, box: sectionBox(part, s), joint: true, owner: part.id, section: true }));

/** Vista general del mueble: piezas y, ocultas, las espigas y lengüetas. */
export function drawView(project: Project, view: ViewName): Drawing {
  const boxes = project.parts.filter((p) => p.base.kind === 'box');
  const items: DrawItem[] = boxes.map((p) => ({ id: p.id, box: placedBox(project, p) }));
  for (const p of boxes) for (const it of [...partJointItems(project, p), ...partSectionItems(p)]) if (!it.hole) items.push(it);
  return { ...drawItems(items, VIEWS[view]), engine: { parts: boxes.map((p) => p.id), projection: VIEWS[view] } };
}

/** Proyección de una pieza sola: largo a la derecha, ancho hacia arriba. */
export function partProjection(part: Part): Projection {
  const [l, w, t] = partAxesBySize(part);
  return { u: l, uSign: 1, v: w, vSign: 1, depth: t, depthSign: 1 };
}

/** Despiece: la pieza con sus espigas y, ocultas, sus mortajas y agujeros. */
export function drawPart(project: Project, part: Part): Drawing {
  const projection = partProjection(part);
  const ends = partEnds(project, part);
  const pockets: DrawItem[] = part.pockets.map((p) => ({ id: `${part.id}-${p.id}`, box: solidBox(pocketSolid(part, p)), joint: true, owner: part.id, hole: true }));
  const rest = [...partJointItems(project, part, true), ...partSectionItems(part), ...pockets];
  let drawing = drawItems([{ id: part.id, box: ends?.box ?? partBox(part) }, ...rest], projection);
  const outline = ends && endOutline(ends, projection);
  if (outline) {
    // El contorno con las puntas en ángulo en lugar del rectángulo; los encastres quedan como estaban.
    const lines = [...outline.lines, ...(rest.length ? drawItems(rest, projection).lines : [])];
    const pts = lines.flatMap((l) => [l.a, l.b]);
    const bounds = {
      u0: Math.min(...pts.map((q) => q[0])),
      v0: Math.min(...pts.map((q) => q[1])),
      u1: Math.max(...pts.map((q) => q[0])),
      v1: Math.max(...pts.map((q) => q[1])),
    };
    drawing = { ...drawing, lines, bounds, angles: outline.angles };
  }
  return {
    ...drawing,
    arcs: partArcMarks(part, projection),
    stops: partSectionStops(part, projection),
    turns: partTurnMarks(part, projection),
    engine: { parts: [part.id], projection, ...(ends?.local ? { local: part.id } : {}) },
  };
}

/**
 * Contorno de una pieza con las puntas en ángulo, en la cara que mira quien dibuja, y el ángulo de cada punta larga:
 * el que se marca con la falsa escuadra. null si el largo de la pieza no corre a lo ancho del dibujo.
 */
function endOutline(e: PartEnds, p: Projection): { lines: Line2[]; angles: AngleMark[] } | null {
  if (p.u !== e.along) return null;
  const depth = p.depthSign > 0 ? e.box.max[p.depth] : e.box.min[p.depth];
  const corner = (end: 'lo' | 'hi', across: number): [number, number] => {
    const q: Vec3 = [0, 0, 0];
    q[p.v] = across;
    q[p.depth] = depth;
    q[e.along] = endAt(e[end], q, e.along, end === 'lo' ? e.box.min[e.along] : e.box.max[e.along]);
    return [p.uSign * q[p.u], p.vSign * q[p.v]];
  };
  const [v0, v1] = [e.box.min[p.v], e.box.max[p.v]];
  const pts = [corner('lo', v0), corner('lo', v1), corner('hi', v1), corner('hi', v0)];
  const lines: Line2[] = pts.map((a, i) => ({ a, b: pts[(i + 1) % 4]!, hidden: false, joint: false }));
  const angles: AngleMark[] = [];
  for (const [end, x, y] of [
    ['lo', pts[0]!, pts[1]!],
    ['hi', pts[3]!, pts[2]!],
  ] as const) {
    if (!e[end]) continue;
    // La punta larga: la que llega más lejos sobre el largo. Ahí el ángulo entre el canto y la punta es agudo.
    const out = (end === 'hi' ? 1 : -1) * p.uSign;
    const [tip, other] = x[0] * out >= y[0] * out ? [x, y] : [y, x];
    const len = Math.hypot(other[0] - tip[0], other[1] - tip[1]) || 1;
    const b: [number, number] = [(other[0] - tip[0]) / len, (other[1] - tip[1]) / len];
    const a: [number, number] = [-out, 0];
    const deg = (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])) ) * 180) / Math.PI;
    if (Math.abs(deg - 90) >= 1) angles.push({ at: tip, a, b, deg });
  }
  return { lines, angles };
}

/** Estaciones del torneado, si el eje del torneado es el largo del dibujo. */
export function partTurnMarks(part: Part, p: Projection): TurnMark[] {
  const tu = part.turning;
  if (!tu || tu.axis !== p.u) return [];
  const box = partBox(part);
  const center = (box.min[p.v] + box.max[p.v]) / 2;
  const st = tu.stations;
  return st.map((s, i) => ({
    u: p.uSign * (box.min[p.u] + s.at),
    v: p.vSign * center,
    at: p.uSign > 0 ? s.at : boxSize(box)[p.u] - s.at,
    d: s.d,
    square: (i === 0 || s.to === 'square') && (i === st.length - 1 || st[i + 1]!.to === 'square'),
  }));
}

/** Puntas de los tramos que corren a lo largo de un eje del dibujo, sin repetir y sin las puntas de la pieza. */
export function partSectionStops(part: Part, p: Projection): { u: number[]; v: number[] } {
  const whole = project({ id: part.id, box: partBox(part) }, p).rect;
  const u = new Set<number>();
  const v = new Set<number>();
  for (const s of part.sections) {
    const { rect } = project({ id: s.id, box: sectionBox(part, s) }, p);
    if (s.axis === p.u) [rect.u0, rect.u1].forEach((x) => x > whole.u0 + EPS && x < whole.u1 - EPS && u.add(x));
    if (s.axis === p.v) [rect.v0, rect.v1].forEach((x) => x > whole.v0 + EPS && x < whole.v1 - EPS && v.add(x));
  }
  return { u: [...u].sort((a, b) => a - b), v: [...v].sort((a, b) => a - b) };
}

/** Los arcos marcados en una cara que se mira de frente (o de atrás) en esta proyección. */
export function partArcMarks(part: Part, p: Projection): ArcMark[] {
  const box = partBox(part);
  const marks: ArcMark[] = [];
  for (const pk of part.pockets) {
    if (pk.shape.kind !== 'arc' || pk.axis !== p.depth) continue;
    const { mid, center, radius } = arcInfo(pk.shape);
    const [ua, va] = otherAxes(pk.axis);
    const flat = (pt: [number, number]): [number, number] => {
      const q: Vec3 = [0, 0, 0];
      q[ua] = box.min[ua] + pt[0];
      q[va] = box.min[va] + pt[1];
      return [p.uSign * q[p.u], p.vSign * q[p.v]];
    };
    const at = flat(mid);
    const c = flat(center);
    // Sin sacar lo de afuera, el arco es cóncavo hacia el corte: la madera queda del lado contrario al centro.
    const sign = pk.shape.outside ? 1 : -1;
    const len = Math.hypot(c[0] - at[0], c[1] - at[1]) || 1;
    marks.push({ id: pk.id, at, toward: [(sign * (c[0] - at[0])) / len, (sign * (c[1] - at[1])) / len], radius });
  }
  return marks;
}

/** Dos vistas de detalle de un encastre, encuadradas donde se tocan las piezas. */
export function drawJointDetail(project: Project, jointId: string): { views: Drawing[]; projections: Projection[] } | null {
  const j = project.joints.find((x) => x.id === jointId);
  const a = j && project.parts.find((p) => p.id === j.partA);
  const b = j && project.parts.find((p) => p.id === j.partB);
  if (!j || !a || !b || a.base.kind !== 'box' || b.base.kind !== 'box') return null;
  // Donde quedan de verdad: el motor dibuja las piezas armadas, inclinadas o siguiendo a una inclinada.
  const ba = placedBox(project, a);
  const bb = placedBox(project, b);
  const e = endJoint(partBox(a), partBox(b));
  // Ejes: el largo de B, y en cada vista uno de los otros dos.
  const [l, w, t] = partAxesBySize(b);
  const along = e?.axis ?? l;
  const across: [Axis, Axis] = e ? [e.thin, e.wide] : [t, w];
  const items: DrawItem[] = [
    { id: a.id, box: ba },
    { id: b.id, box: bb },
    ...partJointItems(project, a).filter((x) => x.id.startsWith(`${j.id}-`)),
    ...partJointItems(project, b).filter((x) => x.id.startsWith(`${j.id}+`) || x.id.startsWith(`${j.id}-`)),
  ];
  const solids = items.filter((x) => x.joint).map((x) => x.box);
  const focus: Box = solids.length
    ? {
        min: [0, 1, 2].map((k) => Math.min(...solids.map((s) => s.min[k]!))) as Box['min'],
        max: [0, 1, 2].map((k) => Math.max(...solids.map((s) => s.max[k]!))) as Box['max'],
      }
    : {
        min: [0, 1, 2].map((k) => Math.max(ba.min[k]!, bb.min[k]!) - 1) as Box['min'],
        max: [0, 1, 2].map((k) => Math.min(ba.max[k]!, bb.max[k]!) + 1) as Box['max'],
      };
  // La ranura de los botones o la fila de grampas corre todo el faldón: se dibuja una punta, que alcanza para marcarla.
  if (j.type === 'tope' && e && solids.length) focus.max[e.wide] = Math.min(focus.max[e.wide], focus.min[e.wide] + 120);
  const projections = across.map((k): Projection => {
    const depth = ([0, 1, 2] as Axis[]).find((x) => x !== along && x !== k)!;
    return { u: along, uSign: 1, v: k, vSign: 1, depth, depthSign: 1 };
  });
  const views = projections.map((p) => {
    const f = project0(focus, p);
    const pad = Math.max(40, 0.6 * Math.max(f.u1 - f.u0, f.v1 - f.v0));
    const win = { u0: f.u0 - pad, v0: f.v0 - pad, u1: f.u1 + pad, v1: f.v1 + pad };
    return { ...drawItems(items, p, win), engine: { parts: [a.id, b.id], projection: p, window: win } };
  });
  return { views, projections };
}

/**
 * Cámara del motor para una proyección: hacia dónde mira (desde el objeto hacia quien mira) y qué va a
 * la derecha. El motor pone "arriba" a la izquierda de esos dos; si no coincide con `v`, hay que dar vuelta v.
 */
export function engineCamera(p: Projection): { dir: Vec3; xAxis: Vec3; flipV: boolean } {
  const unit = (axis: Axis, sign: number): Vec3 => {
    const v: Vec3 = [0, 0, 0];
    v[axis] = sign;
    return v;
  };
  const dir = unit(p.depth, p.depthSign);
  const xAxis = unit(p.u, p.uSign);
  const up: Vec3 = [dir[1] * xAxis[2] - dir[2] * xAxis[1], dir[2] * xAxis[0] - dir[0] * xAxis[2], dir[0] * xAxis[1] - dir[1] * xAxis[0]];
  return { dir, xAxis, flipV: up[p.v] * p.vSign < 0 };
}

/** Identifica un pedido al motor: cambia solo si cambia alguna de sus piezas o cómo se las mira. */
export function engineViewKey(project: Project, view: EngineView): string {
  return JSON.stringify([view.parts.map((id) => partKey(project, id)), view.projection, view.window ?? null]);
}

/**
 * Cambia las líneas de un dibujo de cajas por las que proyectó el motor (cuatro números por tramo).
 * Los nombres, los rectángulos para acotar y los encastres resaltados quedan como estaban.
 */
export function withEngineLines(d: Drawing, segments: ArrayLike<number>, hidden: ArrayLike<number>): Drawing {
  const win = d.engine?.window;
  const lines: Line2[] = [];
  // El motor trabaja en float: un milésimo de mm alcanza y saca ruido como -0,0000000001.
  const at = (k: number) => Math.round(segments[k]! * 1000) / 1000 + 0;
  for (let i = 0; i < hidden.length; i++) {
    const l: Line2 = { a: [at(4 * i), at(4 * i + 1)], b: [at(4 * i + 2), at(4 * i + 3)], hidden: hidden[i] === 1, joint: false };
    const kept = win ? clipSegment(l, win) : l;
    if (kept) lines.push(kept);
  }
  if (win || !lines.length) return { ...d, lines };
  const pts = lines.flatMap((l) => [l.a, l.b]);
  const bounds = {
    u0: Math.min(...pts.map((q) => q[0])),
    v0: Math.min(...pts.map((q) => q[1])),
    u1: Math.max(...pts.map((q) => q[0])),
    v1: Math.max(...pts.map((q) => q[1])),
  };
  return { ...d, lines, bounds };
}

/** Recorta un tramo en cualquier dirección a una ventana (Liang-Barsky). */
export function clipSegment(l: Line2, w: Rect2): Line2 | null {
  const [x0, y0] = l.a;
  const dx = l.b[0] - x0;
  const dy = l.b[1] - y0;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, x0 - w.u0],
    [dx, w.u1 - x0],
    [-dy, y0 - w.v0],
    [dy, w.v1 - y0],
  ];
  for (const [p, q] of edges) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  if ((t1 - t0) * Math.hypot(dx, dy) <= EPS) return null;
  return { ...l, a: [x0 + t0 * dx, y0 + t0 * dy], b: [x0 + t1 * dx, y0 + t1 * dy] };
}

const project0 = (box: Box, p: Projection) => project({ id: '', box }, p).rect;

import { boxSize, endContact, overlapBox, partBox, type Axis, type Box, type Vec3 } from './geometry';
import { defaultJointParams, endJoint, MIN_TENON_WIDTH, suggestJoints, tenonWidth } from './joints';
import type { Component, Joint, Part } from './project';
import { t, tk } from './i18n';
import { fitJointDepths } from './jointfit';
import { crossingInNotch } from './pockets';
import { mirrorOrient, mirrorShape, setOrient } from './rotate';

/**
 * Herramientas de edición que no dependen de la pantalla: imán a caras cercanas, piezas nuevas
 * y encastres que se mantienen al día cuando las piezas se mueven.
 */

/** Distancia en mm a la que una cara se pega a otra. */
export const SNAP_MM = 14;

export interface Snap {
  value: number;
  /** Qué atrajo la medida: el id de la pieza, 'piso', o null si solo se redondeó. */
  to: string | null;
  /** Quedó con el mismo retiro que `to`, del otro costado del mueble. */
  mirror?: boolean;
}

/** Pega una coordenada a la cara más cercana de otra pieza, o al piso; si no hay ninguna, redondea al mm. */
export function snapCoord(parts: Part[], value: number, axis: Axis, exceptId: string, tol = SNAP_MM): Snap {
  let best: Snap = { value: Math.round(value), to: null };
  let bestD = tol;
  for (const q of parts) {
    if (q.id === exceptId || q.base.kind !== 'box') continue;
    const b = partBox(q);
    for (const c of [b.min[axis], b.max[axis]]) {
      const d = Math.abs(c - value);
      if (d < bestD) {
        bestD = d;
        best = { value: c, to: q.id };
      }
    }
  }
  if (axis === 1 && Math.abs(value) <= bestD) return { value: 0, to: 'piso' };
  return best;
}

/**
 * Corrimiento final de una caja que se arrastra `delta` mm sobre `axis`: si una de sus caras queda cerca
 * de una cara de otra pieza, se pega; si no, el corrimiento se redondea al mm.
 * También se pega al espejo de una gemela del mismo grueso: con el mismo retiro desde el otro costado del mueble,
 * así el faldón derecho queda igual que el izquierdo. Ese imán manda sobre el de las caras.
 */
export function snapMove(parts: Part[], start: Box, axis: Axis, delta: number, exceptId: string, tol = SNAP_MM): Snap {
  const others = parts.filter((q) => q.id !== exceptId && q.base.kind === 'box').map((q) => [q, partBox(q)] as const);
  // Gemelas: las que empiezan con la misma palabra (Faldón, Travesaño). Con cualquier pieza del mismo grueso
  // el espejo tiraría de todos lados.
  const word = (q?: Part) => q?.name.split(' ')[0]?.toLocaleLowerCase();
  const kind = word(parts.find((q) => q.id === exceptId));
  const mirror = mirrorSnap(
    others.filter(([q]) => word(q) === kind),
    start,
    axis,
    delta,
    tol,
    others.map(([, b]) => b),
  );
  if (mirror) return mirror;
  let best: Snap = { value: Math.round(delta), to: null };
  let bestD = tol;
  for (const [q, b] of others) {
    for (const c of [b.min[axis], b.max[axis]]) {
      for (const edge of [start.min[axis], start.max[axis]]) {
        const d = Math.abs(c - (edge + delta));
        if (d < bestD) {
          bestD = d;
          best = { value: c - edge, to: q.id };
        }
      }
    }
  }
  return best;
}

/** El reflejo más cercano de una gemela del mismo grueso, por el medio del mueble (`all`), si está dentro del imán. */
function mirrorSnap(twins: (readonly [Part, Box])[], start: Box, axis: Axis, delta: number, tol: number, all: Box[]): Snap | null {
  if (!twins.length) return null;
  const lo = Math.min(...all.map((b) => b.min[axis]));
  const hi = Math.max(...all.map((b) => b.max[axis]));
  const size = start.max[axis] - start.min[axis];
  let best: Snap | null = null;
  let bestD = tol;
  for (const [q, b] of twins) {
    if (Math.abs(b.max[axis] - b.min[axis] - size) > 0.5) continue;
    const at = lo + hi - b.max[axis];
    // Una pieza en el medio es su propio reflejo: no dice nada.
    if (Math.abs(at - b.min[axis]) < 0.5) continue;
    const d = Math.abs(at - (start.min[axis] + delta));
    if (d < bestD) {
      bestD = d;
      best = { value: at - start.min[axis], to: q.id, mirror: true };
    }
  }
  return best;
}

/**
 * Desde dónde se mide la posición de una pieza: el alto desde el piso; a lo ancho y a lo fondo, desde el borde
 * izquierdo y el de atrás del resto del mueble (sin la pieza misma, así el número no cambia al moverla).
 */
export function placeOrigin(parts: Part[], id: string): Vec3 {
  const others = parts.filter((p) => p.id !== id && p.base.kind === 'box').map(partBox);
  if (!others.length) return [0, 0, 0];
  return [Math.min(...others.map((b) => b.min[0])), 0, Math.min(...others.map((b) => b.min[2]))];
}

/** Posición de la pieza medida desde `placeOrigin`: [desde la izquierda, desde el piso, desde atrás]. */
export function partPlace(parts: Part[], part: Part): Vec3 {
  const o = placeOrigin(parts, part.id);
  return [part.position[0] - o[0], part.position[1] - o[1], part.position[2] - o[2]];
}

/** Lleva la pieza a esa distancia del borde (o del piso) sobre un eje. */
export function setPlace(parts: Part[], id: string, axis: Axis, value: number): void {
  const part = parts.find((p) => p.id === id);
  if (part) part.position[axis] = placeOrigin(parts, id)[axis] + value;
}

/** Primer id libre con ese prefijo: N1, N2… */
export function nextPartId(parts: Part[], prefix: string): string {
  const used = new Set(parts.map((p) => p.id));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export const NEW_PARTS = {
  tabla: { prefix: 'N', name: tk('Tabla'), size: [600, 22, 146] },
  liston: { prefix: 'L', name: tk('Listón'), size: [600, 45, 45] },
  tablero: { prefix: 'B', name: tk('Tablero'), size: [600, 18, 400] },
} as const satisfies Record<string, { prefix: string; name: string; size: Vec3 }>;
export type NewPartKind = keyof typeof NEW_PARTS;

/** Pieza nueva apoyada en el piso, al costado derecho de todo lo que ya hay. */
export function newPart(parts: Part[], kind: NewPartKind, wood: string): Part {
  const spec = NEW_PARTS[kind];
  const right = parts.reduce((x, p) => (p.base.kind === 'box' ? Math.max(x, partBox(p).max[0]) : x), 0);
  const id = nextPartId(parts, spec.prefix);
  return {
    id,
    name: `${t(spec.name)} ${id.slice(spec.prefix.length)}`,
    wood,
    base: { kind: 'box', size: [...spec.size] },
    position: [parts.length ? right + 150 : 0, 0, 0],
    rotation: [0, 0, 0],
    ops: [],
    pockets: [], bevels: [], sections: [],
  };
}

/** Copia de una pieza a la derecha del mueble, apoyada a la misma altura y sin atravesar otra pieza, con id y nombre nuevos. */
export function duplicatePart(parts: Part[], part: Part): Part {
  const prefix = part.id.replace(/\d+$/, '') || 'N';
  const right = parts.reduce((x, p) => (p.base.kind === 'box' ? Math.max(x, partBox(p).max[0]) : x), part.position[0]);
  return {
    ...structuredClone(part),
    id: nextPartId(parts, prefix),
    name: part.component ? part.name : t('{name} (copia)', { name: part.name }),
    position: [right + 150, part.position[1], part.position[2]],
  };
}

/** Palabras que cambian al pasar una pieza al otro lado del mueble. */
const SIDE_WORDS: [string, string][] = [
  ['izquierdo', 'derecho'],
  ['izquierda', 'derecha'],
  ['delantero', 'trasero'],
  ['delantera', 'trasera'],
  ['left', 'right'],
  ['front', 'back'],
];

/** El nombre de la pieza del otro lado: "Travesaño medio izquierdo" pasa a "Travesaño medio derecho". */
export function otherSideName(name: string): string {
  return name.replace(/[\p{L}]+/gu, (w) => {
    const lower = w.toLowerCase();
    for (const [a, b] of SIDE_WORDS) {
      const to = lower === a ? b : lower === b ? a : null;
      if (to) return w[0] === w[0]!.toUpperCase() ? to[0]!.toUpperCase() + to.slice(1) : to;
    }
    return w;
  });
}

export interface MirrorResult {
  part: Part;
  /** Sobre qué eje se reflejó: 0 de izquierda a derecha, 2 de adelante hacia atrás. */
  axis: Axis;
}

/**
 * La pieza gemela del otro lado del mueble: la del frente pasa atrás, la de la izquierda a la derecha, con el mismo
 * retiro. Se refleja sobre el eje en que la pieza está más corrida del medio. null si la pieza está en el medio o si
 * del otro lado ya hay una pieza igual.
 */
export function mirrorPart(parts: Part[], part: Part): MirrorResult | null {
  if (part.base.kind !== 'box') return null;
  const others = parts.filter((p) => p.id !== part.id && p.base.kind === 'box').map(partBox);
  if (!others.length) return null;
  const own = partBox(part);
  const all = [...others, own];
  let best: { axis: Axis; off: number } | null = null;
  for (const axis of [0, 2] as Axis[]) {
    const lo = Math.min(...all.map((b) => b.min[axis]));
    const hi = Math.max(...all.map((b) => b.max[axis]));
    const off = Math.abs((own.min[axis] + own.max[axis]) / 2 - (lo + hi) / 2) / Math.max(1, hi - lo);
    if (off * (hi - lo) > 1 && (!best || off > best.off)) best = { axis, off };
  }
  if (!best) return null;
  const { axis } = best;
  const lo = Math.min(...all.map((b) => b.min[axis]));
  const hi = Math.max(...all.map((b) => b.max[axis]));
  const position: Vec3 = [...part.position];
  position[axis] = lo + hi - own.max[axis];
  const box: Box = { min: [...own.min], max: [...own.max] };
  box.min[axis] = position[axis];
  box.max[axis] = position[axis] + (own.max[axis] - own.min[axis]);
  const same = (b: Box) => [0, 1, 2].every((k) => Math.abs(b.min[k]! - box.min[k]!) < 1 && Math.abs(b.max[k]! - box.max[k]!) < 1);
  if (others.some(same)) return null;
  const prefix = part.id.replace(/\d+$/, '') || 'N';
  // La gemela va reflejada: un bisel en la arista de afuera de la pata izquierda queda afuera también en la derecha.
  const twin: Part = { ...structuredClone(part), id: nextPartId(parts, prefix), name: otherSideName(part.name) };
  mirrorShape(twin, axis);
  setOrient(twin, mirrorOrient(axis));
  // Una pata inclinada se abre hacia su lado: la gemela, hacia el otro.
  if (twin.lean) twin.lean[axis === 0 ? 0 : 1] *= -1;
  twin.position = position;
  return { axis, part: twin };
}

/**
 * Letra del código según la primera palabra del nombre, en castellano o en inglés: lo que se renombra como
 * "Listón del asiento" pasa a ser L. Las palabras que no están acá dejan el código como estaba.
 */
const NAME_PREFIXES: [RegExp, string][] = [
  [/^((frente|costado|trasera|fondo) del caj[oó]n|drawer)(?=\s|$)/, 'K'],
  [/^(puerta|(larguero|peinazo|tablero) de la puerta|door)(?=\s|$)/, 'D'],
  [/^(pata|leg)(?=\s|$)/, 'P'],
  [/^(fald[oó]n|apron)(?=\s|$)/, 'F'],
  [/^(travesa[ñn]o|rail|stretcher|rung)(?=\s|$)/, 'R'],
  [/^(list[oó]n|slat|batten)(?=\s|$)/, 'L'],
  [/^(asiento|seat)(?=\s|$)/, 'S'],
  [/^(tablero|panel)(?=\s|$)/, 'B'],
  [/^(tabla|board|plank)(?=\s|$)/, 'N'],
  [/^(estante|shelf)(?=\s|$)/, 'E'],
  [/^(tapa|top|lid)(?=\s|$)/, 'T'],
  [/^(z[oó]calo|plinth|kickboard)(?=\s|$)/, 'Z'],
];

export function namePrefix(name: string): string | null {
  const n = name.trim().toLowerCase();
  return NAME_PREFIXES.find(([re]) => re.test(n))?.[1] ?? null;
}

/**
 * Cambia el nombre de una pieza. Si el nombre nuevo corresponde a otra letra de código (una copia de faldón que pasa
 * a ser "Listón del asiento"), la pieza recibe un código nuevo y sus uniones lo siguen. Devuelve el código final.
 */
export function renamePart(project: { parts: Part[]; joints: Joint[]; components?: Component[] }, id: string, name: string): string {
  const part = project.parts.find((p) => p.id === id);
  if (!part) return id;
  const before = part.name.trim().split(/\s+/)[0];
  part.name = name;
  // El componente lleva el nombre de su pieza: un "Faldón" que pasa a "Travesaño" deja de llamarse Faldón 2.
  const word = name.trim().split(/\s+/)[0] ?? '';
  const comp = project.components?.find((c) => c.id === part.component);
  if (comp && word && word !== before && comp.name.split(' ')[0] !== word) {
    const taken = new Set(project.components!.filter((c) => c !== comp).map((c) => c.name));
    let label = word;
    for (let n = 2; taken.has(label); n++) label = `${word} ${n}`;
    comp.name = label;
  }
  const prefix = namePrefix(name);
  if (!prefix || id.replace(/\d+$/, '') === prefix) return id;
  const next = nextPartId(project.parts, prefix);
  part.id = next;
  for (const j of project.joints) {
    const old = `${j.partA}-${j.partB}`;
    if (j.partA === id) j.partA = next;
    if (j.partB === id) j.partB = next;
    if (j.id === old) j.id = `${j.partA}-${j.partB}`;
  }
  return next;
}

function touches(a: Box, b: Box): boolean {
  return !!endContact(a, b) || !!overlapBox(a, b);
}

/** Hasta cuánto se aleja una espiga del tercio de su pieza y se sigue tomando como "la del tercio". */
const THIRD_SLACK = 0.6;

/**
 * Una espiga que ya no entra en su pieza, porque la pieza se achicó (un faldón de 8 cm que pasa a travesaño de 3):
 * los hombros y el espesor vuelven a las medidas de taller para la pieza nueva. El largo que eligió la persona queda.
 * Con `was`, la caja que tenía la pieza de la espiga antes del cambio: si cambió de espesor y la espiga era la del
 * tercio, sigue siendo la del tercio con el espesor nuevo. Un espesor escrito a mano, lejos del tercio, queda.
 */
function refitTenon(j: Joint, a: Box, b: Box, was?: Box): Joint {
  if (j.type !== 'mortaja') return j;
  const e = endJoint(a, b);
  const def = defaultJointParams('mortaja', a, b);
  if (!e || !def) return j;
  const wide = e.section.max[e.wide] - e.section.min[e.wide];
  const thin = e.section.max[e.thin] - e.section.min[e.thin];
  const shoulder = j.params.shoulder ?? def.shoulder!;
  const thickness = j.params.thickness ?? def.thickness!;
  const narrow = wide - 2 * shoulder < MIN_TENON_WIDTH && def.shoulder! < shoulder;
  const oldStock = was && was.max[e.thin] - was.min[e.thin];
  const newStock = b.max[e.thin] - b.min[e.thin];
  const followed =
    oldStock !== undefined && Math.abs(oldStock - newStock) > 0.01 && Math.abs(thickness - oldStock / 3) <= THIRD_SLACK && Math.abs(thickness - def.thickness!) > 0.01;
  const thick = thickness >= thin || followed;
  // Una espiga doble en una pieza que se angostó: si cada una queda muy fina, vuelve a ser una.
  const count = j.params.count ?? 1;
  const single = count > 1 && tenonWidth(wide, { shoulder: narrow ? def.shoulder! : shoulder, count, gap: j.params.gap }) < MIN_TENON_WIDTH;
  if (!narrow && !thick && !single) return j;
  return {
    ...j,
    params: { ...j.params, ...(narrow ? { shoulder: def.shoulder } : {}), ...(thick ? { thickness: def.thickness } : {}), ...(single ? { count: 1 } : {}) },
  };
}

/**
 * Encastres al día con las piezas: conserva los que siguen valiendo (con el tipo y las medidas que eligió
 * la persona), propone uno para cada contacto nuevo y saca los de piezas que ya no se tocan. Con `before`, las
 * piezas antes del cambio, las espigas del tercio siguen el espesor nuevo de su pieza.
 */
export function syncJoints(parts: Part[], joints: Joint[], before?: Part[]): Joint[] {
  const boxes = new Map(parts.flatMap((p) => (p.base.kind === 'box' ? [[p.id, partBox(p)] as const] : [])));
  const was = new Map((before ?? []).flatMap((p) => (p.base.kind === 'box' ? [[p.id, partBox(p)] as const] : [])));
  const key = (x: string, y: string) => [x, y].sort().join('|');
  const kept = new Map<string, Joint>();
  for (const j of joints) {
    const a = boxes.get(j.partA);
    const b = boxes.get(j.partB);
    if (!a || !b || !touches(a, b)) continue;
    if (defaultJointParams(j.type, a, b) !== null) kept.set(key(j.partA, j.partB), refitTenon(j, a, b, was.get(j.partB)));
  }
  const result: Joint[] = [];
  const added = new Set<string>();
  for (const s of suggestJoints(parts)) {
    const k = kept.get(key(s.partA, s.partB));
    if (!k) added.add(s.id);
    result.push(k ?? s);
    kept.delete(key(s.partA, s.partB));
  }
  // Contactos que la propuesta no ve pero la persona eligió. Un cruce donde ya hay una muesca dibujada
  // apoya en ella: no se rebaja a media madera.
  const byId = new Map(parts.map((p) => [p.id, p]));
  const all = [...result, ...kept.values()].map((j) =>
    j.type === 'media-madera' && crossingInNotch(byId.get(j.partA)!, byId.get(j.partB)!) ? { ...j, type: 'tope' as const, params: {} } : j,
  );
  // Las uniones nuevas no se pueden cruzar adentro de una pieza con las que ya están.
  if (added.size) fitJointDepths({ parts, joints: all }, added);
  return all;
}

/** Medidas de la caja ordenadas de mayor a menor, con su eje: largo, ancho y espesor. */
export function partAxesBySize(part: Part): [Axis, Axis, Axis] {
  const s = part.base.kind === 'box' ? part.base.size : boxSize(partBox(part));
  return ([0, 1, 2] as Axis[]).sort((x, y) => s[y] - s[x]) as [Axis, Axis, Axis];
}

/** Cómo se llama la medida de la pieza sobre el eje `axis`, pensando en la pieza y no en el mueble. */
export function partSizeName(part: Part, axis: Axis): 'largo' | 'ancho' | 'espesor' {
  return (['largo', 'ancho', 'espesor'] as const)[partAxesBySize(part).indexOf(axis)]!;
}

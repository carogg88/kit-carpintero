import { boxSize, endContact, overlapBox, partBox, type Axis, type Box, type Vec3 } from './geometry';
import { defaultJointParams, suggestJoints } from './joints';
import type { Joint, Part } from './project';

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
 */
export function snapMove(parts: Part[], start: Box, axis: Axis, delta: number, exceptId: string, tol = SNAP_MM): Snap {
  let best: Snap = { value: Math.round(delta), to: null };
  let bestD = tol;
  for (const q of parts) {
    if (q.id === exceptId || q.base.kind !== 'box') continue;
    const b = partBox(q);
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

/** Primer id libre con ese prefijo: N1, N2… */
export function nextPartId(parts: Part[], prefix: string): string {
  const used = new Set(parts.map((p) => p.id));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export const NEW_PARTS = {
  tabla: { prefix: 'N', name: 'Tabla', size: [600, 22, 146] },
  liston: { prefix: 'L', name: 'Listón', size: [600, 45, 45] },
  tablero: { prefix: 'B', name: 'Tablero', size: [600, 18, 400] },
} as const satisfies Record<string, { prefix: string; name: string; size: Vec3 }>;
export type NewPartKind = keyof typeof NEW_PARTS;

/** Pieza nueva apoyada en el piso, al costado derecho de todo lo que ya hay. */
export function newPart(parts: Part[], kind: NewPartKind, wood: string): Part {
  const spec = NEW_PARTS[kind];
  const right = parts.reduce((x, p) => (p.base.kind === 'box' ? Math.max(x, partBox(p).max[0]) : x), 0);
  const id = nextPartId(parts, spec.prefix);
  return {
    id,
    name: `${spec.name} ${id.slice(spec.prefix.length)}`,
    wood,
    base: { kind: 'box', size: [...spec.size] },
    position: [parts.length ? right + 150 : 0, 0, 0],
    rotation: [0, 0, 0],
    ops: [],
    pockets: [],
  };
}

/** Copia de una pieza corrida a su derecha, con id y nombre nuevos. */
export function duplicatePart(parts: Part[], part: Part): Part {
  const prefix = part.id.replace(/\d+$/, '') || 'N';
  const width = part.base.kind === 'box' ? part.base.size[0] : 100;
  return {
    ...structuredClone(part),
    id: nextPartId(parts, prefix),
    name: part.component ? part.name : `${part.name} (copia)`,
    position: [part.position[0] + width + 100, part.position[1], part.position[2]],
  };
}

function touches(a: Box, b: Box): boolean {
  return !!endContact(a, b) || !!overlapBox(a, b);
}

/**
 * Encastres al día con las piezas: conserva los que siguen valiendo (con el tipo y las medidas que eligió
 * la persona), propone uno para cada contacto nuevo y saca los de piezas que ya no se tocan.
 */
export function syncJoints(parts: Part[], joints: Joint[]): Joint[] {
  const boxes = new Map(parts.flatMap((p) => (p.base.kind === 'box' ? [[p.id, partBox(p)] as const] : [])));
  const key = (x: string, y: string) => [x, y].sort().join('|');
  const kept = new Map<string, Joint>();
  for (const j of joints) {
    const a = boxes.get(j.partA);
    const b = boxes.get(j.partB);
    if (!a || !b || !touches(a, b)) continue;
    if (defaultJointParams(j.type, a, b) !== null) kept.set(key(j.partA, j.partB), j);
  }
  const result: Joint[] = [];
  for (const s of suggestJoints(parts)) {
    result.push(kept.get(key(s.partA, s.partB)) ?? s);
    kept.delete(key(s.partA, s.partB));
  }
  // Contactos que la propuesta no ve pero la persona eligió.
  return [...result, ...kept.values()];
}

/** Medidas de la caja ordenadas de mayor a menor, con su eje: largo, ancho y espesor. */
export function partAxesBySize(part: Part): [Axis, Axis, Axis] {
  const s = part.base.kind === 'box' ? part.base.size : boxSize(partBox(part));
  return ([0, 1, 2] as Axis[]).sort((x, y) => s[y] - s[x]) as [Axis, Axis, Axis];
}

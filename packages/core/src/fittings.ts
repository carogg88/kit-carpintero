import { boxSize, partBox, type Box, type Vec3 } from './geometry';
import { defaultJointParams } from './joints';
import { nextPartId } from './edit';
import { t, tk } from './i18n';
import type { Component, Joint, JointType, Part } from './project';

/**
 * Cajones y puertas: se eligen un hueco del mueble y unas pocas opciones, y se arman todas las piezas
 * con sus encastres, como lo haría un carpintero. Medidas en mm.
 */

/** Hueco al frente del mueble: un rectángulo libre entre piezas por los cuatro lados, con su fondo. */
export interface Opening {
  box: Box;
  /** Piezas que lo cierran: izquierda, derecha, abajo y arriba. */
  sides: { left: string[]; right: string[]; below: string[]; above: string[] };
  /** Lo grueso de la pieza que lo cierra de cada lado, para que un frente superpuesto no la pase de la mitad. */
  edge: { left: number; right: number; below: number; above: number };
}

/** Piezas que llegan al frente: las que están a menos de esto del frente del mueble marcan los huecos. */
const FRONT_BAND = 40;
const MIN_W = 80;
const MIN_H = 50;
const MIN_DEPTH = 100;

/** Huecos al frente del mueble, de abajo hacia arriba y de izquierda a derecha. */
export function findOpenings(parts: Part[]): Opening[] {
  const all = parts.filter((p) => p.base.kind === 'box').map((p) => ({ id: p.id, b: partBox(p) }));
  if (all.length < 4) return [];
  const zFront = Math.max(...all.map((x) => x.b.max[2]));
  const front = all.filter((x) => x.b.max[2] >= zFront - FRONT_BAND);
  const edges = (k: 0 | 1) => [...new Set(front.flatMap((x) => [x.b.min[k], x.b.max[k]]).map((v) => Math.round(v * 10) / 10))].sort((a, b) => a - b);
  const xs = edges(0);
  const ys = edges(1);
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  if (nx < 1 || ny < 1) return [];
  const covered = (i: number, j: number) => {
    const cx = (xs[i]! + xs[i + 1]!) / 2;
    const cy = (ys[j]! + ys[j + 1]!) / 2;
    return front.some((x) => cx > x.b.min[0] && cx < x.b.max[0] && cy > x.b.min[1] && cy < x.b.max[1]);
  };
  const grid = Array.from({ length: nx }, (_, i) => Array.from({ length: ny }, (_, j) => covered(i, j)));
  const used = grid.map((col) => col.map(() => false));
  const free = (i: number, j: number) => !grid[i]![j] && !used[i]![j];

  const found: Opening[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!free(i, j)) continue;
      let i2 = i;
      while (i2 + 1 < nx && free(i2 + 1, j)) i2++;
      let j2 = j;
      while (j2 + 1 < ny && range(i, i2).every((k) => free(k, j2 + 1))) j2++;
      for (const k of range(i, i2)) for (const m of range(j, j2)) used[k]![m] = true;
      // Cerrado por los cuatro lados: si da a la orilla del mueble no es un hueco, es el aire de afuera.
      const closed =
        i > 0 && i2 + 1 < nx && j > 0 && j2 + 1 < ny &&
        range(j, j2).every((m) => grid[i - 1]![m] && grid[i2 + 1]![m]) &&
        range(i, i2).every((k) => grid[k]![j - 1] && grid[k]![j2 + 1]);
      if (!closed) continue;
      const x0 = xs[i]!, x1 = xs[i2 + 1]!, y0 = ys[j]!, y1 = ys[j2 + 1]!;
      if (x1 - x0 < MIN_W || y1 - y0 < MIN_H) continue;
      const touching = (k: 0 | 1, at: number, lo: number, hi: number, side: 'min' | 'max') => {
        const o = k === 0 ? 1 : 0;
        return front.filter((x) => Math.abs(x.b[side][k] - at) < 1 && Math.min(x.b.max[o], hi) - Math.max(x.b.min[o], lo) > 1);
      };
      const left = touching(0, x0, y0, y1, 'max');
      const right = touching(0, x1, y0, y1, 'min');
      const below = touching(1, y0, x0, x1, 'max');
      const above = touching(1, y1, x0, x1, 'min');
      const around = [...left, ...right, ...below, ...above];
      // El frente del hueco: el de los costados que lo cierran (un zócalo puede estar más adentro).
      const zf = Math.max(...(left.length && right.length ? [...left, ...right] : around).map((x) => x.b.max[2]));
      // El fondo: una trasera detrás del hueco, o hasta donde llegan las piezas que lo cierran.
      const behind = all.filter((x) => x.b.max[2] < zf - 1 && x.b.min[0] < x1 - 1 && x.b.max[0] > x0 + 1 && x.b.min[1] < y1 - 1 && x.b.max[1] > y0 + 1);
      const zb = Math.max(...behind.map((x) => x.b.max[2]), ...around.map((x) => x.b.min[2]));
      if (zf - zb < MIN_DEPTH) continue;
      const thick = (xs: typeof left, k: 0 | 1) => Math.min(...xs.map((x) => boxSize(x.b)[k]));
      found.push({
        box: { min: [x0, y0, zb], max: [x1, y1, zf] },
        sides: { left: left.map((x) => x.id), right: right.map((x) => x.id), below: below.map((x) => x.id), above: above.map((x) => x.id) },
        edge: { left: thick(left, 0), right: thick(right, 0), below: thick(below, 1), above: thick(above, 1) },
      });
    }
  }
  return found;
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
}

/** Hueco suelto, para armar un cajón o una puerta con medidas escritas cuando el mueble no tiene ninguno. */
export function looseOpening(parts: Part[], size: Vec3): Opening {
  const right = parts.reduce((x, p) => (p.base.kind === 'box' ? Math.max(x, partBox(p).max[0]) : x), 0);
  const x0 = parts.length ? right + 150 : 0;
  return {
    box: { min: [x0, 0, 0], max: [x0 + size[0], size[1], size[2]] },
    sides: { left: [], right: [], below: [], above: [] },
    edge: { left: 20, right: 20, below: 20, above: 20 },
  };
}

/** Embutido: el frente queda adentro del hueco, al ras. Superpuesto: tapa los cantos del mueble. */
export type FrontStyle = 'embutido' | 'superpuesto';
/** Correderas de madera (el cajón corre sobre el estante) o metálicas, que piden 12,5 mm por costado. */
export type Slides = 'madera' | 'metalicas';
export type DoorStyle = 'tablero' | 'marco';

export interface DrawerOptions {
  count: number;
  front: FrontStyle;
  slides: Slides;
  wood: string;
}

export interface DoorOptions {
  count: 1 | 2;
  front: FrontStyle;
  style: DoorStyle;
  wood: string;
}

export interface Fitting {
  parts: Part[];
  joints: Joint[];
  components: Component[];
}

/** Luz alrededor de un frente embutido, y entre dos frentes. */
export const REVEAL = 2;
const PAIR_GAP = 3;
/** Espesores: frente y puerta de 2 cm, cajón de 1,5 cm, fondo de 9 mm. */
export const FRONT_T = 20;
const BOX_T = 15;
const BOTTOM_T = 9;
/** Largos de correderas metálicas que se consiguen. */
const SLIDE_LENGTHS = [250, 300, 350, 400, 450, 500, 550, 600];

/** Frente superpuesto: tapa hasta casi la mitad del canto vecino, sin pasar de 9 mm. */
const overlay = (edge: number) => Math.max(3, Math.min(9, Math.floor(edge / 2) - 2));

const DRAWER_NAMES = {
  front: tk('Frente del cajón'),
  side: tk('Costado del cajón'),
  back: tk('Trasera del cajón'),
  bottom: tk('Fondo del cajón'),
};
const DOOR_NAMES = {
  slab: tk('Puerta'),
  stile: tk('Larguero de la puerta'),
  rail: tk('Peinazo de la puerta'),
  panel: tk('Tablero de la puerta'),
};

/** Arma piezas y encastres en orden: el primer tipo de la lista que entra en cada unión. */
class Builder {
  parts: Part[] = [];
  joints: Joint[] = [];
  constructor(
    private existing: Part[],
    private wood: string,
    private prefix: string,
  ) {}

  part(name: string, min: Vec3, max: Vec3): Part {
    const r = (v: number) => Math.round(v * 10) / 10;
    const p: Part = {
      id: nextPartId([...this.existing, ...this.parts], this.prefix),
      name: t(name),
      wood: this.wood,
      base: { kind: 'box', size: [r(max[0] - min[0]), r(max[1] - min[1]), r(max[2] - min[2])] },
      position: [r(min[0]), r(min[1]), r(min[2])],
      rotation: [0, 0, 0],
      ops: [{ kind: 'round', edges: 'all', radius: 1 }],
      pockets: [],
      bevels: [],
      sections: [],
    };
    this.parts.push(p);
    return p;
  }

  /** `a` recibe, `b` entra. */
  join(a: Part, b: Part, types: JointType[]): void {
    for (const type of types) {
      const params = defaultJointParams(type, partBox(a), partBox(b));
      if (params) {
        this.joints.push({ id: `${a.id}-${b.id}`, type, partA: a.id, partB: b.id, params: { ...params } });
        return;
      }
    }
  }

  /** Las piezas iguales (mismo nombre y medidas) quedan vinculadas: los costados, los frentes de varios cajones. */
  done(taken: Component[]): Fitting {
    const groups = new Map<string, Part[]>();
    for (const p of this.parts) {
      const key = JSON.stringify([p.name, p.base]);
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    const components: Component[] = [];
    const ids = new Set(taken.map((c) => c.id));
    const names = new Set(taken.map((c) => c.name));
    for (const copies of groups.values()) {
      if (copies.length < 2) continue;
      let n = 1;
      while (ids.has(`C${n}`)) n++;
      const id = `C${n}`;
      let name = copies[0]!.name;
      for (let k = 2; names.has(name); k++) name = `${copies[0]!.name} ${k}`;
      ids.add(id);
      names.add(name);
      components.push({ id, name });
      for (const p of copies) p.component = id;
    }
    return { parts: this.parts, joints: this.joints, components };
  }
}

/** Frentes repartidos a lo alto (cajones) o a lo ancho (puertas): [desde, hasta] de cada uno. */
function split(lo: number, hi: number, n: number, gap: number): [number, number][] {
  const each = (hi - lo - gap * (n - 1)) / n;
  return range(0, n - 1).map((i) => [lo + i * (each + gap), lo + i * (each + gap) + each]);
}

/** Lo que tapa el frente: el hueco menos la luz si es embutido, o más el canto si es superpuesto. */
function frontRect(o: Opening, style: FrontStyle): { x: [number, number]; y: [number, number]; z: [number, number] } {
  const { min, max } = o.box;
  if (style === 'embutido') {
    return { x: [min[0] + REVEAL, max[0] - REVEAL], y: [min[1] + REVEAL, max[1] - REVEAL], z: [max[2] - FRONT_T, max[2]] };
  }
  // 1 mm adelante del mueble: tocándolo, la app pensaría que va encastrado en los cantos.
  return {
    x: [min[0] - overlay(o.edge.left), max[0] + overlay(o.edge.right)],
    y: [min[1] - overlay(o.edge.below), max[1] + overlay(o.edge.above)],
    z: [max[2] + 1, max[2] + 1 + FRONT_T],
  };
}

/** Lugar que necesita cada cajón, para avisar antes de armarlo. */
export function drawerProblem(o: Opening, opts: Pick<DrawerOptions, 'count' | 'slides' | 'front'>): string | null {
  const s = boxSize(o.box);
  const slot = s[1] / opts.count;
  if (slot - 2 - 15 < 40) return t('No entran {n} cajones: cada uno quedaría de menos de 6 cm de alto.', { n: opts.count });
  const gap = opts.slides === 'metalicas' ? 12.5 : REVEAL;
  if (s[0] - 2 * gap - 2 * BOX_T < 60) return t('El hueco es muy angosto para un cajón.');
  const back = opts.front === 'embutido' ? FRONT_T : -1;
  if (s[2] - back - 10 < MIN_DEPTH) return t('El hueco es muy poco hondo para un cajón.');
  return null;
}

/** Cajones apilados en el hueco: frente, dos costados, trasera y fondo cada uno, con colas de milano y canal. */
export function buildDrawers(existing: { parts: Part[]; components: Component[] }, o: Opening, opts: DrawerOptions): Fitting {
  const b = new Builder(existing.parts, opts.wood, 'K');
  const f = frontRect(o, opts.front);
  const { min, max } = o.box;
  const fronts = split(f.y[0], f.y[1], opts.count, opts.front === 'embutido' ? REVEAL : PAIR_GAP);
  const slots = split(min[1], max[1], opts.count, 0);
  const gap = opts.slides === 'metalicas' ? 12.5 : REVEAL;
  const zf = f.z[0];
  const avail = zf - min[2] - 10;
  const depth = opts.slides === 'metalicas' ? (SLIDE_LENGTHS.filter((l) => l <= avail).at(-1) ?? Math.floor(avail / 10) * 10) : Math.floor(avail / 10) * 10;
  const bx0 = min[0] + gap;
  const bx1 = max[0] - gap;
  const zb = zf - depth;
  // Encastres de un cajón fino: colas de milano adelante y atrás. Si no entran, rebaje o tarugos.
  const corner: JointType[] = ['cola-milano', 'rebaje', 'clavija', 'tope'];
  for (let i = 0; i < opts.count; i++) {
    const [fy0, fy1] = fronts[i]!;
    const [sy0, sy1] = slots[i]!;
    // La caja flota 2 mm sobre lo de abajo y deja 15 mm arriba para entrar y salir.
    const by0 = sy0 + 2;
    const by1 = sy1 - 15;
    const front = b.part(DRAWER_NAMES.front, [f.x[0], fy0, f.z[0]], [f.x[1], fy1, f.z[1]]);
    const left = b.part(DRAWER_NAMES.side, [bx0, by0, zb + BOX_T], [bx0 + BOX_T, by1, zf]);
    const right = b.part(DRAWER_NAMES.side, [bx1 - BOX_T, by0, zb + BOX_T], [bx1, by1, zf]);
    const back = b.part(DRAWER_NAMES.back, [bx0, by0, zb], [bx1, by1, zb + BOX_T]);
    const bottom = b.part(DRAWER_NAMES.bottom, [bx0 + BOX_T, by0 + 10, zb + BOX_T], [bx1 - BOX_T, by0 + 10 + BOTTOM_T, zf]);
    for (const side of [left, right]) {
      b.join(front, side, corner);
      b.join(back, side, corner);
    }
    for (const p of [front, left, right, back]) b.join(p, bottom, ['canal', 'tope']);
  }
  return b.done(existing.components);
}

/** Lugar que necesita la puerta. */
export function doorProblem(o: Opening, opts: Pick<DoorOptions, 'count'>): string | null {
  const s = boxSize(o.box);
  if (s[0] / opts.count < 80) return t('El hueco es muy angosto para {n} puertas.', { n: opts.count });
  return null;
}

/** Una puerta o un par: de una tabla entera, o de marco (largueros y peinazos con mortaja) con un tablero en canal. */
export function buildDoors(existing: { parts: Part[]; components: Component[] }, o: Opening, opts: DoorOptions): Fitting {
  const b = new Builder(existing.parts, opts.wood, 'D');
  const f = frontRect(o, opts.front);
  const leaves = split(f.x[0], f.x[1], opts.count, PAIR_GAP);
  const [z0, z1] = f.z;
  const [y0, y1] = f.y;
  for (const [x0, x1] of leaves) {
    const w = x1 - x0;
    const h = y1 - y0;
    const frame = Math.round(Math.min(60, w / 4, h / 4));
    if (opts.style === 'tablero' || frame < 30) {
      b.part(DOOR_NAMES.slab, [x0, y0, z0], [x1, y1, z1]);
      continue;
    }
    const left = b.part(DOOR_NAMES.stile, [x0, y0, z0], [x0 + frame, y1, z1]);
    const right = b.part(DOOR_NAMES.stile, [x1 - frame, y0, z0], [x1, y1, z1]);
    const bottom = b.part(DOOR_NAMES.rail, [x0 + frame, y0, z0], [x1 - frame, y0 + frame, z1]);
    const top = b.part(DOOR_NAMES.rail, [x0 + frame, y1 - frame, z0], [x1 - frame, y1, z1]);
    // El tablero, de 12 mm y centrado en el espesor del marco, flota en un canal todo alrededor.
    const zm = (z0 + z1) / 2;
    const panel = b.part(DOOR_NAMES.panel, [x0 + frame, y0 + frame, zm - 6], [x1 - frame, y1 - frame, zm + 6]);
    for (const stile of [left, right]) {
      b.join(stile, bottom, ['mortaja', 'clavija', 'tope']);
      b.join(stile, top, ['mortaja', 'clavija', 'tope']);
    }
    for (const p of [left, right, bottom, top]) b.join(p, panel, ['canal', 'tope']);
  }
  return b.done(existing.components);
}

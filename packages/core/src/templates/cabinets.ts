import { buildDoors, buildDrawers, findOpenings, type Fitting } from '../fittings';
import { holdTops } from '../review';
import { SCHEMA_VERSION, type JointType, type Part, type Project } from '../project';
import { defaultJointParams, suggestJoints } from '../joints';
import { partBox, type Vec3 } from '../geometry';
import { createTable, TABLE_DEFAULTS } from './table';
import { tk } from '../i18n';
import { isSheet, sheetById, thinPanelMaterial } from '../woods';

/**
 * Muebles de cajón: dos laterales, tapa arriba, piso sobre un zócalo y trasera de 9 mm. Los huecos se llenan
 * con cajones, puertas o estantes, con las mismas piezas que se agregan en el editor. Medidas en mm.
 */

const BACK_T = 9;
const PLINTH = 80;

interface CarcassDims {
  width: number;
  height: number;
  depth: number;
  board: number;
  /** Alto del zócalo; 0 para un mueble colgado, con el piso abajo de todo. */
  plinth: number;
  /** Alturas (desde el piso) de los estantes fijos al frente, aparte del piso. */
  shelves: number[];
  /** Estantes retirados del frente: quedan detrás de las puertas sin partir el hueco. */
  inner?: number[];
}

function box(wood: string, id: string, name: string, min: Vec3, max: Vec3, ops: Part['ops'] = []): Part {
  return {
    id,
    name,
    wood,
    base: { kind: 'box', size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] },
    position: min,
    rotation: [0, 0, 0],
    ops,
    pockets: [],
    bevels: [],
    sections: [],
  };
}

function carcass(d: CarcassDims, wood: string): Part[] {
  const { width: W, height: H, depth: D, board: t, plinth } = d;
  const b = (id: string, name: string, min: Vec3, max: Vec3) => box(wood, id, name, min, max);
  const parts: Part[] = [
    b('L1', tk('Lateral izquierdo'), [0, 0, 0], [t, H - t, D]),
    b('L2', tk('Lateral derecho'), [W - t, 0, 0], [W, H - t, D]),
    b('T1', tk('Tapa'), [0, H - t, 0], [W, H, D]),
    b('E1', tk('Estante de abajo'), [t, plinth, BACK_T], [W - t, plinth + t, D]),
    { ...b('B1', tk('Fondo trasero'), [t, plinth + t, 0], [W - t, H - t, BACK_T]), wood: thinPanelMaterial(wood, BACK_T) },
  ];
  if (plinth > 0) parts.push(b('Z1', tk('Zócalo'), [t, 0, D - 20 - t], [W - t, plinth, D - 20]));
  [...d.shelves, ...(d.inner ?? [])].forEach((y, i) => {
    const back = d.inner?.includes(y) ? 60 : 0;
    parts.push(b(`E${i + 2}`, `Estante ${i + 2}`, [t, y, BACK_T], [W - t, y + t, D - back]));
  });
  return parts;
}

/** Encastres del mueble: estantes en canal, tapa con tarugos y la trasera apoyada en estantes y piso. */
function carcassProject(id: string, name: string, now: string, parts: Part[]): Project {
  // La melamina se arma con tarugos: la cara plástica no se encastra.
  const melamine = sheetById(parts[0]?.wood ?? '')?.banding ?? false;
  const force = (a: Part, b: Part): JointType | null => {
    const ids = [a.id, b.id];
    if (ids.includes('B1')) return ids.some((x) => x.startsWith('L') || x === 'T1') ? null : 'tope';
    if (ids.includes('T1') || melamine) return 'clavija';
    return null;
  };
  const joints = suggestJoints(parts).map((j) => {
    const a = parts.find((p) => p.id === j.partA)!;
    const b = parts.find((p) => p.id === j.partB)!;
    const type = force(a, b);
    if (!type || type === j.type) return j;
    const params = defaultJointParams(type, partBox(a), partBox(b));
    return params ? { ...j, type, params: { ...params } } : j;
  });
  // Las tapas y asientos macizos van sujetos con botones o grampas, que los dejan moverse.
  holdTops({ parts, joints });
  return { schemaVersion: SCHEMA_VERSION, id: `${id}-${now}`, name, units: 'cm', template: id, createdAt: now, updatedAt: now, parts, joints, components: [], groups: [] };
}

/** Suma un cajón, una puerta o un estante armado al proyecto. */
function fit(p: Project, f: Fitting): void {
  p.parts.push(...f.parts);
  p.joints.push(...f.joints);
  p.components.push(...f.components);
}

/** El hueco de más abajo, o el de más arriba con `top`. */
function opening(p: Project, top = false) {
  const all = findOpenings(p.parts).sort((a, b) => a.box.min[1] - b.box.min[1]);
  return top ? all.at(-1) : all[0];
}

type V = Record<string, number>;

export function createNightstand(v: V, wood: string, now: string): Project {
  const { width: W, height: H, depth: D, board: t } = v as Record<'width' | 'height' | 'depth' | 'board', number>;
  // Un cajón de unos 15 cm arriba y un nicho abierto abajo.
  const drawerH = Math.min(160, Math.max(100, (H - PLINTH - 3 * t) * 0.35));
  const p = carcassProject('mesa-luz', 'Mesa de luz', now, carcass({ width: W, height: H, depth: D, board: t, plinth: PLINTH, shelves: [Math.round(H - t - drawerH - t)] }, wood));
  const o = opening(p, true);
  if (o) fit(p, buildDrawers(p, o, { count: 1, front: 'embutido', slides: 'madera', wood }));
  return p;
}

export function createDresser(v: V, wood: string, now: string): Project {
  const { width: W, height: H, depth: D, board: t, drawers, graded } = v as Record<'width' | 'height' | 'depth' | 'board' | 'drawers' | 'graded', number>;
  const p = carcassProject('cajonera', 'Cajonera', now, carcass({ width: W, height: H, depth: D, board: t, plinth: PLINTH, shelves: [] }, wood));
  const o = opening(p);
  if (o) fit(p, buildDrawers(p, o, { count: Math.max(1, Math.round(drawers)), front: 'embutido', slides: 'metalicas', wood, graded: graded === 1 }));
  return p;
}

/** Biblioteca: estantes abiertos arriba y, si se pide, un mueble con puertas abajo. */
export function createBookcase(v: V, wood: string, now: string): Project {
  const { width: W, height: H, depth: D, board: t, shelves, doors } = v as Record<'width' | 'height' | 'depth' | 'board' | 'shelves' | 'doors', number>;
  const lower = doors ? Math.min(800, Math.round(H * 0.4)) : 0;
  const start = lower || PLINTH + t;
  const n = Math.max(1, Math.round(shelves));
  const top = H - t;
  const ys = doors ? [lower] : [];
  const span = top - start;
  // Los estantes abiertos, repartidos parejo entre el de las puertas (o el piso) y la tapa.
  for (let i = 1; i <= n; i++) ys.push(Math.round(start + (doors ? t : 0) + ((span - (doors ? t : 0)) * i) / (n + 1) - t / 2));
  const p = carcassProject('biblioteca', 'Biblioteca', now, carcass({ width: W, height: H, depth: D, board: t, plinth: PLINTH, shelves: ys }, wood));
  if (doors) {
    const o = opening(p);
    if (o) fit(p, buildDoors(p, o, { count: W > 600 ? 2 : 1, front: 'embutido', style: isSheet(wood) ? 'tablero' : 'marco', wood }));
  }
  return p;
}

/** Alacena colgada: sin zócalo, un estante adentro y puertas de marco que tapan todo. */
export function createWallCabinet(v: V, wood: string, now: string): Project {
  const { width: W, height: H, depth: D, board: t } = v as Record<'width' | 'height' | 'depth' | 'board', number>;
  const mid = Math.round((H - t) / 2);
  const p = carcassProject('alacena', 'Alacena', now, carcass({ width: W, height: H, depth: D, board: t, plinth: 0, shelves: [], inner: [mid] }, wood));
  const o = opening(p);
  if (o) fit(p, buildDoors(p, o, { count: W > 600 ? 2 : 1, front: 'embutido', style: isSheet(wood) ? 'tablero' : 'marco', wood }));
  return p;
}

export const COFFEE_DEFAULTS = { ...TABLE_DEFAULTS, width: 1000, depth: 550, height: 420, leg: 45, top: 25, apronHeight: 80, apronThickness: 20, inset: 25 };

export function createCoffeeTable(v: V, wood: string, now: string): Project {
  const p = createTable({ ...COFFEE_DEFAULTS, ...v } as typeof COFFEE_DEFAULTS, wood, now);
  p.template = 'mesa-ratona';
  p.id = `mesa-ratona-${now}`;
  return p;
}

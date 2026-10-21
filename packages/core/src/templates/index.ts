import { suggestJoints, jointOptions, defaultJointParams } from '../joints';
import { partBox } from '../geometry';
import { partWord } from '../jointinfo';
import { SCHEMA_VERSION, type JointType, type Part, type Project } from '../project';
import { createTable, TABLE_DEFAULTS } from './table';
import { autoComponents } from '../components';

/**
 * Plantillas: un formulario de medidas generales arma el mueble entero, con sus encastres.
 * Todas las medidas en mm.
 */

export interface TemplateField {
  key: string;
  label: string;
  group: 'general' | 'piezas';
  default: number;
  min: number;
  max: number;
  /** Cantidad (entero), no medida. */
  count?: boolean;
  /** Rango habitual: fuera de él se avisa, sin impedir seguir. */
  typical?: [number, number];
  /** Aviso cuando la medida queda fuera del rango habitual. */
  typicalNote?: string;
}

export interface JointChoice {
  /** Grupo de uniones al que se aplica, por las primeras palabras de las piezas ("Pata|Faldón"). */
  groups: string[];
  label: string;
  options: JointType[];
  default: JointType;
}

export interface TemplateDef {
  id: string;
  name: string;
  /** Nombre del proyecto nuevo. */
  projectName: string;
  /** Texto del botón para crear. */
  createLabel: string;
  fields: TemplateField[];
  joints: JointChoice | null;
  build: (v: Record<string, number>, wood: string, now: string) => Project;
}

/**
 * Proyecto con los encastres que propondría un carpintero. `force` cambia el de algunas piezas:
 * 'tope' para tapas y asientos que apoyan (van con tornillos, clips o bisagras), o otro tipo si entra.
 */
const project = (id: string, name: string, now: string, parts: Part[], force: (a: Part, b: Part) => JointType | null): Project => {
  const joints = suggestJoints(parts).map((j) => {
    const a = parts.find((p) => p.id === j.partA)!;
    const b = parts.find((p) => p.id === j.partB)!;
    const type = force(a, b);
    if (!type || type === j.type) return j;
    const params = defaultJointParams(type, partBox(a), partBox(b));
    return params ? { ...j, type, params: { ...params } } : j;
  });
  return { schemaVersion: SCHEMA_VERSION, id: `${id}-${now}`, name, units: 'cm', template: id, createdAt: now, updatedAt: now, parts, joints, components: [] };
};

const boxPart = (wood: string, ops: Part['ops']) => (id: string, name: string, min: [number, number, number], max: [number, number, number]): Part => ({
  id,
  name,
  wood,
  base: { kind: 'box', size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] },
  position: min,
  rotation: [0, 0, 0],
  ops,
  pockets: [],
});

const round3: Part['ops'] = [{ kind: 'round', edges: 'all', radius: 3 }];

function createStool(v: Record<string, number>, wood: string, now: string): Project {
  const { width: S, height: H, leg, seat, apronHeight: aH, rung } = v as Record<'width' | 'height' | 'leg' | 'seat' | 'apronHeight' | 'rung', number>;
  const aT = 20;
  const set = 6;
  const rH = 30;
  const box = boxPart(wood, round3);
  const sY = H - seat;
  const aY = sY - aH;
  const far = S - leg;
  const parts: Part[] = [
    box('S1', 'Asiento', [0, sY, 0], [S, H, S]),
    box('P1', 'Pata trasera izquierda', [0, 0, 0], [leg, sY, leg]),
    box('P2', 'Pata trasera derecha', [far, 0, 0], [S, sY, leg]),
    box('P3', 'Pata delantera derecha', [far, 0, far], [S, sY, S]),
    box('P4', 'Pata delantera izquierda', [0, 0, far], [leg, sY, S]),
    box('F1', 'Faldón delantero', [leg, aY, S - set - aT], [far, sY, S - set]),
    box('F2', 'Faldón trasero', [leg, aY, set], [far, sY, set + aT]),
    box('F3', 'Faldón izquierdo', [set, aY, leg], [set + aT, sY, far]),
    box('F4', 'Faldón derecho', [S - set - aT, aY, leg], [S - set, sY, far]),
    box('R1', 'Travesaño delantero', [leg, rung, S - set - aT], [far, rung + rH, S - set]),
    box('R2', 'Travesaño trasero', [leg, rung, set], [far, rung + rH, set + aT]),
    box('R3', 'Travesaño izquierdo', [set, rung + rH + 10, leg], [set + aT, rung + 2 * rH + 10, far]),
    box('R4', 'Travesaño derecho', [S - set - aT, rung + rH + 10, leg], [S - set, rung + 2 * rH + 10, far]),
  ];
  return project('taburete', 'Taburete', now, parts, (a, b) => (a.id === 'S1' || b.id === 'S1' ? 'tope' : null));
}

function createShelf(v: Record<string, number>, wood: string, now: string): Project {
  const { width: W, height: H, depth: D, board: t, shelves } = v as Record<'width' | 'height' | 'depth' | 'board', number> & { shelves?: number };
  const box = boxPart(wood, []);
  const n = Math.max(2, Math.round(shelves ?? 4));
  const base = 70;
  const parts: Part[] = [box('L1', 'Lateral izquierdo', [0, 0, 0], [t, H, D]), box('L2', 'Lateral derecho', [W - t, 0, 0], [W, H, D])];
  const span = H - t - base;
  for (let i = 0; i < n; i++) {
    const y = Math.round(base + (span * i) / (n - 1));
    const name = i === 0 ? 'Estante de abajo' : i === n - 1 ? 'Estante de arriba' : `Estante ${i + 1}`;
    parts.push(box(`E${i + 1}`, name, [t, y, 0], [W - t, y + t, D]));
  }
  parts.push(box('Z1', 'Zócalo', [t, 0, D - 20 - t], [W - t, base, D - 20]));
  return project('estante', 'Estante', now, parts, () => null);
}

function createBox(v: Record<string, number>, wood: string, now: string): Project {
  const { width: L, depth: Wd, height: H, wall: t, lid } = v as Record<'width' | 'depth' | 'height' | 'wall' | 'lid', number>;
  const box = boxPart(wood, [{ kind: 'round', edges: 'all', radius: 1 }]);
  const bottom = 6;
  const parts: Part[] = [
    box('C1', 'Frente', [0, 0, Wd - t], [L, H, Wd]),
    box('C2', 'Fondo trasero', [0, 0, 0], [L, H, t]),
    box('C3', 'Costado izquierdo', [0, 0, t], [t, H, Wd - t]),
    box('C4', 'Costado derecho', [L - t, 0, t], [L, H, Wd - t]),
    box('B1', 'Base', [t, 8, t], [L - t, 8 + bottom, Wd - t]),
    box('T1', 'Tapa', [0, H, 0], [L, H + lid, Wd]),
  ];
  return project('caja', 'Caja de té', now, parts, (a, b) =>
    a.id === 'T1' || b.id === 'T1' ? 'tope' : a.id === 'B1' || b.id === 'B1' ? 'canal' : null,
  );
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'mesa',
    name: 'Mesa',
    projectName: 'Mesa de comedor',
    createLabel: 'Crear mesa',
    fields: [
      { key: 'width', label: 'Ancho', group: 'general', default: TABLE_DEFAULTS.width, min: 400, max: 3500 },
      { key: 'depth', label: 'Fondo', group: 'general', default: TABLE_DEFAULTS.depth, min: 300, max: 1500 },
      {
        key: 'height',
        label: 'Alto',
        group: 'general',
        default: TABLE_DEFAULTS.height,
        min: 300,
        max: 1200,
        typical: [720, 760],
        typicalNote: 'una mesa de comedor suele medir entre 72 y 76 cm de alto',
      },
      { key: 'leg', label: 'Pata', group: 'piezas', default: TABLE_DEFAULTS.leg, min: 30, max: 150 },
      { key: 'top', label: 'Tapa', group: 'piezas', default: TABLE_DEFAULTS.top, min: 15, max: 60 },
      { key: 'apronHeight', label: 'Faldón', group: 'piezas', default: TABLE_DEFAULTS.apronHeight, min: 50, max: 200 },
    ],
    joints: { groups: ['Pata|Faldón'], label: 'Patas con faldón', options: ['mortaja', 'clavija'], default: 'mortaja' },
    build: (v, wood, now) => createTable({ ...TABLE_DEFAULTS, ...v } as typeof TABLE_DEFAULTS, wood, now),
  },
  {
    id: 'taburete',
    name: 'Taburete',
    projectName: 'Taburete',
    createLabel: 'Crear taburete',
    fields: [
      { key: 'width', label: 'Asiento', group: 'general', default: 340, min: 220, max: 600 },
      {
        key: 'height',
        label: 'Alto',
        group: 'general',
        default: 650,
        min: 300,
        max: 900,
        typical: [450, 780],
        typicalNote: 'un taburete bajo mide unos 45 cm y uno de barra, entre 65 y 78 cm',
      },
      { key: 'rung', label: 'Travesaño', group: 'general', default: 220, min: 80, max: 500 },
      { key: 'leg', label: 'Pata', group: 'piezas', default: 40, min: 25, max: 80 },
      { key: 'seat', label: 'Asiento', group: 'piezas', default: 25, min: 15, max: 50 },
      { key: 'apronHeight', label: 'Faldón', group: 'piezas', default: 70, min: 40, max: 120 },
    ],
    joints: { groups: ['Pata|Faldón', 'Pata|Travesaño'], label: 'Patas con faldones y travesaños', options: ['mortaja', 'clavija'], default: 'mortaja' },
    build: createStool,
  },
  {
    id: 'estante',
    name: 'Estante',
    projectName: 'Estante',
    createLabel: 'Crear estante',
    fields: [
      { key: 'width', label: 'Ancho', group: 'general', default: 800, min: 300, max: 1200 },
      { key: 'depth', label: 'Fondo', group: 'general', default: 300, min: 150, max: 600, typical: [200, 400], typicalNote: 'un estante para libros suele tener entre 20 y 40 cm de fondo' },
      { key: 'height', label: 'Alto', group: 'general', default: 1800, min: 400, max: 2400 },
      { key: 'board', label: 'Tabla', group: 'piezas', default: 20, min: 12, max: 40 },
      { key: 'shelves', label: 'Estantes', group: 'piezas', default: 5, min: 2, max: 10, count: true },
    ],
    joints: { groups: ['Lateral|Estante', 'Lateral|Zócalo'], label: 'Estantes con laterales', options: ['canal', 'clavija'], default: 'canal' },
    build: createShelf,
  },
  {
    id: 'caja',
    name: 'Caja de té',
    projectName: 'Caja de té',
    createLabel: 'Crear caja',
    fields: [
      { key: 'width', label: 'Largo', group: 'general', default: 240, min: 100, max: 600 },
      { key: 'depth', label: 'Ancho', group: 'general', default: 160, min: 80, max: 400 },
      { key: 'height', label: 'Alto', group: 'general', default: 90, min: 40, max: 300 },
      { key: 'wall', label: 'Paredes', group: 'piezas', default: 10, min: 6, max: 20 },
      { key: 'lid', label: 'Tapa', group: 'piezas', default: 10, min: 6, max: 20 },
    ],
    joints: { groups: ['Frente|Costado', 'Fondo|Costado'], label: 'Esquinas', options: ['rebaje', 'dedos', 'cola-milano', 'inglete', 'clavija'], default: 'rebaje' },
    build: createBox,
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

export const templateDefaults = (t: TemplateDef): Record<string, number> => Object.fromEntries(t.fields.map((f) => [f.key, f.default]));

/** Avisos de medidas fuera de lo habitual (no impiden crear). */
export function templateWarnings(t: TemplateDef, v: Record<string, number>): { key: string; note: string }[] {
  return t.fields.flatMap((f) => {
    const x = v[f.key];
    if (x === undefined || !f.typical || !f.typicalNote) return [];
    return x < f.typical[0] || x > f.typical[1] ? [{ key: f.key, note: f.typicalNote }] : [];
  });
}

/** Arma el mueble con las medidas, la madera y el encastre elegido. */
export function buildTemplate(t: TemplateDef, v: Record<string, number>, wood: string, joint?: JointType, now = new Date().toISOString()): Project {
  const p = t.build({ ...templateDefaults(t), ...v }, wood, now);
  p.name = t.projectName;
  autoComponents(p);
  if (!t.joints || !joint) return p;
  const groups = new Set(t.joints.groups);
  for (const j of p.joints) {
    const a = p.parts.find((x) => x.id === j.partA);
    const b = p.parts.find((x) => x.id === j.partB);
    if (!a || !b || !groups.has(`${partWord(a)}|${partWord(b)}`)) continue;
    if (!jointOptions(partBox(a), partBox(b)).includes(joint)) continue;
    j.type = joint;
    j.params = { ...defaultJointParams(joint, partBox(a), partBox(b)) };
  }
  return p;
}

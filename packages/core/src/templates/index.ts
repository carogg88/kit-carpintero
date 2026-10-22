import { suggestJoints, jointOptions, defaultJointParams } from '../joints';
import { partBox } from '../geometry';
import { partWord } from '../jointinfo';
import { SCHEMA_VERSION, type JointType, type Part, type Project } from '../project';
import { createTable, TABLE_DEFAULTS } from './table';
import { autoComponents } from '../components';
import { fitJointDepths } from '../jointfit';
import { t, tk } from '../i18n';

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
  /** Qué es la medida, en palabras de taller y sin dibujo técnico. */
  hint: string;
  /**
   * Qué marca la vista previa con el campo elegido: las piezas cuyo código empieza con `parts` y, si es
   * una medida, la cota de la pieza `measure` (o de todo el mueble con 'all') a lo largo de `axis`.
   * `fromFloor` mide desde el piso hasta abajo de la pieza.
   */
  shows: { parts: string; measure?: string; axis?: 0 | 1 | 2; fromFloor?: boolean };
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
  pockets: [], bevels: [], sections: [],
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
    box('S1', tk('Asiento'), [0, sY, 0], [S, H, S]),
    box('P1', tk('Pata trasera izquierda'), [0, 0, 0], [leg, sY, leg]),
    box('P2', tk('Pata trasera derecha'), [far, 0, 0], [S, sY, leg]),
    box('P3', tk('Pata delantera derecha'), [far, 0, far], [S, sY, S]),
    box('P4', tk('Pata delantera izquierda'), [0, 0, far], [leg, sY, S]),
    box('F1', tk('Faldón delantero'), [leg, aY, S - set - aT], [far, sY, S - set]),
    box('F2', tk('Faldón trasero'), [leg, aY, set], [far, sY, set + aT]),
    box('F3', tk('Faldón izquierdo'), [set, aY, leg], [set + aT, sY, far]),
    box('F4', tk('Faldón derecho'), [S - set - aT, aY, leg], [S - set, sY, far]),
    box('R1', tk('Travesaño delantero'), [leg, rung, S - set - aT], [far, rung + rH, S - set]),
    box('R2', tk('Travesaño trasero'), [leg, rung, set], [far, rung + rH, set + aT]),
    box('R3', tk('Travesaño izquierdo'), [set, rung + rH + 10, leg], [set + aT, rung + 2 * rH + 10, far]),
    box('R4', tk('Travesaño derecho'), [S - set - aT, rung + rH + 10, leg], [S - set, rung + 2 * rH + 10, far]),
  ];
  return project('taburete', 'Taburete', now, parts, (a, b) => (a.id === 'S1' || b.id === 'S1' ? 'tope' : null));
}

function createShelf(v: Record<string, number>, wood: string, now: string): Project {
  const { width: W, height: H, depth: D, board: t, shelves } = v as Record<'width' | 'height' | 'depth' | 'board', number> & { shelves?: number };
  const box = boxPart(wood, []);
  const n = Math.max(2, Math.round(shelves ?? 4));
  const base = 70;
  const parts: Part[] = [box('L1', tk('Lateral izquierdo'), [0, 0, 0], [t, H, D]), box('L2', tk('Lateral derecho'), [W - t, 0, 0], [W, H, D])];
  const span = H - t - base;
  for (let i = 0; i < n; i++) {
    const y = Math.round(base + (span * i) / (n - 1));
    const name = i === 0 ? tk('Estante de abajo') : i === n - 1 ? tk('Estante de arriba') : `Estante ${i + 1}`;
    parts.push(box(`E${i + 1}`, name, [t, y, 0], [W - t, y + t, D]));
  }
  parts.push(box('Z1', tk('Zócalo'), [t, 0, D - 20 - t], [W - t, base, D - 20]));
  return project('estante', 'Estante', now, parts, () => null);
}

function createBox(v: Record<string, number>, wood: string, now: string): Project {
  const { width: L, depth: Wd, height: H, wall: t, lid } = v as Record<'width' | 'depth' | 'height' | 'wall' | 'lid', number>;
  const box = boxPart(wood, [{ kind: 'round', edges: 'all', radius: 1 }]);
  const bottom = 6;
  const parts: Part[] = [
    box('C1', tk('Frente'), [0, 0, Wd - t], [L, H, Wd]),
    box('C2', tk('Fondo trasero'), [0, 0, 0], [L, H, t]),
    box('C3', tk('Costado izquierdo'), [0, 0, t], [t, H, Wd - t]),
    box('C4', tk('Costado derecho'), [L - t, 0, t], [L, H, Wd - t]),
    box('B1', tk('Base'), [t, 8, t], [L - t, 8 + bottom, Wd - t]),
    box('T1', tk('Tapa'), [0, H, 0], [L, H + lid, Wd]),
  ];
  return project('caja', 'Caja de té', now, parts, (a, b) =>
    a.id === 'T1' || b.id === 'T1' ? 'tope' : a.id === 'B1' || b.id === 'B1' ? 'canal' : null,
  );
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'mesa',
    name: tk('Mesa'),
    projectName: tk('Mesa de comedor'),
    createLabel: tk('Crear mesa'),
    fields: [
      { key: 'width', label: tk('Largo'), hint: tk('El lado largo de la tapa, de punta a punta.'), shows: { parts: 'T1', measure: 'all', axis: 0 }, group: 'general', default: TABLE_DEFAULTS.width, min: 400, max: 3500 },
      { key: 'depth', label: tk('Fondo'), hint: tk('El lado corto de la tapa, de adelante hacia atrás.'), shows: { parts: 'T1', measure: 'all', axis: 2 }, group: 'general', default: TABLE_DEFAULTS.depth, min: 300, max: 1500 },
      {
        key: 'height',
        label: tk('Alto'),
        hint: tk('Desde el piso hasta arriba de la tapa.'),
        shows: { parts: 'P', measure: 'all', axis: 1 },
        group: 'general',
        default: TABLE_DEFAULTS.height,
        min: 300,
        max: 1200,
        typical: [720, 760],
        typicalNote: tk('una mesa de comedor suele medir entre 72 y 76 cm de alto'),
      },
      { key: 'leg', label: tk('Grosor de la pata'), hint: tk('Las patas son cuadradas: es el ancho de cada cara.'), shows: { parts: 'P', measure: 'P3', axis: 0 }, group: 'piezas', default: TABLE_DEFAULTS.leg, min: 30, max: 150 },
      { key: 'top', label: tk('Espesor de la tapa'), hint: tk('Lo grueso de la tabla de arriba.'), shows: { parts: 'T1', measure: 'T1', axis: 1 }, group: 'piezas', default: TABLE_DEFAULTS.top, min: 15, max: 60 },
      { key: 'apronHeight', label: tk('Alto del faldón'), hint: tk('El faldón es la tabla que une las patas debajo de la tapa: cuánto baja.'), shows: { parts: 'F', measure: 'F1', axis: 1 }, group: 'piezas', default: TABLE_DEFAULTS.apronHeight, min: 50, max: 200 },
    ],
    joints: { groups: ['Pata|Faldón'], label: tk('Patas con faldón'), options: ['mortaja', 'clavija'], default: 'mortaja' },
    build: (v, wood, now) => createTable({ ...TABLE_DEFAULTS, ...v } as typeof TABLE_DEFAULTS, wood, now),
  },
  {
    id: 'taburete',
    name: tk('Taburete'),
    projectName: tk('Taburete'),
    createLabel: tk('Crear taburete'),
    fields: [
      { key: 'width', label: tk('Lado del asiento'), hint: tk('El asiento es cuadrado: es lo que mide cada lado.'), shows: { parts: 'S1', measure: 'S1', axis: 0 }, group: 'general', default: 340, min: 220, max: 600 },
      {
        key: 'height',
        label: tk('Alto'),
        hint: tk('Desde el piso hasta arriba del asiento.'),
        shows: { parts: 'P', measure: 'all', axis: 1 },
        group: 'general',
        default: 650,
        min: 300,
        max: 900,
        typical: [450, 780],
        typicalNote: tk('un taburete bajo mide unos 45 cm y uno de barra, entre 65 y 78 cm'),
      },
      { key: 'rung', label: tk('Altura del travesaño'), hint: tk('Los travesaños son las barras de abajo, donde se apoyan los pies: a qué altura del piso van.'), shows: { parts: 'R', measure: 'R1', axis: 1, fromFloor: true }, group: 'general', default: 220, min: 80, max: 500 },
      { key: 'leg', label: tk('Grosor de la pata'), hint: tk('Las patas son cuadradas: es el ancho de cada cara.'), shows: { parts: 'P', measure: 'P3', axis: 0 }, group: 'piezas', default: 40, min: 25, max: 80 },
      { key: 'seat', label: tk('Espesor del asiento'), hint: tk('Lo grueso de la tabla donde te sentás.'), shows: { parts: 'S1', measure: 'S1', axis: 1 }, group: 'piezas', default: 25, min: 15, max: 50 },
      { key: 'apronHeight', label: tk('Alto del faldón'), hint: tk('El faldón es la tabla que une las patas debajo del asiento: cuánto baja.'), shows: { parts: 'F', measure: 'F1', axis: 1 }, group: 'piezas', default: 70, min: 40, max: 120 },
    ],
    joints: { groups: ['Pata|Faldón', 'Pata|Travesaño'], label: tk('Patas con faldones y travesaños'), options: ['mortaja', 'clavija'], default: 'mortaja' },
    build: createStool,
  },
  {
    id: 'estante',
    name: tk('Estante'),
    projectName: tk('Estante'),
    createLabel: tk('Crear estante'),
    fields: [
      { key: 'width', label: tk('Ancho'), hint: tk('De lado a lado, por fuera.'), shows: { parts: 'E', measure: 'all', axis: 0 }, group: 'general', default: 800, min: 300, max: 1200 },
      { key: 'depth', label: tk('Fondo'), hint: tk('De adelante hacia atrás: lo hondo de cada estante.'), shows: { parts: 'E', measure: 'all', axis: 2 }, group: 'general', default: 300, min: 150, max: 600, typical: [200, 400], typicalNote: tk('un estante para libros suele tener entre 20 y 40 cm de fondo') },
      { key: 'height', label: tk('Alto'), hint: tk('Desde el piso hasta arriba de los laterales.'), shows: { parts: 'L', measure: 'all', axis: 1 }, group: 'general', default: 1800, min: 400, max: 2400 },
      { key: 'board', label: tk('Espesor de las tablas'), hint: tk('Lo grueso de los laterales y de los estantes.'), shows: { parts: 'L', measure: 'L2', axis: 0 }, group: 'piezas', default: 20, min: 12, max: 40 },
      { key: 'shelves', label: tk('Cantidad de estantes'), hint: tk('Cuántas tablas horizontales lleva, contando la de abajo y la de arriba.'), shows: { parts: 'E' }, group: 'piezas', default: 5, min: 2, max: 10, count: true },
    ],
    joints: { groups: ['Lateral|Estante', 'Lateral|Zócalo'], label: tk('Estantes con laterales'), options: ['canal', 'clavija'], default: 'canal' },
    build: createShelf,
  },
  {
    id: 'caja',
    name: tk('Caja de té'),
    projectName: tk('Caja de té'),
    createLabel: tk('Crear caja'),
    fields: [
      { key: 'width', label: tk('Largo'), hint: tk('El lado largo de la caja, por fuera.'), shows: { parts: 'C1', measure: 'all', axis: 0 }, group: 'general', default: 240, min: 100, max: 600 },
      { key: 'depth', label: tk('Ancho'), hint: tk('El lado corto de la caja, por fuera.'), shows: { parts: 'C4', measure: 'all', axis: 2 }, group: 'general', default: 160, min: 80, max: 400 },
      { key: 'height', label: tk('Alto'), hint: tk('Desde la base hasta el borde de arriba, sin la tapa.'), shows: { parts: 'C', measure: 'C1', axis: 1 }, group: 'general', default: 90, min: 40, max: 300 },
      { key: 'wall', label: tk('Espesor de las paredes'), hint: tk('Lo grueso de las cuatro tablas de los costados.'), shows: { parts: 'C', measure: 'C4', axis: 0 }, group: 'piezas', default: 10, min: 6, max: 20 },
      { key: 'lid', label: tk('Espesor de la tapa'), hint: tk('Lo grueso de la tabla de arriba.'), shows: { parts: 'T1', measure: 'T1', axis: 1 }, group: 'piezas', default: 10, min: 6, max: 20 },
    ],
    joints: { groups: ['Frente|Costado', 'Fondo|Costado'], label: tk('Esquinas'), options: ['rebaje', 'dedos', 'cola-milano', 'inglete', 'clavija'], default: 'rebaje' },
    build: createBox,
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

export const templateDefaults = (tpl: TemplateDef): Record<string, number> => Object.fromEntries(tpl.fields.map((f) => [f.key, f.default]));

/** Avisos de medidas fuera de lo habitual (no impiden crear), en el idioma actual. */
export function templateWarnings(tpl: TemplateDef, v: Record<string, number>): { key: string; note: string }[] {
  return tpl.fields.flatMap((f) => {
    const x = v[f.key];
    if (x === undefined || !f.typical || !f.typicalNote) return [];
    return x < f.typical[0] || x > f.typical[1] ? [{ key: f.key, note: t(f.typicalNote) }] : [];
  });
}

/** Nombre de una pieza de plantilla en el idioma actual: las plantillas se arman con los nombres en español. */
function localPartName(es: string): string {
  const m = /^Estante (\d+)$/.exec(es);
  return m ? t('Estante {n}', { n: m[1]! }) : t(es);
}

/** Arma el mueble con las medidas, la madera y el encastre elegido. */
export function buildTemplate(tpl: TemplateDef, v: Record<string, number>, wood: string, joint?: JointType, now = new Date().toISOString()): Project {
  const p = tpl.build({ ...templateDefaults(tpl), ...v }, wood, now);
  p.name = t(tpl.projectName);
  // Los grupos de uniones se reconocen por los nombres en español, antes de traducirlos.
  if (tpl.joints && joint) {
    const groups = new Set(tpl.joints.groups);
    for (const j of p.joints) {
      const a = p.parts.find((x) => x.id === j.partA);
      const b = p.parts.find((x) => x.id === j.partB);
      if (!a || !b || !groups.has(`${partWord(a)}|${partWord(b)}`)) continue;
      if (!jointOptions(partBox(a), partBox(b)).includes(joint)) continue;
      j.type = joint;
      j.params = { ...defaultJointParams(joint, partBox(a), partBox(b)) };
    }
  }
  // Las espigas de dos faldones que llegan a la misma altura de una pata no se pueden cruzar.
  fitJointDepths(p);
  for (const x of p.parts) x.name = localPartName(x.name);
  autoComponents(p);
  return p;
}

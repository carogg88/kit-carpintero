import { partBox } from '../geometry';
import { defaultMortiseParams } from '../joints/mortise';
import { SCHEMA_VERSION, type Joint, type Part, type Project } from '../project';
import { tk } from '../i18n';

export interface TableDims {
  width: number;
  depth: number;
  height: number;
  leg: number;
  top: number;
  apronHeight: number;
  apronThickness: number;
  /** Distancia de la pata al borde de la tapa. */
  inset: number;
  /** Retiro del faldón respecto de la cara de la pata. */
  setback: number;
  /** Radio de los cantos redondeados; 0 = cantos rectos. */
  edgeRadius: number;
}

export const TABLE_DEFAULTS: TableDims = {
  width: 1800,
  depth: 900,
  height: 750,
  leg: 70,
  top: 22,
  apronHeight: 95,
  apronThickness: 22,
  inset: 30,
  setback: 12,
  edgeRadius: 3,
};

/** Mesa de 4 patas, 4 faldones con mortaja y espiga, y tapa apoyada (se sujeta con clips). */
export function createTable(d: TableDims = TABLE_DEFAULTS, wood = 'guatambu', now = new Date().toISOString()): Project {
  const { width: W, depth: D, height: H, leg, top, apronHeight: aH, apronThickness: aT, inset, setback } = d;
  const tY = H - top;
  const aY = tY - aH;
  const ops: Part['ops'] = d.edgeRadius > 0 ? [{ kind: 'round', edges: 'all', radius: d.edgeRadius }] : [];
  const box = (id: string, name: string, min: [number, number, number], max: [number, number, number]): Part => ({
    id,
    name,
    wood,
    base: { kind: 'box', size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] },
    position: min,
    rotation: [0, 0, 0],
    ops,
    pockets: [], bevels: [], sections: [],
  });
  const x0 = inset;
  const x1 = W - inset - leg;
  const z0 = inset;
  const z1 = D - inset - leg;
  const parts: Part[] = [
    box('T1', tk('Tapa'), [0, tY, 0], [W, H, D]),
    box('P1', tk('Pata trasera izquierda'), [x0, 0, z0], [x0 + leg, tY, z0 + leg]),
    box('P2', tk('Pata trasera derecha'), [x1, 0, z0], [x1 + leg, tY, z0 + leg]),
    box('P3', tk('Pata delantera derecha'), [x1, 0, z1], [x1 + leg, tY, z1 + leg]),
    box('P4', tk('Pata delantera izquierda'), [x0, 0, z1], [x0 + leg, tY, z1 + leg]),
    box('F1', tk('Faldón delantero'), [x0 + leg, aY, z1 + leg - setback - aT], [x1, tY, z1 + leg - setback]),
    box('F2', tk('Faldón trasero'), [x0 + leg, aY, z0 + setback], [x1, tY, z0 + setback + aT]),
    box('F3', tk('Faldón izquierdo'), [x0 + setback, aY, z0 + leg], [x0 + setback + aT, tY, z1]),
    box('F4', tk('Faldón derecho'), [x1 + leg - setback - aT, aY, z0 + leg], [x1 + leg - setback, tY, z1]),
  ];
  const byId = new Map(parts.map((p) => [p.id, p]));
  const joints: Joint[] = [];
  const pairs: [string, string][] = [
    ['P4', 'F1'], ['P3', 'F1'], ['P1', 'F2'], ['P2', 'F2'],
    ['P1', 'F3'], ['P4', 'F3'], ['P2', 'F4'], ['P3', 'F4'],
  ];
  for (const [legId, apronId] of pairs) {
    const a = byId.get(legId)!;
    const b = byId.get(apronId)!;
    const params = defaultMortiseParams(partBox(a), partBox(b));
    if (!params) throw new Error(`${apronId} no toca a ${legId}`);
    joints.push({ id: `${legId}-${apronId}`, type: 'mortaja', partA: legId, partB: apronId, params: { ...params } });
  }
  // La tapa apoya sobre patas y faldones y se sujeta con clips: sin encastre.
  for (const id of ['P1', 'P2', 'P3', 'P4', 'F1', 'F2', 'F3', 'F4']) {
    joints.push({ id: `T1-${id}`, type: 'tope', partA: 'T1', partB: id, params: {} });
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    id: `mesa-${now}`,
    name: tk('Mesa de comedor'),
    units: 'cm',
    template: 'mesa',
    createdAt: now,
    updatedAt: now,
    parts,
    joints,
    components: [],
    groups: [],
  };
}

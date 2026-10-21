import { boxSize, overlapBox, partBox, type Box } from '../geometry';
import type { Joint, JointType, Part } from '../project';
import { endJoint, type JointGeometry } from './common';
import { defaultMortiseParams, mortiseGeometry } from './mortise';
import {
  defaultDowelParams,
  defaultGrooveParams,
  defaultRabbetParams,
  dowelGeometry,
  grooveGeometry,
  lapGeometry,
  rabbetFits,
  rabbetGeometry,
} from './others';

export * from './common';
export * from './mortise';
export * from './others';

type Params = Record<string, number>;

/** Encastres que ya tienen geometría. Los de P2 se suman acá a medida que llegan. */
export const BASE_JOINTS = ['tope', 'mortaja', 'media-madera', 'canal', 'rebaje', 'clavija'] as const satisfies readonly JointType[];

export const JOINT_NAMES: Record<JointType, string> = {
  tope: 'A tope',
  mortaja: 'Mortaja y espiga',
  'media-madera': 'Media madera',
  canal: 'Canal',
  rebaje: 'Rebaje',
  clavija: 'Tarugos',
  'cola-milano': 'Cola de milano',
  dedos: 'Caja y espiga (dedos)',
  brida: 'Brida',
  inglete: 'Inglete',
  galleta: 'Galleta',
  machiembrado: 'Machimbre',
  bolsillo: 'Tornillo de bolsillo',
};

/** Medidas iniciales del encastre según las piezas. null si no se puede hacer entre ellas. */
export function defaultJointParams(type: JointType, a: Box, b: Box): Params | null {
  switch (type) {
    case 'tope':
      return endJoint(a, b) ? {} : null;
    case 'mortaja': {
      const p = defaultMortiseParams(a, b);
      return p && { ...p };
    }
    case 'canal':
      return defaultGrooveParams(a, b);
    case 'rebaje':
      return rabbetFits(a, b) ? defaultRabbetParams(a, b) : null;
    case 'media-madera':
      return overlapBox(a, b) ? { ratio: 0.5 } : null;
    case 'clavija': {
      const p = defaultDowelParams(a, b);
      return p && { ...p };
    }
    default:
      return null;
  }
}

/** Qué se suma y se resta en cada pieza. Usa las medidas guardadas y completa las que falten. */
export function jointGeometry(type: JointType, a: Box, b: Box, params: Params = {}): JointGeometry | null {
  const d = defaultJointParams(type, a, b);
  if (!d) return null;
  const p = { ...d, ...params };
  const n = (k: string) => p[k] ?? 0;
  switch (type) {
    case 'tope':
      return { cutA: [], cutB: [], addB: [] };
    case 'mortaja':
      return mortiseGeometry(a, b, { length: n('length'), thickness: n('thickness'), shoulder: n('shoulder') });
    case 'canal':
      return grooveGeometry(a, b, { depth: n('depth') });
    case 'rebaje':
      return rabbetGeometry(a, b, { depth: n('depth') });
    case 'media-madera':
      return lapGeometry(a, b, { ratio: n('ratio') });
    case 'clavija':
      return dowelGeometry(a, b, { diameter: n('diameter'), count: n('count'), depthA: n('depthA'), depthB: n('depthB') });
    default:
      return null;
  }
}

/** Encastres base posibles entre A (recibe) y B (entra). */
export function jointOptions(a: Box, b: Box): JointType[] {
  return BASE_JOINTS.filter((t) => defaultJointParams(t, a, b) !== null);
}

/** Encastre que propondría un carpintero para estas dos piezas. */
function suggestType(a: Box, b: Box): JointType | null {
  if (overlapBox(a, b)) return 'media-madera';
  const j = endJoint(a, b);
  if (!j) return null;
  const sb = boxSize(b);
  const isPanel = sb[j.wide] >= 150 && sb[j.thin] <= 25;
  if (isPanel) return rabbetFits(a, b) ? 'rebaje' : 'canal';
  if (boxSize(a)[j.axis] >= 30 && sb[j.thin] >= 15) return 'mortaja';
  return 'clavija';
}

/** Busca las piezas que se tocan o se cruzan y propone un encastre para cada par. */
export function suggestJoints(parts: Part[]): Joint[] {
  const boxes = parts.flatMap((p) => (p.base.kind === 'box' ? [{ id: p.id, box: partBox(p) }] : []));
  const joints: Joint[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let k = i + 1; k < boxes.length; k++) {
      const p = boxes[i];
      const q = boxes[k];
      if (!p || !q) continue;
      // Recibe la pieza en la que apoya la punta de la otra.
      const [a, b] = endJoint(p.box, q.box) ? [p, q] : [q, p];
      const type = suggestType(a.box, b.box);
      const params = type && defaultJointParams(type, a.box, b.box);
      if (type && params) joints.push({ id: `${a.id}-${b.id}`, type, partA: a.id, partB: b.id, params });
    }
  }
  return joints;
}

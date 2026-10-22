import { boxSize, overlapBox, partBox, type Box } from '../geometry';
import { JOINT_TYPES, type Joint, type JointType, type Part } from '../project';
import { endJoint, type JointGeometry } from './common';
import { tk } from '../i18n';
import {
  biscuitGeometry,
  bridleGeometry,
  defaultBiscuitParams,
  defaultBridleParams,
  defaultDovetailParams,
  defaultFingerParams,
  defaultPocketParams,
  defaultTongueParams,
  dovetailGeometry,
  fingerGeometry,
  miterFits,
  miterGeometry,
  pocketGeometry,
  tongueGeometry,
} from './fine';
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
export * from './fine';
export * from './mortise';
export * from './others';

type Params = Record<string, number>;

/** Nombre de cada encastre, en español: se traduce al mostrarlo, con `t(JOINT_NAMES[tipo])`. */
export const JOINT_NAMES: Record<JointType, string> = {
  tope: tk('A tope'),
  mortaja: tk('Mortaja y espiga'),
  'media-madera': tk('Media madera'),
  canal: tk('Canal'),
  rebaje: tk('Rebaje'),
  clavija: tk('Tarugos'),
  'cola-milano': tk('Cola de milano'),
  dedos: tk('Ensamble de dedos'),
  brida: tk('Brida'),
  inglete: tk('Inglete'),
  galleta: tk('Galleta'),
  machiembrado: tk('Machimbre'),
  bolsillo: tk('Tornillo de bolsillo'),
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
    case 'cola-milano': {
      const p = defaultDovetailParams(a, b);
      return p && { ...p };
    }
    case 'dedos': {
      const p = defaultFingerParams(a, b);
      return p && { ...p };
    }
    case 'brida': {
      const p = defaultBridleParams(a, b);
      return p && { ...p };
    }
    case 'inglete':
      return miterFits(a, b) ? {} : null;
    case 'galleta': {
      const p = defaultBiscuitParams(a, b);
      return p && { ...p };
    }
    case 'machiembrado': {
      const p = defaultTongueParams(a, b);
      return p && { ...p };
    }
    case 'bolsillo': {
      const p = defaultPocketParams(a, b);
      return p && { ...p };
    }
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
    case 'cola-milano':
      return dovetailGeometry(a, b, { count: n('count'), slope: n('slope'), depth: n('depth') });
    case 'dedos':
      return fingerGeometry(a, b, { count: n('count'), depth: n('depth') });
    case 'brida':
      return bridleGeometry(a, b, { thickness: n('thickness'), depth: n('depth') });
    case 'inglete':
      return miterGeometry(a, b);
    case 'galleta':
      return biscuitGeometry(a, b, { size: n('size'), count: n('count') });
    case 'machiembrado':
      return tongueGeometry(a, b, { thickness: n('thickness'), depth: n('depth') });
    case 'bolsillo':
      return pocketGeometry(a, b, { count: n('count') });
  }
}

/** Encastres posibles entre A (recibe) y B (entra). */
export function jointOptions(a: Box, b: Box): JointType[] {
  return JOINT_TYPES.filter((t) => defaultJointParams(t, a, b) !== null);
}

/** El encastre que se recomienda entre los posibles para estas dos piezas: el que propondría un carpintero. */
export function recommendedJoint(a: Box, b: Box): JointType | null {
  const type = suggestType(a, b);
  return type && defaultJointParams(type, a, b) !== null ? type : null;
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

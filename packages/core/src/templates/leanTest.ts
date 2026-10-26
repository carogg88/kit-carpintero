import { suggestJoints } from '../joints';
import { SCHEMA_VERSION, type Part, type Project } from '../project';
import { tk } from '../i18n';

/** Ángulos que se pueden elegir para abrir las patas, en grados: la opción elegida es el número de la lista. */
export const SPLAY_ANGLES = [4, 6, 8, 10, 12];

export const SPLAYED_DEFAULTS = { width: 360, depth: 360, height: 450, leg: 40, seat: 40, splay: 2 };

/**
 * Taburete de patas abiertas (prueba técnica de piezas inclinadas): un asiento grueso y cuatro patas que se abren
 * hacia sus esquinas, cada una con mortaja y espiga en el asiento. Sin faldones ni travesaños: entre patas inclinadas
 * todavía no se cortan los encastres.
 */
export function createSplayedStool(v: Record<string, number>, wood: string, now: string): Project {
  const { width: W, depth: D, height: H, leg, seat } = { ...SPLAYED_DEFAULTS, ...v };
  const angle = SPLAY_ANGLES[Math.round(v.splay ?? SPLAYED_DEFAULTS.splay)] ?? 8;
  // Arriba, la pata queda metida 1,5 veces su grosor desde el borde del asiento: abajo se abre hacia afuera.
  const inset = Math.round(leg * 1.5);
  const sY = H - seat;
  const part = (id: string, name: string, min: [number, number, number], size: [number, number, number], lean?: [number, number]): Part => ({
    id,
    name,
    wood,
    base: { kind: 'box', size },
    position: min,
    rotation: [0, 0, 0],
    ops: [{ kind: 'round', edges: 'all', radius: 2 }],
    pockets: [],
    bevels: [],
    sections: [],
    ...(lean ? { lean } : {}),
  });
  const legAt = (id: string, name: string, right: boolean, front: boolean) =>
    part(id, name, [right ? W - inset - leg : inset, 0, front ? D - inset - leg : inset], [leg, sY, leg], [right ? angle : -angle, front ? angle : -angle]);
  const parts = [
    part('S1', tk('Asiento'), [0, sY, 0], [W, seat, D]),
    legAt('P1', tk('Pata trasera izquierda'), false, false),
    legAt('P2', tk('Pata trasera derecha'), true, false),
    legAt('P3', tk('Pata delantera derecha'), true, true),
    legAt('P4', tk('Pata delantera izquierda'), false, true),
  ];
  return {
    schemaVersion: SCHEMA_VERSION,
    id: `patas-abiertas-${now}`,
    name: 'Taburete de patas abiertas',
    units: 'cm',
    template: 'patas-abiertas',
    createdAt: now,
    updatedAt: now,
    parts,
    joints: suggestJoints(parts),
    components: [],
    groups: [],
  };
}

/** El taburete de prueba con las medidas de siempre. */
export const leanTestStool = (wood: string, now: string) => createSplayedStool({}, wood, now);

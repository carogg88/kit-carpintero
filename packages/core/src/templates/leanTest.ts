import { suggestJoints } from '../joints';
import { SCHEMA_VERSION, type Part, type Project } from '../project';
import { tk } from '../i18n';

/** Ángulos que se pueden elegir para abrir las patas, en grados: la opción elegida es el número de la lista. */
export const SPLAY_ANGLES = [4, 6, 8, 10, 12];

export const SPLAYED_DEFAULTS = { width: 360, depth: 360, height: 450, leg: 40, seat: 40, splay: 2, rungs: 1, rung: 150 };

/**
 * Taburete de patas abiertas (prueba técnica de piezas inclinadas): un asiento grueso y cuatro patas que se abren
 * hacia sus esquinas, cada una con mortaja y espiga en el asiento. Con travesaños, si se piden: van entre las patas
 * derechas y al armarlos siguen a las inclinadas (ver `follow.ts`). Los de los costados van más arriba que los de
 * adelante y atrás, para que sus espigas no se crucen adentro de la pata.
 */
export function createSplayedStool(v: Record<string, number>, wood: string, now: string): Project {
  const { width: W, depth: D, height: H, leg, seat, rungs, rung } = { ...SPLAYED_DEFAULTS, ...v };
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
  if (rungs) {
    const rH = 30;
    const rT = 20;
    const x0 = inset + leg;
    const x1 = W - inset - leg;
    const z0 = inset + leg;
    const z1 = D - inset - leg;
    // Centrados en el grueso de la pata.
    const back = inset + (leg - rT) / 2;
    const front = D - inset - leg + (leg - rT) / 2;
    const left = inset + (leg - rT) / 2;
    const right = W - inset - leg + (leg - rT) / 2;
    const up = rung + rH + 10;
    parts.push(
      part('R1', tk('Travesaño delantero'), [x0, rung, front], [x1 - x0, rH, rT]),
      part('R2', tk('Travesaño trasero'), [x0, rung, back], [x1 - x0, rH, rT]),
      part('R3', tk('Travesaño izquierdo'), [left, up, z0], [rT, rH, z1 - z0]),
      part('R4', tk('Travesaño derecho'), [right, up, z0], [rT, rH, z1 - z0]),
    );
  }
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

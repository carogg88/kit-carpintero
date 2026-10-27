import { suggestJoints } from '../joints';
import { SCHEMA_VERSION, type Part, type Project } from '../project';
import { tk } from '../i18n';

/** Ángulos que se pueden elegir para abrir las patas, en grados: la opción elegida es el número de la lista. */
export const SPLAY_ANGLES = [4, 6, 8, 10, 12];

export const SPLAYED_DEFAULTS = { width: 360, depth: 360, height: 450, leg: 40, seat: 40, splay: 2, rungs: 1, rung: 150 };

/** Cómo se arma un asiento grueso con cuatro patas abiertas: el taburete y el banco rústico. */
interface SplayedPlan {
  W: number;
  D: number;
  H: number;
  leg: number;
  seat: number;
  /** Cuánto queda metida arriba cada pata desde el borde del asiento, a lo ancho (X) y a lo hondo (Z). */
  insetX: number;
  insetZ: number;
  /** Cuánto se abre cada pata hacia afuera, visto de frente (X) y de costado (Z), en grados. */
  angleX: number;
  angleZ: number;
  /** Travesaños de adelante y atrás (a lo largo, X) y de los costados (Z), y a qué altura va cada par. */
  long: number | null;
  ends: number | null;
  wood: string;
}

/**
 * Un asiento grueso y cuatro patas que se abren hacia sus esquinas, cada una con mortaja y espiga en el asiento.
 * Los travesaños van entre las patas derechas y al armarlos siguen a las inclinadas (ver `follow.ts`). Los de
 * adelante y atrás van a otra altura que los de los costados, para que sus espigas no se crucen adentro de la pata.
 */
/** Una pieza de caja con los cantos redondeados, inclinada si se pide. */
const piece =
  (wood: string) =>
  (id: string, name: string, min: [number, number, number], size: [number, number, number], lean?: [number, number]): Part => ({
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

function splayedParts(p: SplayedPlan): Part[] {
  const { W, D, H, leg, seat, insetX, insetZ, angleX, angleZ, wood } = p;
  const sY = H - seat;
  const part = piece(wood);
  const legAt = (id: string, name: string, right: boolean, front: boolean) =>
    part(id, name, [right ? W - insetX - leg : insetX, 0, front ? D - insetZ - leg : insetZ], [leg, sY, leg], [right ? angleX : -angleX, front ? angleZ : -angleZ]);
  const parts = [
    part('S1', tk('Asiento'), [0, sY, 0], [W, seat, D]),
    legAt('P1', tk('Pata trasera izquierda'), false, false),
    legAt('P2', tk('Pata trasera derecha'), true, false),
    legAt('P3', tk('Pata delantera derecha'), true, true),
    legAt('P4', tk('Pata delantera izquierda'), false, true),
  ];
  const rH = 30;
  const rT = 20;
  const x0 = insetX + leg;
  const x1 = W - insetX - leg;
  const z0 = insetZ + leg;
  const z1 = D - insetZ - leg;
  // Centrados en el grueso de la pata.
  if (p.long !== null) {
    const back = insetZ + (leg - rT) / 2;
    const front = D - insetZ - leg + (leg - rT) / 2;
    parts.push(
      part('R1', tk('Travesaño delantero'), [x0, p.long, front], [x1 - x0, rH, rT]),
      part('R2', tk('Travesaño trasero'), [x0, p.long, back], [x1 - x0, rH, rT]),
    );
  }
  if (p.ends !== null) {
    const left = insetX + (leg - rT) / 2;
    const right = W - insetX - leg + (leg - rT) / 2;
    parts.push(
      part('R3', tk('Travesaño izquierdo'), [left, p.ends, z0], [rT, rH, z1 - z0]),
      part('R4', tk('Travesaño derecho'), [right, p.ends, z0], [rT, rH, z1 - z0]),
    );
  }
  return parts;
}

function splayedProject(template: string, name: string, parts: Part[], now: string): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: `${template}-${now}`,
    name,
    units: 'cm',
    template,
    createdAt: now,
    updatedAt: now,
    parts,
    joints: suggestJoints(parts),
    components: [],
    groups: [],
  };
}

/** Taburete de patas abiertas: cada pata se abre lo mismo hacia su esquina, de frente y de costado. */
export function createSplayedStool(v: Record<string, number>, wood: string, now: string): Project {
  const { width: W, depth: D, height: H, leg, seat, rungs, rung } = { ...SPLAYED_DEFAULTS, ...v };
  const angle = SPLAY_ANGLES[Math.round(v.splay ?? SPLAYED_DEFAULTS.splay)] ?? 8;
  // Arriba, la pata queda metida 1,5 veces su grosor desde el borde del asiento: abajo se abre hacia afuera.
  const inset = Math.round(leg * 1.5);
  const parts = splayedParts({ W, D, H, leg, seat, insetX: inset, insetZ: inset, angleX: angle, angleZ: angle, long: rungs ? rung : null, ends: rungs ? rung + 40 : null, wood });
  return splayedProject('patas-abiertas', 'Taburete de patas abiertas', parts, now);
}

export const BENCH_DEFAULTS = { length: 900, depth: 300, height: 450, leg: 45, seat: 45, splayLong: 1, splaySide: 3, rungs: 1, rung: 150 };

/** Travesaños del banco: ninguno, uno en cada punta (entre la pata de adelante y la de atrás), o también a lo largo. */
export const BENCH_RUNGS_NONE = 0;
export const BENCH_RUNGS_ENDS = 1;
export const BENCH_RUNGS_ALL = 2;

/**
 * Banco rústico: una tabla gruesa y larga con las patas abiertas, más hacia los costados que a lo largo, como los
 * bancos de campo. A lo largo las patas quedan metidas un octavo del largo desde cada punta; a lo hondo, apenas su
 * grosor, para que entre el travesaño de cada punta.
 */
export function createSplayedBench(v: Record<string, number>, wood: string, now: string): Project {
  const { length: W, depth: D, height: H, leg, seat, rungs, rung } = { ...BENCH_DEFAULTS, ...v };
  const angleX = SPLAY_ANGLES[Math.round(v.splayLong ?? BENCH_DEFAULTS.splayLong)] ?? 6;
  const angleZ = SPLAY_ANGLES[Math.round(v.splaySide ?? BENCH_DEFAULTS.splaySide)] ?? 10;
  const parts = splayedParts({
    W,
    D,
    H,
    leg,
    seat,
    insetX: Math.round(W / 8),
    insetZ: leg,
    angleX,
    angleZ,
    ends: rungs !== BENCH_RUNGS_NONE ? rung : null,
    long: rungs === BENCH_RUNGS_ALL ? rung + 40 : null,
    wood,
  });
  return splayedProject('banco-rustico', 'Banco rústico', parts, now);
}

/** El taburete de patas abiertas con las medidas de siempre. */
export const leanTestStool = (wood: string, now: string) => createSplayedStool({}, wood, now);

/** Cuánto se echa hacia atrás el respaldo, en grados: la opción elegida es el número de la lista. */
export const RAKE_ANGLES = [6, 8, 10, 12, 14];

export const CHAIR_DEFAULTS = { width: 440, depth: 420, height: 450, back: 850, rake: 2, splay: 1, backRails: 0, rungs: 1, rung: 150, leg: 38, seat: 40 };

/**
 * Silla de asiento macizo: el taburete de patas abiertas con un respaldo. Los dos parantes del respaldo entran
 * con espiga en la cara de arriba del asiento, por fuera de las patas de atrás, y se echan hacia atrás: giran sobre
 * su punta de arriba, así que la de abajo se corre hacia adelante y queda cortada plana sobre el asiento. El
 * travesaño de arriba (y el del medio, si se pide) va entre los parantes y los sigue al armarlo.
 */
export function createSplayedChair(v: Record<string, number>, wood: string, now: string): Project {
  const { width: W, depth: D, height: H, back, leg, seat, rungs, rung, backRails } = { ...CHAIR_DEFAULTS, ...v };
  const angle = SPLAY_ANGLES[Math.round(v.splay ?? CHAIR_DEFAULTS.splay)] ?? 6;
  const rake = RAKE_ANGLES[Math.round(v.rake ?? CHAIR_DEFAULTS.rake)] ?? 10;
  const inset = Math.round(leg * 1.5);
  const parts = splayedParts({ W, D, H, leg, seat, insetX: inset, insetZ: inset, angleX: angle, angleZ: angle, long: rungs ? rung : null, ends: rungs ? rung + 40 : null, wood });
  const part = piece(wood);
  const post = 35;
  const rT = 20;
  const h = back - H;
  // Derecho, el parante apoya contra el borde de atrás del asiento: echado hacia atrás, la punta de arriba queda
  // sobre ese borde y la de abajo se corre hacia adelante. Va por fuera de las patas, para que su mortaja y la de
  // la pata no se encuentren adentro del asiento.
  const x = Math.max(10, inset - post - 8);
  const z = 0;
  parts.push(
    part('B1', tk('Parante izquierdo del respaldo'), [x, H, z], [post, h, post], [0, rake]),
    part('B2', tk('Parante derecho del respaldo'), [W - x - post, H, z], [post, h, post], [0, rake]),
  );
  const rail = (id: string, name: string, top: number, tall: number) =>
    part(id, name, [x + post, top - tall, z + (post - rT) / 2], [W - 2 * (x + post), tall, rT]);
  parts.push(rail('C1', tk('Travesaño de arriba del respaldo'), back - 25, 70));
  if (backRails) parts.push(rail('C2', tk('Travesaño del medio del respaldo'), H + Math.round(h * 0.45), 40));
  return splayedProject('silla', 'Silla', parts, now);
}

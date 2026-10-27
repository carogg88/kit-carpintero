import { boxSize, partBox, type Axis, type Vec3 } from './geometry';
import { leanFrame, rotateVec } from './lean';
import type { Part } from './project';
import { sheetById } from './woods';

/**
 * La veta de cada pieza: hacia dónde corre la fibra. En la madera maciza va a lo largo de la tabla, y la tabla se
 * corta con el largo de la pieza a lo largo: por eso la veta va, salvo que se diga otra cosa, por lo más largo de la
 * pieza (la misma regla que la lista de cortes). Un tablero casi cuadrado o un panel se puede querer al revés:
 * `Part.grain` guarda el eje elegido a mano.
 *
 * Para el render, la pieza sale de un tronco imaginario: el centro del tronco (la médula) corre a lo largo de la
 * veta, por debajo de la cara ancha. Así en la cara se ven las rayas y los arcos, y en la punta, los anillos.
 */

/** Si la veta de la pieza se puede elegir: madera maciza o placa con chapa, caja sin tornear. */
export function grainChoosable(part: Part): boolean {
  if (part.base.kind !== 'box' || part.turning) return false;
  const sheet = sheetById(part.wood);
  return !sheet || sheet.grain;
}

/** El eje más largo de la pieza (el primero, si hay empate). */
function longest(size: Vec3): Axis {
  return ([0, 1, 2] as Axis[]).reduce((best, k) => (size[k]! > size[best]! + 0.01 ? k : best), 0 as Axis);
}

/** Eje por donde corre la veta de la pieza, en la pieza derecha (sin inclinar). */
export function grainAxis(part: Part): Axis {
  if (part.turning) return part.turning.axis;
  if (part.base.kind !== 'box') return 1;
  const g = part.grain;
  if (g !== undefined && grainChoosable(part)) return g as Axis;
  return longest(part.base.size);
}

/** La veta va a mano y no por lo más largo. */
export const grainTurned = (part: Part): boolean => part.grain !== undefined && grainChoosable(part) && part.base.kind === 'box' && grainAxis(part) !== longest(part.base.size);

/**
 * Los ejes a los que se puede llevar la veta: los dos más largos de la pieza (por el espesor no tiene sentido). El
 * primero es el que sale solo.
 */
export function grainOptions(part: Part): Axis[] {
  if (part.base.kind !== 'box') return [];
  const size = part.base.size;
  return ([0, 1, 2] as Axis[]).sort((a, b) => size[b]! - size[a]! || a - b).slice(0, 2);
}

/** Pone la veta a lo largo de `axis`; si es la que sale sola, saca la elección a mano. */
export function setGrain(part: Part, axis: Axis): void {
  if (part.base.kind !== 'box') return;
  if (axis === longest(part.base.size)) delete part.grain;
  else part.grain = axis;
}

/** Cómo es la fibra de la pieza para dibujarla. */
export interface GrainFrame {
  /** Un punto de la médula del tronco imaginario. */
  origin: Vec3;
  /** Hacia dónde corre la veta, de largo 1. */
  along: Vec3;
  /** A lo ancho de la cara (de largo 1). */
  across: Vec3;
  /** Hacia la cara ancha, saliendo de la médula (de largo 1). */
  up: Vec3;
  /** Número fijo para la pieza: cada una toma otra parte del tronco y no se ven todas iguales. */
  seed: number;
  /** Desde la médula hasta la cara de atrás de la tabla, y el espesor: las capas de un terciado van de ahí. */
  back: number;
  thickness: number;
}

/** Un número de 0 a 1 que sale siempre igual del mismo texto. */
export function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

const unit = (k: Axis): Vec3 => [0, 1, 2].map((i) => (i === k ? 1 : 0)) as Vec3;

/**
 * La médula y los ejes de la veta de una pieza, en mm y en el lugar del mueble. Una pieza torneada tiene la médula
 * en el centro (se ven anillos redondos en la punta); una tabla, por debajo de su cara ancha, a una distancia que
 * cambia de pieza a pieza.
 */
export function grainFrame(part: Part): GrainFrame | null {
  if (part.base.kind !== 'box') return null;
  const box = partBox(part);
  const size = boxSize(box);
  const seed = hashUnit(part.id);
  const g = grainAxis(part);
  const rest = ([0, 1, 2] as Axis[]).filter((k) => k !== g);
  // El espesor: el más fino de los otros dos. La cara ancha mira para ese lado.
  const [thick, wide] = size[rest[0]!]! <= size[rest[1]!]! ? [rest[0]!, rest[1]!] : [rest[1]!, rest[0]!];
  const center: Vec3 = [0, 1, 2].map((k) => (box.min[k]! + box.max[k]!) / 2) as Vec3;
  let origin: Vec3;
  let back = 0;
  if (part.turning) {
    origin = center;
  } else {
    // La médula, debajo de la tabla: entre 1 y 4 veces el ancho, corrida a un costado.
    const depth = size[wide]! * (0.6 + seed * 1.6) + 40;
    const side = (hashUnit(part.id + 'x') - 0.5) * size[wide]!;
    origin = [...center];
    origin[thick] = center[thick]! - size[thick]! / 2 - depth;
    origin[wide] = center[wide]! + side;
    back = depth;
  }
  let along = unit(g);
  let across = unit(wide);
  let up = unit(thick);
  const lean = leanFrame(part);
  if (lean) {
    const turn = (v: Vec3) => rotateVec(v, lean.axis, lean.angle);
    const o = turn([origin[0] - lean.pivot[0], origin[1] - lean.pivot[1], origin[2] - lean.pivot[2]]);
    origin = [o[0] + lean.pivot[0], o[1] + lean.pivot[1], o[2] + lean.pivot[2]];
    along = turn(along);
    across = turn(across);
    up = turn(up);
  }
  return { origin, along, across, up, seed, back, thickness: size[thick]! };
}

/**
 * Veta atravesada: una pieza larga y angosta con la veta a lo ancho. La fibra corta se parte con poco esfuerzo, sobre
 * todo en patas, travesaños y espigas. Devuelve cuántas veces más larga es la pieza que lo que mide a lo largo de la
 * veta, o 0 si está bien.
 */
export function shortGrain(part: Part): number {
  if (!grainTurned(part) || part.base.kind !== 'box') return 0;
  const size = part.base.size;
  const ratio = Math.max(...size) / size[grainAxis(part)]!;
  return ratio >= 2 ? ratio : 0;
}

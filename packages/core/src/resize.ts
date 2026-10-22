import { partBox, type Axis, type Box } from './geometry';
import type { Part } from './project';

/**
 * Medidas generales del mueble: cambiar el ancho, el alto o el fondo total y que las piezas acompañen,
 * sin tocar espesores. Las piezas largas sobre ese eje (patas, laterales, tapas, faldones) se estiran;
 * las demás quedan con su medida. Las que se tocan forman un bloque que se mueve entero (la tapa con sus
 * faldones), y el lugar libre entre bloques se estira en proporción: los estantes quedan repartidos igual.
 * El vuelo de las puntas (de la tapa más allá de las patas) no cambia, salvo que no haya otro lugar libre.
 */

/** Una pieza se estira si ocupa al menos esta parte del mueble sobre el eje. */
const STRETCH_SHARE = 0.5;

/** Caja de todo el mueble. */
export function furnitureBox(parts: Part[]): Box | null {
  const boxes = parts.filter((p) => p.base.kind === 'box').map(partBox);
  if (!boxes.length) return null;
  return {
    min: [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b.min[k]!))) as Box['min'],
    max: [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k]!))) as Box['max'],
  };
}

export interface ResizeResult {
  /** Piezas que se estiraron y piezas que se corrieron. */
  stretched: string[];
  moved: string[];
}

/**
 * Lleva el mueble a `size` mm sobre `axis`, desde su borde mínimo (el piso, la izquierda, atrás).
 * Devuelve null si no hay lugar libre para estirar ni piezas largas (todo es un solo bloque rígido),
 * o si las piezas largas quedarían de largo cero o negativo.
 */
export function resizeFurniture(parts: Part[], axis: Axis, size: number): ResizeResult | null {
  const all = furnitureBox(parts);
  if (!all) return null;
  const lo = all.min[axis];
  const hi = all.max[axis];
  const total = hi - lo;
  const delta = size - total;
  if (Math.abs(delta) < 0.05) return { stretched: [], moved: [] };

  const items = parts
    .filter((p) => p.base.kind === 'box')
    .map((p) => {
      const b = partBox(p);
      return { p, b, stretch: b.max[axis] - b.min[axis] >= total * STRETCH_SHARE };
    });

  // Bloques rígidos: los tramos que ocupan las piezas que no se estiran, juntando los que se tocan.
  const spans = items
    .filter((x) => !x.stretch)
    .map((x) => [x.b.min[axis], x.b.max[axis]] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const blocks: [number, number][] = [];
  for (const s of spans) {
    const last = blocks.at(-1);
    if (last && s[0] <= last[1] + 0.6) last[1] = Math.max(last[1], s[1]);
    else blocks.push([...s]);
  }

  // Huecos libres entre bloques (y hasta los bordes): ahí va el cambio, en proporción a lo que mide cada uno.
  const gaps: [number, number][] = [];
  let at = lo;
  for (const [a, b] of blocks) {
    if (a > at + 0.01) gaps.push([at, a]);
    at = Math.max(at, b);
  }
  if (hi > at + 0.01) gaps.push([at, hi]);
  // Lo libre en las puntas suele ser un vuelo (la tapa que sobresale de las patas): se estira solo si no hay otro lugar.
  const inner = gaps.filter(([a, b]) => a > lo + 0.01 && b < hi - 0.01);
  if (inner.length) gaps.splice(0, gaps.length, ...inner);
  const free = gaps.reduce((s, [a, b]) => s + b - a, 0);
  if (free < 0.01 || free + delta < 0) return null;
  const k = (free + delta) / free;

  /** Dónde queda una coordenada: los huecos se estiran, los bloques se corren enteros. */
  const map = (v: number) => {
    let shift = 0;
    for (const [a, b] of gaps) {
      if (v >= b) shift += (b - a) * (k - 1);
      else if (v > a) shift += (v - a) * (k - 1);
    }
    return v + shift;
  };

  const result: ResizeResult = { stretched: [], moved: [] };
  for (const { p, b, stretch } of items) {
    const min = map(b.min[axis]);
    if (stretch) {
      const max = map(b.max[axis]);
      if (max - min < 1) return null;
      const old = b.max[axis] - b.min[axis];
      const len = round(max - min);
      if (p.base.kind === 'box') p.base.size[axis] = len;
      // Lo que se mide a lo largo de la pieza la acompaña: tramos y estaciones del torneado.
      const scale = len / old;
      for (const s of p.sections) {
        if (s.axis !== axis) continue;
        s.from = round(s.from * scale);
        s.to = round(s.to * scale);
      }
      if (p.turning && p.turning.axis === axis) for (const st of p.turning.stations) st.at = round(st.at * scale);
      result.stretched.push(p.id);
    } else if (Math.abs(min - b.min[axis]) > 0.05) {
      result.moved.push(p.id);
    }
    p.position[axis] = round(min);
  }
  // Las piezas que no son cajas (cilindros) se corren con el lugar donde arrancan.
  for (const p of parts) {
    if (p.base.kind === 'box') continue;
    const v = map(p.position[axis]);
    if (Math.abs(v - p.position[axis]) > 0.05) result.moved.push(p.id);
    p.position[axis] = round(v);
  }
  return result;
}

const round = (v: number) => Math.round(v * 10) / 10;

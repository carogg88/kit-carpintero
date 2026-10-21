import { boxSize, otherAxes, partBox, type Axis } from './geometry';
import { partAxesBySize } from './edit';
import type { Part, Turning, TurnStation } from './project';
import { t, tk } from './i18n';

/**
 * Torneado: la pieza es su taco girado en el torno. El perfil va de punta a punta del eje del torneado y
 * sale de las estaciones (dónde, qué diámetro y cómo se llega). Lo cuadrado queda con la medida del taco.
 */

/** Largo del taco sobre el eje del torneado y el lado menor de su sección: el diámetro más grande que da. */
export function turnBlank(part: Part, axis: Axis): { len: number; side: number } {
  const s = boxSize(partBox(part));
  const [u, v] = otherAxes(axis);
  return { len: s[axis], side: Math.min(s[u], s[v]) };
}

type PresetStation = [at: number, d: number, to?: TurnStation['to'], bulge?: number];

/** Perfiles para arrancar: posición sobre el largo y diámetro sobre el lado del taco, de 0 a 1, desde la punta de abajo. */
export const TURN_PRESETS = {
  cilindro: { name: tk('Cilindro'), stations: [[0, 1], [1, 1]] as PresetStation[] },
  columna: {
    name: tk('Columna de pie'),
    stations: [
      [0, 1],
      [0.26, 1, 'square'],
      [0.28, 0.82],
      [0.34, 0.62, 'curve', -0.05],
      [0.38, 0.78, 'curve', 0.05],
      [0.42, 0.6],
      [0.58, 0.82, 'curve', 0.1],
      [0.7, 0.5, 'curve', -0.04],
      [0.74, 0.7, 'curve', 0.05],
      [0.78, 0.55],
      [0.88, 0.66],
      [0.9, 0.86],
      [0.92, 0.86],
      [1, 1, 'square'],
    ] as PresetStation[],
  },
  pata: {
    name: tk('Pata de mesa'),
    stations: [
      [0, 0.55],
      [0.03, 0.66, 'curve', 0.02],
      [0.06, 0.56],
      [0.58, 0.78],
      [0.62, 0.66, 'curve', -0.04],
      [0.67, 0.86, 'curve', 0.05],
      [0.7, 0.9],
      [0.72, 0.9],
      [1, 1, 'square'],
    ] as PresetStation[],
  },
  barrote: {
    name: tk('Barrote'),
    stations: [
      [0, 1],
      [0.12, 1, 'square'],
      [0.15, 0.7],
      [0.45, 0.95, 'curve', 0.12],
      [0.72, 0.45, 'curve', -0.05],
      [0.85, 0.62, 'curve', 0.04],
      [0.88, 1],
      [1, 1, 'square'],
    ] as PresetStation[],
  },
} as const;
export type TurnPreset = keyof typeof TURN_PRESETS;

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Perfil de un modelo, a la medida del taco de la pieza. El eje es el del torneado que ya tiene o el largo. */
export function presetTurning(part: Part, preset: TurnPreset, axis: Axis = part.turning?.axis ?? partAxesBySize(part)[0]): Turning {
  const { len, side } = turnBlank(part, axis);
  return {
    axis,
    stations: TURN_PRESETS[preset].stations.map(([at, d, to = 'straight', bulge = 0]) => ({
      at: round1(at * len),
      d: round1(d * side),
      to,
      bulge: round1(bulge * side),
    })),
  };
}

/**
 * Deja el perfil en regla: estaciones en orden, la primera en 0 y la última en la punta, ningún diámetro mayor
 * que el taco, y la primera sin forma de llegada.
 */
export function cleanTurning(part: Part, turning: Turning): Turning {
  const { len, side } = turnBlank(part, turning.axis);
  const stations = turning.stations
    .map((s) => ({ ...s, at: Math.min(len, Math.max(0, s.at)), d: Math.min(side, Math.max(1, s.d)) }))
    .sort((a, b) => a.at - b.at);
  stations[0]!.at = 0;
  stations[0]!.to = 'straight';
  stations[0]!.bulge = 0;
  stations[stations.length - 1]!.at = len;
  return { axis: turning.axis, stations };
}

/** Un tramo del perfil, en (distancia desde la punta, radio). `mid` es el punto del medio de una curva. */
export interface TurnSegment {
  kind: TurnStation['to'];
  a: [number, number];
  b: [number, number];
  mid?: [number, number];
}

/** Los tramos del perfil de punta a punta. Las curvas casi rectas se toman como rectas. */
export function turnSegments(part: Part, turning: Turning): TurnSegment[] {
  const { side } = turnBlank(part, turning.axis);
  const R = side / 2;
  const st = turning.stations;
  const out: TurnSegment[] = [];
  for (let i = 1; i < st.length; i++) {
    const p = st[i - 1]!;
    const q = st[i]!;
    const a: [number, number] = [p.at, p.d / 2];
    const b: [number, number] = [q.at, q.d / 2];
    if (q.to === 'square') {
      out.push({ kind: 'square', a, b });
      continue;
    }
    if (q.to === 'curve' && Math.abs(q.bulge) >= 0.5 && b[0] - a[0] > 1) {
      // Punto del medio: el medio de la cuerda, corrido `bulge` hacia afuera (o hacia adentro) del eje.
      const dx = b[0] - a[0];
      const dr = b[1] - a[1];
      const l = Math.hypot(dx, dr);
      let nx = -dr / l;
      let nr = dx / l;
      if (nr < 0) [nx, nr] = [-nx, -nr];
      const mid: [number, number] = [(a[0] + b[0]) / 2 + nx * q.bulge, (a[1] + b[1]) / 2 + nr * q.bulge];
      // Que la curva no pase el eje ni salga del taco.
      mid[1] = Math.min(R, Math.max(0.5, mid[1]));
      mid[0] = Math.min(b[0] - 0.1, Math.max(a[0] + 0.1, mid[0]));
      out.push({ kind: 'curve', a, b, mid });
      continue;
    }
    out.push({ kind: 'straight', a, b });
  }
  return out;
}

/** Diámetros más chico y más grande de lo torneado (sin contar lo que queda cuadrado). */
export function turnDiameters(part: Part, turning: Turning): { min: number; max: number } {
  const segs = turnSegments(part, turning).filter((s) => s.kind !== 'square');
  const rs = segs.flatMap((s) => [s.a[1], s.b[1], ...(s.mid ? [s.mid[1]] : [])]);
  if (!rs.length) return { min: 0, max: 0 };
  return { min: Math.min(...rs) * 2, max: Math.max(...rs) * 2 };
}

/** Suma una estación en el medio del tramo torneado más largo, con el diámetro que ya tiene ahí. */
export function addStation(part: Part, turning: Turning): Turning {
  const st = turning.stations;
  let best = -1;
  for (let i = 1; i < st.length; i++) {
    if (st[i]!.to === 'square') continue;
    if (best < 0 || st[i]!.at - st[i - 1]!.at > st[best]!.at - st[best - 1]!.at) best = i;
  }
  if (best < 0) best = st.length - 1;
  const p = st[best - 1]!;
  const q = st[best]!;
  const mid: TurnStation = { at: round1((p.at + q.at) / 2), d: round1((p.d + q.d) / 2), to: q.to === 'square' ? 'straight' : q.to, bulge: 0 };
  return cleanTurning(part, { axis: turning.axis, stations: [...st.slice(0, best), mid, ...st.slice(best)] });
}

/** En palabras de taller: "torneado, Ø 40 a 63 mm, 2 partes cuadradas". */
export function describeTurning(part: Part, turning: Turning, n: (mm: number) => string): string {
  const { min, max } = turnDiameters(part, turning);
  const squares = turning.stations.filter((s) => s.to === 'square').length;
  const dia = Math.abs(max - min) < 0.5 ? t('torneado, Ø {d}', { d: n(max) }) : t('torneado, Ø {min} a {max}', { min: n(min), max: n(max) });
  if (!squares) return dia;
  return `${dia}, ${squares === 1 ? t('1 parte cuadrada') : t('{n} partes cuadradas', { n: squares })}`;
}

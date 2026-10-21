import { MM_PER_INCH } from '../units';

/**
 * Medidas comerciales de madereras de Buenos Aires: secciones en pulgadas, largos en metros,
 * precio por pie. La disponibilidad real cambia según la madera y el corralón.
 */
export const THICKNESSES_IN = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const;
export const WIDTHS_IN = [2, 3, 4, 5, 6, 8, 10, 12] as const;
export const LENGTHS_M = [1.83, 2.44, 2.74, 3.05, 3.35, 3.66] as const;

/** Ancho de tabla que se usa para encolar tapas más anchas que la tabla más ancha. */
export const PANEL_BOARD_IN = 6;

export type StockKind = 'listón' | 'tabla' | 'tirante';

/**
 * Medida real después de cepillar, en mm. Se pierde cerca de 3 mm hasta 1″,
 * 5 mm hasta 2″ y 6 mm en secciones más grandes.
 */
export function planedMm(nominalIn: number): number {
  const loss = nominalIn <= 1 ? 3 : nominalIn <= 2 ? 5 : 6;
  return Math.round((nominalIn * MM_PER_INCH - loss) * 2) / 2;
}

/** Pies madereros: pulgadas de espesor × pulgadas de ancho × pies de largo ÷ 12. */
export function boardFeet(thicknessIn: number, widthIn: number, lengthM: number): number {
  return (thicknessIn * widthIn * (lengthM / 0.3048)) / 12;
}

export function stockKind(thicknessIn: number, widthIn: number): StockKind {
  if (thicknessIn >= 2) return 'tirante';
  return widthIn <= 2 ? 'listón' : 'tabla';
}

/** Escritura de taller de una medida en pulgadas: 0.75 → 3/4″, 1.5 → 1 1/2″. */
export function formatInches(inches: number): string {
  const whole = Math.floor(inches);
  const frac = inches - whole;
  const fracText = frac === 0.5 ? '1/2' : frac === 0.25 ? '1/4' : frac === 0.75 ? '3/4' : '';
  if (!fracText) return `${inches}″`;
  return whole ? `${whole} ${fracText}″` : `${fracText}″`;
}

export interface StockFit {
  kind: StockKind;
  thicknessIn: number;
  widthIn: number;
  /** Tablas a encolar de canto para llegar al ancho; 1 si sale de una sola. */
  boards: number;
  /** Largo comercial más corto del que sale la pieza, con 2 cm para escuadrar; null si es más larga. */
  lengthM: number | null;
}

/** Margen para escuadrar las puntas. */
const TRIM_MM = 20;

/**
 * Qué comprar para una pieza de estas medidas (mm, en cualquier orden): la sección comercial más chica
 * que, cepillada, todavía da la medida. Null si es más gruesa que 4″.
 */
export function stockFor(sizeMm: readonly [number, number, number]): StockFit | null {
  const [t, w, l] = [...sizeMm].sort((x, y) => x - y) as [number, number, number];
  const thicknessIn = THICKNESSES_IN.find((n) => planedMm(n) >= t);
  if (thicknessIn === undefined) return null;
  const lengthM = LENGTHS_M.find((m) => m * 1000 >= l + TRIM_MM) ?? null;
  const widthIn = WIDTHS_IN.find((n) => n >= thicknessIn && planedMm(n) >= w);
  if (widthIn !== undefined) {
    return { kind: stockKind(thicknessIn, widthIn), thicknessIn, widthIn, boards: 1, lengthM };
  }
  return {
    kind: 'tabla',
    thicknessIn,
    widthIn: PANEL_BOARD_IN,
    boards: Math.ceil(w / planedMm(PANEL_BOARD_IN)),
    lengthM,
  };
}

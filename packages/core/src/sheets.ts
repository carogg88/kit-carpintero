import { partBox } from './geometry';
import type { Part } from './project';
import type { Sheet } from './woods';

/**
 * Placas: cómo se reparten las piezas en placas enteras y qué cantos llevan tapacanto. Las placas se cortan
 * con cortes de lado a lado (como en la escuadradora del corralón), así que el reparto es en guillotina.
 */

/** Corte de la escuadradora, en mm. */
export const SHEET_KERF_MM = 4;
/** Lo que se recorta en cada borde de la placa para escuadrarla, en mm. */
export const SHEET_TRIM_MM = 10;

/** Una pieza dentro de una placa. `x` corre a lo largo de la placa y `y` a lo ancho, desde una esquina. */
export interface SheetPlacement {
  id: string;
  x: number;
  y: number;
  /** Lo que ocupa a lo largo y a lo ancho de la placa, en mm. */
  length: number;
  width: number;
  /** Va girada: el largo de la pieza a lo ancho de la placa. */
  rotated: boolean;
}

/** Una placa a comprar y cómo cortarla. */
export interface SheetBoard {
  material: string;
  /** Espesor de la placa, en mm. */
  thickness: number;
  /** Largo y ancho de la placa, en mm. */
  size: [number, number];
  placements: SheetPlacement[];
}

export interface SheetPiece {
  id: string;
  length: number;
  width: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Open {
  board: SheetBoard;
  free: Rect[];
}

/** Espesor de placa del que sale una pieza: el más fino que alcanza. Null si es más gruesa que todas. */
export function sheetThicknessFor(sheet: Sheet, mm: number): number | null {
  return sheet.thicknesses.find((v) => v >= mm - 0.5) ?? null;
}

/**
 * Reparte piezas en placas: las más grandes primero, cada una en el hueco libre donde menos sobra
 * (girándola si la placa no tiene veta). Devuelve las placas y las piezas que no entran en una placa entera.
 */
export function packSheets(sheet: Sheet, thickness: number, pieces: SheetPiece[]): { boards: SheetBoard[]; tooBig: string[] } {
  const [L, W] = sheet.size;
  const k = SHEET_KERF_MM;
  const open: Open[] = [];
  const tooBig: string[] = [];
  const fresh = (): Open => ({
    board: { material: sheet.id, thickness, size: [L, W], placements: [] },
    free: [{ x: SHEET_TRIM_MM, y: SHEET_TRIM_MM, w: L - 2 * SHEET_TRIM_MM, h: W - 2 * SHEET_TRIM_MM }],
  });
  const sorted = [...pieces].sort((a, b) => b.length * b.width - a.length * a.width || b.length - a.length);
  for (const p of sorted) {
    const turns: [number, number, boolean][] = [[p.length, p.width, false]];
    if (!sheet.grain && p.length !== p.width) turns.push([p.width, p.length, true]);
    const best = (list: Open[]) => {
      let pick: { o: Open; r: Rect; l: number; w: number; rotated: boolean; score: number } | null = null;
      for (const o of list) {
        for (const r of o.free) {
          for (const [l, w, rotated] of turns) {
            if (l > r.w + 0.01 || w > r.h + 0.01) continue;
            // Donde menos sobra del lado más justo: deja huecos grandes y enteros para lo que sigue.
            const score = Math.min(r.w - l, r.h - w);
            if (!pick || score < pick.score - 0.01) pick = { o, r, l, w, rotated, score };
          }
        }
      }
      return pick;
    };
    let pick = best(open);
    if (!pick) {
      const o = fresh();
      pick = best([o]);
      if (!pick) {
        tooBig.push(p.id);
        continue;
      }
      open.push(o);
    }
    const { o, r, l, w, rotated } = pick;
    o.board.placements.push({ id: p.id, x: r.x, y: r.y, length: l, width: w, rotated });
    o.free.splice(o.free.indexOf(r), 1);
    // Se corta por donde queda el pedazo libre más grande.
    const restW = r.w - l - k;
    const restH = r.h - w - k;
    const pieces: Rect[] =
      restW < restH
        ? [
            { x: r.x + l + k, y: r.y, w: restW, h: w },
            { x: r.x, y: r.y + w + k, w: r.w, h: restH },
          ]
        : [
            { x: r.x + l + k, y: r.y, w: restW, h: r.h },
            { x: r.x, y: r.y + w + k, w: l, h: restH },
          ];
    o.free.push(...pieces.filter((x) => x.w > 1 && x.h > 1));
  }
  return { boards: open.map((o) => o.board), tooBig };
}

/** Superficie que usan las piezas de una placa, de 0 a 1. */
export function sheetUse(b: SheetBoard): number {
  const used = b.placements.reduce((s, p) => s + p.length * p.width, 0);
  return used / (b.size[0] * b.size[1]);
}

/** Las piezas de placa más finas que esto (traseras, fondos de cajón) no llevan tapacanto. */
export const BANDING_MIN_MM = 12;

/**
 * Cantos a la vista de una pieza de placa: los que no apoyan contra otra pieza. Devuelve cuántos son de los
 * largos y cuántos de los cortos (0 a 2 cada uno), como se pide el tapacanto en el corralón.
 */
export function exposedEdges(part: Part, parts: Part[]): [number, number] {
  const box = partBox(part);
  const size = [0, 1, 2].map((a) => box.max[a]! - box.min[a]!);
  const axes = [0, 1, 2].sort((a, b) => size[b]! - size[a]!);
  const [longAxis, shortAxis] = axes as [number, number, number];
  const others = parts.filter((p) => p.id !== part.id && p.base.kind === 'box').map(partBox);
  /** Un canto está tapado si otra pieza cubre más de la mitad de esa cara. */
  const covered = (axis: number, side: 0 | 1) => {
    const at = side ? box.max[axis]! : box.min[axis]!;
    const along = [0, 1, 2].filter((a) => a !== axis);
    const area = along.reduce((s, a) => s * size[a]!, 1);
    let hit = 0;
    for (const o of others) {
      if (o.min[axis]! > at + 0.6 || o.max[axis]! < at - 0.6) continue;
      hit += along.reduce((s, a) => s * Math.max(0, Math.min(box.max[a]!, o.max[a]!) - Math.max(box.min[a]!, o.min[a]!)), 1);
    }
    return hit > area / 2;
  };
  // Los cantos largos son las caras que corren a lo largo de la pieza: las de los extremos del eje corto.
  const count = (axis: number) => (covered(axis, 0) ? 0 : 1) + (covered(axis, 1) ? 0 : 1);
  return [count(shortAxis), count(longAxis)];
}

/** Ancho de tapacanto para un espesor de placa, en mm. */
export const bandingWidth = (thickness: number) => (thickness <= 19 ? 22 : thickness <= 30 ? 33 : 45);

import { t } from './i18n';
import type { Drawing, Line2 } from './drawing';
import { MM_PER_INCH, type Units } from './units';

/**
 * Archivo DXF (versión R12, la que abren todos los programas de CNC, láser y dibujo) con el despiece:
 * cada pieza distinta a escala 1:1, una al lado de la otra, con su código arriba.
 * Las líneas que se tocan se juntan en polilíneas, así el programa de corte ve cada contorno cerrado.
 */

/** Una pieza del despiece: su dibujo (en mm, v hacia arriba) y el texto que va arriba. */
export interface DxfPiece {
  label: string;
  drawing: Drawing;
}

/** Capas del archivo: lo que se ve (para cortar), lo oculto (mortajas, vaciados del otro lado) y los textos. */
export const DXF_LAYERS = {
  cut: { name: () => t('CORTE'), color: 7, ltype: 'CONTINUOUS' },
  hidden: { name: () => t('OCULTO'), color: 8, ltype: 'DASHED' },
  text: { name: () => t('TEXTO'), color: 3, ltype: 'CONTINUOUS' },
} as const;

/** Lugar entre piezas y ancho de cada fila, en mm. */
const GAP = 40;
const ROW = 2400;
const TEXT_H = 12;

type Pt = [number, number];

/** Junta tramos que comparten punta en recorridos: abiertos o cerrados (la última punta vuelve a la primera). */
export function chainLines(lines: Pick<Line2, 'a' | 'b'>[], tol = 0.01): { points: Pt[]; closed: boolean }[] {
  const key = (p: Pt) => `${Math.round(p[0] / tol)},${Math.round(p[1] / tol)}`;
  const ends = new Map<string, number[]>();
  lines.forEach((l, i) => {
    for (const p of [l.a, l.b]) ends.set(key(p), [...(ends.get(key(p)) ?? []), i]);
  });
  const used = new Array<boolean>(lines.length).fill(false);
  const other = (i: number, from: Pt): Pt => (key(lines[i]!.a) === key(from) ? lines[i]!.b : lines[i]!.a);
  const next = (at: Pt) => ends.get(key(at))?.find((j) => !used[j]);
  const out: { points: Pt[]; closed: boolean }[] = [];
  lines.forEach((l, i) => {
    if (used[i]) return;
    used[i] = true;
    const pts: Pt[] = [l.a, l.b];
    // Hacia adelante desde la punta b, y después hacia atrás desde la punta a.
    for (let j = next(pts[pts.length - 1]!); j !== undefined; j = next(pts[pts.length - 1]!)) {
      used[j] = true;
      pts.push(other(j, pts[pts.length - 1]!));
    }
    for (let j = next(pts[0]!); j !== undefined; j = next(pts[0]!)) {
      used[j] = true;
      pts.unshift(other(j, pts[0]!));
    }
    const closed = pts.length > 3 && key(pts[0]!) === key(pts[pts.length - 1]!);
    out.push({ points: closed ? pts.slice(0, -1) : pts, closed });
  });
  return out;
}

/**
 * Texto de DXF. El archivo va en Latin-1 (ANSI_1252, lo que espera un R12): acentos, ñ, × y · entran tal cual;
 * cualquier otro carácter va como \U+XXXX.
 */
function dxfText(s: string): string {
  return [...s.replace(/[\r\n]+/g, ' ')].map((c) => (c.codePointAt(0)! < 256 ? c : `\\U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)).join('');
}

/** Los bytes del archivo: cada carácter de `piecesDxf` es uno solo, en Latin-1. */
export const dxfBytes = (dxf: string): Uint8Array<ArrayBuffer> => Uint8Array.from(dxf, (c) => c.charCodeAt(0));

/** Distancia de `p` al tramo a-b. */
function toSegment(p: Pt, a: Pt, b: Pt): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = dx * dx + dy * dy;
  const k = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - a[0] - k * dx, p[1] - a[1] - k * dy);
}

/**
 * Saca las líneas ocultas que caen justo debajo de una que se ve (la cara de atrás detrás del contorno):
 * en el papel no se notan, pero una CNC las cortaría dos veces.
 */
export function dropCovered(lines: Line2[], tol = 0.1): Line2[] {
  const seen = lines.filter((l) => !l.hidden);
  const on = (p: Pt) => seen.some((v) => toSegment(p, v.a, v.b) <= tol);
  return lines.filter((l) => !l.hidden || !(on(l.a) && on(l.b) && on([(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2])));
}

const num = (x: number) => String(Math.round(x * 10000) / 10000 + 0);

/** Arma el DXF. En pulgadas los números van en pulgadas; si no, en mm. */
export function piecesDxf(pieces: DxfPiece[], units: Units): string {
  const k = units === 'in' ? 1 / MM_PER_INCH : 1;
  const out: (string | number)[] = [];
  const g = (code: number, value: string | number) => out.push(code, value);
  const layer = (l: keyof typeof DXF_LAYERS) => dxfText(DXF_LAYERS[l].name());
  const body: (() => void)[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let maxX = 0;
  for (const piece of pieces) {
    const b = piece.drawing.bounds;
    // Lo que ocupa a lo ancho: la pieza o su texto, el que sea más largo (una letra mide hasta unos 0,75 del alto).
    const w = Math.max(b.u1 - b.u0, piece.label.length * TEXT_H * 0.75);
    const h = b.v1 - b.v0;
    if (x > 0 && x + w > ROW) {
      y -= rowH + GAP + TEXT_H * 2;
      x = 0;
      rowH = 0;
    }
    // La pieza se corre para que su esquina de abajo a la izquierda quede en (x, y - h).
    const dx = x - b.u0;
    const dy = y - h - b.v0;
    const at = (p: Pt): Pt => [(p[0] + dx) * k, (p[1] + dy) * k];
    for (const hidden of [false, true]) {
      const lines = dropCovered(piece.drawing.lines).filter((l) => l.hidden === hidden);
      for (const c of chainLines(lines)) {
        const name = layer(hidden ? 'hidden' : 'cut');
        body.push(() => {
          g(0, 'POLYLINE');
          g(8, name);
          g(66, 1);
          g(10, 0);
          g(20, 0);
          g(30, 0);
          g(70, c.closed ? 1 : 0);
          for (const p of c.points) {
            const [px, py] = at(p);
            g(0, 'VERTEX');
            g(8, name);
            g(10, num(px));
            g(20, num(py));
            g(30, 0);
          }
          g(0, 'SEQEND');
          g(8, name);
        });
      }
    }
    const label = dxfText(piece.label);
    const tx = x * k;
    const ty = (y + TEXT_H * 0.6) * k;
    body.push(() => {
      g(0, 'TEXT');
      g(8, layer('text'));
      g(10, num(tx));
      g(20, num(ty));
      g(30, 0);
      g(40, num(TEXT_H * k));
      g(1, label);
    });
    x += w + GAP;
    maxX = Math.max(maxX, x - GAP);
    rowH = Math.max(rowH, h);
  }
  const minY = y - rowH;

  g(0, 'SECTION');
  g(2, 'HEADER');
  g(9, '$ACADVER');
  g(1, 'AC1009');
  g(9, '$DWGCODEPAGE');
  g(3, 'ANSI_1252');
  g(9, '$INSUNITS');
  g(70, units === 'in' ? 1 : 4);
  g(9, '$MEASUREMENT');
  g(70, units === 'in' ? 0 : 1);
  g(9, '$EXTMIN');
  g(10, 0);
  g(20, num(minY * k));
  g(30, 0);
  g(9, '$EXTMAX');
  g(10, num(maxX * k));
  g(20, num(TEXT_H * 2 * k));
  g(30, 0);
  g(0, 'ENDSEC');

  g(0, 'SECTION');
  g(2, 'TABLES');
  g(0, 'TABLE');
  g(2, 'LTYPE');
  g(70, 2);
  for (const [name, desc, dashes] of [
    ['CONTINUOUS', 'Solid line', [] as number[]],
    ['DASHED', '__ __ __', [6 * k, -3 * k]],
  ] as const) {
    g(0, 'LTYPE');
    g(2, name);
    g(70, 0);
    g(3, desc);
    g(72, 65);
    g(73, dashes.length);
    g(40, num(dashes.reduce((s, d) => s + Math.abs(d), 0)));
    for (const d of dashes) g(49, num(d));
  }
  g(0, 'ENDTAB');
  g(0, 'TABLE');
  g(2, 'LAYER');
  g(70, 3);
  for (const l of Object.keys(DXF_LAYERS) as (keyof typeof DXF_LAYERS)[]) {
    g(0, 'LAYER');
    g(2, layer(l));
    g(70, 0);
    g(62, DXF_LAYERS[l].color);
    g(6, DXF_LAYERS[l].ltype);
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  g(0, 'SECTION');
  g(2, 'ENTITIES');
  body.forEach((f) => f());
  g(0, 'ENDSEC');
  g(0, 'EOF');

  const lines: string[] = [];
  for (let i = 0; i < out.length; i += 2) lines.push(String(out[i]).padStart(3), String(out[i + 1]));
  return lines.join('\r\n') + '\r\n';
}

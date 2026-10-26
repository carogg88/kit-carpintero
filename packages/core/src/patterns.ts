import { partAxesBySize } from './edit';
import { boxSize, otherAxes, partBox, type Axis } from './geometry';
import { describeBevel } from './bevels';
import { clipToFace, describePocket, faceLabelOf, pocketRegion } from './pockets';
import { pathCurved } from './profile';
import type { Rect2 } from './drawing';
import type { Bevel, Part, Pocket } from './project';
import { t } from './i18n';

/**
 * Plantilla de calco: la cara grande de la pieza a tamaño real, con lo que se le saca dibujado encima (esquinas
 * redondeadas, biseles de esquina, arcos, calados y vaciados). Se imprime, se pega y se calca sobre la tabla.
 * El dibujo va con el lado largo acostado (u a la derecha, v hacia arriba) y visto desde afuera de la cara.
 */

export interface PatternShape {
  /** Id del vaciado o del bisel. */
  id: string;
  source: 'pocket' | 'bevel';
  /** `cut` se saca de lado a lado (calado, esquina, arco); `pocket` es un vaciado o rebaje que no atraviesa. */
  kind: 'cut' | 'pocket';
  curve: boolean;
  /** Lo que se saca, como polígono en coordenadas del dibujo. */
  points: [number, number][];
  /** Un arco suelto: tiene su propia plantilla acostada sobre la cuerda. */
  arc?: boolean;
  /** Para un círculo: el centro y el radio, para marcar con el compás o la mecha. */
  circle?: { c: [number, number]; r: number };
  /** Desde dónde se ubica: la esquina del bisel, la esquina del rectángulo, el centro del círculo o el inicio del arco. */
  anchor: [number, number];
  /** "redondeo R 50 mm entre…", "calado Ø 35 mm en…". */
  label: string;
  /** Igual en forma: dos esquinas con la misma clave salen con la misma plantilla. */
  key: string;
}

export interface FacePattern {
  partId: string;
  /** La cara que se dibuja: eje perpendicular y de qué lado se mira. */
  axis: Axis;
  side: 1 | -1;
  width: number;
  height: number;
  /** Qué cara de la pieza queda en cada borde del dibujo. */
  edges: Record<'left' | 'right' | 'bottom' | 'top', { axis: Axis; side: 1 | -1 }>;
  shapes: PatternShape[];
}

/** El dibujo se lee bien visto desde afuera si los dos ejes de la cara giran como la mano derecha hacia ese lado. */
const rightHanded = (axis: Axis, side: 1 | -1) => side * (axis === 1 ? -1 : 1) > 0;

/** La plantilla de la cara grande de la pieza, o null si no tiene nada curvo ni calado que calcar. */
export function facePattern(part: Part, n: (mm: number) => string): FacePattern | null {
  if (part.base.kind !== 'box' || part.turning) return null;
  const axis = partAxesBySize(part)[2];
  const [ua, va] = otherAxes(axis);
  const s = boxSize(partBox(part));
  const fw = s[ua];
  const fh = s[va];
  // Se mira desde la cara de los rebajes que no atraviesan, si están todos del mismo lado; si no, desde el lado de afuera.
  const blind = part.pockets.filter((p) => p.axis === axis && !p.through);
  const side: 1 | -1 = blind.length && blind.every((p) => p.side < 0) ? -1 : 1;
  const swap = fh > fw;
  const flip = rightHanded(axis, side) === swap;
  const width = swap ? fh : fw;
  const height = swap ? fw : fh;
  const xAxis = swap ? va : ua;
  const yAxis = swap ? ua : va;
  const show = ([u, v]: [number, number]): [number, number] => {
    const [x, y] = swap ? [v, u] : [u, v];
    return [x, flip ? height - y : y];
  };
  const shapes: PatternShape[] = [];

  for (const bv of part.bevels) {
    if (bv.a.axis === axis || bv.b.axis === axis) continue;
    shapes.push(bevelShape(bv, ua, fw, fh, show, part, n));
  }
  for (const pk of part.pockets) {
    if (pk.axis !== axis) continue;
    const sh = pk.shape;
    const region = pocketRegion(part, axis, sh, sh.kind === 'arc' ? sh.outside : undefined);
    if (region.length < 3) continue;
    shapes.push({
      id: pk.id,
      source: 'pocket',
      kind: pk.through ? 'cut' : 'pocket',
      curve: sh.kind === 'path' ? pathCurved(sh) : sh.kind !== 'rect',
      arc: sh.kind === 'arc' || undefined,
      points: region.map(show),
      circle: sh.kind === 'circle' ? { c: show([sh.u, sh.v]), r: sh.d / 2 } : undefined,
      anchor: show(sh.kind === 'path' ? [sh.points[0]!.u, sh.points[0]!.v] : [sh.u, sh.v]),
      label: describePocket(pk, n),
      key: pocketKey(pk),
    });
  }
  // Solo vale la pena si hay algo que no se marca con regla y escuadra: una curva o un calado.
  if (!shapes.some((sh) => sh.curve || (sh.source === 'pocket' && sh.kind === 'cut'))) return null;
  return {
    partId: part.id,
    axis,
    side,
    width,
    height,
    edges: {
      left: { axis: xAxis, side: -1 },
      right: { axis: xAxis, side: 1 },
      bottom: { axis: yAxis, side: flip ? 1 : -1 },
      top: { axis: yAxis, side: flip ? -1 : 1 },
    },
    shapes,
  };
}

function pocketKey(pk: Pocket): string {
  const sh = pk.shape;
  const size =
    sh.kind === 'rect'
      ? `${sh.w}x${sh.h}`
      : sh.kind === 'circle'
        ? `${sh.d}`
        : sh.kind === 'path'
          ? `${sh.points.map((p) => `${p.u},${p.v},${p.corner}`).join(';')}:${sh.closed}:${sh.flip}`
          : `${sh.u2 - sh.u},${sh.v2 - sh.v},${sh.bulge}`;
  return `pocket:${sh.kind}:${size}:${pk.through}:${pk.depth}`;
}

function bevelShape(
  bv: Bevel,
  ua: Axis,
  fw: number,
  fh: number,
  show: (p: [number, number]) => [number, number],
  part: Part,
  n: (mm: number) => string,
): PatternShape {
  // En coordenadas de la cara: la esquina donde se juntan las dos caras del bisel.
  const ea = bv.a.side > 0 ? (bv.a.axis === ua ? fw : fh) : 0;
  const eb = bv.b.side > 0 ? (bv.b.axis === ua ? fw : fh) : 0;
  const local = (along: number, across: number): [number, number] => (bv.a.axis === ua ? [along, across] : [across, along]);
  const pts: [number, number][] = [];
  if (bv.round) {
    const r = bv.da;
    const ca = ea - bv.a.side * r;
    const cb = eb - bv.b.side * r;
    for (let i = 0; i <= 24; i++) {
      const th = (i / 24) * (Math.PI / 2);
      pts.push(local(ca + bv.a.side * r * Math.cos(th), cb + bv.b.side * r * Math.sin(th)));
    }
  } else {
    pts.push(local(ea, eb - bv.b.side * bv.da), local(ea - bv.a.side * bv.db, eb));
  }
  pts.push(local(ea, eb));
  return {
    id: bv.id,
    source: 'bevel',
    kind: 'cut',
    curve: bv.round,
    points: clipToFace(pts, fw, fh).map(show),
    anchor: show(local(ea, eb)),
    label: describeBevel(part, bv, n),
    key: `bevel:${bv.round}:${bv.da}:${bv.db}`,
  };
}

export function shapeBounds(points: [number, number][]): Rect2 {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { u0: Math.min(...xs), v0: Math.min(...ys), u1: Math.max(...xs), v1: Math.max(...ys) };
}

/** Dónde va, medido desde los dos bordes más cercanos: "a 120 mm de la cara izquierda y a 80 mm de la cara de abajo". */
export function shapePlace(p: FacePattern, at: [number, number], n: (mm: number) => string): string {
  const [x, y] = at;
  const fromX = x <= p.width - x ? { d: x, edge: p.edges.left } : { d: p.width - x, edge: p.edges.right };
  const fromY = y <= p.height - y ? { d: y, edge: p.edges.bottom } : { d: p.height - y, edge: p.edges.top };
  const label = (f: { axis: Axis; side: 1 | -1 }) => faceLabelOf(f.axis, f.side);
  // "de el frente" se dice "del frente".
  return t('a {x} de {ex} y a {y} de {ey}', { x: n(fromX.d), ex: label(fromX.edge), y: n(fromY.d), ey: label(fromY.edge) }).replace(/\bde el\b/g, 'del');
}

export interface PatternDetail {
  /** Lo que entra en la plantilla de detalle, en coordenadas del dibujo. */
  b: Rect2;
  /** Las formas que se calcan con esta plantilla y cuántas iguales hay en la pieza. */
  shapes: { shape: PatternShape; count: number }[];
}

/**
 * Cuando la cara entera no entra en pocas hojas: una plantilla por forma, con un margen alrededor para ver los bordes
 * de la pieza que la ubican. Las esquinas iguales salen una sola vez (se da vuelta la hoja); las que se pisan, juntas.
 * Los arcos sueltos no van: ya tienen su plantilla acostada sobre la cuerda.
 */
export function patternDetails(p: FacePattern, margin = 14): PatternDetail[] {
  const groups = new Map<string, { shape: PatternShape; count: number }>();
  for (const sh of p.shapes) {
    if (sh.arc) continue;
    const key = sh.source === 'bevel' ? sh.key : `${sh.key}:${sh.id}`;
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { shape: sh, count: 1 });
  }
  let out: PatternDetail[] = [...groups.values()].map((g) => {
    const b = shapeBounds(g.shape.points);
    return {
      b: {
        u0: Math.max(-margin / 2, b.u0 - margin),
        v0: Math.max(-margin / 2, b.v0 - margin),
        u1: Math.min(p.width + margin / 2, b.u1 + margin),
        v1: Math.min(p.height + margin / 2, b.v1 + margin),
      },
      shapes: [g],
    };
  });
  // Las que se pisan van en la misma plantilla.
  for (let merged = true; merged; ) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      for (let j = i + 1; j < out.length && !merged; j++) {
        const [a, b] = [out[i]!.b, out[j]!.b];
        if (a.u0 < b.u1 && b.u0 < a.u1 && a.v0 < b.v1 && b.v0 < a.v1) {
          out[i] = {
            b: { u0: Math.min(a.u0, b.u0), v0: Math.min(a.v0, b.v0), u1: Math.max(a.u1, b.u1), v1: Math.max(a.v1, b.v1) },
            shapes: [...out[i]!.shapes, ...out[j]!.shapes],
          };
          out = out.filter((_, k) => k !== j);
          merged = true;
        }
      }
    }
  }
  return out;
}

import { boxSize, copyBox, type Axis, type Box, type Vec3 } from '../geometry';
import { box, endJoint, half, slab, type JointGeometry, type Solid } from './common';

export interface MortiseParams {
  /** Largo de la espiga, en mm. */
  length: number;
  /** Espesor de la espiga; por la regla del tercio, un tercio del espesor de la pieza. */
  thickness: number;
  /** Hombro a cada lado de la espiga, en mm. */
  shoulder: number;
  /**
   * Espigas: 1, o 2 lado a lado en una pieza ancha (un faldón alto), con `gap` mm de madera entre las dos. Dos espigas
   * angostas se mueven menos con la madera que una ancha y no debilitan tanto la pata. Si falta, es una.
   */
  count?: number;
  gap?: number;
  /** Cómo se traba: el número de `TENON_STYLES`. Si falta, ciega (la de siempre). */
  style?: number;
  /** Media caja: hondo del diente que llena el hombro del lado de afuera, en mm. 0 o si falta, sin media caja. */
  haunch?: number;
  /** Tarugada: diámetro del tarugo y cuánto se corre el agujero de la espiga hacia el hombro, en mm. */
  pin?: number;
  offset?: number;
  /** Con llave: cuánto asoma la espiga del otro lado y el ancho de la llave, en mm. */
  protrude?: number;
  key?: number;
}

/**
 * Las formas de trabar una caja y espiga. Pasante, con cuñas y con llave atraviesan la pieza que recibe; la tarugada
 * lleva un tarugo que cruza pata y espiga, con el agujero de la espiga corrido para que apriete.
 */
export const TENON_STYLES = ['ciega', 'pasante', 'cunas', 'ciega-cunas', 'tarugada', 'llave'] as const;
export type TenonStyle = (typeof TENON_STYLES)[number];

export const tenonStyle = (p: Pick<MortiseParams, 'style'>): TenonStyle => TENON_STYLES[p.style ?? 0] ?? 'ciega';

/** Los estilos donde la espiga atraviesa la pieza que recibe. */
export const isThrough = (style: TenonStyle) => style === 'pasante' || style === 'cunas' || style === 'llave';

/** Corte de sierra para las cuñas, y cuánto se abre la caja de cada lado para que las cuñas abran la espiga. */
export const WEDGE_KERF = 2;
export const WEDGE_FLARE = 2;

/** Medidas de taller para lo que agrega cada estilo, a partir del espesor de la espiga y su largo. */
export function styleDefaults(p: Pick<MortiseParams, 'thickness' | 'length'>): Required<Pick<MortiseParams, 'pin' | 'offset' | 'protrude' | 'key' | 'haunch'>> {
  const key = 16;
  return {
    pin: p.thickness >= 15 ? 10 : p.thickness >= 9 ? 8 : 6,
    offset: 1.5,
    key,
    protrude: key + 24,
    haunch: Math.max(6, half(p.length / 3)),
  };
}

/** Largo de la espiga: el elegido, o lo que la atraviesa (más lo que asoma, con llave). */
export function tenonLength(p: MortiseParams, depth: number): number {
  const style = tenonStyle(p);
  if (!isThrough(style)) return p.length;
  return depth + (style === 'llave' ? (p.protrude ?? styleDefaults(p).protrude) : 0);
}

/** Desde este ancho de espiga conviene partirla en dos. */
export const DOUBLE_TENON_FROM = 90;

/** Separación entre las dos espigas, para empezar: un tercio del ancho, redondeado a medio milímetro. */
export const defaultTenonGap = (width: number) => half(width / 3);

/**
 * Dónde va cada espiga a lo ancho, entre `from` y `to` (ya sin los hombros): una sola, o dos con `gap` en el medio.
 * Si el hueco no deja madera para las dos, queda una.
 */
export function tenonSpans(from: number, to: number, count = 1, gap?: number): [number, number][] {
  const width = to - from;
  if (count < 2 || width <= 0) return [[from, to]];
  const g = Math.max(1, gap ?? defaultTenonGap(width));
  const each = (width - g) / 2;
  if (each < 3) return [[from, to]];
  return [
    [from, from + each],
    [to - each, to],
  ];
}

/** Ancho de cada espiga, en mm: con dos, el de una de ellas. */
export function tenonWidth(wide: number, p: Pick<MortiseParams, 'shoulder' | 'count' | 'gap'>): number {
  const [first] = tenonSpans(0, wide - 2 * p.shoulder, p.count, p.gap);
  return first![1] - first![0];
}

/**
 * Medidas de taller para una mortaja: espiga de un tercio, hasta 40 mm de largo, hombros de 10 mm. En piezas angostas
 * (un travesaño de 3 cm) el hombro baja a un sexto del ancho, para que la espiga no quede de 1 cm y se quiebre.
 */
export function defaultMortiseParams(mortisePart: Box, tenonPart: Box): MortiseParams | null {
  const j = endJoint(mortisePart, tenonPart);
  if (!j) return null;
  const size = boxSize(tenonPart);
  const depthAvailable = boxSize(mortisePart)[j.axis];
  const wide = j.section.max[j.wide] - j.section.min[j.wide];
  const shoulder = Math.min(10, Math.max(3, half(wide / 6)));
  return {
    length: Math.round(Math.min(40, depthAvailable * 0.65)),
    thickness: Math.round((size[j.thin] / 3) * 10) / 10,
    shoulder,
    // Una espiga; si se pasa a doble, con esta separación.
    count: 1,
    gap: defaultTenonGap(wide - 2 * shoulder),
  };
}

/** Por debajo de este ancho, una espiga se quiebra con facilidad. */
export const MIN_TENON_WIDTH = 15;

/**
 * Geometría de una mortaja y espiga: la espiga que se suma a `tenonPart` y la mortaja que se resta
 * de `mortisePart` (2 mm más profunda, para la cola sobrante). Con espiga doble, es lo que ocupan las dos juntas.
 */
export function mortiseAndTenon(mortisePart: Box, tenonPart: Box, p: MortiseParams): { tenon: Box; mortise: Box } | null {
  const j = endJoint(mortisePart, tenonPart);
  if (!j) return null;
  const section = slab(j, 0, tenonPart);
  const mid = (tenonPart.min[j.thin] + tenonPart.max[j.thin]) / 2;
  section.min[j.thin] = mid - p.thickness / 2;
  section.max[j.thin] = mid + p.thickness / 2;
  section.min[j.wide] = tenonPart.min[j.wide] + p.shoulder;
  section.max[j.wide] = tenonPart.max[j.wide] - p.shoulder;
  const length = tenonLength(p, boxSize(mortisePart)[j.axis]);
  return { tenon: slab(j, length, section), mortise: slab(j, length + 2, section) };
}

/** Cada espiga con su mortaja: una, o las dos de una espiga doble. */
export function splitTenons<T extends { tenon: Box; mortise: Box }>(g: T, axis: number, p: Pick<MortiseParams, 'count' | 'gap'>): { tenon: Box; mortise: Box }[] {
  return tenonSpans(g.tenon.min[axis]!, g.tenon.max[axis]!, p.count, p.gap).map(([lo, hi]) => {
    const tenon = copyBox(g.tenon);
    const mortise = copyBox(g.mortise);
    tenon.min[axis] = mortise.min[axis] = lo;
    tenon.max[axis] = mortise.max[axis] = hi;
    return { tenon, mortise };
  });
}

export function mortiseGeometry(a: Box, b: Box, p: MortiseParams): JointGeometry | null {
  const g = mortiseAndTenon(a, b, p);
  const j = endJoint(a, b);
  if (!g || !j) return null;
  const pieces = splitTenons(g, j.wide, p);
  // La media caja va del lado de la punta de la pieza que recibe: donde el hombro queda a la vista.
  const side: 'min' | 'max' = a.max[j.wide] - j.section.max[j.wide] <= j.section.min[j.wide] - a.min[j.wide] ? 'max' : 'min';
  const extra = tenonExtras({ ...j, depth: boxSize(a)[j.axis], span: [a.min[j.thin], a.max[j.thin]], edge: j.section[side][j.wide], side }, pieces, p);
  return { cutA: pieces.map((x) => box(x.mortise)), cutB: [], addB: pieces.map((x) => box(x.tenon)), ...(extra ? { extra } : {}) };
}

/** Dónde está la espiga: cómo entra, la cara de la pieza que recibe, su hondo y su espesor, y el lado de la media caja. */
export interface TenonFrame {
  axis: Axis;
  dir: 1 | -1;
  thin: Axis;
  wide: Axis;
  /** La cara de la pieza que recibe, sobre `axis`. */
  face: number;
  /** Lo que mide la pieza que recibe sobre `axis`. */
  depth: number;
  /** Dónde empieza y termina la pieza que recibe sobre `thin`: el tarugo la cruza entera. */
  span: [number, number];
  /** Lado de la media caja y hasta dónde llega: el canto de la pieza que entra. */
  side: 'min' | 'max';
  edge: number;
}

/**
 * Lo que agrega cada estilo además de la espiga y su caja: la media caja, los cortes y el abocinado de las cuñas, el
 * agujero del tarugo (corrido en la espiga) y el de la llave. Va aparte de la espiga: no cambia dónde ni cuánto mide.
 */
export function tenonExtras(f: TenonFrame, pieces: { tenon: Box }[], p: MortiseParams): Required<JointGeometry>['extra'] | null {
  const style = tenonStyle(p);
  const d = { ...styleDefaults(p), ...defined(p) };
  const length = tenonLength(p, f.depth);
  const at = (mm: number) => f.face + f.dir * mm;
  const along = (b: Box, from: number, to: number) => {
    b.min[f.axis] = Math.min(at(from), at(to));
    b.max[f.axis] = Math.max(at(from), at(to));
    return b;
  };
  const cutA: Solid[] = [];
  const cutB: Solid[] = [];
  const addB: Solid[] = [];
  if (p.haunch && p.haunch > 0 && pieces.length) {
    const t = copyBox((f.side === 'max' ? pieces[pieces.length - 1] : pieces[0])!.tenon);
    const from = f.side === 'max' ? t.max[f.wide] : f.edge;
    const to = f.side === 'max' ? f.edge : t.min[f.wide];
    if (to - from > 1) {
      t.min[f.wide] = from;
      t.max[f.wide] = to;
      addB.push(box(along(copyBox(t), 0, p.haunch)));
      cutA.push(box(along(copyBox(t), 0, p.haunch + 1)));
    }
  }
  for (const { tenon } of pieces) {
    const lo = tenon.min[f.wide];
    const hi = tenon.max[f.wide];
    const width = hi - lo;
    if (style === 'cunas' || style === 'ciega-cunas') {
      // Dos cortes a un quinto de cada canto, o uno al medio en una espiga angosta, de dos tercios del largo.
      const cuts = width >= 30 ? [lo + width / 5, hi - width / 5] : [(lo + hi) / 2];
      for (const c of cuts) {
        const k = copyBox(tenon);
        k.min[f.thin] -= 0.5;
        k.max[f.thin] += 0.5;
        k.min[f.wide] = c - WEDGE_KERF / 2;
        k.max[f.wide] = c + WEDGE_KERF / 2;
        cutB.push(box(along(k, length - (2 * length) / 3, length + 0.5)));
      }
      // La caja se abre hacia donde las cuñas empujan: del lado de afuera en la pasante, al fondo en la ciega.
      const flare = copyBox(tenon);
      flare.min[f.wide] = lo - WEDGE_FLARE;
      flare.max[f.wide] = hi + WEDGE_FLARE;
      cutA.push(box(style === 'cunas' ? along(flare, f.depth / 2, f.depth + 1) : along(flare, length / 2, length + 2)));
    }
    if (style === 'tarugada') {
      const r = d.pin / 2;
      const pos = Math.max(r + 6, length / 3);
      const start = (mm: number): Vec3 => {
        const v: Vec3 = [0, 0, 0];
        v[f.thin] = f.span[0] - 1;
        v[f.wide] = (lo + hi) / 2;
        v[f.axis] = at(mm);
        return v;
      };
      const across = f.span[1] - f.span[0] + 2;
      cutA.push({ kind: 'cylinder', start: start(pos), axis: f.thin, dir: 1, radius: r, length: across });
      // En la espiga, más cerca del hombro: al meter el tarugo, tira de la espiga y cierra el hombro.
      cutB.push({ kind: 'cylinder', start: start(pos - d.offset), axis: f.thin, dir: 1, radius: r, length: across });
    }
    if (style === 'llave') {
      const k = copyBox(tenon);
      const thick = Math.max(4, half((tenon.max[f.thin] - tenon.min[f.thin]) / 2));
      const mid = (tenon.min[f.thin] + tenon.max[f.thin]) / 2;
      k.min[f.thin] = mid - thick / 2;
      k.max[f.thin] = mid + thick / 2;
      k.min[f.wide] = lo - 1;
      k.max[f.wide] = hi + 1;
      // Arranca 2 mm adentro de la pata, así la llave aprieta contra su cara.
      cutB.push(box(along(k, f.depth - 2, f.depth + d.key)));
    }
  }
  return cutA.length + cutB.length + addB.length ? { cutA, cutB, addB } : null;
}

/** Solo las medidas que están: las que faltan las completan los valores de taller. */
function defined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

import { boxSize, overlapBox, partBox, type Axis, type Box } from './geometry';
import { defaultMortiseParams, endJoint, JOINT_NAMES, mortiseAndTenon, type MortiseParams } from './joints';
import { furnitureBox } from './resize';
import { formatLength } from './units';
import { isSheet, sheetById } from './woods';
import type { Joint, JointType, Part, Project } from './project';
import { locale, t, tk } from './i18n';

/**
 * Revisión del diseño: lo que un carpintero con oficio miraría antes de cortar. No impide nada; avisa con la pieza
 * marcada, por qué pasa y qué hacer. Son cuentas de taller sobre las medidas, no un cálculo de estructuras.
 */

export type ReviewKind = 'cruce' | 'veta' | 'estante' | 'espiga' | 'vuelco';

export interface ReviewNote {
  /** Estable mientras no cambie lo que lo provoca: sirve de clave en la lista. */
  id: string;
  kind: ReviewKind;
  /** Las piezas en cuestión; la primera es la que hay que mirar. */
  parts: string[];
  title: string;
  /** Qué pasa y por qué. */
  text: string;
  /** Qué hacer. */
  fix: string;
}

const lower = (s: string) => s.toLocaleLowerCase(locale());
const name = (p: Part) => lower(p.name);
const mm = (v: number) => `${Math.round(v)} mm`;

/** Ejes de una caja, del más largo al más corto. En la app la veta va siempre a lo largo de la pieza. */
const axesBySize = (b: Box): [Axis, Axis, Axis] => {
  const s = boxSize(b);
  return ([0, 1, 2] as Axis[]).sort((x, y) => s[y] - s[x]) as [Axis, Axis, Axis];
};

const solid = (p: Part) => p.base.kind === 'box' && !p.turning && !isSheet(p.wood);

// ── Veta cruzada ────────────────────────────────────────────────────────────

/** La madera maciza se mueve con la humedad, a lo ancho y casi nada a lo largo: en Buenos Aires, cerca de 1 % del ancho. */
export const MOVEMENT_SHARE = 0.01;
/** Desde este ancho el movimiento ya rompe una unión trabada. */
const MOVING_WIDTH = 200;
/** Lo que tienen que compartir las dos piezas sobre ese ancho para que la unión lo trabe. */
const LOCKED_SPAN = 150;
/** Encastres que flotan o dejan correr la madera: no traban el ancho. */
const FLOATING = new Set<JointType>(['tope', 'canal', 'machiembrado']);

/**
 * Pieza ancha encolada a otra cuya veta corre a lo ancho de la primera: la ancha quiere moverse y la otra no la deja.
 * Es la tapa maciza fija a un faldón lateral o el lateral fijo a una tapa con la veta de punta: se raja.
 */
function crossGrain(project: Project, j: Joint): ReviewNote | null {
  if (FLOATING.has(j.type)) return null;
  const a = project.parts.find((p) => p.id === j.partA);
  const b = project.parts.find((p) => p.id === j.partB);
  if (!a || !b || !solid(a) || !solid(b)) return null;
  for (const [wide, other] of [
    [a, b],
    [b, a],
  ] as const) {
    const wb = partBox(wide);
    const ob = partBox(other);
    const [, across] = axesBySize(wb);
    const width = boxSize(wb)[across];
    if (width < MOVING_WIDTH || axesBySize(ob)[0] !== across) continue;
    const shared = Math.min(wb.max[across], ob.max[across]) - Math.max(wb.min[across], ob.min[across]);
    if (shared < LOCKED_SPAN) continue;
    const move = Math.max(1, Math.round(width * MOVEMENT_SHARE));
    return {
      id: `veta|${j.id}`,
      kind: 'veta',
      parts: [wide.id, other.id],
      title: t('Veta cruzada: {a} y {b}', { a: wide.name, b: name(other) }),
      text: t(
        '{a} es maciza y mide {w} de ancho: con la humedad se mueve hasta {move} mm a lo ancho. {b} tiene la veta para ese lado y no se mueve: la unión con {joint} las traba y alguna se raja.',
        { a: wide.name, w: formatLength(width, project.units), move, b: other.name, joint: lower(t(JOINT_NAMES[j.type])) },
      ),
      fix: t('Uní las dos piezas a tope con grampas o con tornillos en agujeros ovalados, para que la madera corra. O usá una placa, que no se mueve.'),
    };
  }
  return null;
}

// ── Estantes que se comban ──────────────────────────────────────────────────

/** Módulo de elasticidad, en MPa (N/mm²). Valores de tabla, del lado seguro. */
const STIFFNESS: Record<string, number> = {
  guatambu: 11000,
  paraiso: 8000,
  cedro: 8000,
  lapacho: 17000,
  algarrobo: 9000,
  pino: 10000,
  mdf: 3500,
  melamina: 2800,
  terciado: 6000,
  multilaminado: 7000,
};
/** Libros: unos 110 kg por m² de estante (una fila de 25 cm de fondo pesa cerca de 27 kg por metro). */
const BOOK_LOAD_KG_M2 = 110;
/** Flecha que casi no se nota a la vista: 1/500 de la luz (unos 1,8 mm en 90 cm). */
const SAG_LIMIT = 500;

const isShelf = (p: Part) => /^E\d/.test(p.id) || /^(estante|shelf)/i.test(p.name.trim());

/** Cuánto se comba en el medio un estante apoyado en las puntas, cargado de libros, en mm. */
export function shelfSag(span: number, depth: number, thickness: number, wood: string): number {
  const e = STIFFNESS[wood] ?? 8000;
  const w = (BOOK_LOAD_KG_M2 * 9.81 * (depth / 1000)) / 1000; // N por mm de largo
  const inertia = (depth * thickness ** 3) / 12;
  return (5 * w * span ** 4) / (384 * e * inertia);
}

/** Los estantes iguales (misma luz, fondo, espesor y material) van en un solo aviso. */
function sagging(project: Project): ReviewNote[] {
  const groups = new Map<string, Part[]>();
  for (const p of project.parts) {
    if (p.base.kind !== 'box' || p.turning || !isShelf(p)) continue;
    const [w, h, d] = p.base.size;
    // Solo los estantes acostados; el largo es la luz entre apoyos y el otro lado, el fondo.
    if (h >= Math.min(w, d)) continue;
    const key = [Math.max(w, d), Math.min(w, d), h, p.wood].join('|');
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const notes: ReviewNote[] = [];
  for (const shelves of groups.values()) {
    const p = shelves[0]!;
    const [w, h, d] = (p.base as { size: [number, number, number] }).size;
    const span = Math.max(w, d);
    const depth = Math.min(w, d);
    const sag = shelfSag(span, depth, h, p.wood);
    const limit = span / SAG_LIMIT;
    if (sag <= limit) continue;
    // La luz que aguanta y el espesor que haría falta: la flecha crece con la luz a la cuarta y baja con el espesor al cubo.
    const maxSpan = span * (limit / sag) ** (1 / 3);
    const needed = h * (sag / limit) ** (1 / 3);
    const sheet = sheetById(p.wood);
    const thick = sheet ? sheet.thicknesses.find((x) => x >= needed) : Math.ceil(needed / 5) * 5;
    const len = formatLength(Math.floor(maxSpan / 10) * 10, project.units);
    const n = shelves.length;
    notes.push({
      id: `estante|${p.id}`,
      kind: 'estante',
      parts: shelves.map((s) => s.id),
      title: n === 1 ? t('{name} se comba', { name: p.name }) : t('{n} estantes se comban', { n }),
      text: t('Con {len} entre apoyos y {t} de espesor, cargado de libros baja unos {sag} mm en el medio, y con los años un poco más.', {
        len: formatLength(span, project.units),
        t: mm(h),
        sag: sag.toLocaleString(locale(), { maximumFractionDigits: 1 }),
      }),
      fix: thick
        ? t('Para que no se note, hacelo de hasta {len} de largo o de {t} de espesor, o poné un apoyo en el medio o un listón de canto abajo del frente.', { len, t: mm(thick) })
        : t('Para que no se note, hacelo de hasta {len} de largo, o poné un apoyo en el medio o un listón de canto abajo del frente.', { len }),
    });
  }
  return notes;
}

// ── Espigas ─────────────────────────────────────────────────────────────────

/** Madera mínima a cada lado de una mortaja: menos que esto se parte al encolar o con el primer golpe. */
const MIN_WALL = 6;

function tenon(project: Project, j: Joint): ReviewNote | null {
  if (j.type !== 'mortaja') return null;
  const a = project.parts.find((p) => p.id === j.partA);
  const b = project.parts.find((p) => p.id === j.partB);
  if (!a || !b || a.base.kind !== 'box' || b.base.kind !== 'box') return null;
  const ba = partBox(a);
  const bb = partBox(b);
  const base = defaultMortiseParams(ba, bb);
  const e = endJoint(ba, bb);
  if (!base || !e) return null;
  const params = { ...base, ...j.params } as MortiseParams;
  const g = mortiseAndTenon(ba, bb, params);
  if (!g) return null;
  const stock = boxSize(bb)[e.thin];
  const third = Math.round((stock / 3) * 10) / 10;
  // Las paredes de la mortaja: lo que queda entre el agujero y las caras de la pieza que lo recibe.
  const wall = Math.min(...([e.thin, e.wide] as Axis[]).flatMap((k) => [g.mortise.min[k] - ba.min[k], ba.max[k] - g.mortise.max[k]]));
  if (wall < MIN_WALL) {
    return {
      id: `espiga|${j.id}`,
      kind: 'espiga',
      parts: [a.id, b.id],
      title: t('Mortaja al borde en {name}', { name: name(a) }),
      text: t('La mortaja para {b} deja solo {w} de madera hasta la cara de {a}: se puede partir al encolar o con un golpe.', { b: name(b), w: mm(Math.max(0, wall)), a: name(a) }),
      fix: t('Dejá al menos {min} mm de pared: corré la pieza hacia adentro, hacé la espiga más fina o usá una pieza que reciba más gruesa.', { min: MIN_WALL }),
    };
  }
  if (params.thickness > third + 1) {
    return {
      id: `espiga|${j.id}`,
      kind: 'espiga',
      parts: [b.id, a.id],
      title: t('Espiga gruesa en {name}', { name: name(b) }),
      text: t('La espiga de {b} mide {t} y la pieza tiene {s}: los hombros quedan finos y se quiebran, y la mortaja debilita {a}.', { b: name(b), t: mm(params.thickness), s: mm(stock), a: name(a) }),
      fix: t('La regla del tercio: una espiga de {third} mm, un tercio del espesor de la pieza.', { third: third.toLocaleString(locale()) }),
    };
  }
  return null;
}

// ── Vuelco ──────────────────────────────────────────────────────────────────

/**
 * Un mueble alto y de poco fondo se vuelca si alguien se cuelga o trepa; uno con cajones, además, cuando se abren
 * todos a la vez. Pasa con más frecuencia de lo que parece y con chicos es grave.
 */
export function tipRisk(project: Pick<Project, 'parts'>): { height: number; depth: number; drawers: boolean } | null {
  const box = furnitureBox(project.parts);
  if (!box) return null;
  const [w, height, d] = boxSize(box);
  const depth = Math.min(w, d);
  const drawers = project.parts.some((p) => /^K\d/.test(p.id));
  return (drawers && height >= 700 && height >= 1.5 * depth) || (height >= 1000 && height >= 2.5 * depth) ? { height, depth, drawers } : null;
}

function tipping(project: Project): ReviewNote | null {
  const r = tipRisk(project);
  if (!r) return null;
  const top = [...project.parts].filter((p) => p.base.kind === 'box').sort((x, y) => partBox(y).max[1] - partBox(x).max[1])[0];
  return {
    id: 'vuelco',
    kind: 'vuelco',
    parts: top ? [top.id] : [],
    title: t('Se puede volcar'),
    text: t(r.drawers ? tk('Mide {h} de alto y {d} de fondo: si alguien trepa o abre todos los cajones juntos, se viene para adelante.') : tk('Mide {h} de alto y {d} de fondo: si alguien se cuelga o trepa, se viene para adelante.'), {
      h: formatLength(r.height, project.units),
      d: formatLength(r.depth, project.units),
    }),
    fix: t('Atornillalo a la pared con dos escuadras antivuelco, arriba y atrás, en un taco de la pared o con tarugos. Ya están en la lista de compras.'),
  };
}

/**
 * Dos piezas que ocupan el mismo lugar sin un encastre que lo resuelva: así no se pueden armar. Pasa al correr una
 * pieza a mano hasta meterla en otra de una forma que ninguna unión admite (una tapa hundida en una pata).
 */
function crossings(project: Project): ReviewNote[] {
  const boxes = project.parts.filter((p) => p.base.kind === 'box').map((p) => ({ p, box: partBox(p) }));
  const joined = new Set(project.joints.map((j) => [j.partA, j.partB].sort().join('|')));
  const notes: ReviewNote[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let k = i + 1; k < boxes.length; k++) {
      const a = boxes[i]!;
      const b = boxes[k]!;
      if (joined.has([a.p.id, b.p.id].sort().join('|'))) continue;
      const o = overlapBox(a.box, b.box, 0.5);
      if (!o) continue;
      const depth = Math.min(...boxSize(o));
      notes.push({
        id: `cruce:${a.p.id}|${b.p.id}`,
        kind: 'cruce',
        parts: [b.p.id, a.p.id],
        title: t('{a} y {b} se meten una en otra', { a: a.p.id, b: b.p.id }),
        text: t('Ocupan el mismo lugar ({mm}) y no hay un encastre que lo resuelva: así no se pueden armar.', { mm: mm(depth) }),
        fix: t('Corré una hasta que solo se toquen, o acortala. Con Rayos X (tecla X) se ve dónde se cruzan.'),
      });
    }
  }
  return notes;
}

/** Todos los avisos del diseño, del más grave al más leve. */
export function reviewDesign(project: Project): ReviewNote[] {
  const notes: ReviewNote[] = [...crossings(project)];
  const tip = tipping(project);
  if (tip) notes.push(tip);
  const seen = new Set<string>();
  for (const j of project.joints) {
    const n = crossGrain(project, j);
    // Una tapa fija a dos faldones laterales es un solo problema por par de piezas.
    if (n && !seen.has(n.parts.join('|'))) {
      seen.add(n.parts.join('|'));
      notes.push(n);
    }
  }
  for (const j of project.joints) {
    const n = tenon(project, j);
    if (n) notes.push(n);
  }
  notes.push(...sagging(project));
  return notes;
}

/** Los avisos que tocan a una pieza. */
export const partNotes = (notes: ReviewNote[], id: string) => notes.filter((n) => n.parts.includes(id));

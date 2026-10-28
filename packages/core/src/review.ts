import { boxSize, overlapBox, partBox, type Axis, type Box } from './geometry';
import { bestHold, defaultMortiseParams, defaultTenonGap, DOUBLE_TENON_FROM, endJoint, FLOATING_HOLDS, HOLDS, holdFits, holdOf, JOINT_NAMES, mortiseAndTenon, type Hold, type MortiseParams } from './joints';
import { furnitureBox } from './resize';
import { formatLength } from './units';
import { isSheet, sheetById } from './woods';
import { grainAxis, setGrain, shortGrain } from './grain';
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
  /** La unión en cuestión y cuál de sus medidas mirar, cuando el arreglo se hace ahí. */
  joint?: string;
  field?: string;
  /** El arreglo, listo para aplicar con `applyReviewFix`. */
  action?: ReviewFix;
}

/** Un arreglo de la revisión: medidas nuevas para una unión, o una pieza más gruesa de un lado. */
export type ReviewFix = { label: string } & (
  | { kind: 'joint'; joints: string[]; params: Record<string, number> }
  | { kind: 'part'; part: string; axis: Axis; min: number; size: number }
  | { kind: 'grain'; part: string; axis: Axis }
);

/** Aplica el arreglo sobre el proyecto (o un borrador de él). Si lo que nombra ya no está, no hace nada. */
export function applyReviewFix(project: Pick<Project, 'parts' | 'joints'>, fix: ReviewFix): void {
  if (fix.kind === 'joint') {
    for (const j of project.joints) if (fix.joints.includes(j.id)) Object.assign(j.params, fix.params);
    return;
  }
  const part = project.parts.find((x) => x.id === fix.part);
  if (!part || part.base.kind !== 'box') return;
  if (fix.kind === 'grain') return void setGrain(part, fix.axis);
  part.position[fix.axis] = fix.min;
  part.base.size[fix.axis] = fix.size;
}

const lower = (s: string) => s.toLocaleLowerCase(locale());
const name = (p: Part) => lower(p.name);
const mm = (v: number) => `${Math.round(v)} mm`;

/** Ejes de una caja, del más largo al más corto. */
const axesBySize = (b: Box): [Axis, Axis, Axis] => {
  const s = boxSize(b);
  return ([0, 1, 2] as Axis[]).sort((x, y) => s[y] - s[x]) as [Axis, Axis, Axis];
};

/** Lo ancho de la pieza: el más grande de los dos ejes que no son la veta. */
const acrossGrain = (p: Part): Axis => {
  const g = grainAxis(p);
  return axesBySize(partBox(p)).find((k) => k !== g)!;
};

const solid = (p: Part) => p.base.kind === 'box' && !p.turning && !isSheet(p.wood);

// ── Veta cruzada ────────────────────────────────────────────────────────────

/** La madera maciza se mueve con la humedad, a lo ancho y casi nada a lo largo: en Buenos Aires, cerca de 1 % del ancho. */
export const MOVEMENT_SHARE = 0.01;
/** Desde este ancho el movimiento ya rompe una unión trabada. */
const MOVING_WIDTH = 200;
/** Lo que tienen que compartir las dos piezas sobre ese ancho para que la unión lo trabe. */
const LOCKED_SPAN = 150;
/**
 * Encastres que flotan o dejan correr la madera: no traban el ancho. A tope depende de cómo se sujete: con botones,
 * grampas en 8 o tornillos en agujero ovalado corre; encolada, atornillada fija o sin decir, no.
 */
const FLOATING = new Set<JointType>(['canal', 'machiembrado']);

/**
 * Las tapas y asientos macizos anchos que apoyan a tope sobre faldones, sujetos con algo que los deja correr: botones
 * si entran, si no grampas en 8. Es lo que hacen las plantillas; las uniones con una sujeción elegida no se tocan.
 */
export function holdTops(project: Pick<Project, 'parts' | 'joints'>): void {
  for (const j of project.joints) {
    if (j.type !== 'tope' || holdOf(j.params) !== 'libre') continue;
    const a = project.parts.find((p) => p.id === j.partA);
    const b = project.parts.find((p) => p.id === j.partB);
    if (!a || !b || !solid(a) || b.base.kind !== 'box' || boxSize(partBox(a))[acrossGrain(a)] < MOVING_WIDTH) continue;
    const hold = bestHold(partBox(a), partBox(b));
    if (hold) j.params.hold = HOLDS.indexOf(hold);
  }
}

/** Sujeción que deja correr la tapa en todas las uniones a tope de `wide` donde entra: botones, o si no, grampas. */
function holdFix(project: Project, wide: Part): ReviewFix | undefined {
  const plain = project.joints.filter((j) => j.type === 'tope' && j.partA === wide.id && !FLOATING_HOLDS.has(holdOf(j.params)));
  for (const hold of ['botones', 'grampas'] as Hold[]) {
    const joints = plain.filter((j) => {
      const b = project.parts.find((p) => p.id === j.partB);
      return b && b.base.kind === 'box' && holdFits(partBox(wide), partBox(b), hold);
    });
    if (joints.length)
      return {
        kind: 'joint',
        joints: joints.map((j) => j.id),
        params: { hold: HOLDS.indexOf(hold) },
        label: hold === 'botones' ? t('Sujetar con botones de madera') : t('Sujetar con grampas en 8'),
      };
  }
  return undefined;
}

/**
 * Pieza ancha encolada a otra cuya veta corre a lo ancho de la primera: la ancha quiere moverse y la otra no la deja.
 * Es la tapa maciza fija a un faldón lateral o el lateral fijo a una tapa con la veta de punta: se raja.
 */
function crossGrain(project: Project, j: Joint): ReviewNote | null {
  if (FLOATING.has(j.type)) return null;
  const a = project.parts.find((p) => p.id === j.partA);
  const b = project.parts.find((p) => p.id === j.partB);
  if (!a || !b || !solid(a) || !solid(b)) return null;
  // Apoyada en una muesca, o tomada con algo que la deja correr: no traba.
  const top = j.type === 'tope';
  if (top && (FLOATING_HOLDS.has(holdOf(j.params)) || !endJoint(partBox(a), partBox(b)))) return null;
  for (const [wide, other] of [
    [a, b],
    [b, a],
  ] as const) {
    const wb = partBox(wide);
    const ob = partBox(other);
    const across = acrossGrain(wide);
    const width = boxSize(wb)[across];
    if (width < MOVING_WIDTH || grainAxis(other) !== across) continue;
    const shared = Math.min(wb.max[across], ob.max[across]) - Math.max(wb.min[across], ob.min[across]);
    if (shared < LOCKED_SPAN) continue;
    const move = Math.max(1, Math.round(width * MOVEMENT_SHARE));
    const action = top && wide === a ? holdFix(project, wide) : undefined;
    if (action)
      // Una tapa apoyada: un solo aviso para toda la tapa, con el arreglo para todos sus faldones.
      return {
        id: `veta-tapa|${wide.id}`,
        kind: 'veta',
        parts: [wide.id, other.id],
        title: t('La tapa no se puede mover: {a}', { a: wide.name }),
        text: t(
          '{a} es maciza y mide {w} de ancho: con la humedad se mueve hasta {move} mm a lo ancho. Si la encolás o la atornillás fija a {b} y a los otros faldones, no la dejan moverse y se raja.',
          { a: wide.name, w: formatLength(width, project.units), move, b: name(other) },
        ),
        fix: t('Sujetala con botones de madera o grampas en 8: la toman firme contra los faldones y la dejan correr.'),
        action,
      };
    return {
      id: `veta|${j.id}`,
      kind: 'veta',
      parts: [wide.id, other.id],
      title: t('Veta cruzada: {a} y {b}', { a: wide.name, b: name(other) }),
      text: t(
        '{a} es maciza y mide {w} de ancho: con la humedad se mueve hasta {move} mm a lo ancho. {b} tiene la veta para ese lado y no se mueve: la unión con {joint} las traba y alguna se raja.',
        { a: wide.name, w: formatLength(width, project.units), move, b: other.name, joint: lower(t(JOINT_NAMES[j.type])) },
      ),
      fix: t('Uní las dos piezas a tope con botones de madera, grampas en 8 o tornillos en agujeros ovalados, para que la madera corra. O usá una placa, que no se mueve.'),
    };
  }
  return null;
}

// ── Veta corta ──────────────────────────────────────────────────────────────

/**
 * Pieza larga y angosta con la veta girada a lo ancho: la fibra queda corta y se parte con un golpe o al encolar. Pasa
 * cuando se gira la veta a mano en una pata, un travesaño o un listón.
 */
function shortGrainNotes(project: Project): ReviewNote[] {
  const notes: ReviewNote[] = [];
  for (const p of project.parts) {
    if (!shortGrain(p) || p.base.kind !== 'box') continue;
    const long = axesBySize(partBox(p))[0];
    notes.push({
      id: `veta-corta|${p.id}`,
      kind: 'veta',
      parts: [p.id],
      title: t('Veta corta: {a}', { a: p.name }),
      text: t('{a} mide {l} de largo pero la veta va a lo ancho, por los {w}: la fibra queda corta y la pieza se parte con poco esfuerzo.', {
        a: p.name,
        l: formatLength(p.base.size[long], project.units),
        w: formatLength(p.base.size[grainAxis(p)], project.units),
      }),
      fix: t('Poné la veta a lo largo de la pieza. Si buscabas la veta a lo ancho por el dibujo, usá una placa enchapada.'),
      action: { kind: 'grain', part: p.id, axis: long, label: t('Poner la veta a lo largo') },
    });
  }
  return notes;
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
  // Al medio milímetro, como se marca en el taller y como lo muestra Uniones.
  const third = Math.round((stock / 3) * 2) / 2;
  // Las paredes de la mortaja: lo que queda entre el agujero y las caras de la pieza que lo recibe.
  const walls = ([e.thin, e.wide] as Axis[]).flatMap((k) => [
    { axis: k, side: -1 as const, wall: g.mortise.min[k] - ba.min[k] },
    { axis: k, side: 1 as const, wall: ba.max[k] - g.mortise.max[k] },
  ]);
  const thinnest = walls.reduce((x, y) => (y.wall < x.wall ? y : x));
  const wall = thinnest.wall;
  if (wall < MIN_WALL) {
    // El arreglo: engrosar la pieza que recibe del lado de la pared fina, lo justo para dejar la pared mínima.
    const add = Math.ceil(MIN_WALL - wall);
    const k = thinnest.axis;
    const size = ba.max[k] - ba.min[k] + add;
    // Solo a lo grueso: alargar una pata para ganar pared arriba no es engrosarla. Una pata inclinada tampoco se toca.
    const along = axesBySize(ba)[0] === k;
    const leaning = !!a.lean && (a.lean[0] !== 0 || a.lean[1] !== 0);
    return {
      id: `espiga|${j.id}`,
      kind: 'espiga',
      parts: [a.id, b.id],
      title: t('Mortaja al borde en {name}', { name: name(a) }),
      text: t('La mortaja para {b} deja solo {w} de madera hasta la cara de {a}: se puede partir al encolar o con un golpe.', { b: name(b), w: mm(Math.max(0, wall)), a: name(a) }),
      fix: t('Dejá al menos {min} mm de pared: corré la pieza hacia adentro, hacé la espiga más fina o usá una pieza que reciba más gruesa.', { min: MIN_WALL }),
      joint: j.id,
      field: 'thickness',
      action: leaning || along
        ? undefined
        : {
            kind: 'part',
            part: a.id,
            axis: k,
            min: thinnest.side < 0 ? ba.min[k] - add : ba.min[k],
            size,
            label: t('Engrosar {name} a {size}', { name: name(a), size: formatLength(size, project.units) }),
          },
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
      joint: j.id,
      field: 'thickness',
      action: { kind: 'joint', joints: [j.id], params: { thickness: third }, label: t('Usar espiga de {third} mm', { third: third.toLocaleString(locale()) }) },
    };
  }
  // Una espiga muy ancha (un faldón alto): con la humedad la pieza se mueve a lo ancho y la mortaja larga debilita la
  // pata. Dos espigas con madera en el medio aguantan mejor.
  const width = g.tenon.max[e.wide] - g.tenon.min[e.wide];
  if ((params.count ?? 1) < 2 && width >= DOUBLE_TENON_FROM) {
    return {
      id: `espiga|${j.id}`,
      kind: 'espiga',
      parts: [b.id, a.id],
      title: t('Espiga ancha en {name}', { name: name(b) }),
      text: t('La espiga de {b} mide {w} de ancho: con la humedad la madera se mueve a lo ancho y una mortaja tan larga debilita {a}.', { b: name(b), w: mm(width), a: name(a) }),
      fix: t('Partila en dos: una espiga doble, con madera en el medio, se mueve menos y deja la pieza más fuerte.'),
      joint: j.id,
      field: 'count',
      action: { kind: 'joint', joints: [j.id], params: { count: 2, gap: defaultTenonGap(width) }, label: t('Hacer espiga doble') },
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
    // Una tapa fija a dos faldones laterales es un solo problema por par de piezas; una tapa apoyada, uno por tapa.
    const key = n && (n.action ? n.id : n.parts.join('|'));
    if (n && key && !seen.has(key)) {
      seen.add(key);
      notes.push(n);
    }
  }
  const tenons = project.joints.flatMap((j) => tenon(project, j) ?? []);
  // La misma espiga gruesa en las dos puntas de un travesaño se arregla de una vez: el botón va a las dos uniones, y
  // queda un solo aviso.
  const merged = new Set<ReviewNote>();
  for (const n of tenons) {
    const fix = n.action;
    if (merged.has(n) || fix?.kind !== 'joint') continue;
    const same = tenons.filter(
      (m) => m.action?.kind === 'joint' && m.parts[0] === n.parts[0] && m.action.params.thickness === fix.params.thickness && m.action.params.count === fix.params.count,
    );
    if (same.length < 2) continue;
    for (const m of same) if (m !== n) merged.add(m);
    fix.joints = same.map((m) => m.joint!);
    fix.label =
      fix.params.thickness !== undefined
        ? t('Usar espiga de {third} mm en las {n} uniones', { third: fix.params.thickness.toLocaleString(locale()), n: same.length })
        : t('Hacer espiga doble en las {n} uniones', { n: same.length });
  }
  notes.push(...tenons.filter((n) => !merged.has(n)));
  notes.push(...shortGrainNotes(project));
  notes.push(...sagging(project));
  return notes;
}

/** Los avisos que tocan a una pieza. */
export const partNotes = (notes: ReviewNote[], id: string) => notes.filter((n) => n.parts.includes(id));

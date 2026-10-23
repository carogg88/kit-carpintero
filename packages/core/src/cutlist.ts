import { boardFeet, LENGTHS_M, planedMm, stockFor, stockKind, type StockKind } from './catalog/boards';
import { boxSize, partBox, type Box } from './geometry';
import { isAngleCut } from './bevels';
import { arcInfo } from './pockets';
import { describeSection, sectionBox } from './sections';
import { describeTurning } from './turning';
import { jointGeometry, solidBox } from './joints';
import type { Joint, Part, Project } from './project';
import { t, tk } from './i18n';
import { sheetById } from './woods';
import { BANDING_MIN_MM, bandingWidth, exposedEdges, packSheets, sheetThicknessFor, type SheetBoard, type SheetPiece } from './sheets';

/** Corte de sierra, en mm. */
export const KERF_MM = 3;
/** Margen para escuadrar cada punta de una tabla, en mm. */
export const END_TRIM_MM = 10;

/** Una pieza a cortar: medidas en bruto de corte (con espigas y lengüetas) y lo que hay que hacerle. */
export interface CutPiece {
  part: Part;
  /** Largo, ancho y espesor de corte, de mayor a menor, en mm. */
  cut: [number, number, number];
  /** Cuánto se suma al largo terminado por espigas o lengüetas, en mm. */
  extraLength: number;
  /** Cuántas espigas o lengüetas lleva. */
  tongues: number;
  work: string[];
  /** Las notas de `work` que solo cuentan encastres ("2 mortajas"): donde se detalla cada encastre, sobran. */
  jointWork: string[];
  /** Cantos con tapacanto, de los largos y de los cortos (solo piezas de placa que lo llevan). */
  band?: [number, number];
}

/** Grupo de piezas iguales, como una fila de la lista de cortes. */
export interface CutRow {
  name: string;
  ids: string[];
  wood: string;
  cut: [number, number, number];
  extraLength: number;
  tongues: number;
  work: string[];
  /** Las notas de `work` que solo cuentan encastres. */
  jointWork: string[];
  /** Tablas a encolar de canto para llegar al ancho (1 si sale de una). */
  boards: number;
  /** Cantos con tapacanto, de los largos y de los cortos. */
  band?: [number, number];
}

const unionBox = (a: Box, b: Box): Box => ({
  min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
  max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
});

/** "{n} bisel" o "{n} biseles", traducido. */
const plural = (n: number, one: string, many: string) => t(n === 1 ? one : many, { n });

/** Trabajos que se cuentan por punta, no por pieza suelta: "dedos en 2 puntas". */
const BY_END: Record<string, [string, string]> = {
  'pines de cola de milano': [tk('pines de cola de milano'), tk('pines de cola de milano en {n} puntas')],
  'colas de milano': [tk('colas de milano'), tk('colas de milano en {n} puntas')],
  dedos: [tk('dedos'), tk('dedos en {n} puntas')],
};

/** Cómo se cuenta cada trabajo: una y varias. */
const WORK_NAMES: Record<string, [string, string]> = {
  mortaja: [tk('{n} mortaja'), tk('{n} mortajas')],
  espiga: [tk('{n} espiga'), tk('{n} espigas')],
  canal: [tk('{n} canal'), tk('{n} canales')],
  'lengüeta de canal': [tk('{n} lengüeta para canal'), tk('{n} lengüetas para canal')],
  rebaje: [tk('{n} rebaje'), tk('{n} rebajes')],
  'lengüeta de rebaje': [tk('{n} lengüeta para rebaje'), tk('{n} lengüetas para rebaje')],
  'media madera': [tk('{n} corte a media madera'), tk('{n} cortes a media madera')],
  tarugo: [tk('{n} agujero para tarugo'), tk('{n} agujeros para tarugos')],
  'rebaje de brida': [tk('{n} rebaje de brida'), tk('{n} rebajes de brida')],
  'horquilla de brida': [tk('{n} horquilla de brida'), tk('{n} horquillas de brida')],
  inglete: [tk('{n} inglete'), tk('{n} ingletes')],
  'ranura para galleta': [tk('{n} ranura para galleta'), tk('{n} ranuras para galletas')],
  'canal de machimbre': [tk('{n} canal de machimbre'), tk('{n} canales de machimbre')],
  'lengüeta de machimbre': [tk('{n} lengüeta de machimbre'), tk('{n} lengüetas de machimbre')],
  'agujero de bolsillo': [tk('{n} agujero de bolsillo'), tk('{n} agujeros de bolsillo')],
};

/** Medidas de corte y trabajos de una pieza, según sus encastres. */
export function cutPiece(part: Part, project: Project): CutPiece {
  const box = partBox(part);
  let outer = box;
  // Un tramo más grueso pide una tabla más gruesa: la pieza se corta del tamaño mayor y se rebaja el resto.
  for (const sec of part.sections) outer = unionBox(outer, sectionBox(part, sec));
  let tongues = 0;
  const counts = new Map<string, number>();
  const add = (k: string, n = 1) => counts.set(k, (counts.get(k) ?? 0) + n);
  for (const j of project.joints) {
    if (j.partA !== part.id && j.partB !== part.id) continue;
    const other = project.parts.find((p) => p.id === (j.partA === part.id ? j.partB : j.partA));
    const a = j.partA === part.id ? part : other;
    const b = j.partB === part.id ? part : other;
    if (!a || !b || a.base.kind !== 'box' || b.base.kind !== 'box') continue;
    const g = jointGeometry(j.type, partBox(a), partBox(b), j.params);
    const isA = j.partA === part.id;
    if (g && !isA) {
      for (const s of g.addB) outer = unionBox(outer, solidBox(s));
      if (g.addB.length) tongues += 1;
    }
    const p = { ...j.params };
    switch (j.type) {
      case 'mortaja':
        add(isA ? 'mortaja' : 'espiga');
        break;
      case 'canal':
        add(isA ? 'canal' : 'lengüeta de canal');
        break;
      case 'rebaje':
        add(isA ? 'rebaje' : 'lengüeta de rebaje');
        break;
      case 'media-madera':
        add('media madera');
        break;
      case 'clavija':
        add('tarugo', g?.cutA.length ?? p.count ?? 0);
        break;
      case 'cola-milano':
        add(isA ? 'pines de cola de milano' : 'colas de milano');
        break;
      case 'dedos':
        add('dedos');
        break;
      case 'brida':
        add(isA ? 'rebaje de brida' : 'horquilla de brida');
        break;
      case 'inglete':
        add('inglete');
        break;
      case 'galleta':
        add('ranura para galleta', g ? (isA ? g.cutA.length : g.cutB.length) : (p.count ?? 0));
        break;
      case 'machiembrado':
        add(isA ? 'canal de machimbre' : 'lengüeta de machimbre');
        break;
      case 'bolsillo':
        if (!isA) add('agujero de bolsillo', (g?.cutB.length ?? 0) / 2);
        break;
      default:
        break;
    }
  }
  const work: string[] = [];
  for (const [k, n] of counts) {
    const byEnd = BY_END[k];
    if (k === 'espiga' && n === 2) work.push(t('espiga en cada punta'));
    else if (byEnd) work.push(n === 1 ? t(byEnd[0]) : t(byEnd[1], { n }));
    else {
      const names = WORK_NAMES[k];
      work.push(names ? plural(n, names[0], names[1]) : `${n} ${k}`);
    }
  }
  const jointWork = [...work];
  const plain = part.pockets.filter((p) => p.shape.kind !== 'arc');
  const through = plain.filter((p) => p.through).length;
  if (through) work.push(plural(through, tk('{n} calado'), tk('{n} calados')));
  if (plain.length - through) work.push(plural(plain.length - through, tk('{n} vaciado'), tk('{n} vaciados')));
  // Cada arco con su radio: es lo que se traza con el compás o la plantilla.
  for (const p of part.pockets) {
    if (p.shape.kind !== 'arc') continue;
    const r = Math.round(arcInfo(p.shape).radius);
    work.push(p.through ? t('corte en arco R {r} mm', { r }) : t('rebaje en arco R {r} mm', { r }));
  }
  const angled = part.bevels.filter((b) => isAngleCut(part, b)).length;
  if (angled) work.push(plural(angled, tk('{n} corte en ángulo'), tk('{n} cortes en ángulo')));
  const rounded = part.bevels.filter((b) => b.round);
  const flat = part.bevels.length - angled - rounded.length;
  if (flat) work.push(plural(flat, tk('{n} bisel'), tk('{n} biseles')));
  // Cada radio aparte: es la fresa o la plantilla que hay que tener.
  for (const r of [...new Set(rounded.map((b) => Math.round(b.da)))]) {
    const n = rounded.filter((b) => Math.round(b.da) === r).length;
    work.push(n === 1 ? t('{n} arista redondeada R {r} mm', { n, r }) : t('{n} aristas redondeadas R {r} mm', { n, r }));
  }
  if (part.turning) work.push(describeTurning(part, part.turning, (mm) => `${Math.round(mm)} mm`));
  for (const sec of part.sections) work.push(describeSection(sec, (mm) => `${Math.round(mm)} mm`).replace(/ mm × /, ' × '));
  const op = part.turning ? undefined : part.ops[0];
  if (op) work.push(op.kind === 'round' ? t('cantos redondeados {r} mm', { r: op.radius }) : t('cantos chaflanados {s} mm', { s: op.size }));
  const finished = [...boxSize(box)].sort((x, y) => y - x);
  const cut = [...boxSize(outer)].sort((x, y) => y - x) as [number, number, number];
  const sheet = sheetById(part.wood);
  let band: [number, number] | undefined;
  if (sheet) {
    // La placa no se cepilla: si la pieza no tiene un espesor de placa, se avisa de cuál sale.
    const from = sheetThicknessFor(sheet, cut[2]);
    if (from !== null && Math.abs(from - cut[2]) > 0.5) work.push(t('sale de placa de {s} mm', { s: from }));
    if (sheet.banding && cut[2] >= BANDING_MIN_MM) {
      band = exposedEdges(part, project.parts);
      const n = band[0] + band[1];
      if (n) work.push(plural(n, tk('tapacanto en {n} canto'), tk('tapacanto en {n} cantos')));
    }
  }
  return { part, cut, extraLength: Math.round((cut[0] - (finished[0] ?? 0)) * 2) / 2, tongues, work, jointWork, ...(band ? { band } : {}) };
}

/**
 * Nombre común de un grupo: las palabras con que empiezan todos ("Pata", "Faldón"). Si no comparten ninguna,
 * las primeras palabras de cada uno ("Faldón y travesaño"): nombrar solo a uno confunde.
 */
function commonName(names: string[]): string {
  const words = names.map((n) => n.split(' '));
  const first = words[0] ?? [];
  const common: string[] = [];
  for (let i = 0; i < first.length; i++) {
    if (words.every((w) => w[i] === first[i])) common.push(first[i]!);
    else break;
  }
  if (common.length) return common.join(' ');
  const kinds = [...new Set(words.map((w) => (w[0] ?? '').toLocaleLowerCase()))];
  const joined = kinds.length > 1 ? t('{a} y {b}', { a: kinds.slice(0, -1).join(', '), b: kinds[kinds.length - 1]! }) : (kinds[0] ?? '');
  return joined.charAt(0).toLocaleUpperCase() + joined.slice(1);
}

/** Lista de cortes: piezas iguales (mismas medidas, madera y trabajo) en una fila. */
export function cutList(project: Project): CutRow[] {
  const pieces = project.parts.filter((p) => p.base.kind === 'box').map((p) => cutPiece(p, project));
  const groups = new Map<string, CutPiece[]>();
  for (const c of pieces) {
    const key = JSON.stringify([c.cut.map((v) => Math.round(v)), c.part.wood, c.extraLength, c.work]);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const rows = [...groups.values()].map((g) => {
    const c = g[0]!;
    const stock = sheetById(c.part.wood) ? null : stockFor(c.cut);
    const work = stock && stock.boards > 1 ? [t('encolar {n} tiras', { n: stock.boards }), ...c.work] : c.work;
    return {
      name: g.length > 1 ? commonName(g.map((x) => x.part.name)) : c.part.name,
      ids: g.map((x) => x.part.id),
      wood: c.part.wood,
      cut: c.cut,
      extraLength: c.extraLength,
      tongues: c.tongues,
      work,
      jointWork: c.jointWork,
      boards: stock?.boards ?? 1,
      ...(c.band ? { band: c.band } : {}),
    };
  });
  // Filas con el mismo nombre ("Faldón" y "Faldón"): se distinguen por el largo.
  const byName = new Map<string, CutRow[]>();
  for (const r of rows) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  for (const same of byName.values()) {
    if (same.length < 2) continue;
    const sorted = [...same].sort((x, y) => y.cut[0] - x.cut[0]);
    sorted.forEach((r, i) => {
      const name = r.name;
      r.name = sorted.length === 2 ? (i === 0 ? t('{name} largo', { name }) : t('{name} corto', { name })) : `${name} ${i + 1}`;
    });
  }
  return rows;
}

/** Un trozo dentro de una tabla del plan de corte. */
export interface CutSlot {
  id: string;
  length: number;
  /** Ancho que ocupa en la tabla (menor que el de la tabla si se corta a lo ancho). */
  width: number;
  /** Trozos más angostos que salen al lado, en el mismo tramo de la tabla, cortando a lo largo. */
  beside?: CutSlot[];
}

/** Una tabla o tirante a comprar y cómo cortarla. */
export interface StockBoard {
  wood: string;
  kind: StockKind;
  thicknessIn: number;
  widthIn: number;
  lengthM: number;
  slots: CutSlot[];
  /** Largo usado, con cortes de sierra y margen, en mm. */
  used: number;
}

export interface CutPlan {
  boards: StockBoard[];
  /** Placas a comprar, con sus piezas. */
  sheets: SheetBoard[];
  /** Piezas que no entran en ningún largo comercial. */
  tooLong: string[];
  /** Piezas de placa que no salen de una placa entera, o más gruesas que la placa más gruesa. */
  tooBig: string[];
  /** Tapacanto a comprar: placa, ancho en mm y metros. */
  banding: { material: string; width: number; meters: number }[];
  /** Pies madereros por madera. */
  feet: Record<string, number>;
  /** Desperdicio: madera comprada que no termina en piezas, de 0 a 1. */
  waste: number;
}

const MAX_LENGTH = Math.max(...LENGTHS_M) * 1000;

/** Todos los trozos de una tabla, también los que salen al lado de otro. */
export const boardPieces = (b: StockBoard): CutSlot[] => b.slots.flatMap((s) => [s, ...(s.beside ?? [])]);

interface Piece {
  slot: CutSlot;
  /** Ancho de la tabla comercial que le corresponde sola. */
  widthIn: number;
}

/** Reparte trozos en tablas de `widthIn`: los angostos se ponen uno al lado del otro, los más largos primero. */
function packBoards(wood: string, thicknessIn: number, widthIn: number, pieces: CutSlot[], rip: boolean): StockBoard[] {
  const wide = planedMm(widthIn);
  const segments: { slot: CutSlot; used: number }[] = [];
  for (const s of [...pieces].sort((x, y) => y.length - x.length || y.width - x.width)) {
    const seg = rip ? segments.find((g) => g.used + KERF_MM + s.width <= wide && s.length <= g.slot.length) : undefined;
    if (seg) {
      seg.slot.beside = [...(seg.slot.beside ?? []), { ...s }];
      seg.used += KERF_MM + s.width;
    } else segments.push({ slot: { ...s }, used: s.width });
  }
  const bins: { slots: CutSlot[]; used: number }[] = [];
  for (const { slot } of segments) {
    const need = slot.length + KERF_MM;
    const bin = bins.find((b) => b.used + need <= MAX_LENGTH);
    if (bin) {
      bin.slots.push(slot);
      bin.used += need;
    } else bins.push({ slots: [slot], used: 2 * END_TRIM_MM + need });
  }
  return bins.map((b) => ({
    wood,
    kind: stockKind(thicknessIn, widthIn),
    thicknessIn,
    widthIn,
    lengthM: LENGTHS_M.find((m) => m * 1000 >= b.used) ?? MAX_LENGTH / 1000,
    slots: b.slots,
    used: b.used,
  }));
}

const boughtVolume = (boards: StockBoard[]) => boards.reduce((v, b) => v + planedMm(b.thicknessIn) * planedMm(b.widthIn) * b.lengthM * 1000, 0);

/**
 * Las piezas de una madera y un espesor: cada sección en su tabla, o las angostas sacadas a lo largo de una tabla
 * más ancha que igual se compra. Se queda con lo que menos madera hace comprar.
 */
function packThickness(wood: string, thicknessIn: number, pieces: Piece[]): StockBoard[] {
  const bySection = (list: Piece[]) => {
    const widths = [...new Set(list.map((p) => p.widthIn))].sort((x, y) => x - y);
    return widths.flatMap((w) =>
      packBoards(
        wood,
        thicknessIn,
        w,
        list.filter((p) => p.widthIn === w).map((p) => p.slot),
        false,
      ),
    );
  };
  let best = bySection(pieces);
  for (const w of new Set(pieces.map((p) => p.widthIn))) {
    const fits = pieces.filter((p) => p.widthIn <= w);
    if (fits.length === pieces.filter((p) => p.widthIn === w).length) continue;
    const option = [...packBoards(wood, thicknessIn, w, fits.map((p) => p.slot), true), ...bySection(pieces.filter((p) => p.widthIn > w))];
    const [a, b] = [boughtVolume(option), boughtVolume(best)];
    if (a < b - 1 || (Math.abs(a - b) <= 1 && option.length < best.length)) best = option;
  }
  return best;
}

/**
 * Piezas finas que salen de una tabla más gruesa de la misma madera: dos listones de 34 cm salen del tirante de las
 * patas (cepillándolos a su espesor), en lugar de comprar otro listón entero para ellos. Se pasa una tabla entera, y
 * solo si así se compra menos madera.
 */
function useLeftovers(boards: StockBoard[]): StockBoard[] {
  const out = [...boards];
  const volume = (b: StockBoard, lengthM = b.lengthM) => planedMm(b.thicknessIn) * planedMm(b.widthIn) * lengthM * 1000;
  for (const thin of [...boards].sort((x, y) => x.thicknessIn - y.thicknessIn)) {
    const need = thin.slots.reduce((n, s) => n + s.length + KERF_MM, 0);
    const widest = Math.max(...thin.slots.map((s) => s.width + (s.beside ?? []).reduce((w, x) => w + KERF_MM + x.width, 0)));
    // La tabla gruesa puede pasar al largo comercial siguiente, si eso hace comprar menos madera que la tabla fina.
    let best: { host: StockBoard; lengthM: number; extra: number } | null = null;
    for (const b of out) {
      if (b === thin || b.wood !== thin.wood || b.thicknessIn <= thin.thicknessIn || planedMm(b.widthIn) < widest) continue;
      const lengthM = LENGTHS_M.find((m) => m * 1000 >= b.used + need);
      if (!lengthM) continue;
      const extra = volume(b, lengthM) - volume(b);
      if (extra < volume(thin) && (!best || extra < best.extra)) best = { host: b, lengthM, extra };
    }
    if (!best) continue;
    best.host.slots.push(...thin.slots);
    best.host.used += need;
    best.host.lengthM = Math.max(best.host.lengthM, best.lengthM);
    out.splice(out.indexOf(thin), 1);
  }
  return out;
}

/**
 * Plan de corte: reparte los trozos en tablas comerciales, los más largos primero, y achica cada tabla al largo
 * comercial más corto que alcanza. Las piezas angostas pueden salir a lo largo de una tabla más ancha del mismo
 * espesor (dos travesaños de una tabla de 4″), si así se compra menos madera.
 */
export function cutPlan(project: Project): CutPlan {
  const byThickness = new Map<string, { wood: string; t: number; pieces: Piece[] }>();
  const tooLong: string[] = [];
  const tooBig: string[] = [];
  const bySheet = new Map<string, { material: string; t: number; pieces: SheetPiece[] }>();
  const band = new Map<string, { material: string; width: number; mm: number }>();
  const sheetVolume = new Map<string, number>();
  let piecesVolume = 0;
  for (const c of project.parts.filter((p) => p.base.kind === 'box').map((p) => cutPiece(p, project))) {
    const sheet = sheetById(c.part.wood);
    if (sheet) {
      const th = sheetThicknessFor(sheet, c.cut[2]);
      if (th === null) {
        tooBig.push(c.part.id);
        continue;
      }
      sheetVolume.set(c.part.id, c.cut[0] * c.cut[1] * c.cut[2]);
      const key = `${sheet.id}|${th}`;
      const g = bySheet.get(key) ?? { material: sheet.id, t: th, pieces: [] };
      g.pieces.push({ id: c.part.id, length: c.cut[0], width: c.cut[1] });
      bySheet.set(key, g);
      if (c.band && c.band[0] + c.band[1] > 0) {
        const width = bandingWidth(th);
        const b = band.get(`${sheet.id}|${width}`) ?? { material: sheet.id, width, mm: 0 };
        // Cada canto lleva 5 cm de más para recortar las puntas.
        b.mm += c.band[0] * (c.cut[0] + 50) + c.band[1] * (c.cut[1] + 50);
        band.set(`${sheet.id}|${width}`, b);
      }
      continue;
    }
    const stock = stockFor(c.cut);
    if (!stock || c.cut[0] + 2 * END_TRIM_MM > MAX_LENGTH) {
      tooLong.push(c.part.id);
      continue;
    }
    piecesVolume += c.cut[0] * c.cut[1] * c.cut[2];
    const key = `${c.part.wood}|${stock.thicknessIn}`;
    const g = byThickness.get(key) ?? { wood: c.part.wood, t: stock.thicknessIn, pieces: [] };
    // Una tapa encolada son varias tiras, cada una del ancho entero de la tabla.
    const width = stock.boards > 1 ? planedMm(stock.widthIn) : c.cut[1];
    for (let i = 0; i < stock.boards; i++) {
      g.pieces.push({ slot: { id: stock.boards > 1 ? `${c.part.id}·${i + 1}` : c.part.id, length: c.cut[0], width }, widthIn: stock.widthIn });
    }
    byThickness.set(key, g);
  }
  const boards = useLeftovers([...byThickness.values()].flatMap((g) => packThickness(g.wood, g.t, g.pieces)));
  const sheets = [...bySheet.values()].flatMap((g) => {
    const r = packSheets(sheetById(g.material)!, g.t, g.pieces);
    tooBig.push(...r.tooBig);
    for (const b of r.boards) for (const p of b.placements) piecesVolume += sheetVolume.get(p.id) ?? 0;
    return r.boards;
  });

  const feet: Record<string, number> = {};
  for (const b of boards) feet[b.wood] = (feet[b.wood] ?? 0) + boardFeet(b.thicknessIn, b.widthIn, b.lengthM);
  const bought = boughtVolume(boards) + sheets.reduce((v, s) => v + s.size[0] * s.size[1] * s.thickness, 0);
  const banding = [...band.values()].map((b) => ({ material: b.material, width: b.width, meters: Math.ceil(b.mm / 1000) }));
  return { boards, sheets, tooLong, tooBig, banding, feet, waste: bought ? Math.max(0, 1 - piecesVolume / bought) : 0 };
}

/** Placas a comprar: las iguales juntas. */
export function sheetShopping(plan: CutPlan): { material: string; thickness: number; size: [number, number]; count: number }[] {
  const rows = new Map<string, { material: string; thickness: number; size: [number, number]; count: number }>();
  for (const s of plan.sheets) {
    const key = `${s.material}|${s.thickness}`;
    const r = rows.get(key) ?? { material: s.material, thickness: s.thickness, size: s.size, count: 0 };
    r.count += 1;
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => a.material.localeCompare(b.material) || b.thickness - a.thickness);
}

/** Lista de compras: tablas iguales juntas. */
export function shoppingList(plan: CutPlan): { wood: string; kind: StockKind; thicknessIn: number; widthIn: number; lengthM: number; count: number }[] {
  const rows = new Map<string, { wood: string; kind: StockKind; thicknessIn: number; widthIn: number; lengthM: number; count: number }>();
  for (const b of plan.boards) {
    const key = `${b.wood}|${b.thicknessIn}|${b.widthIn}|${b.lengthM}`;
    const r = rows.get(key) ?? { wood: b.wood, kind: b.kind, thicknessIn: b.thicknessIn, widthIn: b.widthIn, lengthM: b.lengthM, count: 0 };
    r.count += 1;
    rows.set(key, r);
  }
  return [...rows.values()];
}

/** Tarugos a comprar: diámetro y largo, con la cantidad. */
export function dowelsNeeded(project: Project): { diameter: number; length: number; count: number }[] {
  const rows = new Map<string, { diameter: number; length: number; count: number }>();
  for (const j of project.joints as Joint[]) {
    if (j.type !== 'clavija') continue;
    const a = project.parts.find((p) => p.id === j.partA);
    const b = project.parts.find((p) => p.id === j.partB);
    if (!a || !b) continue;
    const g = jointGeometry('clavija', partBox(a), partBox(b), j.params);
    const first = g?.cutA[0];
    const second = g?.cutB[0];
    if (!g || first?.kind !== 'cylinder' || second?.kind !== 'cylinder') continue;
    const diameter = first.radius * 2;
    const length = first.length + second.length - 2;
    const key = `${diameter}|${length}`;
    const r = rows.get(key) ?? { diameter, length, count: 0 };
    r.count += g.cutA.length;
    rows.set(key, r);
  }
  return [...rows.values()];
}

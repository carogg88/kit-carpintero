import { boardFeet, LENGTHS_M, planedMm, stockFor, stockKind, type StockKind } from './catalog/boards';
import { boxSize, partBox, type Box } from './geometry';
import { jointGeometry } from './joints';
import type { Joint, Part, Project } from './project';

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
  /** Tablas a encolar de canto para llegar al ancho (1 si sale de una). */
  boards: number;
}

const unionBox = (a: Box, b: Box): Box => ({
  min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
  max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
});

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Medidas de corte y trabajos de una pieza, según sus encastres. */
export function cutPiece(part: Part, project: Project): CutPiece {
  const box = partBox(part);
  let outer = box;
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
      for (const s of g.addB) if (s.kind === 'box') outer = unionBox(outer, s.box);
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
      default:
        break;
    }
  }
  const work: string[] = [];
  const names: Record<string, [string, string]> = {
    mortaja: ['mortaja', 'mortajas'],
    espiga: ['espiga', 'espigas'],
    canal: ['canal', 'canales'],
    'lengüeta de canal': ['lengüeta para canal', 'lengüetas para canal'],
    rebaje: ['rebaje', 'rebajes'],
    'lengüeta de rebaje': ['lengüeta para rebaje', 'lengüetas para rebaje'],
    'media madera': ['corte a media madera', 'cortes a media madera'],
    tarugo: ['agujero para tarugo', 'agujeros para tarugos'],
  };
  for (const [k, n] of counts) {
    const [one, many] = names[k] ?? [k, k];
    if (k === 'espiga' && n === 2) work.push('espiga en cada punta');
    else work.push(plural(n, one, many));
  }
  const op = part.ops[0];
  if (op) work.push(op.kind === 'round' ? `cantos redondeados ${op.radius} mm` : `cantos chaflanados ${op.size} mm`);
  const finished = [...boxSize(box)].sort((x, y) => y - x);
  const cut = [...boxSize(outer)].sort((x, y) => y - x) as [number, number, number];
  return { part, cut, extraLength: Math.round(cut[0] - (finished[0] ?? 0)), tongues, work };
}

/** Nombre común de un grupo: las palabras con que empiezan todos ("Pata", "Faldón"), o el primero. */
function commonName(names: string[]): string {
  const words = names.map((n) => n.split(' '));
  const first = words[0] ?? [];
  const common: string[] = [];
  for (let i = 0; i < first.length; i++) {
    if (words.every((w) => w[i] === first[i])) common.push(first[i]!);
    else break;
  }
  return common.length ? common.join(' ') : (names[0] ?? '');
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
    const stock = stockFor(c.cut);
    const work = stock && stock.boards > 1 ? [`encolar ${stock.boards} tablas`, ...c.work] : c.work;
    return {
      name: g.length > 1 ? commonName(g.map((x) => x.part.name)) : c.part.name,
      ids: g.map((x) => x.part.id),
      wood: c.part.wood,
      cut: c.cut,
      extraLength: c.extraLength,
      tongues: c.tongues,
      work,
      boards: stock?.boards ?? 1,
    };
  });
  // Filas con el mismo nombre ("Faldón" y "Faldón"): se distinguen por el largo.
  const byName = new Map<string, CutRow[]>();
  for (const r of rows) byName.set(r.name, [...(byName.get(r.name) ?? []), r]);
  for (const same of byName.values()) {
    if (same.length < 2) continue;
    const sorted = [...same].sort((x, y) => y.cut[0] - x.cut[0]);
    sorted.forEach((r, i) => {
      r.name = sorted.length === 2 ? `${r.name} ${i === 0 ? 'largo' : 'corto'}` : `${r.name} ${i + 1}`;
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
  /** Piezas que no entran en ningún largo comercial. */
  tooLong: string[];
  /** Pies madereros por madera. */
  feet: Record<string, number>;
  /** Desperdicio: madera comprada que no termina en piezas, de 0 a 1. */
  waste: number;
}

const MAX_LENGTH = Math.max(...LENGTHS_M) * 1000;

/**
 * Plan de corte: reparte los trozos de cada sección (madera, espesor y ancho) en tablas comerciales,
 * los más largos primero, y achica cada tabla al largo comercial más corto que alcanza.
 */
export function cutPlan(project: Project): CutPlan {
  const bySection = new Map<string, { wood: string; t: number; w: number; slots: CutSlot[] }>();
  const tooLong: string[] = [];
  let piecesVolume = 0;
  for (const c of project.parts.filter((p) => p.base.kind === 'box').map((p) => cutPiece(p, project))) {
    const stock = stockFor(c.cut);
    if (!stock || c.cut[0] + 2 * END_TRIM_MM > MAX_LENGTH) {
      tooLong.push(c.part.id);
      continue;
    }
    const key = `${c.part.wood}|${stock.thicknessIn}|${stock.widthIn}`;
    const sec = bySection.get(key) ?? { wood: c.part.wood, t: stock.thicknessIn, w: stock.widthIn, slots: [] };
    const width = stock.boards > 1 ? planedMm(stock.widthIn) : c.cut[1];
    for (let i = 0; i < stock.boards; i++) {
      sec.slots.push({ id: stock.boards > 1 ? `${c.part.id}·${i + 1}` : c.part.id, length: c.cut[0], width });
    }
    bySection.set(key, sec);
    piecesVolume += c.cut[0] * c.cut[1] * c.cut[2];
  }

  const boards: StockBoard[] = [];
  for (const sec of bySection.values()) {
    const bins: { slots: CutSlot[]; used: number }[] = [];
    for (const s of [...sec.slots].sort((x, y) => y.length - x.length)) {
      const need = s.length + KERF_MM;
      const bin = bins.find((b) => b.used + need <= MAX_LENGTH);
      if (bin) {
        bin.slots.push(s);
        bin.used += need;
      } else bins.push({ slots: [s], used: 2 * END_TRIM_MM + need });
    }
    for (const b of bins) {
      const lengthM = LENGTHS_M.find((m) => m * 1000 >= b.used) ?? MAX_LENGTH / 1000;
      boards.push({ wood: sec.wood, kind: stockKind(sec.t, sec.w), thicknessIn: sec.t, widthIn: sec.w, lengthM, slots: b.slots, used: b.used });
    }
  }

  const feet: Record<string, number> = {};
  let boughtVolume = 0;
  for (const b of boards) {
    feet[b.wood] = (feet[b.wood] ?? 0) + boardFeet(b.thicknessIn, b.widthIn, b.lengthM);
    boughtVolume += planedMm(b.thicknessIn) * planedMm(b.widthIn) * b.lengthM * 1000;
  }
  return { boards, tooLong, feet, waste: boughtVolume ? Math.max(0, 1 - piecesVolume / boughtVolume) : 0 };
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

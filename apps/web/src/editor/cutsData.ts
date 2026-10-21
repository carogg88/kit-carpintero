import {
  boardFeet,
  formatInches,
  formatNumber,
  woodAlternatives,
  woodById,
  type CutPlan,
  type CutRow,
  type Hardness,
  type Project,
  type StockKind,
} from '@kitc/core';

export type ShopRow = { wood: string; kind: StockKind; thicknessIn: number; widthIn: number; lengthM: number; count: number };

const KIND_PLURAL: Record<StockKind, string> = { tabla: 'tablas', listón: 'listones', tirante: 'tirantes' };
const HARDNESS_PLURAL: Record<Hardness, string> = { dura: 'duras', semidura: 'semiduras', blanda: 'blandas' };

export const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
export const decimal = (v: number, digits = 1) => v.toLocaleString('es-AR', { maximumFractionDigits: digits });
export const woodName = (id: string) => woodById(id)?.name ?? id;

/** "P1 a P4" si son correlativas, "F1, F2" si no. */
export function formatIds(ids: string[]): string {
  const m = ids.map((id) => id.match(/^(\D+)(\d+)$/));
  const prefix = m[0]?.[1];
  const nums = m.map((x) => (x && x[1] === prefix ? Number(x[2]) : NaN));
  const consecutive = ids.length > 2 && nums.every((v, i) => v === (nums[0] ?? 0) + i);
  return consecutive ? `${ids[0]} a ${ids[ids.length - 1]}` : ids.join(', ');
}

/** "Tabla 1″ × 6″ · 3,66 m". */
export const stockLabel = (r: Pick<ShopRow, 'kind' | 'thicknessIn' | 'widthIn' | 'lengthM'>) =>
  `${capitalize(r.kind)} ${formatInches(r.thicknessIn)} × ${formatInches(r.widthIn)} · ${decimal(r.lengthM, 2)} m`;

/** "3 tablas 1″ × 6″ de 3,66 m". */
export const stockCountLabel = (r: ShopRow) =>
  `${r.count} ${r.count === 1 ? r.kind : KIND_PLURAL[r.kind]} ${formatInches(r.thicknessIn)} × ${formatInches(r.widthIn)} de ${decimal(r.lengthM, 2)} m`;

export const shopKey = (r: Pick<ShopRow, 'wood' | 'thicknessIn' | 'widthIn' | 'lengthM'>) => `${r.wood}|${r.thicknessIn}|${r.widthIn}|${r.lengthM}`;

/** Para qué es cada compra: "Tapa: 7 tiras de 180 cm, encoladas · 18 pies". */
export function shopUse(r: ShopRow, plan: CutPlan, rows: CutRow[], project: Project): string {
  const slots = plan.boards.filter((b) => shopKey(b) === shopKey(r)).flatMap((b) => b.slots);
  const uses = new Map<CutRow, number>();
  for (const s of slots) {
    const row = rows.find((x) => x.ids.includes(s.id.split('·')[0] ?? ''));
    if (row) uses.set(row, (uses.get(row) ?? 0) + 1);
  }
  const unit = project.units === 'cm' ? ' cm' : '″';
  const parts = [...uses].map(([row, k]) => {
    const len = `${formatNumber(row.cut[0], project.units)}${unit}`;
    return row.boards > 1 ? `${row.name}: ${k} ${k === 1 ? 'tira' : 'tiras'} de ${len}, encoladas` : `${row.name}: ${k} de ${len}`;
  });
  const feet = boardFeet(r.thicknessIn, r.widthIn, r.lengthM) * r.count;
  return `${parts.join('; ')} · ${decimal(feet)} pies`;
}

/** "paraíso o cedro (semiduras), lapacho o algarrobo (duras)". */
export function alternativesText(id: string): string {
  const groups = new Map<Hardness, string[]>();
  for (const w of woodAlternatives(id)) groups.set(w.hardness, [...(groups.get(w.hardness) ?? []), w.name.toLocaleLowerCase('es')]);
  return [...groups].map(([h, names]) => `${names.join(' o ')} (${HARDNESS_PLURAL[h]})`).join(', ');
}

const cell = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Planilla para abrir en Excel o Google Sheets (separador ; y coma decimal, como en Argentina). */
export function cutsCsv(project: Project, rows: CutRow[], shop: ShopRow[]): string {
  const u = project.units === 'cm' ? 'cm' : 'pulgadas';
  const n = (mm: number) => formatNumber(mm, project.units);
  const lines: (string | number)[][] = [
    [project.name, 'Lista de cortes'],
    [],
    ['Pieza', 'Piezas', 'Cantidad', `Largo de corte (${u})`, `Ancho (${u})`, `Espesor (${u})`, 'Madera', 'Trabajo'],
    ...rows.map((r) => [r.name, r.ids.join(' '), r.ids.length, n(r.cut[0]), n(r.cut[1]), n(r.cut[2]), woodName(r.wood), r.work.join(', ')]),
    [],
    ['Para comprar'],
    ['Madera', 'Tipo', 'Espesor', 'Ancho', 'Largo (m)', 'Cantidad'],
    ...shop.map((s) => [woodName(s.wood), s.kind, formatInches(s.thicknessIn), formatInches(s.widthIn), decimal(s.lengthM, 2), s.count]),
  ];
  return '﻿' + lines.map((l) => l.map(cell).join(';')).join('\r\n') + '\r\n';
}

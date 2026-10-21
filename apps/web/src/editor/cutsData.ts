import {
  boardFeet,
  formatInches,
  formatNumber,
  getLang,
  locale,
  t,
  tk,
  woodAlternatives,
  woodById,
  type CutPlan,
  type CutRow,
  type Hardness,
  type Project,
  type StockKind,
} from '@kitc/core';

export type ShopRow = { wood: string; kind: StockKind; thicknessIn: number; widthIn: number; lengthM: number; count: number };

const KIND_NAME: Record<StockKind, string> = { tabla: tk('tabla'), listón: tk('listón'), tirante: tk('tirante') };
const KIND_PLURAL: Record<StockKind, string> = { tabla: tk('tablas'), listón: tk('listones'), tirante: tk('tirantes') };
const HARDNESS_PLURAL: Record<Hardness, string> = { dura: tk('duras'), semidura: tk('semiduras'), blanda: tk('blandas') };

/** Tipo de madera para mostrar: "tabla", "listón"… en el idioma actual. */
export const kindName = (kind: StockKind) => t(KIND_NAME[kind]);

export const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);
export const decimal = (v: number, digits = 1) => v.toLocaleString(locale(), { maximumFractionDigits: digits });
export const woodName = (id: string) => {
  const name = woodById(id)?.name;
  return name ? t(name) : id;
};

/** "P1 a P4" si son correlativas, "F1, F2" si no. */
export function formatIds(ids: string[]): string {
  const m = ids.map((id) => id.match(/^(\D+)(\d+)$/));
  const prefix = m[0]?.[1];
  const nums = m.map((x) => (x && x[1] === prefix ? Number(x[2]) : NaN));
  const consecutive = ids.length > 2 && nums.every((v, i) => v === (nums[0] ?? 0) + i);
  return consecutive ? t('{a} a {b}', { a: ids[0]!, b: ids[ids.length - 1]! }) : ids.join(', ');
}

/** "Tabla 1″ × 6″ · 3,66 m". */
export const stockLabel = (r: Pick<ShopRow, 'kind' | 'thicknessIn' | 'widthIn' | 'lengthM'>) =>
  `${capitalize(kindName(r.kind))} ${formatInches(r.thicknessIn)} × ${formatInches(r.widthIn)} · ${decimal(r.lengthM, 2)} m`;

/** "3 tablas 1″ × 6″ de 3,66 m". */
export const stockCountLabel = (r: ShopRow) =>
  t('{n} {kind} {thick} × {wide} de {len} m', {
    n: r.count,
    kind: r.count === 1 ? kindName(r.kind) : t(KIND_PLURAL[r.kind]),
    thick: formatInches(r.thicknessIn),
    wide: formatInches(r.widthIn),
    len: decimal(r.lengthM, 2),
  });

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
    if (row.boards <= 1) return t('{name}: {k} de {len}', { name: row.name, k, len });
    return k === 1 ? t('{name}: {k} tira de {len}, encoladas', { name: row.name, k, len }) : t('{name}: {k} tiras de {len}, encoladas', { name: row.name, k, len });
  });
  const feet = boardFeet(r.thicknessIn, r.widthIn, r.lengthM) * r.count;
  return t('{uses} · {feet} pies', { uses: parts.join('; '), feet: decimal(feet) });
}

/** "paraíso o cedro (semiduras), lapacho o algarrobo (duras)". */
export function alternativesText(id: string): string {
  const groups = new Map<Hardness, string[]>();
  for (const w of woodAlternatives(id)) groups.set(w.hardness, [...(groups.get(w.hardness) ?? []), t(w.name).toLocaleLowerCase(locale())]);
  return [...groups].map(([h, names]) => `${names.reduce((a, b) => t('{a} o {b}', { a, b }))} (${t(HARDNESS_PLURAL[h])})`).join(', ');
}

const cell = (v: string | number, sep: string) => {
  const s = String(v);
  return s.includes(sep) || /["\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Planilla para abrir en Excel o Google Sheets: en español, separador ; y coma decimal, como en Argentina;
 * en inglés, separador , y punto decimal.
 */
export function cutsCsv(project: Project, rows: CutRow[], shop: ShopRow[]): string {
  const sep = getLang() === 'en' ? ',' : ';';
  const u = project.units === 'cm' ? 'cm' : t('pulgadas');
  const n = (mm: number) => formatNumber(mm, project.units);
  const lines: (string | number)[][] = [
    [project.name, t('Lista de cortes')],
    [],
    [
      t('Pieza'),
      t('Piezas'),
      t('Cantidad'),
      t('Largo de corte ({u})', { u }),
      t('Ancho ({u})', { u }),
      t('Espesor ({u})', { u }),
      t('Madera'),
      t('Trabajo'),
    ],
    ...rows.map((r) => [r.name, r.ids.join(' '), r.ids.length, n(r.cut[0]), n(r.cut[1]), n(r.cut[2]), woodName(r.wood), r.work.join(', ')]),
    [],
    [t('Para comprar')],
    [t('Madera'), t('Tipo'), t('Espesor'), t('Ancho'), t('Largo (m)'), t('Cantidad')],
    ...shop.map((s) => [woodName(s.wood), kindName(s.kind), formatInches(s.thicknessIn), formatInches(s.widthIn), decimal(s.lengthM, 2), s.count]),
  ];
  return '﻿' + lines.map((l) => l.map((v) => cell(v, sep)).join(sep)).join('\r\n') + '\r\n';
}

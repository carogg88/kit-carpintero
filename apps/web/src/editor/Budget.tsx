import { useId, useState } from 'react';
import { getLang, locale, t, tk, WOODS, type CutPlan, type HardwareRow, type HardwareUnit } from '@kitc/core';
import { decimal, qtyLabel, sheetKey, sheetLabel, woodName, type SheetRow } from './cutsData';
import styles from './Sections.module.css';

/**
 * Presupuesto: precios que carga cada uno (de su maderera, su casa de placas y su ferretería) por pie,
 * por placa y por herraje. Quedan guardados en el navegador para los próximos proyectos.
 */

const PRICES_KEY = 'kitc.precios';
/** El precio por pie de antes, uno solo para todas las maderas. */
const OLD_FEET_KEY = 'kitc.precioPie';

function readPrices(): Record<string, string> {
  try {
    const v = localStorage.getItem(PRICES_KEY);
    if (v) return JSON.parse(v) as Record<string, string>;
    const old = localStorage.getItem(OLD_FEET_KEY);
    return old ? { 'pie|*': JSON.parse(old) as string } : {};
  } catch {
    return {};
  }
}

export function usePrices() {
  const [prices, set] = useState(readPrices);
  const setPrice = (key: string, value: string) => {
    const next = { ...prices, [key]: value };
    set(next);
    try {
      localStorage.setItem(PRICES_KEY, JSON.stringify(next));
    } catch {
      // Sin almacenamiento: los precios viven mientras la página esté abierta.
    }
  };
  return [prices, setPrice] as const;
}

/** En español el punto separa miles y la coma los decimales; en inglés, al revés. */
export function parsePrice(text: string | undefined): number | null {
  if (!text) return null;
  const v = Number(getLang() === 'en' ? text.replace(/,/g, '') : text.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export const money = (v: number) => `$ ${Math.round(v).toLocaleString(locale())}`;

const PER_UNIT: Record<HardwareUnit, string> = { u: tk('por unidad'), par: tk('por par'), m: tk('por metro'), hoja: tk('por hoja'), l: tk('por litro') };

export interface BudgetLine {
  key: string;
  label: string;
  qty: string;
  per: string;
  amount: number;
  /** Clave del precio, y la de respaldo si no hay uno propio (el precio por pie de antes). */
  priceKey: string;
  fallbackKey?: string;
}

export interface BudgetGroup {
  title: string;
  lines: BudgetLine[];
}

/** Las filas del presupuesto: madera por pie, placas por unidad y herrajes por lo que se compran. */
export function budgetGroups(plan: CutPlan, sheets: SheetRow[], hardware: HardwareRow[]): BudgetGroup[] {
  const groups: BudgetGroup[] = [];
  const woods = Object.entries(plan.feet);
  if (woods.length) {
    groups.push({
      title: t('Madera maciza'),
      lines: woods.map(([w, feet]) => ({
        key: `pie|${w}`,
        label: woodName(w),
        qty: t('{n} pies', { n: decimal(feet) }),
        per: t('por pie'),
        amount: feet,
        priceKey: `pie|${w}`,
        fallbackKey: 'pie|*',
      })),
    });
  }
  if (sheets.length) {
    groups.push({
      title: t('Placas'),
      lines: sheets.map((s) => ({ key: sheetKey(s), label: sheetLabel(s), qty: t(s.count === 1 ? tk('{n} placa') : tk('{n} placas'), { n: s.count }), per: t('por placa'), amount: s.count, priceKey: sheetKey(s) })),
    });
  }
  if (hardware.length) {
    groups.push({
      title: t('Herrajes y consumibles'),
      lines: hardware.map((h) => ({ key: `herraje|${h.id}`, label: h.name, qty: qtyLabel(h), per: t(PER_UNIT[h.unit]), amount: h.qty, priceKey: `herraje|${h.id}` })),
    });
  }
  return groups;
}

export function budgetTotal(groups: BudgetGroup[], prices: Record<string, string>): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const l of groups.flatMap((g) => g.lines)) {
    const p = parsePrice(prices[l.priceKey]) ?? (l.fallbackKey ? parsePrice(prices[l.fallbackKey]) : null);
    if (p === null) missing += 1;
    else total += p * l.amount;
  }
  return { total, missing };
}

function PriceInput({ line, prices, onChange }: { line: BudgetLine; prices: Record<string, string>; onChange: (key: string, v: string) => void }) {
  const id = useId();
  const own = prices[line.priceKey];
  const fallback = line.fallbackKey ? prices[line.fallbackKey] : undefined;
  return (
    <label className={styles.priceField} htmlFor={id}>
      <span className={styles.srOnly}>{t('Precio de {item}, {per}', { item: line.label, per: line.per })}</span>
      <span aria-hidden="true">$</span>
      <input id={id} inputMode="decimal" placeholder={fallback ?? '—'} value={own ?? ''} onChange={(e) => onChange(line.priceKey, e.target.value)} />
    </label>
  );
}

export function BudgetPanel({
  groups,
  prices,
  setPrice,
  feet,
  projectWoods,
}: {
  groups: BudgetGroup[];
  prices: Record<string, string>;
  setPrice: (key: string, v: string) => void;
  feet: number;
  projectWoods: string[];
}) {
  const { total, missing } = budgetTotal(groups, prices);
  const price = (l: BudgetLine) => parsePrice(prices[l.priceKey]) ?? (l.fallbackKey ? parsePrice(prices[l.fallbackKey]) : null);
  return (
    <div className={styles.budget}>
      {groups.map((g) => (
        <section key={g.title} className={styles.budgetGroup} aria-label={g.title}>
          <h2 className={styles.eyebrow}>{g.title}</h2>
          <ul>
            {g.lines.map((l) => {
              const p = price(l);
              return (
                <li key={l.key} className={styles.budgetRow}>
                  <span className={styles.budgetItem}>
                    <strong>{l.label}</strong>
                    <span className={styles.muted}>{l.qty}</span>
                  </span>
                  <span className={styles.budgetPrice}>
                    <PriceInput line={l} prices={prices} onChange={setPrice} />
                    <span className={styles.muted}>{l.per}</span>
                  </span>
                  <span className={styles.budgetAmount}>{p === null ? '—' : money(p * l.amount)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className={styles.budgetTotal}>
        <span>{t('Total aproximado')}</span>
        <strong>{money(total)}</strong>
      </p>
      <p className={styles.muted}>
        {missing > 0
          ? t(missing === 1 ? tk('Falta el precio de 1 cosa: el total no la cuenta.') : tk('Falta el precio de {n} cosas: el total no las cuenta.'), { n: missing })
          : t('Están todos los precios.')}{' '}
        {t('Los precios quedan guardados en este dispositivo para tus próximos proyectos.')}
      </p>
      {feet > 0 && <WoodCompare feet={feet} prices={prices} setPrice={setPrice} projectWoods={projectWoods} />}
    </div>
  );
}

/** Cuánto saldría la madera maciza del proyecto en cada madera: los mismos pies, otro precio. */
function WoodCompare({ feet, prices, setPrice, projectWoods }: { feet: number; prices: Record<string, string>; setPrice: (key: string, v: string) => void; projectWoods: string[] }) {
  return (
    <section className={styles.budgetGroup} aria-labelledby="comparar-maderas">
      <h2 id="comparar-maderas" className={styles.eyebrow}>
        {t('Comparar maderas')}
      </h2>
      <p className={styles.muted}>{t('La madera maciza de este proyecto son {n} pies. Cargá el precio por pie de otras maderas para ver cuánto saldría.', { n: decimal(feet) })}</p>
      <ul>
        {WOODS.map((w) => {
          const mine = projectWoods.includes(w.id);
          // El precio por pie de antes era el de la madera del proyecto: no vale para las otras.
          const line: BudgetLine = { key: `pie|${w.id}`, label: t(w.name), qty: '', per: t('por pie'), amount: feet, priceKey: `pie|${w.id}`, ...(mine ? { fallbackKey: 'pie|*' } : {}) };
          const p = parsePrice(prices[line.priceKey]) ?? (mine ? parsePrice(prices['pie|*']) : null);
          return (
            <li key={w.id} className={`${styles.budgetRow} ${mine ? styles.budgetMine : ''}`}>
              <span className={styles.budgetItem}>
                <strong>{t(w.name)}</strong>
                {mine && <span className={styles.muted}>{t('la de este proyecto')}</span>}
              </span>
              <span className={styles.budgetPrice}>
                <PriceInput line={line} prices={prices} onChange={setPrice} />
                <span className={styles.muted}>{line.per}</span>
              </span>
              <span className={styles.budgetAmount}>{p === null ? '—' : money(p * feet)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

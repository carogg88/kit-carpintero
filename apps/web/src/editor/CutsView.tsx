import { useMemo, useState } from 'react';
import {
  cutList,
  cutPlan,
  dowelsNeeded,
  END_TRIM_MM,
  formatNumber,
  KERF_MM,
  planedMm,
  shoppingList,
  woodById,
  type CutRow,
  type Project,
  type StockBoard,
} from '@kitc/core';
import { IconDownload } from './icons';
import {
  alternativesText,
  capitalize,
  cutsCsv,
  decimal,
  formatIds,
  shopKey,
  shopUse,
  stockCountLabel,
  stockLabel,
  woodName,
  type ShopRow,
} from './cutsData';
import styles from './Sections.module.css';

/** Lectura y escritura del navegador que nunca rompe la página (modo privado, datos borrados). */
function readStored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: el dato vive mientras la página esté abierta.
  }
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileSlug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'proyecto';

function extraNote(r: CutRow, n: (mm: number) => string): string | null {
  if (r.extraLength <= 0) return null;
  const tenon = r.work.some((w) => w.includes('espiga'));
  const word = tenon ? (r.tongues === 1 ? 'espiga' : 'espigas') : r.tongues === 1 ? 'lengüeta' : 'lengüetas';
  return `${n(r.cut[0] - r.extraLength)} + ${r.tongues} ${word}`;
}

function CutTable({ rows, n }: { rows: CutRow[]; n: (mm: number) => string }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Pieza</th>
            <th scope="col" className={styles.num}>
              Cant.
            </th>
            <th scope="col" className={styles.num}>
              Largo de corte
            </th>
            <th scope="col" className={styles.num}>
              Ancho × espesor
            </th>
            <th scope="col">Madera</th>
            <th scope="col">Trabajo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const note = extraNote(r, n);
            return (
              <tr key={r.ids.join()}>
                <td>
                  <strong>{r.name}</strong>
                  <br />
                  <span className={styles.ids}>{formatIds(r.ids)}</span>
                </td>
                <td className={styles.num}>{r.ids.length}</td>
                <td className={styles.num}>
                  {n(r.cut[0])}
                  {note && <span className={styles.extra}>{note}</span>}
                </td>
                <td className={styles.num}>
                  {n(r.cut[1])} × {n(r.cut[2])}
                </td>
                <td>{woodName(r.wood)}</td>
                <td className={styles.workCell}>{capitalize(r.work.join(' · ')) || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CutCards({ rows, n, unit }: { rows: CutRow[]; n: (mm: number) => string; unit: string }) {
  return (
    <ul className={styles.cutCards}>
      {rows.map((r) => {
        const note = extraNote(r, n);
        return (
          <li key={r.ids.join()}>
            <div className={styles.cardHead}>
              <strong>{r.name}</strong>
              <span className={styles.ids}>{formatIds(r.ids)}</span>
              <span className={styles.qty}>× {r.ids.length}</span>
            </div>
            <span className={styles.cardDims}>
              {n(r.cut[0])} × {n(r.cut[1])} × {n(r.cut[2])}
              {unit}
            </span>
            {note && <span className={styles.extra}>Largo: {note}</span>}
            <span className={styles.muted}>
              {woodName(r.wood)}
              {r.work.length > 0 && ` · ${r.work.join(' · ')}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Una tabla comercial con sus trozos, a escala: pieza en color, sobrante rayado. */
function BoardDiagram({ board, n, showWood }: { board: StockBoard; n: (mm: number) => string; showWood: boolean }) {
  const total = board.lengthM * 1000;
  const width = planedMm(board.widthIn);
  const pct = (mm: number) => `${(mm / total) * 100}%`;
  const rest = Math.max(0, total - board.used);
  const description = `${board.slots.map((s) => `${s.id} de ${n(s.length)}`).join(', ')}; sobran ${n(rest)}`;
  return (
    <figure className={styles.board}>
      <figcaption>
        <strong>{stockLabel(board)}</strong>
        {showWood && <span> · {woodName(board.wood)}</span>}
      </figcaption>
      <div className={styles.boardBar} style={{ height: Math.min(64, Math.max(30, board.widthIn * 10)) }} role="img" aria-label={description}>
        <span className={styles.waste} style={{ flexBasis: pct(END_TRIM_MM) }} />
        {board.slots.map((s, i) => (
          <span key={`${s.id}-${i}`} className={styles.slot} style={{ flexBasis: pct(s.length), marginRight: pct(KERF_MM) }} title={`${s.id} · ${n(s.length)}`}>
            <span className={styles.piece} style={{ height: `${Math.min(100, (s.width / width) * 100)}%` }}>
              <span className={styles.pieceLabel}>
                {s.id} <span>{n(s.length)}</span>
              </span>
            </span>
            <span className={styles.waste} />
          </span>
        ))}
        <span className={styles.waste} style={{ flexGrow: 1 }} />
      </div>
    </figure>
  );
}

function ShopChecklist({ shop, plan, rows, project }: { shop: ShopRow[]; plan: ReturnType<typeof cutPlan>; rows: CutRow[]; project: Project }) {
  const key = `kitc.compras.${project.id}`;
  const [done, setDone] = useState<string[]>(() => readStored<string[]>(key, []));
  const toggle = (k: string, on: boolean) => {
    const next = on ? [...done, k] : done.filter((x) => x !== k);
    setDone(next);
    store(key, next);
  };
  const woods = [...new Set(shop.map((s) => s.wood))];
  return (
    <>
      {woods.map((w) => (
        <section key={w} className={styles.checkGroup} aria-label={`Madera: ${woodName(w)}`}>
          <h2 className={styles.eyebrow}>Madera · {woodName(w)}</h2>
          {shop
            .filter((s) => s.wood === w)
            .map((s) => {
              const k = shopKey(s);
              return (
                <label key={k} className={styles.checkCard}>
                  <input type="checkbox" checked={done.includes(k)} onChange={(e) => toggle(k, e.target.checked)} />
                  <span>
                    <strong>{stockCountLabel(s)}</strong>
                    <span className={styles.muted}>{shopUse(s, plan, rows, project)}</span>
                  </span>
                </label>
              );
            })}
        </section>
      ))}
    </>
  );
}

export function CutsView({ project }: { project: Project }) {
  const { rows, plan, shop, dowels } = useMemo(() => {
    const plan = cutPlan(project);
    return { rows: cutList(project), plan, shop: shoppingList(plan), dowels: dowelsNeeded(project) };
  }, [project]);
  const [price, setPrice] = useState(() => readStored<string>('kitc.precioPie', ''));
  const units = project.units;
  const unit = units === 'cm' ? ' cm' : '″';
  const n = (mm: number) => formatNumber(mm, units);

  const pieces = rows.reduce((s, r) => s + r.ids.length, 0);
  if (pieces === 0) {
    return (
      <main className={styles.empty}>
        <h1 className={styles.h1}>Todavía no hay piezas</h1>
        <p className={styles.muted}>Agregá piezas en el modelo y acá aparece qué cortar y qué comprar.</p>
      </main>
    );
  }

  const woods = Object.keys(plan.feet);
  const feet = Object.values(plan.feet).reduce((s, v) => s + v, 0);
  const feetLabel = woods.length === 1 ? `pies de ${woodName(woods[0]!).toLocaleLowerCase('es')}` : 'pies de madera';
  const priceValue = Number(price.replace(/\./g, '').replace(',', '.'));
  const total = priceValue > 0 ? Math.round(priceValue * feet) : null;
  const boardCount = shop.reduce((s, r) => s + r.count, 0);
  const glued = project.joints.some((j) => j.type !== 'tope') || rows.some((r) => r.boards > 1);
  const tooLong = plan.tooLong;
  const exportCsv = () => download(`${fileSlug(project.name)}-cortes.csv`, cutsCsv(project, rows, shop));

  const hardware = (
    <>
      <h2 className={styles.h3}>Herrajes y otros</h2>
      <ul className={styles.plainList}>
        {dowels.map((d) => (
          <li key={`${d.diameter}-${d.length}`}>
            <span>
              Tarugos de {d.diameter} mm × {formatNumber(d.length, units)}
              {unit}
            </span>
            <strong>× {d.count}</strong>
          </li>
        ))}
        {glued && (
          <li>
            <span>Cola vinílica para madera</span>
            <strong>{pieces > 20 ? '500 g' : '250 g'}</strong>
          </li>
        )}
        {!glued && dowels.length === 0 && <li className={styles.muted}>Nada más por ahora.</li>}
      </ul>
    </>
  );

  return (
    <>
      <main className={styles.cuts}>
        <section className={styles.cutsMain} aria-labelledby="cortes-titulo" id="cortes-lista">
          <div className={styles.titleRow}>
            <h1 id="cortes-titulo" className={styles.h1}>
              Lista de cortes
            </h1>
            <span className={styles.muted}>
              {pieces} piezas · medidas de corte en {units === 'cm' ? 'cm' : 'pulgadas'}
            </span>
            <button type="button" className={`${styles.secondary} ${styles.desktopOnly}`} onClick={exportCsv}>
              <IconDownload />
              Exportar planilla
            </button>
          </div>
          <CutTable rows={rows} n={n} />
          <CutCards rows={rows} n={n} unit={unit} />
          {tooLong.length > 0 && (
            <p className={styles.warn} role="alert">
              {tooLong.join(', ')} {tooLong.length === 1 ? 'es más larga' : 'son más largas'} que las tablas de la maderera (3,66 m): hay que empalmar o pedir un largo especial.
            </p>
          )}

          <h2 className={styles.h2}>Cómo cortar cada tabla</h2>
          <div className={styles.diagrams}>
            {plan.boards.map((b, i) => (
              <BoardDiagram key={i} board={b} n={n} showWood={woods.length > 1} />
            ))}
            <div className={styles.diagramLegend}>
              <span>
                <span className={styles.swatchPiece} aria-hidden="true" />
                Pieza
              </span>
              <span>
                <span className={styles.swatchWaste} aria-hidden="true" />
                Sobrante
              </span>
              <span>Corte de sierra: {KERF_MM} mm</span>
            </div>
          </div>
        </section>

        <aside className={styles.cutsAside} aria-label="Resumen de compra">
          <div className={`${styles.buyCard} ${styles.desktopOnly}`}>
            <h2 className={styles.h3}>Para comprar en la maderera</h2>
            <div className={styles.stats}>
              <div>
                <span className={styles.bigNum}>{decimal(feet)}</span>
                <span>{feetLabel}</span>
              </div>
              <div>
                <span className={styles.bigNum}>{Math.round(plan.waste * 100)}%</span>
                <span>de desperdicio</span>
              </div>
            </div>
            <label className={styles.darkField}>
              Precio por pie (opcional)
              <input
                inputMode="decimal"
                placeholder="$ precio de tu maderera"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  store('kitc.precioPie', e.target.value);
                }}
              />
            </label>
            {total !== null && (
              <p className={styles.total}>
                Total aproximado <strong>$ {total.toLocaleString('es-AR')}</strong>
              </p>
            )}
          </div>

          <div className={`${styles.tiles} ${styles.mobileOnly}`}>
            <div className={styles.tileDark}>
              <span className={styles.tileNum}>{boardCount}</span>
              <span>tablas y tirantes</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileNum}>{decimal(feet)}</span>
              <span>{feetLabel}</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileNum}>{Math.round(plan.waste * 100)}%</span>
              <span>desperdicio</span>
            </div>
          </div>

          <div className={`${styles.card} ${styles.desktopOnly}`}>
            <h2 className={styles.h3}>Tablas</h2>
            <ul className={styles.plainList}>
              {shop.map((s) => (
                <li key={shopKey(s)}>
                  <span>
                    {stockLabel(s)}
                    {woods.length > 1 && ` · ${woodName(s.wood)}`}
                  </span>
                  <strong>× {s.count}</strong>
                </li>
              ))}
            </ul>
            {hardware}
          </div>

          <div className={`${styles.checklist} ${styles.mobileOnly}`}>
            <ShopChecklist shop={shop} plan={plan} rows={rows} project={project} />
            {hardware}
            <p className={styles.muted}>Medidas comerciales de madereras de Buenos Aires. Cada tabla ya suma {KERF_MM} mm por corte de sierra.</p>
          </div>

          {woods.map((w) => (
            <div key={w} className={styles.card}>
              <h2 className={styles.h3}>Sobre el {woodName(w).toLocaleLowerCase('es')}</h2>
              <p className={styles.muted}>
                {woodById(w)?.about} Otras opciones: {alternativesText(w)}.
              </p>
            </div>
          ))}
        </aside>
      </main>
      <div className={`${styles.actionBar} ${styles.mobileOnly}`}>
        <a className={styles.secondary} href="#cortes-lista" onClick={(e) => {
          e.preventDefault();
          document.getElementById('cortes-lista')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }}>
          Ver cortes
        </a>
        <button type="button" className={styles.primary} onClick={exportCsv}>
          Exportar planilla
        </button>
      </div>
    </>
  );
}

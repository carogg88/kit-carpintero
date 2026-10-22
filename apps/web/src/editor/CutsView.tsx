import { useMemo, useState } from 'react';
import {
  cutList,
  cutPlan,
  dowelsNeeded,
  END_TRIM_MM,
  formatNumber,
  getLang,
  KERF_MM,
  locale,
  planedMm,
  shoppingList,
  t,
  woodById,
  type CutRow,
  type Project,
  type StockBoard,
} from '@kitc/core';
import { HelpTip } from '../help/Help';
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
    .replace(/^-|-$/g, '') || t('proyecto');

/** Qué agrega largo a la pieza: se mira en sus encastres (las notas de trabajo cambian con el idioma). */
function extraNote(r: CutRow, n: (mm: number) => string, project: Project): string | null {
  if (r.extraLength <= 0) return null;
  const base = n(r.cut[0] - r.extraLength);
  const id = r.ids[0];
  // side 'B': la pieza que entra en la otra (la que lleva colas, horquilla o espiga).
  const has = (type: string, side?: 'B') => project.joints.some((j) => j.type === type && (j.partB === id || (!side && j.partA === id)));
  const ends = r.tongues === 1 ? t('1 punta') : t('{n} puntas', { n: r.tongues });
  if (has('cola-milano', 'B')) return t('{base} + colas en {ends}', { base, ends });
  if (has('dedos')) return t('{base} + dedos en {ends}', { base, ends });
  if (has('inglete')) return t('{base} + inglete en {ends}', { base, ends });
  if (has('brida', 'B')) return t('{base} + horquilla en {ends}', { base, ends });
  const vars = { base, n: r.tongues };
  if (has('mortaja', 'B')) return r.tongues === 1 ? t('{base} + {n} espiga', vars) : t('{base} + {n} espigas', vars);
  return r.tongues === 1 ? t('{base} + {n} lengüeta', vars) : t('{base} + {n} lengüetas', vars);
}

function CutTable({ rows, n, project }: { rows: CutRow[]; n: (mm: number) => string; project: Project }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t('Pieza')}</th>
            <th scope="col" className={styles.num}>
              {t('Cant.')}
            </th>
            <th scope="col" className={styles.num}>
              {t('Largo de corte')}
            </th>
            <th scope="col" className={styles.num}>
              {t('Ancho × espesor')}
            </th>
            <th scope="col">{t('Madera')}</th>
            <th scope="col">{t('Trabajo')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const note = extraNote(r, n, project);
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

function CutCards({ rows, n, unit, project }: { rows: CutRow[]; n: (mm: number) => string; unit: string; project: Project }) {
  return (
    <ul className={styles.cutCards}>
      {rows.map((r) => {
        const note = extraNote(r, n, project);
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
            {note && <span className={styles.extra}>{t('Largo: {note}', { note })}</span>}
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
  const description = t('{pieces}; sobran {rest}', {
    pieces: board.slots
      .map((s) => [s, ...(s.beside ?? [])].map((x) => t('{id} de {len}', { id: x.id, len: n(x.length) })).join(t(' al lado de ')))
      .join(', '),
    rest: n(rest),
  });
  // Con trozos uno al lado del otro, la tabla se dibuja más alta para que se lean.
  const rows = Math.max(1, ...board.slots.map((s) => 1 + (s.beside?.length ?? 0)));
  return (
    <figure className={styles.board}>
      <figcaption>
        <strong>{stockLabel(board)}</strong>
        {showWood && <span> · {woodName(board.wood)}</span>}
      </figcaption>
      <div className={styles.boardBar} style={{ height: Math.max(rows * 22, Math.min(40, Math.max(24, board.widthIn * 6))) }} role="img" aria-label={description}>
        <span className={styles.waste} style={{ flexBasis: pct(END_TRIM_MM) }} />
        {board.slots.map((s, i) => (
          <span key={`${s.id}-${i}`} className={styles.slot} style={{ flexBasis: pct(s.length), marginRight: pct(KERF_MM) }} title={[s, ...(s.beside ?? [])].map((x) => `${x.id} · ${n(x.length)}`).join('\n')}>
            {[s, ...(s.beside ?? [])].map((x) => (
              // Un trozo más corto que el tramo deja sobrante a su lado.
              <span key={x.id} className={styles.pieceRow} style={{ height: `${Math.min(100, (x.width / width) * 100)}%` }}>
                <span className={styles.piece} style={{ flexBasis: `${(x.length / s.length) * 100}%` }}>
                  <span className={styles.pieceLabel}>
                    {x.id} <span>{n(x.length)}</span>
                  </span>
                </span>
                {x.length < s.length && <span className={styles.waste} />}
              </span>
            ))}
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
        <section key={w} className={styles.checkGroup} aria-label={t('Madera: {wood}', { wood: woodName(w) })}>
          <h2 className={styles.eyebrow}>{t('Madera · {wood}', { wood: woodName(w) })}</h2>
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

/** Qué quiere decir el desperdicio: un número solo asusta al que nunca compró madera. */
function wasteNote(waste: number): string {
  return waste <= 0.35
    ? t('Es normal: las tablas vienen en largos fijos y siempre sobra algo. Guardá los retazos para probar los encastres.')
    : t('Es alto: las piezas no aprovechan bien los largos de la maderera. Podés pedir que te corten las tablas a medida, o usar lo que sobra para probar los encastres.');
}

export function CutsView({ project }: { project: Project }) {
  const { rows, plan, shop, dowels } = useMemo(() => {
    const plan = cutPlan(project);
    return { rows: cutList(project), plan, shop: shoppingList(plan), dowels: dowelsNeeded(project) };
  }, [project]);
  const [price, setPrice] = useState(() => readStored<string>('kitc.precioPie', ''));
  // La lista y el despiece de cada tabla van en pestañas: cada uno entra en una pantalla.
  const [tab, setTab] = useState<'lista' | 'tablas'>('lista');
  const units = project.units;
  const unit = units === 'cm' ? ' cm' : '″';
  const n = (mm: number) => formatNumber(mm, units);

  const pieces = rows.reduce((s, r) => s + r.ids.length, 0);
  if (pieces === 0) {
    return (
      <main className={styles.empty}>
        <h1 className={styles.h1}>{t('Todavía no hay piezas')}</h1>
        <p className={styles.muted}>{t('Agregá piezas en el modelo y acá aparece qué cortar y qué comprar.')}</p>
      </main>
    );
  }

  const woods = Object.keys(plan.feet);
  const feet = Object.values(plan.feet).reduce((s, v) => s + v, 0);
  const feetLabel = woods.length === 1 ? t('pies de {wood}', { wood: woodName(woods[0]!).toLocaleLowerCase(locale()) }) : t('pies de madera');
  // En español el punto separa miles y la coma los decimales; en inglés, al revés.
  const priceValue = Number(getLang() === 'en' ? price.replace(/,/g, '') : price.replace(/\./g, '').replace(',', '.'));
  const total = priceValue > 0 ? Math.round(priceValue * feet) : null;
  const boardCount = shop.reduce((s, r) => s + r.count, 0);
  const glued = project.joints.some((j) => j.type !== 'tope') || rows.some((r) => r.boards > 1);
  const tooLong = plan.tooLong;
  const exportCsv = () => download(`${fileSlug(project.name)}-${t('cortes')}.csv`, cutsCsv(project, rows, shop));

  const hardware = (
    <>
      <h2 className={styles.h3}>{t('Herrajes y otros')}</h2>
      <ul className={styles.plainList}>
        {dowels.map((d) => (
          <li key={`${d.diameter}-${d.length}`}>
            <span>{t('Tarugos de {d} mm × {len}{unit}', { d: d.diameter, len: formatNumber(d.length, units), unit })}</span>
            <strong>× {d.count}</strong>
          </li>
        ))}
        {glued && (
          <li>
            <span>{t('Cola vinílica para madera')}</span>
            <strong>{pieces > 20 ? '500 g' : '250 g'}</strong>
          </li>
        )}
        {!glued && dowels.length === 0 && <li className={styles.muted}>{t('Nada más por ahora.')}</li>}
      </ul>
    </>
  );

  return (
    <>
      <main className={styles.cuts}>
        <section className={styles.cutsMain} aria-labelledby="cortes-titulo" id="cortes-lista">
          <div className={styles.titleRow}>
            <h1 id="cortes-titulo" className={styles.h1}>
              {t('Lista de cortes')}
            </h1>
            <span className={styles.muted}>{t('{n} piezas · medidas de corte en {units}', { n: pieces, units: units === 'cm' ? 'cm' : t('pulgadas') })}</span>
            <button type="button" className={`${styles.secondary} ${styles.desktopOnly}`} onClick={exportCsv}>
              <IconDownload />
              {t('Exportar planilla')}
            </button>
          </div>
          <div className={styles.cutTabs} role="tablist" aria-label={t('Qué ver')}>
            <button type="button" role="tab" id="tab-lista" aria-selected={tab === 'lista'} aria-controls="panel-lista" onClick={() => setTab('lista')}>
              {t('Lista de piezas')}
            </button>
            <button type="button" role="tab" id="tab-tablas" aria-selected={tab === 'tablas'} aria-controls="panel-tablas" onClick={() => setTab('tablas')}>
              {t('Cómo cortar cada tabla')}
              <span className={styles.tabCount}>{plan.boards.length}</span>
            </button>
          </div>
          <div id="panel-lista" role="tabpanel" aria-labelledby="tab-lista" className={styles.cutPanel} hidden={tab !== 'lista'}>
            <CutTable rows={rows} n={n} project={project} />
            <CutCards rows={rows} n={n} unit={unit} project={project} />
            {tooLong.length > 0 && (
              <p className={styles.warn} role="alert">
                {tooLong.length === 1
                  ? t('{ids} es más larga que las tablas de la maderera (3,66 m): hay que empalmar o pedir un largo especial.', { ids: tooLong.join(', ') })
                  : t('{ids} son más largas que las tablas de la maderera (3,66 m): hay que empalmar o pedir un largo especial.', { ids: tooLong.join(', ') })}
              </p>
            )}
          </div>

          <div id="panel-tablas" role="tabpanel" aria-labelledby="tab-tablas" className={styles.cutPanel} hidden={tab !== 'tablas'}>
            <h2 className={styles.srOnly}>{t('Cómo cortar cada tabla')}</h2>
            <div className={styles.diagrams}>
              {plan.boards.map((b, i) => (
                <BoardDiagram key={i} board={b} n={n} showWood={woods.length > 1} />
              ))}
              <div className={styles.diagramLegend}>
                <span>
                  <span className={styles.swatchPiece} aria-hidden="true" />
                  {t('Pieza')}
                </span>
                <span>
                  <span className={styles.swatchWaste} aria-hidden="true" />
                  {t('Sobrante')}
                </span>
                <span>{t('Corte de sierra: {kerf} mm', { kerf: KERF_MM })}</span>
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.cutsAside} aria-label={t('Resumen de compra')}>
          <div className={`${styles.buyCard} ${styles.desktopOnly}`}>
            <h2 className={styles.h3}>{t('Para comprar en la maderera')}</h2>
            <div className={styles.stats}>
              <div>
                <span className={styles.bigNum}>{decimal(feet)}</span>
                <span>
                {feetLabel}
                <HelpTip term="pie" />
              </span>
              </div>
              <div>
                <span className={styles.bigNum}>{Math.round(plan.waste * 100)}%</span>
                <span>{t('de desperdicio')}</span>
              </div>
            </div>
            <label className={styles.darkField}>
              {t('Precio por pie (opcional)')}
              <input
                inputMode="decimal"
                placeholder={t('$ precio de tu maderera')}
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  store('kitc.precioPie', e.target.value);
                }}
              />
            </label>
            {total !== null && (
              <p className={styles.total}>
                {t('Total aproximado')} <strong>$ {total.toLocaleString(locale())}</strong>
              </p>
            )}
          </div>

          <div className={`${styles.tiles} ${styles.mobileOnly}`}>
            <div className={styles.tileDark}>
              <span className={styles.tileNum}>{boardCount}</span>
              <span>{t('tablas y tirantes')}</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileNum}>{decimal(feet)}</span>
              <span>
                {feetLabel}
                <HelpTip term="pie" />
              </span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileNum}>{Math.round(plan.waste * 100)}%</span>
              <span>{t('desperdicio')}</span>
            </div>
          </div>

          <p className={styles.wasteNote}>{wasteNote(plan.waste)}</p>

          <div className={`${styles.card} ${styles.desktopOnly}`}>
            <h2 className={styles.h3}>{t('Tablas')}</h2>
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
            <p className={styles.muted}>{t('Medidas comerciales de madereras de Buenos Aires. Cada tabla ya suma {kerf} mm por corte de sierra.', { kerf: KERF_MM })}</p>
          </div>

          {woods.map((w) => (
            <div key={w} className={styles.card}>
              <h2 className={styles.h3}>{t('Sobre el {wood}', { wood: woodName(w).toLocaleLowerCase(locale()) })}</h2>
              <p className={styles.muted}>
                {t(woodById(w)?.about ?? '')} {t('Otras opciones: {list}.', { list: alternativesText(w) })}
              </p>
            </div>
          ))}
        </aside>
      </main>
      <div className={`${styles.actionBar} ${styles.mobileOnly}`}>
        <a className={styles.secondary} href="#cortes-lista" onClick={(e) => {
          e.preventDefault();
          setTab('lista');
          document.getElementById('cortes-lista')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }}>
          {t('Ver cortes')}
        </a>
        <button type="button" className={styles.primary} onClick={exportCsv}>
          {t('Exportar planilla')}
        </button>
      </div>
    </>
  );
}

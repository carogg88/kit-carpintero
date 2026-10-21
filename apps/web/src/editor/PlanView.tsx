import { useMemo, useState, type ReactNode } from 'react';
import {
  arcTemplate,
  cutList,
  drawJointDetail,
  drawPart,
  drawView,
  faceName,
  formatNumber,
  groupJoints,
  JOINT_NAMES,
  MEASURED_FROM,
  otherAxes,
  partBox,
  t,
  tk,
  turnBlank,
  turnOutline,
  turnSegments,
  type CutRow,
  type Drawing,
  type ArcMark,
  type Part,
  type Turning,
  type EngineView,
  type Project,
  type Rect2,
  type Units,
} from '@kitc/core';
import { IconDownload } from './icons';
import { capitalize, woodName } from './cutsData';
import { useEngineLines } from './useGeometry';
import styles from './Plan.module.css';

/** Hoja A4 apaisada, en mm de papel. */
const W = 297;
const H = 210;
const M = 10;
const TITLE_W = 118;
const TITLE_H = 22;
const SCALES = [1, 2, 5, 10, 20, 25, 50];

type Layer = 'contornos' | 'cotas' | 'ocultas' | 'encastres' | 'notas';
const LAYERS: [Layer, string][] = [
  ['contornos', tk('Contornos')],
  ['cotas', tk('Cotas')],
  ['ocultas', tk('Líneas ocultas')],
  ['encastres', tk('Encastres resaltados')],
  ['notas', tk('Notas y nombres')],
];

/** Cambia las líneas de cajas por las de la forma exacta, si el motor ya las tiene. */
type Refine = (d: Drawing) => Drawing;

const pickScale = (fits: (s: number) => boolean) => SCALES.find(fits) ?? SCALES[SCALES.length - 1]!;

/** Pasa del dibujo (mm del mueble, v hacia arriba) a la hoja (mm de papel, y hacia abajo). */
interface Place {
  x: number;
  y: number;
  s: number;
  b: Rect2;
}
const px = (p: Place, u: number) => p.x + (u - p.b.u0) / p.s;
const py = (p: Place, v: number) => p.y + (p.b.v1 - v) / p.s;

function Lines({ d, at }: { d: Drawing; at: Place }) {
  return (
    <>
      <g className={styles.joints}>
        {d.joints.map((r, i) => (
          <rect key={i} x={px(at, r.u0)} y={py(at, r.v1)} width={(r.u1 - r.u0) / at.s} height={(r.v1 - r.v0) / at.s} />
        ))}
      </g>
      <g className={styles.hidden}>
        {d.lines
          .filter((l) => l.hidden)
          .map((l, i) => (
            <line key={i} x1={px(at, l.a[0])} y1={py(at, l.a[1])} x2={px(at, l.b[0])} y2={py(at, l.b[1])} />
          ))}
      </g>
      <g className={styles.contour}>
        {d.lines
          .filter((l) => !l.hidden)
          .map((l, i) => (
            <line key={i} x1={px(at, l.a[0])} y1={py(at, l.a[1])} x2={px(at, l.b[0])} y2={py(at, l.b[1])} />
          ))}
      </g>
    </>
  );
}

/** Cota con líneas de referencia y marcas oblicuas, como en un plano de taller. */
function Dim({ from, to, at, offset, text, vertical }: { from: number; to: number; at: number; offset: number; text: string; vertical?: boolean }) {
  const tl = 1.2;
  const line = at + offset;
  const ext = (p: number) =>
    vertical ? <line x1={at} y1={p} x2={line + Math.sign(offset) * 1.5} y2={p} /> : <line x1={p} y1={at} x2={p} y2={line + Math.sign(offset) * 1.5} />;
  const tick = (p: number) =>
    vertical ? <line x1={line - tl} y1={p + tl} x2={line + tl} y2={p - tl} /> : <line x1={p - tl} y1={line + tl} x2={p + tl} y2={line - tl} />;
  // Si el texto no entra entre las marcas, va afuera, después de la segunda.
  const room = Math.abs(to - from) > text.length * 1.8 + 2;
  const mid = room ? (from + to) / 2 : Math.max(from, to) + text.length * 0.9 + 2;
  return (
    <g className={styles.dim}>
      {ext(from)}
      {ext(to)}
      {vertical ? <line x1={line} y1={from} x2={line} y2={to} /> : <line x1={from} y1={line} x2={to} y2={line} />}
      {tick(from)}
      {tick(to)}
      {vertical ? (
        <text x={line - 1.2} y={mid} transform={`rotate(-90 ${line - 1.2} ${mid})`} textAnchor="middle">
          {text}
        </text>
      ) : (
        <text x={mid} y={line - 1.2} textAnchor="middle">
          {text}
        </text>
      )}
    </g>
  );
}

/**
 * Torneado: debajo, la distancia de cada estación a la punta (cotas desde un mismo cero, como en la regla del tornero);
 * arriba, el diámetro en cada estación que no queda dentro de lo cuadrado. Si dos textos se pisan, va el primero.
 */
function TurnDims({ d, at, n }: { d: Drawing; at: Place; n: (mm: number) => string }) {
  const marks = d.turns ?? [];
  if (!marks.length) return null;
  const base = py(at, d.bounds.v0) + 3;
  const top = py(at, d.bounds.v1) - 1.5;
  const gap = 3.2;
  const shown: { pos: boolean; dia: boolean }[] = [];
  let lastPos = -Infinity;
  let lastDia = -Infinity;
  marks.forEach((m, i) => {
    const x = px(at, m.u);
    const pos = x - lastPos >= gap || i === marks.length - 1;
    const dia = !m.square && x - lastDia >= gap;
    if (pos) lastPos = x;
    if (dia) lastDia = x;
    shown.push({ pos, dia });
  });
  return (
    <g className={styles.dim}>
      <line x1={px(at, marks[0]!.u)} y1={base} x2={px(at, marks[marks.length - 1]!.u)} y2={base} />
      {marks.map((m, i) => {
        const x = px(at, m.u);
        const { pos: showPos, dia: showDia } = shown[i]!;
        return (
          <g key={i}>
            <line x1={x} y1={py(at, d.bounds.v0)} x2={x} y2={base + 1} />
            <circle cx={x} cy={base} r={0.35} className={styles.dimDot} />
            {showPos && (
              <text x={x + 0.9} y={base + 1.2} transform={`rotate(-90 ${x + 0.9} ${base + 1.2})`} textAnchor="end">
                {n(m.at)}
              </text>
            )}
            {showDia && (
              <text x={x + 0.9} y={top} transform={`rotate(-90 ${x + 0.9} ${top})`} textAnchor="start">
                Ø {n(m.d)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Cotas en cadena entre las puntas de la pieza y las de sus tramos; sin tramos no dibuja nada. */
function Chain({ stops, lo, hi, render }: { stops?: number[]; lo: number; hi: number; render: (a: number, b: number, key: number) => ReactNode }) {
  if (!stops?.length) return null;
  const at = [lo, ...stops, hi];
  return <>{at.slice(1).map((b, i) => render(at[i]!, b, i))}</>;
}

/** Cota de radio: flecha que toca el arco por el lado de la madera y "R 125" en la punta de la línea. */
function Radius({ m, at, text }: { m: ArcMark; at: Place; text: string }) {
  const x = px(at, m.at[0]);
  const y = py(at, m.at[1]);
  // En la hoja y crece hacia abajo.
  const dx = m.toward[0];
  const dy = -m.toward[1];
  const len = 7;
  const ex = x + dx * len;
  const ey = y + dy * len;
  const head = 1.4;
  const side = (k: number): [number, number] => [x + dx * head * 1.6 - dy * head * 0.5 * k, y + dy * head * 1.6 + dx * head * 0.5 * k];
  const [l, r] = [side(1), side(-1)];
  const horizontal = Math.abs(dx) > Math.abs(dy);
  return (
    <g className={styles.dim}>
      <line x1={x} y1={y} x2={ex} y2={ey} />
      <polygon points={`${x},${y} ${l[0]},${l[1]} ${r[0]},${r[1]}`} className={styles.arrow} />
      <text
        x={horizontal ? ex + Math.sign(dx) * 1 : ex}
        y={horizontal ? ey + 1 : ey + (dy > 0 ? 3 : -1.2)}
        textAnchor={horizontal ? (dx > 0 ? 'start' : 'end') : 'middle'}
      >
        {text}
      </text>
    </g>
  );
}

function TitleBlock({ project, sheet, of, scale, units }: { project: Project; sheet: number; of: number; scale: number | null; units: Units }) {
  const x = W - M - TITLE_W;
  const y = H - M - TITLE_H;
  const woods = [...new Set(project.parts.map((p) => woodName(p.wood)))].join(', ');
  const cell = (cx: number, cy: number, w: number, label: string, value: string, mono = false) => (
    <g>
      <rect x={cx} y={cy} width={w} height={TITLE_H / 2} />
      <text x={cx + 2} y={cy + 3.6} className={styles.tbLabel}>
        {label}
      </text>
      <text x={cx + 2} y={cy + 8.6} className={mono ? styles.tbMono : styles.tbValue}>
        {value}
      </text>
    </g>
  );
  return (
    <g className={styles.titleBlock}>
      {cell(x, y, 80, t('Proyecto'), project.name)}
      {cell(x + 80, y, TITLE_W - 80, t('Hoja'), t('{n} de {total}', { n: sheet, total: of }), true)}
      {cell(x, y + TITLE_H / 2, 30, t('Escala'), scale ? `1:${scale}` : t('Indicada'), true)}
      {cell(x + 30, y + TITLE_H / 2, 30, t('Medidas'), units === 'cm' ? 'cm' : t('pulgadas'), true)}
      {cell(x + 60, y + TITLE_H / 2, TITLE_W - 60, t('Madera'), woods)}
    </g>
  );
}

interface SheetDef {
  key: string;
  title: string;
  hint: string;
  /** Escala de toda la hoja, o null si cada dibujo lleva la suya. */
  scale: number | null;
  body: React.ReactNode;
}

function Sheet({ def, n, of, project, layers }: { def: SheetDef; n: number; of: number; project: Project; layers: Set<Layer> }) {
  const off = LAYERS.filter(([k]) => !layers.has(k)).map(([k]) => styles[`off-${k}`]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`${styles.sheet} ${off.join(' ')}`} role="img" aria-label={t('Hoja {n} de {total}: {title}', { n, total: of, title: def.title })}>
      <rect x={0} y={0} width={W} height={H} className={styles.paper} />
      <rect x={M / 2} y={M / 2} width={W - M} height={H - M} className={styles.frame} />
      {def.body}
      <TitleBlock project={project} sheet={n} of={of} scale={def.scale} units={project.units} />
    </svg>
  );
}

/** Hoja 1: frente, costado y planta con las medidas generales. */
function generalSheet(project: Project, refine: Refine): SheetDef {
  const n = (mm: number) => formatNumber(mm, project.units);
  const front = refine(drawView(project, 'front'));
  const side = refine(drawView(project, 'side'));
  const top = refine(drawView(project, 'top'));
  const w = (d: Drawing) => d.bounds.u1 - d.bounds.u0;
  const h = (d: Drawing) => d.bounds.v1 - d.bounds.v0;
  const gap = 24;
  const scale = pickScale((s) => (w(front) + w(side)) / s + 3 * gap <= W - 2 * M && (h(front) + h(top)) / s + 2.6 * gap <= H - 2 * M);
  const fp: Place = { x: M + gap, y: M + 14, s: scale, b: front.bounds };
  const sp: Place = { x: fp.x + w(front) / scale + gap, y: fp.y, s: scale, b: side.bounds };
  const tp: Place = { x: fp.x, y: fp.y + h(front) / scale + gap, s: scale, b: top.bounds };

  // Medidas de detalle del frente: espesor de la tapa, alto del faldón y ancho de la pata.
  const fr = front.rects.map((r) => r.rect);
  const topRect = [...fr].sort((x, y) => y.v1 - x.v1)[0];
  const floor = fr.filter((r) => Math.abs(r.v0 - front.bounds.v0) < 1).sort((x, y) => x.u0 - y.u0)[0];
  const apron = topRect && fr.filter((r) => Math.abs(r.v1 - topRect.v0) < 1 && r.v0 > front.bounds.v0 + 1).sort((x, y) => y.u1 - y.u0 - (x.u1 - x.u0))[0];

  const title = (p: Place, d: Drawing, text: string) => (
    <text x={px(p, (d.bounds.u0 + d.bounds.u1) / 2)} y={py(p, d.bounds.v0) + 15} textAnchor="middle" className={styles.viewTitle}>
      {text}
    </text>
  );
  const fitsLabel = (d: Drawing, id: string) => {
    const r = d.rects.find((x) => x.id === id)?.rect;
    return !!r && (r.u1 - r.u0) / scale >= 5 && (r.v1 - r.v0) / scale >= 3.5;
  };
  const labels = (p: Place, d: Drawing) =>
    d.labels.filter((l) => fitsLabel(d, l.id)).map((l) => (
      <text key={l.id} x={px(p, l.at[0])} y={py(p, l.at[1]) + 1.2} textAnchor="middle" className={styles.partId}>
        {l.id}
      </text>
    ));
  return {
    key: 'general',
    title: t('Vistas generales'),
    hint: t('Frente, costado y planta'),
    scale,
    body: (
      <>
        <Lines d={front} at={fp} />
        <Lines d={side} at={sp} />
        <Lines d={top} at={tp} />
        <g className={styles.notes}>
          {title(fp, front, t('Frente'))}
          {title(sp, side, t('Costado'))}
          {title(tp, top, t('Planta (desde arriba)'))}
          {labels(fp, front)}
          {labels(sp, side)}
          {labels(tp, top)}
        </g>
        <Dim from={px(fp, front.bounds.u0)} to={px(fp, front.bounds.u1)} at={py(fp, front.bounds.v1)} offset={-6} text={n(w(front))} />
        <Dim vertical from={py(fp, front.bounds.v1)} to={py(fp, front.bounds.v0)} at={px(fp, front.bounds.u0)} offset={-6} text={n(h(front))} />
        {floor && (
          <Dim from={px(fp, floor.u0)} to={px(fp, floor.u1)} at={py(fp, front.bounds.v0)} offset={5} text={n(floor.u1 - floor.u0)} />
        )}
        {topRect && (
          <Dim vertical from={py(fp, topRect.v1)} to={py(fp, topRect.v0)} at={px(fp, front.bounds.u1)} offset={5} text={n(topRect.v1 - topRect.v0)} />
        )}
        {apron && (
          <Dim vertical from={py(fp, apron.v1)} to={py(fp, apron.v0)} at={px(fp, front.bounds.u1)} offset={12} text={n(apron.v1 - apron.v0)} />
        )}
        <Dim from={px(sp, side.bounds.u0)} to={px(sp, side.bounds.u1)} at={py(sp, side.bounds.v1)} offset={-6} text={n(w(side))} />
        <Dim vertical from={py(tp, top.bounds.v1)} to={py(tp, top.bounds.v0)} at={px(tp, top.bounds.u1)} offset={6} text={n(h(top))} />
      </>
    ),
  };
}

/** Hoja 2 (y siguientes): cada pieza distinta, acotada, con sus espigas y mortajas. */
function partSheets(project: Project, refine: Refine): SheetDef[] {
  const n = (mm: number) => formatNumber(mm, project.units);
  const rows = cutList(project);
  const PER = 8;
  const sheets: SheetDef[] = [];
  for (let i = 0; i < rows.length; i += PER) {
    const chunk = rows.slice(i, i + PER);
    const cols = 2;
    const nRows = Math.max(2, Math.ceil(chunk.length / cols));
    const cellW = (W - 2 * M) / cols;
    const cellH = (H - 2 * M - TITLE_H) / nRows;
    const drawn = chunk.map((r) => {
      const part = project.parts.find((p) => p.id === r.ids[0])!;
      return { r, part, d: refine(drawPart(project, part)) };
    });
    // Con tramos, la cota en cadena va pegada a la pieza y la total más afuera: hace falta un poco más de lugar.
    // Un torneado lleva los diámetros arriba y las distancias abajo.
    const extraV = (d: Drawing) => (d.stops?.u.length ? 6 : 0) + (d.turns?.length ? 20 : 0);
    const scaleFor = (d: Drawing) =>
      pickScale((s) => (d.bounds.u1 - d.bounds.u0) / s <= cellW - 26 - (d.stops?.v.length ? 6 : 0) && (d.bounds.v1 - d.bounds.v0) / s <= cellH - 22 - extraV(d));
    const scales = new Set(drawn.map(({ d }) => scaleFor(d)));
    sheets.push({
      key: `piezas-${i}`,
      title: rows.length > PER ? t('Despiece {n}', { n: i / PER + 1 }) : t('Despiece'),
      hint: t('Cada pieza acotada'),
      scale: scales.size === 1 ? [...scales][0]! : null,
      body: drawn.map(({ r, part, d }, k) => {
        const scale = scaleFor(d);
        const cx = M + (k % cols) * cellW;
        const cy = M + Math.floor(k / cols) * cellH;
        const p: Place = { x: cx + 16, y: cy + 12 + (d.turns?.length ? 9 : 0), s: scale, b: d.bounds };
        const below = d.stops?.u.length ? 11 : d.turns?.length ? 15 : 5;
        const size = partBox(part);
        const thick = Math.min(...size.max.map((v, j) => v - size.min[j]!));
        return (
          <g key={r.ids.join()}>
            <text x={cx + 6} y={cy + 6} className={styles.cellTitle}>
              {r.name} · {r.ids.join(', ')}
            </text>
            <text x={cx + cellW - 6} y={cy + 6} textAnchor="end" className={styles.cellMeta}>
              × {r.ids.length} · {woodName(r.wood)} · {t('espesor {n}', { n: n(thick) })} · 1:{scale}
            </text>
            <Lines d={d} at={p} />
            <Chain stops={d.stops?.u} lo={d.bounds.u0} hi={d.bounds.u1} render={(a, b, k) => <Dim key={k} from={px(p, a)} to={px(p, b)} at={py(p, d.bounds.v0)} offset={5} text={n(b - a)} />} />
            <Chain stops={d.stops?.v} lo={d.bounds.v0} hi={d.bounds.v1} render={(a, b, k) => <Dim key={k} vertical from={py(p, b)} to={py(p, a)} at={px(p, d.bounds.u0)} offset={-5} text={n(b - a)} />} />
            <TurnDims d={d} at={p} n={n} />
            <Dim from={px(p, d.bounds.u0)} to={px(p, d.bounds.u1)} at={py(p, d.bounds.v0)} offset={below} text={n(d.bounds.u1 - d.bounds.u0)} />
            <Dim vertical from={py(p, d.bounds.v1)} to={py(p, d.bounds.v0)} at={px(p, d.bounds.u0)} offset={d.stops?.v.length ? -11 : -5} text={n(d.bounds.v1 - d.bounds.v0)} />
            {d.arcs?.map((m) => <Radius key={m.id} m={m} at={p} text={`R ${n(m.radius)}`} />)}
            {r.work.length > 0 && (
              <text x={cx + 6} y={cy + cellH - 3} className={`${styles.notes} ${styles.cellMeta}`}>
                {capitalize(r.work.join(' · '))}
              </text>
            )}
          </g>
        );
      }),
    });
  }
  return sheets;
}

/** Hoja de encastres: un detalle por grupo de uniones con cortes, en dos vistas. */
function jointSheets(project: Project, refine: Refine): SheetDef[] {
  const n = (mm: number) => formatNumber(mm, project.units);
  const groups = groupJoints(project).filter((g) => g.joints.some((j) => j.type !== 'tope'));
  const details = groups
    .map((g) => {
      const j = g.joints.find((x) => x.type !== 'tope')!;
      const d = drawJointDetail(project, j.id);
      return d && { g, j, d: { ...d, views: d.views.map(refine) } };
    })
    .filter((x) => x !== null);
  const PER = 3;
  const sheets: SheetDef[] = [];
  if (!details.length) {
    return [
      {
        key: 'encastres',
        title: t('Encastres'),
        hint: t('Sin cortes'),
        scale: null,
        body: (
          <text x={W / 2} y={H / 2} textAnchor="middle" className={styles.cellTitle}>
            {t('Este mueble no tiene encastres con cortes: todas las uniones son a tope.')}
          </text>
        ),
      },
    ];
  }
  for (let i = 0; i < details.length; i += PER) {
    const chunk = details.slice(i, i + PER);
    const rowH = (H - 2 * M - TITLE_H) / chunk.length;
    const viewW = (W - 2 * M) / 2;
    const scaleFor = (d: NonNullable<ReturnType<typeof drawJointDetail>>) =>
      pickScale((s) => d.views.every((v) => (v.bounds.u1 - v.bounds.u0) / s <= viewW - 34 && (v.bounds.v1 - v.bounds.v0) / s <= rowH - 20));
    const scales = new Set(chunk.map(({ d }) => scaleFor(d)));
    sheets.push({
      key: `encastres-${i}`,
      title: details.length > PER ? t('Encastres {n}', { n: i / PER + 1 }) : t('Encastres'),
      hint:
        chunk.length === 1
          ? t('{joint} en detalle', { joint: t(JOINT_NAMES[chunk[0]!.j.type]) })
          : t('{joint} y otros, en detalle', { joint: t(JOINT_NAMES[chunk[0]!.j.type]) }),
      scale: scales.size === 1 ? [...scales][0]! : null,
      body: chunk.map(({ g, j, d }, k) => {
        const cy = M + k * rowH;
        const scale = scaleFor(d);
        return (
          <g key={g.key}>
            <text x={M + 6} y={cy + 6} className={styles.cellTitle}>
              {g.label} · {t(JOINT_NAMES[j.type])} · {g.joints.length === 1 ? t('1 unión') : t('{n} uniones', { n: g.joints.length })} · 1:{scale}
            </text>
            {d.views.map((v, vi) => {
              const p: Place = { x: M + vi * viewW + 18, y: cy + 11, s: scale, b: v.bounds };
              const jr = v.joints;
              const ext = jr.length
                ? {
                    u0: Math.min(...jr.map((r) => r.u0)),
                    u1: Math.max(...jr.map((r) => r.u1)),
                    v0: Math.min(...jr.map((r) => r.v0)),
                    v1: Math.max(...jr.map((r) => r.v1)),
                  }
                : null;
              return (
                <g key={vi}>
                  <clipPath id={`clip-${g.key}-${vi}`.replace(/[^\w-]/g, '_')}>
                    <rect x={p.x} y={p.y} width={(v.bounds.u1 - v.bounds.u0) / scale} height={(v.bounds.v1 - v.bounds.v0) / scale} />
                  </clipPath>
                  <g clipPath={`url(#${`clip-${g.key}-${vi}`.replace(/[^\w-]/g, '_')})`}>
                    <Lines d={v} at={p} />
                  </g>
                  <g className={styles.notes}>
                    {v.labels.map((l) => (
                      <text key={l.id} x={px(p, l.at[0])} y={py(p, l.at[1]) + 1.2} textAnchor="middle" className={styles.partId}>
                        {l.id}
                      </text>
                    ))}
                  </g>
                  {ext && (
                    <>
                      <Dim from={px(p, ext.u0)} to={px(p, ext.u1)} at={py(p, v.bounds.v0)} offset={4} text={n(ext.u1 - ext.u0)} />
                      <Dim vertical from={py(p, ext.v1)} to={py(p, ext.v0)} at={px(p, v.bounds.u1)} offset={5} text={n(ext.v1 - ext.v0)} />
                    </>
                  )}
                </g>
              );
            })}
          </g>
        );
      }),
    });
  }
  return sheets;
}

/** Zona de la hoja donde va la plantilla; abajo a la izquierda queda lugar para la barra de control. */
const TPL = { x0: M, y0: M + 15, x1: W - M, y1: H - M - TITLE_H - 3 };
/** Cuánto se pisan dos hojas vecinas de una misma plantilla. */
const OVERLAP = 16;

interface TiledTemplate {
  /** Clave única: parte de la clave de cada hoja y del recorte. */
  id: string;
  /** Lo que ocupa el dibujo, en mm del dibujo (v hacia arriba). */
  b: Rect2;
  title: string;
  hint: (k: number, total: number) => string;
  /** Primera línea de la hoja, después de "Plantilla 1:1". */
  heading: string;
  note: string;
  draw: (at: Place) => ReactNode;
}

/**
 * Reparte un dibujo a tamaño real en las hojas A4 que haga falta. Las hojas vecinas se pisan una franja, con cruces
 * para pegarlas y la línea de corte; todas llevan la barra de 10 cm para comprobar la impresión.
 */
function tiledSheets({ id, b, title, hint, heading, note, draw }: TiledTemplate): SheetDef[] {
  const rw = TPL.x1 - TPL.x0;
  const rh = TPL.y1 - TPL.y0;
  const cw = b.u1 - b.u0;
  const ch = b.v1 - b.v0;
  const count = (c: number, r: number) => (c <= r ? 1 : Math.ceil((c - OVERLAP) / (r - OVERLAP)));
  const cols = count(cw, rw);
  const rows = count(ch, rh);
  // Si entra en una hoja, centrada; si no, desde la punta izquierda de arriba.
  const left = cols === 1 ? b.u0 - (rw - cw) / 2 : b.u0;
  const top = rows === 1 ? b.v1 + (rh - ch) / 2 : b.v1;
  const total = cols * rows;
  const sheets: SheetDef[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i + 1;
      const u0 = left + i * (rw - OVERLAP);
      const v1 = top - j * (rh - OVERLAP);
      const at: Place = { x: TPL.x0, y: TPL.y0, s: 1, b: { u0, v0: v1 - rh, u1: u0 + rw, v1 } };
      const clip = `tpl-${id}-${k}`.replace(/[^\w-]/g, '_');
      // Cruces para pegar: sobre la línea del medio de cada franja que se pisa con la hoja de al lado.
      const marks: [number, number][] = [];
      const ysMarks = [v1 - 12, v1 - rh + 12];
      const xsMarks = [u0 + 12, u0 + rw - 12];
      if (i > 0) for (const y of ysMarks) marks.push([u0 + OVERLAP / 2, y]);
      if (i < cols - 1) for (const y of ysMarks) marks.push([u0 + rw - OVERLAP / 2, y]);
      if (j > 0) for (const x of xsMarks) marks.push([x, v1 - OVERLAP / 2]);
      if (j < rows - 1) for (const x of xsMarks) marks.push([x, v1 - rh + OVERLAP / 2]);
      const cross = (x: number, y: number, key: number) => (
        <g key={key}>
          <circle cx={px(at, x)} cy={py(at, y)} r={2.2} />
          <line x1={px(at, x) - 4} y1={py(at, y)} x2={px(at, x) + 4} y2={py(at, y)} />
          <line x1={px(at, x)} y1={py(at, y) - 4} x2={px(at, x)} y2={py(at, y) + 4} />
        </g>
      );
      sheets.push({
        key: `plantilla-${id}-${k}`,
        title,
        hint: hint(k, total),
        scale: 1,
        body: (
          <>
            <text x={M + 6} y={M + 6} className={styles.cellTitle}>
              {t('Plantilla 1:1')} · {heading}
            </text>
            <text x={W - M - 6} y={M + 6} textAnchor="end" className={styles.cellMeta}>
              {total > 1
                ? rows > 1
                  ? t('Hoja {k} de {total} (fila {row}, columna {col})', { k, total, row: j + 1, col: i + 1 })
                  : t('Hoja {n} de {total}', { n: k, total })
                : t('Una sola hoja')}
            </text>
            <text x={M + 6} y={M + 11} className={`${styles.notes} ${styles.cellMeta}`}>
              {note}
            </text>
            <clipPath id={clip}>
              <rect x={TPL.x0} y={TPL.y0} width={rw} height={rh} />
            </clipPath>
            <g clipPath={`url(#${clip})`}>
              {draw(at)}
              <g className={styles.register}>{marks.map(([x, y], m) => cross(x, y, m))}</g>
            </g>
            {i > 0 && <line x1={TPL.x0 + OVERLAP / 2} y1={TPL.y0} x2={TPL.x0 + OVERLAP / 2} y2={TPL.y1} className={styles.cutLine} />}
            {j > 0 && <line x1={TPL.x0} y1={TPL.y0 + OVERLAP / 2} x2={TPL.x1} y2={TPL.y0 + OVERLAP / 2} className={styles.cutLine} />}
            <Ruler x={M + 4} y={H - M - 7} />
            <text x={M + 4} y={H - M - TITLE_H + 3} className={styles.cellMeta}>
              {t('Imprimí al 100 %, sin «ajustar a la página». La barra tiene que medir 10 cm justos.')}
            </text>
            {total > 1 && (
              <text x={M + 4} y={H - M - TITLE_H + 7} className={styles.cellMeta}>
                {t('Recortá por la línea de puntos y pegá sobre la hoja anterior haciendo coincidir las cruces.')}
              </text>
            )}
          </>
        ),
      });
    }
  }
  return sheets;
}

/** Plantillas 1:1: cada arco acostado sobre su cuerda y cada torneado acostado sobre su eje, en las hojas que haga falta. */
function templateSheets(project: Project): SheetDef[] {
  const n = (mm: number) => formatNumber(mm, project.units);
  const sheets: SheetDef[] = [];
  for (const r of cutList(project)) {
    const part = project.parts.find((p) => p.id === r.ids[0])!;
    for (const pk of part.pockets) {
      if (pk.shape.kind !== 'arc') continue;
      const sh = pk.shape;
      const arc = arcTemplate(sh);
      const ys = arc.points.map((q) => q[1]);
      const xs = arc.points.map((q) => q[0]);
      const [ua, va] = otherAxes(pk.axis);
      const face = pk.axis === 2 && pk.side > 0 ? t('el frente') : t('la {face}', { face: t(faceName(pk.axis, pk.side)) });
      const where = (u: number, v: number) =>
        t('{u} desde {fromU} y {v} desde {fromV}', { u: n(u), fromU: t(MEASURED_FROM[ua]), v: n(v), fromV: t(MEASURED_FROM[va]) });
      const what = pk.through ? t('Corte en arco R {r}', { r: n(arc.radius) }) : t('Rebaje en arco R {r}', { r: n(arc.radius) });
      const removed = sh.outside
        ? { x: arc.chord / 2 - 4, y: arc.sagitta + 5, text: t('Se saca lo de afuera del arco') }
        : { x: arc.chord / 2 - 4, y: arc.sagitta > 14 ? arc.sagitta / 3 : -6, text: t('Se saca entre la cuerda y el arco') };
      sheets.push(
        ...tiledSheets({
          id: `${r.ids[0]}-${pk.id}`,
          // Lugar para la cota de la cuerda abajo y para la de la flecha a la derecha.
          b: { u0: Math.min(0, ...xs) - 8, u1: Math.max(arc.chord, ...xs) + 22, v0: Math.min(0, ...ys) - 16, v1: Math.max(...ys) + 10 },
          title: t('Plantilla {id} · {part}', { id: pk.id, part: r.ids[0]! }),
          hint: (k, total) => (total > 1 ? t('Arco R {r}, hoja {k} de {total}', { r: n(arc.radius), k, total }) : t('Arco R {r} a tamaño real', { r: n(arc.radius) })),
          heading: `${r.name} · ${r.ids.join(', ')} · ${pk.id}`,
          note: t('{what}, cuerda {chord}, flecha {sagitta}, en {face}: la cuerda va de {from} a {to}.', {
            what,
            chord: n(arc.chord),
            sagitta: n(arc.sagitta),
            face,
            from: where(sh.u, sh.v),
            to: where(sh.u2, sh.v2),
          }),
          draw: (at) => {
            const pts = arc.points.map((q) => `${px(at, q[0])},${py(at, q[1])}`).join(' ');
            return (
              <>
                {!sh.outside && <polygon points={pts} className={styles.cutAway} />}
                <g className={styles.contour}>
                  <polyline points={pts} className={styles.templateArc} />
                </g>
                <g className={styles.guide}>
                  <line x1={px(at, 0)} y1={py(at, 0)} x2={px(at, arc.chord)} y2={py(at, 0)} />
                  <line x1={px(at, 0)} y1={py(at, -5)} x2={px(at, 0)} y2={py(at, 5)} />
                  <line x1={px(at, arc.chord)} y1={py(at, -5)} x2={px(at, arc.chord)} y2={py(at, 5)} />
                  <line x1={px(at, arc.chord / 2)} y1={py(at, -5)} x2={px(at, arc.chord / 2)} y2={py(at, arc.sagitta + 5)} className={styles.axisLine} />
                </g>
                <g className={styles.notes}>
                  <text x={px(at, 0) + 1.5} y={py(at, 0) + 4} className={styles.cellMeta}>
                    {t('Inicio')}
                  </text>
                  <text x={px(at, arc.chord) - 1.5} y={py(at, 0) + 4} textAnchor="end" className={styles.cellMeta}>
                    {t('Fin')}
                  </text>
                  <text x={px(at, removed.x)} y={py(at, removed.y)} textAnchor="end" className={styles.cellMeta}>
                    {removed.text}
                  </text>
                </g>
                <Dim from={px(at, 0)} to={px(at, arc.chord)} at={py(at, 0)} offset={10} text={t('cuerda {n}', { n: n(arc.chord) })} />
                <Dim vertical from={py(at, arc.sagitta)} to={py(at, 0)} at={px(at, arc.chord / 2)} offset={8} text={t('flecha {n}', { n: n(arc.sagitta) })} />
              </>
            );
          },
        }),
      );
    }
    if (part.turning) sheets.push(...turningTemplate(part, part.turning, r, n));
  }
  return sheets;
}

/**
 * Plantilla 1:1 del torneado: la silueta entera acostada sobre su eje, con cada estación marcada de arriba abajo,
 * su distancia desde la punta y su diámetro. Recortada por el contorno sirve de plantilla para ir comparando en el torno;
 * apoyada sobre el taco, de regla para marcar las estaciones.
 */
function turningTemplate(part: Part, turning: Turning, r: CutRow, n: (mm: number) => string): SheetDef[] {
  const { len, side } = turnBlank(part, turning.axis);
  const R = side / 2;
  const half = turnOutline(part, turning, 0.5);
  const st = turning.stations;
  const segs = turnSegments(part, turning);
  const square = (i: number) => (i === 0 || st[i]!.to === 'square') && (i === st.length - 1 || st[i + 1]!.to === 'square');
  const from = t(MEASURED_FROM[turning.axis]);
  return tiledSheets({
    id: `${r.ids[0]}-torneado`,
    // Arriba, los diámetros; abajo, las distancias; a los costados, las puntas.
    b: { u0: -12, u1: len + 12, v0: -R - 26, v1: R + 22 },
    title: t('Torneado · {part}', { part: r.ids[0]! }),
    hint: (k, total) => (total > 1 ? t('Perfil del torneado, hoja {k} de {total}', { k, total }) : t('Perfil del torneado a tamaño real')),
    heading: `${r.name} · ${r.ids.join(', ')}`,
    note: t('Taco de {side} × {side} × {len}. Las distancias se miden desde {from}; con el calibre llevá cada diámetro a su estación.', {
      side: n(side),
      len: n(len),
      from,
    }),
    draw: (at) => {
      const line = (sign: 1 | -1) => half.map(([u, v]) => `${px(at, u)},${py(at, sign * v)}`).join(' ');
      const outline = `${line(1)} ${half
        .slice()
        .reverse()
        .map(([u, v]) => `${px(at, u)},${py(at, -v)}`)
        .join(' ')}`;
      return (
        <>
          <rect x={px(at, 0)} y={py(at, R)} width={len} height={side} className={styles.turnBlankTpl} />
          <polygon points={outline} className={styles.turnTpl} />
          <line x1={px(at, -8)} y1={py(at, 0)} x2={px(at, len + 8)} y2={py(at, 0)} className={styles.axisLine} />
          {segs
            .filter((s) => s.kind === 'square' && s.b[0] - s.a[0] > 24)
            .map((s, i) => (
              <text key={i} x={px(at, (s.a[0] + s.b[0]) / 2)} y={py(at, 0) - 1.5} textAnchor="middle" className={styles.cellMeta}>
                {t('queda cuadrado')}
              </text>
            ))}
          <g className={styles.dim}>
            {st.map((s, i) => (
              <g key={i}>
                <line x1={px(at, s.at)} y1={py(at, R + 2)} x2={px(at, s.at)} y2={py(at, -R - 4)} />
                <text x={px(at, s.at) + 1} y={py(at, -R - 5)} transform={`rotate(-90 ${px(at, s.at) + 1} ${py(at, -R - 5)})`} textAnchor="end">
                  {i + 1} · {n(s.at)}
                </text>
                {!square(i) && (
                  <text x={px(at, s.at) + 1} y={py(at, R + 3)} transform={`rotate(-90 ${px(at, s.at) + 1} ${py(at, R + 3)})`} textAnchor="start">
                    Ø {n(s.d)}
                  </text>
                )}
              </g>
            ))}
          </g>
          <text x={px(at, 0)} y={py(at, -R - 22)} className={styles.cellMeta}>
            {t('Punta de {side}', { side: from })}
          </text>
        </>
      );
    },
  });
}

/** Barra de 10 cm con marcas cada centímetro, para comprobar que la hoja salió a tamaño real. */
function Ruler({ x, y }: { x: number; y: number }) {
  return (
    <g className={styles.ruler}>
      <rect x={x} y={y - 2} width={100} height={2} />
      {Array.from({ length: 11 }, (_, i) => (
        <line key={i} x1={x + i * 10} y1={y - 2} x2={x + i * 10} y2={y - (i % 5 === 0 ? 5 : 3.6)} />
      ))}
      <text x={x + 104} y={y}>
        10 cm
      </text>
    </g>
  );
}

const buildSheets = (project: Project, refine: Refine) => [
  generalSheet(project, refine),
  ...partSheets(project, refine),
  ...jointSheets(project, refine),
  ...templateSheets(project),
];

export function PlanView({ project }: { project: Project }) {
  // Primero con cajas, para saber qué vistas pedirle al motor; después cada vista cambia a la forma exacta cuando llega.
  const wanted = useMemo(() => {
    const views: EngineView[] = [];
    buildSheets(project, (d) => {
      if (d.engine) views.push(d.engine);
      return d;
    });
    return views;
  }, [project]);
  const refine = useEngineLines(project, wanted);
  const sheets = useMemo(() => buildSheets(project, refine), [project, refine]);
  const [current, setCurrent] = useState(0);
  const [layers, setLayers] = useState<Set<Layer>>(() => new Set<Layer>(['contornos', 'cotas', 'ocultas', 'notas']));
  const index = Math.min(current, sheets.length - 1);
  const toggle = (k: Layer, on: boolean) => {
    const next = new Set(layers);
    if (on) next.add(k);
    else next.delete(k);
    setLayers(next);
  };

  if (!project.parts.length) {
    return (
      <main className={styles.empty}>
        <h1>{t('Todavía no hay piezas')}</h1>
        <p>{t('Agregá piezas en el modelo y acá aparece el plano.')}</p>
      </main>
    );
  }

  return (
    <main className={styles.plan}>
      <aside className={styles.aside} aria-label={t('Hojas y capas')}>
        <nav className={styles.card} aria-label={t('Hojas del plano')}>
          <h2 className={styles.eyebrow}>{t('Hojas')}</h2>
          <div className={styles.sheetList}>
            {sheets.map((s, i) => (
              <button key={s.key} type="button" aria-current={i === index ? 'page' : undefined} onClick={() => setCurrent(i)}>
                <strong>
                  {i + 1} · {s.title}
                </strong>
                <span>{s.hint}</span>
              </button>
            ))}
          </div>
        </nav>
        <details className={styles.card} open>
          <summary className={styles.eyebrow}>{t('Capas')}</summary>
          <fieldset className={styles.layers}>
            <legend className={styles.srOnly}>{t('Capas del plano')}</legend>
            {LAYERS.map(([k, label]) => (
              <label key={k}>
                <input type="checkbox" checked={layers.has(k)} onChange={(e) => toggle(k, e.target.checked)} />
                <span className={styles[`swatch-${k}`]} aria-hidden="true">
                  {k === 'notas' ? 'Aa' : ''}
                </span>
                {t(label)}
              </label>
            ))}
          </fieldset>
        </details>
        <button type="button" className={styles.pdf} onClick={() => window.print()}>
          <IconDownload />
          {t('Descargar PDF')}
        </button>
        <p className={styles.note}>{t('Se abre la ventana de impresión: elegí «Guardar como PDF». Salen las {n} hojas en A4 apaisado.', { n: sheets.length })}</p>
      </aside>
      <section className={styles.desk} aria-label={t('Hoja {n}: {title}', { n: index + 1, title: sheets[index]?.title ?? '' })}>
        {sheets.map((s, i) => (
          <div key={s.key} className={styles.page} data-current={i === index || undefined}>
            <Sheet def={s} n={i + 1} of={sheets.length} project={project} layers={layers} />
          </div>
        ))}
      </section>
    </main>
  );
}

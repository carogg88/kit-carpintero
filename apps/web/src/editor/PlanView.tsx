import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  arcTemplate,
  cutList,
  describePartJoints,
  drawJointDetail,
  drawPart,
  drawView,
  faceLabelOf,
  formatAngle,
  facePattern,
  faceName,
  formatNumber,
  groupJoints,
  JOINT_NAMES,
  MEASURED_FROM,
  otherAxes,
  partBox,
  patternDetails,
  shapeBounds,
  shapePlace,
  t,
  tk,
  turnBlank,
  turnOutline,
  turnSegments,
  type CutRow,
  type Drawing,
  type AngleMark,
  type ArcMark,
  type Part,
  type Turning,
  type EngineView,
  type FacePattern,
  type PatternShape,
  type Project,
  type Rect2,
  type Units,
  plainJoint,
} from '@kitc/core';
import { IconDownload, IconZoomIn, IconZoomOut } from './icons';
import { capitalize, formatIds, woodName } from './cutsData';
import { shoot, type Shot } from './planShots';
import { useEngineLines, type ExactMesh } from './useGeometry';
import styles from './Plan.module.css';
import { projectName } from '../i18n';
import { BrandLogo } from '../brand/Brand';

/** Hoja A4 apaisada, en mm de papel. */
const W = 297;
const H = 210;
const M = 10;
const TITLE_W = 118;
const TITLE_H = 22;
/** La casilla del logo, pegada a la izquierda del rótulo. */
const BRAND_W = 26;
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

/** Foto en 3D de algunas piezas (o de todas), del tamaño pedido en mm de papel. */
type Shooter = (parts: string[] | undefined, w: number, h: number, labels?: boolean) => Shot | null;

/** Píxeles de las fotos 3D por mm de papel: alcanza para imprimir nítido. */
const SHOT_PX = 8;

/**
 * Un color por tipo de pieza, el mismo en la hoja del mueble y en el despiece: claros, para que se lean los
 * códigos y las aristas encima, y distintos entre sí aun impresos en una impresora común.
 */
const PIECE_COLORS = ['#d8b07e', '#93b38a', '#86a9c9', '#e0a35f', '#c48a7a', '#a99bc4', '#7fb8ae', '#c9b45c', '#b5a48f', '#d79bb0'];

/** Lista de códigos corta: "P1 a P4" si son correlativas, "F3, F4, R3" si no. */
const codes = formatIds;

/** Corta un texto en renglones de hasta `max` letras, sin partir palabras. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + word.length + 1 > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

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

/** Ángulo de una punta cortada en ángulo, entre el canto y la punta: el que se toma con la falsa escuadra. */
function AngleArc({ m, at, text }: { m: AngleMark; at: Place; text: string }) {
  const x = px(at, m.at[0]);
  const y = py(at, m.at[1]);
  const r = 6;
  // En la hoja y crece hacia abajo.
  const a: [number, number] = [m.a[0], -m.a[1]];
  const b: [number, number] = [m.b[0], -m.b[1]];
  const sweep = a[0] * b[1] - a[1] * b[0] > 0 ? 1 : 0;
  const mid = [a[0] + b[0], a[1] + b[1]];
  const len = Math.hypot(mid[0]!, mid[1]!) || 1;
  const tx = x + (mid[0]! / len) * (r + 4);
  const ty = y + (mid[1]! / len) * (r + 4) + 1;
  return (
    <g className={styles.dim}>
      <path d={`M ${x + a[0] * r} ${y + a[1] * r} A ${r} ${r} 0 0 ${sweep} ${x + b[0] * r} ${y + b[1] * r}`} fill="none" />
      <text x={tx} y={ty} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

function TitleBlock({ project, sheet, of, scale, units }: { project: Project; sheet: number; of: number; scale: number | null | 'none'; units: Units }) {
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
      <rect x={x - BRAND_W} y={y} width={BRAND_W} height={TITLE_H} />
      <BrandLogo x={x - BRAND_W + (BRAND_W - 17) / 2} y={y + 2.5} height={17} />
      {cell(x, y, 80, t('Proyecto'), projectName(project.name))}
      {cell(x + 80, y, TITLE_W - 80, t('Hoja'), t('{n} de {total}', { n: sheet, total: of }), true)}
      {cell(x, y + TITLE_H / 2, 30, t('Escala'), scale === 'none' ? t('Sin escala') : scale ? `1:${scale}` : t('Indicada'), true)}
      {cell(x + 30, y + TITLE_H / 2, 30, t('Medidas'), units === 'cm' ? 'cm' : t('pulgadas'), true)}
      {cell(x + 60, y + TITLE_H / 2, TITLE_W - 60, t('Madera'), woods)}
    </g>
  );
}

interface SheetDef {
  key: string;
  title: string;
  hint: string;
  /** Escala de toda la hoja, null si cada dibujo lleva la suya, o 'none' si es un dibujo en 3D sin escala. */
  scale: number | null | 'none';
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

/** Lo que va en la columna de la derecha de la hoja del mueble: el ancho del rótulo, para que queden alineados. */
const KEY_X = W - M - TITLE_W;

/** Muestra de cada tipo de línea, para la leyenda: las mismas clases que en los dibujos. */
const LINE_SAMPLES: { key: string; label: string; draw: (x: number, y: number) => ReactNode }[] = [
  {
    key: 'contorno',
    label: tk('Contorno: el borde de la pieza que se ve.'),
    draw: (x, y) => (
      <g className={styles.contour}>
        <line x1={x} y1={y} x2={x + 12} y2={y} />
      </g>
    ),
  },
  {
    key: 'oculta',
    label: tk('Línea oculta: un borde que queda detrás o adentro de la madera.'),
    draw: (x, y) => (
      <g className={styles.hidden}>
        <line x1={x} y1={y} x2={x + 12} y2={y} />
      </g>
    ),
  },
  {
    key: 'cota',
    label: tk('Cota: una medida, de marca a marca.'),
    draw: (x, y) => <Dim from={x} to={x + 12} at={y + 2.2} offset={-1.6} text="75" />,
  },
  {
    key: 'encastre',
    label: tk('Encastre resaltado: espiga, mortaja o agujero.'),
    draw: (x, y) => (
      <rect x={x} y={y - 1.4} width={12} height={2.8} className={styles.jointSample} />
    ),
  },
];

/**
 * Hoja 1: el mueble armado en 3D, cada pieza con su código y su color, la tabla de piezas, cómo leer las líneas
 * y qué hay en cada hoja. Es la que se mira primero en el taller.
 */
function overviewSheet(project: Project, colors: ReadonlyMap<string, string>, shots: Shooter, rest: SheetDef[]): SheetDef {
  const n = (mm: number) => formatNumber(mm, project.units);
  const img = { x: M + 4, y: M + 15, w: KEY_X - M - 8, h: H - M - 19 };
  const shot = shots(undefined, img.w, img.h, true);
  const hidden = new Set(shot?.hidden ?? []);
  const rows = cutList(project);

  // Columna derecha, de arriba abajo: piezas, líneas, escala y hojas.
  const x = KEY_X;
  let y = M + 6;
  const body: ReactNode[] = [];
  const heading = (text: string) => {
    body.push(
      <text key={`h-${text}`} x={x} y={y} className={styles.keyHeading}>
        {text}
      </text>,
    );
    y += 5;
  };
  heading(t('Piezas'));
  // Lugar para la tabla: lo que no ocupan las líneas, la escala y la lista de hojas.
  const groups = sheetGroups(rest);
  const room = H - M - TITLE_H - 6 - y - (5 + LINE_SAMPLES.length * 6 + 3) - 12 - (5 + groups.length * 4.4 + 2);
  const fit = Math.max(1, Math.floor(room / 5));
  const shown = rows.length > fit ? rows.slice(0, fit - 1) : rows;
  for (const r of shown) {
    const part = project.parts.find((p) => p.id === r.ids[0])!;
    const size = [...partBox(part).max.map((v, i) => v - partBox(part).min[i]!)].sort((a, b) => b - a);
    const out = r.ids.every((id) => hidden.has(id));
    body.push(
      <g key={`r-${r.ids.join()}`}>
        <rect x={x} y={y - 2.9} width={3.6} height={3.6} rx={0.6} fill={colors.get(r.ids[0]!)} className={styles.swatch} />
        <text x={x + 6} y={y} className={styles.keyCode}>
          {codes(r.ids)}
        </text>
        <text x={x + 27} y={y} className={styles.keyText}>
          {r.ids.length > 1 ? `${r.name} × ${r.ids.length}` : r.name}
          {out && <tspan className={styles.keyMuted}> · {t('tapada')}</tspan>}
        </text>
        <text x={x + TITLE_W} y={y} textAnchor="end" className={styles.keyNum}>
          {size.map(n).join(' × ')}
        </text>
      </g>,
    );
    y += 5;
  }
  if (shown.length < rows.length) {
    body.push(
      <text key="more" x={x + 6} y={y} className={styles.keyMuted}>
        {t('Y {n} más en el despiece', { n: rows.length - shown.length })}
      </text>,
    );
    y += 5;
  }
  y += 3;
  heading(t('Cómo leer las líneas'));
  for (const l of LINE_SAMPLES) {
    body.push(
      <g key={`l-${l.key}`}>
        {l.draw(x, y - 1)}
        <text x={x + 16} y={y} className={styles.keyText}>
          {t(l.label)}
        </text>
      </g>,
    );
    y += 6;
  }
  y += 3;
  body.push(
    <text key="escala" x={x} y={y} className={styles.keyText}>
      {t('Escala 1:10 quiere decir que 1 cm en la hoja son 10 cm de verdad.')}
    </text>,
    <text key="escala-2" x={x} y={y + 4} className={styles.keyMuted}>
      {t('Cada hoja dice la suya abajo. Las cotas van en {units}: no hace falta medir el papel.', { units: project.units === 'cm' ? 'cm' : t('pulgadas') })}
    </text>,
  );
  y += 12;
  heading(t('Qué hay en cada hoja'));
  for (const g of groups) {
    body.push(
      <text key={`g-${g.from}`} x={x} y={y} className={styles.keyText}>
        <tspan className={styles.keyCode}>{g.from === g.to ? g.from : t('{a} a {b}', { a: g.from, b: g.to })}</tspan>
        <tspan dx={2}>
          {g.title} · {g.hint}
        </tspan>
      </text>,
    );
    y += 4.4;
  }

  return {
    key: 'mueble',
    title: t('El mueble'),
    hint: t('En 3D, con el código de cada pieza'),
    scale: 'none',
    body: (
      <>
        <text x={M + 6} y={M + 6} className={styles.cellTitle}>
          {t('El mueble armado')}
        </text>
        <text x={M + 6} y={M + 11} className={styles.cellMeta}>
          {t('Cada pieza lleva su código: es el mismo en el despiece, en las uniones y en la lista de cortes.')}
        </text>
        {shot ? (
          <>
            <image href={shot.url} x={img.x} y={img.y} width={img.w} height={img.h} />
            <g className={styles.notes}>
              {shot.labels.map((l) => {
                const w = l.id.length * 1.7 + 2.6;
                const cx = img.x + l.x * img.w;
                const cy = img.y + l.y * img.h;
                return (
                  <g key={l.id}>
                    <rect x={cx - w / 2} y={cy - 2.1} width={w} height={4.2} rx={1.2} className={styles.tag} stroke={colors.get(l.id)} />
                    <text x={cx} y={cy + 1} textAnchor="middle" className={styles.tagText}>
                      {l.id}
                    </text>
                  </g>
                );
              })}
            </g>
          </>
        ) : (
          <text x={img.x + img.w / 2} y={img.y + img.h / 2} textAnchor="middle" className={styles.cellMeta}>
            {t('Este navegador no puede dibujar en 3D: el mueble se ve en la hoja de vistas generales.')}
          </text>
        )}
        {body}
      </>
    ),
  };
}

/** Hojas seguidas del mismo tipo juntas, para la lista de la hoja 1: "3 a 4 · Despiece". */
function sheetGroups(sheets: SheetDef[]): { from: number; to: number; title: string; hint: string }[] {
  const kind = (s: SheetDef) => s.key.replace(/-.*$/, '');
  const out: { from: number; to: number; title: string; hint: string; kind: string }[] = [];
  sheets.forEach((s, i) => {
    const last = out[out.length - 1];
    // Son las que siguen a la del mueble, que es la 1: la primera de estas es la 2.
    if (last && last.kind === kind(s)) last.to = i + 2;
    else out.push({ from: i + 2, to: i + 2, title: s.title.replace(/ \d+$/, ''), hint: s.hint, kind: kind(s) });
  });
  return out.map((g) => {
    const many = g.to > g.from;
    const hint = g.kind === 'plantilla' ? t('Plantillas a tamaño real') : g.hint;
    return { from: g.from, to: g.to, title: g.kind === 'plantilla' ? t('Plantillas 1:1') : g.title, hint: many && g.kind === 'piezas' ? t('Cada pieza acotada') : hint };
  });
}

/** Hoja 2: frente, costado y planta con las medidas generales. */
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

/**
 * Puntos donde empiezan y terminan los encastres sobre cada eje del dibujo, con las puntas de la pieza y de lo que
 * sobresale: para acotarlos en cadena arriba y a la derecha. Sin encastres que caigan adentro, no hay cadena.
 */
function jointStops(d: Drawing, id: string): { u: number[]; v: number[] } {
  const body = d.rects.find((r) => r.id === id)?.rect;
  if (!body || !d.joints.length) return { u: [], v: [] };
  const chain = (lo: number, hi: number, outer: [number, number], edges: number[]) => {
    const inner = edges.filter((x) => x > lo + 0.5 && x < hi - 0.5);
    if (!inner.length && outer[0] > lo - 0.5 && outer[1] < hi + 0.5) return [];
    const all = [outer[0], lo, ...inner, hi, outer[1]].sort((a, b) => a - b);
    return all.filter((x, i) => i === 0 || x - all[i - 1]! > 0.5);
  };
  return {
    u: chain(body.u0, body.u1, [d.bounds.u0, d.bounds.u1], d.joints.flatMap((r) => [r.u0, r.u1])),
    v: chain(body.v0, body.v1, [d.bounds.v0, d.bounds.v1], d.joints.flatMap((r) => [r.v0, r.v1])),
  };
}

/** Lugar de la foto 3D en cada pieza del despiece, en mm de papel. */
const THUMB = { w: 32, h: 26 };
/** Letras que entran en un renglón de nota de una celda del despiece. */
const NOTE_CHARS = 98;
const NOTE_LINE = 3.3;

/** Despiece: cada pieza distinta, acotada, con sus espigas y mortajas, su foto en 3D y dónde marcar cada encastre. */
function partSheets(project: Project, refine: Refine, colors: ReadonlyMap<string, string>, shots: Shooter): SheetDef[] {
  const n = (mm: number) => formatNumber(mm, project.units);
  const rows = cutList(project);
  // Cuatro por hoja: lugar para el dibujo, la foto y las frases de dónde marcar.
  const PER = 4;
  const sheets: SheetDef[] = [];
  for (let i = 0; i < rows.length; i += PER) {
    const chunk = rows.slice(i, i + PER);
    const cols = 2;
    const nRows = Math.max(2, Math.ceil(chunk.length / cols));
    const cellW = (W - 2 * M) / cols;
    const cellH = (H - 2 * M - TITLE_H) / nRows;
    const drawn = chunk.map((r) => {
      const part = project.parts.find((p) => p.id === r.ids[0])!;
      const d = refine(drawPart(project, part));
      const marks = describePartJoints(project, part, n);
      const notes = [...marks, ...(r.work.length ? [capitalize(r.work.join(' · '))] : [])];
      if (d.angles?.length) notes.push(t('Los ángulos dibujados son los de la falsa escuadra: entre el canto y la punta larga.'));
      if (r.ids.length > 1 && marks.length) {
        notes.push(t('Medido en {id}; las otras son iguales, o en espejo donde haga falta.', { id: r.ids[0]! }));
      }
      const stops = jointStops(d, part.id);
      // La foto va a la derecha del dibujo o abajo, al lado de las notas: la que deje el dibujo más grande.
      // Con tramos, la cota en cadena va pegada a la pieza y la total más afuera: hace falta un poco más de lugar.
      // Un torneado lleva los diámetros arriba y las distancias abajo; los encastres, su cadena arriba y a la derecha.
      const extraU = (d.stops?.v.length ? 6 : 0) + (stops.v.length ? 9 : 0);
      const extraV = (d.stops?.u.length ? 6 : 0) + (d.turns?.length ? 20 : stops.u.length ? 7 : 0);
      const layouts = (['side', 'below'] as const).map((thumbAt) => {
        const all = notes.flatMap((x) => wrap(x, thumbAt === 'side' ? NOTE_CHARS : Math.floor((NOTE_CHARS * (cellW - 16 - THUMB.w)) / (cellW - 12))));
        // Siempre queda lugar para el dibujo: si las notas no entran, siguen en la hoja de encastres.
        const max = Math.floor((cellH - 40) / NOTE_LINE);
        const lines = all.length > max ? [...all.slice(0, max - 1), t('Sigue en la hoja de encastres.')] : all;
        const notesH = thumbAt === 'side' ? lines.length * NOTE_LINE : Math.max(lines.length * NOTE_LINE, THUMB.h + 2);
        const width = cellW - 30 - extraU - (thumbAt === 'side' ? THUMB.w + 4 : 0);
        const scale = pickScale((s) => (d.bounds.u1 - d.bounds.u0) / s <= width && (d.bounds.v1 - d.bounds.v0) / s <= cellH - 22 - extraV - notesH);
        return { thumbAt, lines, scale };
      });
      const best = layouts[1]!.scale < layouts[0]!.scale ? layouts[1]! : layouts[0]!;
      return { r, part, d, stops, ...best };
    });
    const scales = new Set(drawn.map((x) => x.scale));
    sheets.push({
      key: `piezas-${i}`,
      title: rows.length > PER ? t('Despiece {n}', { n: i / PER + 1 }) : t('Despiece'),
      hint: t('Cada pieza acotada'),
      scale: scales.size === 1 ? [...scales][0]! : null,
      body: drawn.map((x, k) => {
        const { r, part, d, stops, lines, scale, thumbAt } = x;
        const cx = M + (k % cols) * cellW;
        const cy = M + Math.floor(k / cols) * cellH;
        const p: Place = { x: cx + 16, y: cy + 12 + (d.turns?.length ? 9 : stops.u.length ? 6 : 0), s: scale, b: d.bounds };
        const below = d.stops?.u.length ? 11 : d.turns?.length ? 15 : 5;
        const size = partBox(part);
        const thick = Math.min(...size.max.map((v, j) => v - size.min[j]!));
        const thumb = thumbAt === 'side' ? { x: cx + cellW - 6 - THUMB.w, y: cy + 9 } : { x: cx + cellW - 6 - THUMB.w, y: cy + cellH - 2 - THUMB.h };
        const shot = shots([part.id], THUMB.w, THUMB.h);
        // Una cadena se dibuja si cada medida entra entre sus marcas; solo la del extremo puede ir afuera.
        const readable = (pts: number[], last: 'first' | 'last') =>
          pts.length > 2 &&
          pts.slice(1).every((b, j) => {
            const room = Math.abs(b - pts[j]!) / scale > n(b - pts[j]!).length * 1.8 + 2;
            return room || (last === 'last' ? j === pts.length - 2 : j === 0);
          });
        const chainU = !d.turns?.length && readable(stops.u, 'last') ? stops.u : [];
        // En la cadena vertical, la medida que puede ir afuera es la de abajo: la primera de la lista.
        const chainV = readable(stops.v, 'first') ? stops.v : [];
        return (
          <g key={r.ids.join()}>
            <text x={cx + 6} y={cy + 6} className={styles.cellTitle}>
              {r.name} · {r.ids.join(', ')}
            </text>
            <text x={cx + cellW - 6} y={cy + 6} textAnchor="end" className={styles.cellMeta}>
              × {r.ids.length} · {woodName(r.wood)} · {t('espesor {n}', { n: n(thick) })} · 1:{scale}
            </text>
            {shot && (
              <g>
                <rect x={thumb.x} y={thumb.y} width={THUMB.w} height={THUMB.h} rx={1.5} className={styles.thumbBox} />
                <image href={shot.url} x={thumb.x + 1} y={thumb.y + 1} width={THUMB.w - 2} height={THUMB.h - 2} />
                <rect x={thumb.x + 2} y={thumb.y + 2} width={3} height={3} rx={0.5} fill={colors.get(part.id)} className={styles.swatch} />
              </g>
            )}
            <Lines d={d} at={p} />
            <Chain stops={d.stops?.u} lo={d.bounds.u0} hi={d.bounds.u1} render={(a, b, k) => <Dim key={k} from={px(p, a)} to={px(p, b)} at={py(p, d.bounds.v0)} offset={5} text={n(b - a)} />} />
            <Chain stops={d.stops?.v} lo={d.bounds.v0} hi={d.bounds.v1} render={(a, b, k) => <Dim key={k} vertical from={py(p, b)} to={py(p, a)} at={px(p, d.bounds.u0)} offset={-5} text={n(b - a)} />} />
            {chainU.slice(1).map((b, j) => (
              <Dim key={`ju${j}`} from={px(p, chainU[j]!)} to={px(p, b)} at={py(p, d.bounds.v1)} offset={-5} text={n(b - chainU[j]!)} />
            ))}
            {chainV.slice(1).map((b, j) => (
              <Dim key={`jv${j}`} vertical from={py(p, b)} to={py(p, chainV[j]!)} at={px(p, d.bounds.u1)} offset={5} text={n(b - chainV[j]!)} />
            ))}
            <TurnDims d={d} at={p} n={n} />
            <Dim from={px(p, d.bounds.u0)} to={px(p, d.bounds.u1)} at={py(p, d.bounds.v0)} offset={below} text={n(d.bounds.u1 - d.bounds.u0)} />
            <Dim vertical from={py(p, d.bounds.v1)} to={py(p, d.bounds.v0)} at={px(p, d.bounds.u0)} offset={d.stops?.v.length ? -11 : -5} text={n(d.bounds.v1 - d.bounds.v0)} />
            {d.arcs?.map((m) => <Radius key={m.id} m={m} at={p} text={`R ${n(m.radius)}`} />)}
            {d.angles?.map((m, j) => <AngleArc key={`ang${j}`} m={m} at={p} text={formatAngle(Math.round(m.deg * 2) / 2)} />)}
            {lines.length > 0 && (
              <text className={`${styles.notes} ${styles.cellMeta}`}>
                {lines.map((l, j) => (
                  <tspan key={j} x={cx + 6} y={cy + cellH - 3 - (lines.length - 1 - j) * NOTE_LINE}>
                    {l}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        );
      }),
    });
  }
  return sheets;
}

/** Desde dónde se mira cada vista de detalle, según el eje de profundidad: siempre desde el lado positivo. */
const VIEW_NAMES = [tk('Vista de costado'), tk('Vista desde arriba'), tk('Vista de frente')] as const;

/** Hoja de encastres: un detalle por grupo de uniones con cortes, en dos vistas con su nombre. */
function jointSheets(project: Project, refine: Refine): SheetDef[] {
  const n = (mm: number) => formatNumber(mm, project.units);
  const groups = groupJoints(project).filter((g) => g.joints.some((j) => !plainJoint(j)));
  const details = groups
    .map((g) => {
      const j = g.joints.find((x) => !plainJoint(x))!;
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
      pickScale((s) => d.views.every((v) => (v.bounds.u1 - v.bounds.u0) / s <= viewW - 34 && (v.bounds.v1 - v.bounds.v0) / s <= rowH - 24));
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
                  <text x={px(p, (v.bounds.u0 + v.bounds.u1) / 2)} y={py(p, v.bounds.v0) + 10} textAnchor="middle" className={`${styles.notes} ${styles.viewName}`}>
                    {t(VIEW_NAMES[d.projections[vi]!.depth])}
                  </text>
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
function tileGrid(b: Rect2): { cols: number; rows: number } {
  const count = (c: number, r: number) => (c <= r ? 1 : Math.ceil((c - OVERLAP) / (r - OVERLAP)));
  return { cols: count(b.u1 - b.u0, TPL.x1 - TPL.x0), rows: count(b.v1 - b.v0, TPL.y1 - TPL.y0) };
}

function tiledSheets({ id, b, title, hint, heading, note, draw }: TiledTemplate): SheetDef[] {
  const rw = TPL.x1 - TPL.x0;
  const rh = TPL.y1 - TPL.y0;
  const cw = b.u1 - b.u0;
  const ch = b.v1 - b.v0;
  const { cols, rows } = tileGrid(b);
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

/** Hasta cuántas hojas se imprime la cara entera; si hacen falta más, una plantilla de detalle por forma. */
const WHOLE_FACE_SHEETS = 4;

/**
 * Plantillas 1:1: la cara de cada pieza con curvas o calados (entera si entra en pocas hojas, y si no cada esquina
 * y cada calado con lo que lo rodea), cada arco acostado sobre su cuerda y cada torneado acostado sobre su eje.
 */
function templateSheets(project: Project): SheetDef[] {
  const n = (mm: number) => formatNumber(mm, project.units);
  const sheets: SheetDef[] = [];
  for (const r of cutList(project)) {
    const part = project.parts.find((p) => p.id === r.ids[0])!;
    const traced = faceSheets(part, r, n);
    sheets.push(...traced.sheets);
    for (const pk of part.pockets) {
      if (pk.shape.kind !== 'arc') continue;
      // En la cara entera ya está dibujado en su lugar.
      if (traced.whole && pk.axis === traced.whole.axis) continue;
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

const poly = (at: Place, pts: [number, number][]) => pts.map(([x, y]) => `${px(at, x)},${py(at, y)}`).join(' ');

/** Los tramos del borde de lo que se saca que no van sobre el canto de la pieza: la línea nueva, la que se calca. */
function traceSegments(p: FacePattern, pts: [number, number][]): [[number, number], [number, number]][] {
  const onEdge = (a: [number, number], b: [number, number]) =>
    (Math.abs(a[0]) < 0.01 && Math.abs(b[0]) < 0.01) ||
    (Math.abs(a[0] - p.width) < 0.01 && Math.abs(b[0] - p.width) < 0.01) ||
    (Math.abs(a[1]) < 0.01 && Math.abs(b[1]) < 0.01) ||
    (Math.abs(a[1] - p.height) < 0.01 && Math.abs(b[1] - p.height) < 0.01);
  return pts.map((a, i) => [a, pts[(i + 1) % pts.length]!] as [[number, number], [number, number]]).filter(([a, b]) => !onEdge(a, b));
}

/** La cara a tamaño real: el canto de la pieza fino, lo que se saca rayado, la línea a calcar gruesa y los vaciados de puntos. */
function FaceDrawing({ p, at, n, guides }: { p: FacePattern; at: Place; n: (mm: number) => string; guides?: PatternShape[] }) {
  const cuts = p.shapes.filter((s) => s.kind === 'cut');
  const blind = p.shapes.filter((s) => s.kind === 'pocket');
  // El id va en el medio de la forma; en un círculo, abajo de la cruz del centro.
  const label = (s: PatternShape): [number, number] => {
    if (s.circle) return [s.circle.c[0], s.circle.c[1] - Math.min(s.circle.r * 0.6, 6) - 3];
    const b = shapeBounds(s.points);
    return [(b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2];
  };
  const edge = (f: { axis: 0 | 1 | 2; side: 1 | -1 }) => t(faceName(f.axis, f.side));
  // El nombre de cada canto, en el medio de lo que se ve de ese canto en la hoja.
  const mid = (lo: number, hi: number, a: number, b: number) => (Math.max(lo, a) + Math.min(hi, b)) / 2;
  const cx = mid(0, p.width, at.b.u0 + 12, at.b.u1 - 12);
  const cy = mid(0, p.height, at.b.v0 + 12, at.b.v1 - 12);
  return (
    <>
      {cuts.map((s) => (
        <polygon key={s.id} points={poly(at, s.points)} className={styles.cutAway} />
      ))}
      <rect x={px(at, 0)} y={py(at, p.height)} width={p.width} height={p.height} className={styles.faceTpl} />
      {blind.map((s) => (
        <polygon key={s.id} points={poly(at, s.points)} className={styles.blindTpl} />
      ))}
      <g className={styles.contour}>
        {cuts.flatMap((s) =>
          traceSegments(p, s.points).map(([a, b], i) => <line key={`${s.id}-${i}`} x1={px(at, a[0])} y1={py(at, a[1])} x2={px(at, b[0])} y2={py(at, b[1])} className={styles.traceLine} />),
        )}
      </g>
      <g className={styles.guide}>
        {p.shapes
          .filter((s) => s.circle)
          .map((s) => {
            const [x, y] = s.circle!.c;
            const k = Math.min(6, s.circle!.r * 0.6);
            return (
              <g key={s.id}>
                <line x1={px(at, x - k)} y1={py(at, y)} x2={px(at, x + k)} y2={py(at, y)} />
                <line x1={px(at, x)} y1={py(at, y - k)} x2={px(at, x)} y2={py(at, y + k)} />
              </g>
            );
          })}
        {guides?.map((s) => {
          // Por el punto que ubica la forma, una línea a lo largo y otra a lo ancho: ahí van las marcas medidas desde los cantos.
          const [x, y] = s.circle?.c ?? s.anchor;
          return (
            <g key={`g-${s.id}`}>
              <line x1={px(at, at.b.u0)} y1={py(at, y)} x2={px(at, at.b.u1)} y2={py(at, y)} className={styles.axisLine} />
              <line x1={px(at, x)} y1={py(at, at.b.v0)} x2={px(at, x)} y2={py(at, at.b.v1)} className={styles.axisLine} />
            </g>
          );
        })}
      </g>
      <g className={styles.notes}>
        {p.shapes.map((s) => {
          const [x, y] = label(s);
          return (
            <text key={s.id} x={px(at, x)} y={py(at, y) + 1} textAnchor="middle" className={styles.shapeId}>
              {s.id}
            </text>
          );
        })}
        <text x={px(at, cx)} y={py(at, 0) - 2.5} textAnchor="middle" className={styles.edgeName}>
          {edge(p.edges.bottom)}
        </text>
        <text x={px(at, cx)} y={py(at, p.height) + 4.5} textAnchor="middle" className={styles.edgeName}>
          {edge(p.edges.top)}
        </text>
        <text x={px(at, 0) + 4.5} y={py(at, cy)} transform={`rotate(-90 ${px(at, 0) + 4.5} ${py(at, cy)})`} textAnchor="middle" className={styles.edgeName}>
          {edge(p.edges.left)}
        </text>
        <text x={px(at, p.width) - 2.5} y={py(at, cy)} transform={`rotate(90 ${px(at, p.width) - 2.5} ${py(at, cy)})`} textAnchor="middle" className={styles.edgeName}>
          {edge(p.edges.right)}
        </text>
      </g>
      {!guides && (
        <>
          <Dim from={px(at, 0)} to={px(at, p.width)} at={py(at, 0)} offset={10} text={n(p.width)} />
          <Dim vertical from={py(at, p.height)} to={py(at, 0)} at={px(at, p.width)} offset={8} text={n(p.height)} />
        </>
      )}
    </>
  );
}

/** La cara con curvas o calados: entera si entra en pocas hojas, y si no una plantilla por forma. */
function faceSheets(part: Part, r: CutRow, n: (mm: number) => string): { sheets: SheetDef[]; whole?: FacePattern } {
  const p = facePattern(part, n);
  if (!p) return { sheets: [] };
  const face = t(faceName(p.axis, p.side));
  const heading = `${r.name} · ${r.ids.join(', ')}`;
  const blindNote = p.shapes.some((s) => s.kind === 'pocket') ? ` ${t('De puntos, los vaciados que no atraviesan.')}` : '';
  const b: Rect2 = { u0: -10, v0: -16, u1: p.width + 22, v1: p.height + 8 };
  const { cols, rows } = tileGrid(b);
  if (cols * rows <= WHOLE_FACE_SHEETS) {
    return {
      whole: p,
      sheets: tiledSheets({
        id: `${r.ids[0]}-cara`,
        b,
        title: t('Contorno · {part}', { part: r.ids[0]! }),
        hint: (k, total) => (total > 1 ? t('La pieza entera, hoja {k} de {total}', { k, total }) : t('La pieza entera a tamaño real')),
        heading,
        note: `${t('Mirando {face} desde afuera. Lo rayado se saca: calcá la línea gruesa.', { face: faceLabelOf(p.axis, p.side) })}${blindNote}`,
        draw: (at) => <FaceDrawing p={p} at={at} n={n} />,
      }),
    };
  }
  const sheets: SheetDef[] = [];
  for (const d of patternDetails(p)) {
    const ids = d.shapes.map((g) => g.shape.id).join(', ');
    const what = d.shapes
      .map(({ shape, count }) => {
        const where = shape.source === 'bevel' ? '' : `, ${shapePlace(p, shape.circle?.c ?? shape.anchor, n)}`;
        const same = count > 1 ? `; ${t('sirve para las {n} esquinas iguales: girá la hoja', { n: count })}` : '';
        return `${shape.id}: ${shape.label}${where}${same}`;
      })
      .join(' · ');
    sheets.push(
      ...tiledSheets({
        id: `${r.ids[0]}-${ids}`,
        b: d.b,
        title: t('Plantilla {id} · {part}', { id: ids, part: r.ids[0]! }),
        hint: (k, total) => (total > 1 ? t('Detalle a tamaño real, hoja {k} de {total}', { k, total }) : t('Detalle a tamaño real')),
        heading: `${heading} · ${face}`,
        note: `${capitalize(what)}.${blindNote}`,
        draw: (at) => <FaceDrawing p={p} at={at} n={n} guides={d.shapes.filter((g) => g.shape.source === 'pocket').map((g) => g.shape)} />,
      }),
    );
  }
  return { sheets };
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

function buildSheets(project: Project, refine: Refine, colors: ReadonlyMap<string, string>, shots: Shooter): SheetDef[] {
  const rest = [generalSheet(project, refine), ...partSheets(project, refine, colors, shots), ...jointSheets(project, refine), ...templateSheets(project)];
  return [overviewSheet(project, colors, shots, rest), ...rest];
}

/** Un color de PIECE_COLORS por fila de la lista de cortes: las piezas iguales comparten color. */
function pieceColors(project: Project): Map<string, string> {
  const colors = new Map<string, string>();
  cutList(project).forEach((r, i) => r.ids.forEach((id) => colors.set(id, PIECE_COLORS[i % PIECE_COLORS.length]!)));
  return colors;
}

const ZOOM_MAX = 4;
const ZOOM_STEP = 1.5;

/**
 * Agrandar la hoja: con dos dedos en el celular, con Ctrl y la rueda (o pellizcando el panel táctil) en la compu, y
 * con los botones en los dos. El punto que queda entre los dedos o bajo el puntero no se mueve.
 */
function useSheetZoom() {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const current = useRef(1);
  const pending = useRef<{ x: number; y: number; from: number } | null>(null);

  const zoomTo = (next: number, at?: { x: number; y: number }) => {
    const el = box.current;
    const z = Math.min(ZOOM_MAX, Math.max(1, next));
    if (!el || Math.abs(z - current.current) < 0.001) return;
    pending.current = { x: at?.x ?? el.clientWidth / 2, y: at?.y ?? el.clientHeight / 2, from: current.current };
    current.current = z;
    setZoom(z);
  };
  const onGesture = useEffectEvent(zoomTo);

  useLayoutEffect(() => {
    const el = box.current;
    const a = pending.current;
    if (!el || !a) return;
    pending.current = null;
    const k = zoom / a.from;
    el.scrollLeft = (el.scrollLeft + a.x) * k - a.x;
    el.scrollTop = (el.scrollTop + a.y) * k - a.y;
  }, [zoom]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let pinch: { d: number; z: number } | null = null;
    const local = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top };
    };
    const spread = (e: TouchEvent) => {
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mid: local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2) };
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { d: spread(e).d || 1, z: current.current };
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      if (e.cancelable) e.preventDefault();
      const { d, mid } = spread(e);
      onGesture((pinch.z * d) / pinch.d, mid);
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      onGesture(current.current * Math.exp(-e.deltaY * 0.01), local(e.clientX, e.clientY));
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  return { box, zoom, zoomTo };
}

export function PlanView({ project, meshes }: { project: Project; meshes: ReadonlyMap<string, ExactMesh> }) {
  const colors = useMemo(() => pieceColors(project), [project]);
  // Primero con cajas, para saber qué vistas pedirle al motor; después cada vista cambia a la forma exacta cuando llega.
  const wanted = useMemo(() => {
    const views: EngineView[] = [];
    buildSheets(
      project,
      (d) => {
        if (d.engine) views.push(d.engine);
        return d;
      },
      colors,
      () => null,
    );
    return views;
  }, [project, colors]);
  const refine = useEngineLines(project, wanted);
  const sheets = useMemo(() => {
    const shots: Shooter = (parts, w, h, labels) => shoot({ project, meshes, colors, parts, width: Math.round(w * SHOT_PX), height: Math.round(h * SHOT_PX), labels });
    return buildSheets(project, refine, colors, shots);
  }, [project, refine, colors, meshes]);
  const { box, zoom, zoomTo } = useSheetZoom();
  const [current, setCurrent] = useState(0);
  const [layers, setLayers] = useState<Set<Layer>>(() => new Set<Layer>(['contornos', 'cotas', 'ocultas', 'notas']));
  // En el celular y en pantallas bajas las capas empiezan cerradas: así la hoja y el botón del PDF entran sin bajar.
  const [layersOpen, setLayersOpen] = useState(() => typeof matchMedia !== 'function' || matchMedia('(min-width: 900px) and (min-height: 860px)').matches);
  const index = Math.min(current, sheets.length - 1);
  // Las hojas no cambian al agrandar: solo el ancho, que va por CSS.
  const pages = useMemo(
    () =>
      sheets.map((s, i) => (
        <div key={s.key} className={styles.page} data-current={i === index || undefined} data-template={s.key.startsWith('plantilla-') || undefined}>
          <Sheet def={s} n={i + 1} of={sheets.length} project={project} layers={layers} />
        </div>
      )),
    [sheets, index, project, layers],
  );
  const templates = sheets.filter((s) => s.key.startsWith('plantilla-')).length;
  const [printing, setPrinting] = useState<'todo' | 'plantillas'>('todo');
  const printTemplates = () => {
    flushSync(() => setPrinting('plantillas'));
    window.print();
    setPrinting('todo');
  };
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
    <main className={styles.plan} data-print={printing}>
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
        <details className={styles.card} open={layersOpen} onToggle={(e) => setLayersOpen(e.currentTarget.open)}>
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
        {templates > 0 && (
          <button type="button" className={styles.printTpl} onClick={printTemplates}>
            {templates === 1 ? t('Imprimir solo la plantilla 1:1') : t('Imprimir solo las {n} hojas de plantillas 1:1', { n: templates })}
          </button>
        )}
        <p className={styles.note}>{t('Se abre la ventana de impresión: elegí «Guardar como PDF». Salen las {n} hojas en A4 apaisado.', { n: sheets.length })}</p>
      </aside>
      <section className={styles.desk} aria-label={t('Hoja {n}: {title}', { n: index + 1, title: sheets[index]?.title ?? '' })}>
        <div className={styles.zoomBar}>
          <button type="button" className={styles.zoomBtn} onClick={() => zoomTo(zoom / ZOOM_STEP)} disabled={zoom <= 1} aria-label={t('Alejar')}>
            <IconZoomOut />
          </button>
          <button type="button" className={styles.zoomFit} onClick={() => zoomTo(1)} disabled={zoom <= 1} aria-label={`${Math.round(zoom * 100)} % · ${t('Ajustar la hoja al ancho')}`}>
            {Math.round(zoom * 100)} %
          </button>
          <button type="button" className={styles.zoomBtn} onClick={() => zoomTo(zoom * ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label={t('Acercar')}>
            <IconZoomIn />
          </button>
          <span className={styles.zoomHint}>{t('Pellizcá o tocá dos veces para agrandar')}</span>
        </div>
        <div
          ref={box}
          className={styles.zoomBox}
          data-zoomed={zoom > 1 || undefined}
          style={{ '--zoom': zoom } as React.CSSProperties}
          onDoubleClick={(e) => {
            // Dos toques: de la hoja entera a leer lo que hay bajo el dedo, y de vuelta.
            const r = e.currentTarget.getBoundingClientRect();
            zoomTo(zoom > 1 ? 1 : 2.5, { x: e.clientX - r.left, y: e.clientY - r.top });
          }}
        >
          {pages}
        </div>
      </section>
    </main>
  );
}

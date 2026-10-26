import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  acrossFace,
  addCopies,
  arcInfo,
  bevelAngle,
  boxSize,
  componentCopies,
  describeBevel,
  faceLabel,
  defaultJointParams,
  depthUnder,
  describePocket,
  describeSection,
  otherAxes,
  faceSize,
  duplicatePart,
  duplicateParts,
  endJoint,
  formatLength,
  formatNumber,
  furnitureBox,
  goldenChecks,
  groupOf,
  isWholeGroup,
  makeGroup,
  partsBox,
  resizeGroup,
  ungroup,
  resizeFurniture,
  JOINT_NAMES,
  jointName,
  jointOptions,
  locale,
  makeComponent,
  makeUnique,
  MEASURED_FROM,
  mirrorPart,
  newPart,
  overlapBox,
  parseLength,
  partBox,
  partPlace,
  insertPathPoint,
  pathReady,
  segmentMiddle,
  pocketTakesWholePart,
  renamePart,
  turnPart,
  setPlace,
  t,
  tk,
  nearestSheetThickness,
  sheetById,
  type Axis,
  type Bevel,
  type Joint,
  type NewPartKind,
  type Part,
  type PathPoint,
  type PathShape,
  type Pocket,
  type Project,
  type Section,
  type Units,
} from '@kitc/core';
import { OPEN_EVENT, PartNotes, ReviewCard, reviewSummary, useReview } from './Review';
import { GoldenCard, goldenCount } from './Golden';
import { Accordion } from '../ui/Accordion';
import { HelpTip } from '../help/Help';
import { sectionHref } from '../routes';
import { IconCornerPoint, IconCurvePoint, IconGroup, IconLink, IconPlus, IconRotate, IconTrash, IconWarn, IconZoomIn } from './icons';
import { TurningCard } from './TurningCard';
import { FittingPanel } from './FittingPanel';
import { MaterialOptions, sheetNote } from './MaterialOptions';
import { partsLabel, useEditor, type FittingKind } from './store';
import { EyeToggle, PartViewButtons } from './visibility';
import styles from './Editor.module.css';


interface LengthFieldProps {
  label: ReactNode;
  mm: number;
  units: Units;
  min?: number;
  max?: number;
  onCommit: (mm: number) => void;
  compact?: boolean;
  /** Id de un aviso que describe el campo (por ejemplo, una medida fuera de lo habitual). */
  describedBy?: string;
  /** Mientras se escribe: la medida si es válida y distinta, o null. Sirve para mostrar el fantasma. */
  onDraft?: (mm: number | null) => void;
}

/** Campo de medida: se escribe en la unidad elegida y se valida al salir del campo. */
export function LengthField({ label, mm, units, min = 1, max, onCommit, compact, describedBy, onDraft }: LengthFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => (mm || min === 0 ? formatNumber(mm, units) : ''));
  const [error, setError] = useState<string | null>(null);
  // Si la medida cambia desde afuera (deshacer, arrastrar), el campo la muestra de nuevo.
  const [shown, setShown] = useState({ mm, units });
  if (shown.mm !== mm || shown.units !== units) {
    setShown({ mm, units });
    setText(mm || min === 0 ? formatNumber(mm, units) : '');
    setError(null);
  }
  const commit = () => {
    onDraft?.(null);
    const v = parseLength(text, units);
    if (v === null) return setError(units === 'cm' ? t('Escribí un número, por ejemplo 72,5') : t('Escribí pulgadas, por ejemplo 2 7/8'));
    if (v < min) return setError(t('Tiene que ser de {n} o más', { n: formatNumber(min, units) }));
    if (max !== undefined && v > max) return setError(t('Tiene que ser de {n} o menos', { n: formatNumber(max, units) }));
    setError(null);
    if (Math.abs(v - mm) > 0.01) onCommit(v);
    else setText(formatNumber(mm, units));
  };
  return (
    <label className={compact ? styles.inlineField : styles.field} htmlFor={id}>
      {label}
      <input
        id={id}
        className={styles.num}
        inputMode="decimal"
        value={text}
        aria-invalid={!!error}
        aria-describedby={[error ? `${id}-e` : '', describedBy ?? ''].filter(Boolean).join(' ') || undefined}
        onChange={(e) => {
          setText(e.target.value);
          if (!onDraft) return;
          const v = parseLength(e.target.value, units);
          onDraft(v !== null && v >= min && (max === undefined || v <= max) && Math.abs(v - mm) > 0.01 ? v : null);
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {error && (
        <span id={`${id}-e`} className={styles.error} role="alert">
          <IconWarn />
          {error}
        </span>
      )}
    </label>
  );
}


/** Descripción corta de un encastre con sus medidas, como en el diseño: "mortaja 0,7 × 8 × 4,2 cm". */
export function describeJoint(j: Joint, project: Project): string {
  const a = project.parts.find((p) => p.id === j.partA);
  const b = project.parts.find((p) => p.id === j.partB);
  if (!a || !b) return '';
  const ba = partBox(a);
  const bb = partBox(b);
  const p = { ...defaultJointParams(j.type, ba, bb), ...j.params };
  const u = project.units;
  const n = (mm: number) => formatNumber(mm, u);
  const unit = u === 'cm' ? ' cm' : '″';
  switch (j.type) {
    case 'tope':
      return t('apoyada, sin cortes');
    case 'mortaja': {
      const e = endJoint(ba, bb);
      const wide = e ? e.section.max[e.wide] - e.section.min[e.wide] - 2 * (p.shoulder ?? 0) : 0;
      if (wide <= 0) return t('mortaja y espiga');
      return t('mortaja {t} × {w} × {d}{unit}', { t: n(p.thickness ?? 0), w: n(wide), d: n((p.length ?? 0) + 2), unit });
    }
    case 'canal':
    case 'rebaje':
      return j.type === 'canal'
        ? t('canal de {d}{unit} de profundidad', { d: n(p.depth ?? 0), unit })
        : t('rebaje de {d}{unit} de profundidad', { d: n(p.depth ?? 0), unit });
    case 'media-madera':
      return t('cada pieza rebajada a la mitad');
    case 'clavija':
      return t('{count} tarugos de {d} mm', { count: p.count ?? 0, d: p.diameter ?? 0 });
    case 'cola-milano':
      return p.count === 1
        ? t('{count} cola de milano 1:{slope}', { count: 1, slope: p.slope ?? 8 })
        : t('{count} colas de milano 1:{slope}', { count: p.count ?? 0, slope: p.slope ?? 8 });
    case 'dedos':
      return t('{count} dedos de {d}{unit}', { count: p.count ?? 0, d: n(p.depth ?? 0), unit });
    case 'brida':
      return t('brida, lengüeta de {t}{unit}', { t: n(p.thickness ?? 0), unit });
    case 'inglete':
      return t('esquina en inglete');
    case 'galleta':
      return p.count === 1
        ? t('{count} galleta del {size}', { count: 1, size: p.size ?? 20 })
        : t('{count} galletas del {size}', { count: p.count ?? 0, size: p.size ?? 20 });
    case 'machiembrado':
      return t('machimbre, lengüeta de {t} × {d}{unit}', { t: n(p.thickness ?? 0), d: n(p.depth ?? 0), unit });
    case 'bolsillo':
      return p.count === 1 ? t('{count} tornillo de bolsillo', { count: 1 }) : t('{count} tornillos de bolsillo', { count: p.count ?? 0 });
  }
}

/** Una unión de la pieza en una línea: con qué pieza y el encastre, que se cambia acá mismo. */
function JointRow({ joint, partId, project }: { joint: Joint; partId: string; project: Project }) {
  const commit = useEditor((s) => s.commit);
  const otherId = joint.partA === partId ? joint.partB : joint.partA;
  const other = project.parts.find((p) => p.id === otherId);
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  const options = a && b ? jointOptions(partBox(a), partBox(b)) : [];
  if (!options.includes(joint.type)) options.unshift(joint.type);
  const crossing = !!a && !!b && !!overlapBox(partBox(a), partBox(b));
  return (
    <li className={styles.jointRow}>
      <span className={styles.jointDot} data-plain={joint.type === 'tope' || undefined} aria-hidden="true" />
      <span className={styles.jointWho} title={describeJoint(joint, project)}>
        <strong>{otherId}</strong> {other?.name}
      </span>
      <select
        className={styles.jointSelect}
        aria-label={t('Encastre con {id}', { id: otherId })}
        value={joint.type}
        onChange={(e) =>
          commit((d) => {
            const j = d.joints.find((x) => x.id === joint.id);
            if (j) {
              j.type = e.target.value as Joint['type'];
              j.params = {};
            }
          })
        }
      >
        {options.map((type) => (
          <option key={type} value={type}>
            {t(jointName(type, crossing))}
          </option>
        ))}
      </select>
      {/* De cerca: el encastre en 3D, con las piezas separadas si se quiere, en Uniones. */}
      <a
        className={styles.jointLook}
        href={sectionHref(project.id, 'uniones')}
        aria-label={t('Ver de cerca la unión con {id}', { id: otherId })}
        title={t('Ver de cerca')}
        onClick={() => useEditor.getState().setJointFocus(joint.id)}
      >
        <IconZoomIn />
      </a>
    </li>
  );
}

/** Qué bloques del panel quedan abiertos: se recuerda al pasar de una pieza a otra. */
const foldOpen = { forma: false, uniones: false };

/** Un bloque del panel que se pliega: el título y un resumen de una línea siempre a la vista. */
function Fold({ title, summary, open, onToggle, children }: { title: string; summary: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.fold}>
      <h3 className={styles.foldHead}>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
          <span className={styles.foldTitle}>{title}</span>
          <span className={styles.foldSummary}>{summary}</span>
          <svg className={styles.foldChevron} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </h3>
      <div id={id} className={styles.foldBody} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

const AXIS_LABELS = [tk('Ancho'), tk('Alto'), tk('Fondo')] as const;
/** Los tres giros, por el eje sobre el que gira la pieza. */
const ROTATIONS = [
  [1, tk('En el piso'), tk('Gira un cuarto de vuelta apoyada como está: lo largo a lo ancho pasa a ir de adelante hacia atrás')],
  [0, tk('Adelante'), tk('La vuelca hacia adelante: lo de arriba pasa al frente')],
  [2, tk('Al costado'), tk('La vuelca de costado: lo de arriba pasa a un lado')],
] as const;
/** Desde dónde se mide la posición en cada eje. */
const PLACE_LABELS = [tk('De la izquierda'), tk('Del piso'), tk('De atrás')] as const;

/** Un vaciado o calado de la pieza, con sus medidas editables. */
function PocketCard({ pocket, part, units, onChange, onRemove }: { pocket: Pocket; part: Part; units: Units; onChange: (recipe: (p: Pocket) => void) => void; onRemove: () => void }) {
  const throughId = useId();
  const otherId = useId();
  const { axes, size } = faceSize(part, pocket.axis);
  const thick = depthUnder(part, pocket.axis);
  const n = (mm: number) => `${formatNumber(mm, units)}${units === 'cm' ? ' cm' : '″'}`;
  const s = pocket.shape;
  const side = (i: 0 | 1) => t(MEASURED_FROM[axes[i]]);
  const from = (i: 0 | 1) => (s.kind === 'circle' ? t('Centro desde {side}', { side: side(i) }) : t('Desde {side}', { side: side(i) }));
  return (
    <div className={styles.pocketCard}>
      <div className={styles.pocketHead}>
        <span className={styles.pocketTitle}>
          <strong>{pocket.id}</strong> {describePocket(pocket, n).replace(/^./, (c) => c.toUpperCase())}
        </span>
        <button type="button" className={styles.iconBtnSmall} aria-label={t('Borrar {id}', { id: pocket.id })} title={t('Borrar')} onClick={onRemove}>
          <IconTrash />
        </button>
      </div>
      {pocketTakesWholePart(part, pocket) && (
        <span className={styles.error} role="alert">
          <IconWarn />
          {t('Este calado se lleva toda la pieza: achicalo o cambialo a vaciado.')}
        </span>
      )}
      <div className={styles.pocketFields}>
        {s.kind === 'arc' ? (
          <>
            <LengthField label={t('Inicio desde {side}', { side: side(0) })} mm={s.u} units={units} min={0} max={size[0]} onCommit={(v) => onChange((p) => p.shape.kind !== 'path' && (p.shape.u = v))} />
            <LengthField label={t('Inicio desde {side}', { side: side(1) })} mm={s.v} units={units} min={0} max={size[1]} onCommit={(v) => onChange((p) => p.shape.kind !== 'path' && (p.shape.v = v))} />
            <LengthField label={t('Fin desde {side}', { side: side(0) })} mm={s.u2} units={units} min={0} max={size[0]} onCommit={(v) => onChange((p) => p.shape.kind === 'arc' && (p.shape.u2 = v))} />
            <LengthField label={t('Fin desde {side}', { side: side(1) })} mm={s.v2} units={units} min={0} max={size[1]} onCommit={(v) => onChange((p) => p.shape.kind === 'arc' && (p.shape.v2 = v))} />
            <LengthField
              label={t('Flecha')}
              mm={Math.abs(s.bulge)}
              units={units}
              min={0.5}
              max={arcInfo(s).chord / 2}
              onCommit={(v) => onChange((p) => p.shape.kind === 'arc' && (p.shape.bulge = Math.sign(p.shape.bulge) * v))}
            />
          </>
        ) : s.kind === 'path' ? null : (
          <>
            {s.kind === 'rect' ? (
              <>
                <LengthField label={t(AXIS_LABELS[axes[0]])} mm={s.w} units={units} max={size[0]} onCommit={(v) => onChange((p) => p.shape.kind === 'rect' && (p.shape.w = v))} />
                <LengthField label={t(AXIS_LABELS[axes[1]])} mm={s.h} units={units} max={size[1]} onCommit={(v) => onChange((p) => p.shape.kind === 'rect' && (p.shape.h = v))} />
              </>
            ) : (
              <LengthField label={t('Diámetro')} mm={s.d} units={units} max={Math.max(...size)} onCommit={(v) => onChange((p) => p.shape.kind === 'circle' && (p.shape.d = v))} />
            )}
            <LengthField label={from(0)} mm={s.u} units={units} min={0} max={size[0]} onCommit={(v) => onChange((p) => p.shape.kind !== 'path' && (p.shape.u = v))} />
            <LengthField label={from(1)} mm={s.v} units={units} min={0} max={size[1]} onCommit={(v) => onChange((p) => p.shape.kind !== 'path' && (p.shape.v = v))} />
          </>
        )}
        {!pocket.through && (
          <LengthField label={t('Profundidad')} mm={pocket.depth} units={units} min={0.5} max={thick} onCommit={(v) => onChange((p) => void (p.depth = v))} />
        )}
      </div>
      <label className={styles.check} htmlFor={throughId}>
        <input id={throughId} type="checkbox" checked={pocket.through} onChange={(e) => onChange((p) => void (p.through = e.target.checked))} />
        {t('Atraviesa la pieza')}
      </label>
      {s.kind === 'path' && (
        <button type="button" className={styles.link} onClick={() => editInModel(part, pocket)}>
          {t('Mover los puntos en el modelo')}
        </button>
      )}
      {s.kind === 'path' && <PathPoints shape={s} part={part} axisLabels={[side(0), side(1)]} size={size} units={units} onChange={onChange} />}
      {s.kind === 'path' && !s.closed && (
        <label className={styles.check} htmlFor={otherId}>
          <input id={otherId} type="checkbox" checked={s.flip} onChange={(e) => onChange((p) => p.shape.kind === 'path' && (p.shape.flip = e.target.checked))} />
          {t('Sacar el otro lado del perfil')}
        </label>
      )}
      {s.kind === 'arc' && (
        <label className={styles.check} htmlFor={otherId}>
          <input id={otherId} type="checkbox" checked={s.outside} onChange={(e) => onChange((p) => p.shape.kind === 'arc' && (p.shape.outside = e.target.checked))} />
          {t('Sacar lo de afuera del arco (esquina redondeada)')}
        </label>
      )}
    </div>
  );
}

/** Abre Dibujar en la cara del perfil, de frente, con sus puntos listos para arrastrar. */
function editInModel(part: Part, pocket: Pocket) {
  const { setTool, setDrawShape, setDrawFace } = useEditor.getState();
  setTool('draw');
  setDrawShape('path');
  setDrawFace({ partId: part.id, axis: pocket.axis, side: pocket.side });
}

/**
 * Los puntos de un perfil a mano: dónde está cada uno y si la línea pasa curva o quiebra. Un cambio que deja el perfil
 * sin forma (las puntas fuera de los bordes, o la línea cruzada) no se aplica: se avisa.
 */
function PathPoints({
  shape,
  part,
  axisLabels,
  size,
  units,
  onChange,
}: {
  shape: PathShape;
  part: Part;
  axisLabels: [string, string];
  size: [number, number];
  units: Units;
  onChange: (recipe: (p: Pocket) => void) => void;
}) {
  const warn = useEditor((s) => s.warn);
  const fewest = shape.closed ? 3 : 2;
  const change = (edit: (points: PathPoint[]) => PathPoint[]) => {
    const next = { ...shape, points: edit(shape.points.map((p) => ({ ...p }))) };
    if (!pathReady(next, size[0], size[1])) {
      return warn(shape.closed ? t('Así el perfil se cruza consigo mismo: probá otra medida') : t('Así el perfil no queda de borde a borde: las puntas van sobre un borde de la pieza'));
    }
    onChange((p) => void (p.shape = next));
  };
  return (
    <div className={styles.pathPoints} role="group" aria-label={t('Puntos del perfil de {id}', { id: part.id })}>
      <div className={styles.pathHead} aria-hidden="true">
        <span>#</span>
        <span>{t('Desde {side}', { side: axisLabels[0] })}</span>
        <span>{t('Desde {side}', { side: axisLabels[1] })}</span>
      </div>
      {shape.points.map((p, i) => {
        const n = i + 1;
        // Las puntas de un perfil abierto lo atan a los bordes: se mueven, pero no se borran.
        const end = !shape.closed && (i === 0 || i === shape.points.length - 1);
        return (
          <div key={i} className={styles.pathRow}>
            <span className={styles.pathNum}>{n}</span>
            <LengthField
              compact
              label={<span className={styles.srOnly}>{t('Punto {n}, desde {side}', { n, side: axisLabels[0] })}</span>}
              mm={p.u}
              units={units}
              min={0}
              max={size[0]}
              onCommit={(v) => change((pts) => pts.map((q, k) => (k === i ? { ...q, u: v } : q)))}
            />
            <LengthField
              compact
              label={<span className={styles.srOnly}>{t('Punto {n}, desde {side}', { n, side: axisLabels[1] })}</span>}
              mm={p.v}
              units={units}
              min={0}
              max={size[1]}
              onCommit={(v) => change((pts) => pts.map((q, k) => (k === i ? { ...q, v } : q)))}
            />
            <button
              type="button"
              className={styles.iconBtnSmall}
              aria-pressed={!p.corner}
              aria-label={p.corner ? t('Punto {n} en esquina: pasarlo a curva', { n }) : t('Punto {n} en curva: pasarlo a esquina', { n })}
              title={p.corner ? t('Esquina') : t('Curva')}
              onClick={() => change((pts) => pts.map((q, k) => (k === i ? { ...q, corner: !q.corner } : q)))}
            >
              {p.corner ? <IconCornerPoint /> : <IconCurvePoint />}
            </button>
            <button
              type="button"
              className={styles.iconBtnSmall}
              aria-label={t('Agregar un punto entre el {a} y el {b}', { a: n, b: (i + 1) % shape.points.length + 1 })}
              title={t('Agregar un punto después')}
              disabled={!shape.closed && i === shape.points.length - 1}
              onClick={() => {
                const [u, v] = segmentMiddle(shape, i).map((c) => Math.round(c * 2) / 2) as [number, number];
                onChange((q) => void (q.shape = insertPathPoint(shape, i, u, v)));
              }}
            >
              <IconPlus />
            </button>
            <button
              type="button"
              className={styles.iconBtnSmall}
              aria-label={t('Borrar el punto {n}', { n })}
              title={t('Borrar')}
              disabled={end || shape.points.length <= fewest}
              onClick={() => change((pts) => pts.filter((_, k) => k !== i))}
            >
              <IconTrash />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Ángulo en grados, con coma o punto. */
function AngleField({ label, deg, max, onCommit }: { label: string; deg: number; max: number; onCommit: (deg: number) => void }) {
  const id = useId();
  const show = (d: number) => (Math.round(d * 10) / 10).toLocaleString(locale(), { maximumFractionDigits: 1, useGrouping: false });
  const [text, setText] = useState(() => show(deg));
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(deg);
  if (Math.abs(shown - deg) > 1e-6) {
    setShown(deg);
    setText(show(deg));
    setError(null);
  }
  const commit = () => {
    const v = Number(text.replace(',', '.').replace('°', '').trim());
    if (!Number.isFinite(v) || v <= 0 || v >= 90) return setError(t('Entre 1° y 89°'));
    if (v > max + 0.05) return setError(t('Con este ancho, hasta {max}°', { max: show(max) }));
    setError(null);
    if (Math.abs(v - deg) > 0.05) onCommit(v);
    else setText(show(deg));
  };
  return (
    <label className={styles.field} htmlFor={id}>
      {label}
      <input
        id={id}
        className={styles.num}
        inputMode="decimal"
        value={text}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-e` : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {error && (
        <span id={`${id}-e`} className={styles.error} role="alert">
          <IconWarn />
          {error}
        </span>
      )}
    </label>
  );
}

/** Un bisel o corte en ángulo (cuánto entra en cada cara y el ángulo que forma con la cara marcada) o un redondeo (su radio). */
function BevelCard({ bevel, part, units, onChange, onRemove }: { bevel: Bevel; part: Part; units: Units; onChange: (recipe: (b: Bevel) => void) => void; onRemove: () => void }) {
  const n = (mm: number) => `${formatNumber(mm, units)}${units === 'cm' ? ' cm' : '″'}`;
  const maxA = acrossFace(part, bevel.b);
  const maxB = boxSize(partBox(part))[bevel.a.axis];
  const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
  return (
    <div className={styles.pocketCard}>
      <div className={styles.pocketHead}>
        <span className={styles.pocketTitle}>
          <strong>{bevel.id}</strong> {cap(describeBevel(part, bevel, n))}
        </span>
        <button type="button" className={styles.iconBtnSmall} aria-label={t('Borrar {id}', { id: bevel.id })} title={t('Borrar')} onClick={onRemove}>
          <IconTrash />
        </button>
      </div>
      {bevel.round ? (
        <div className={styles.pocketFields}>
          <LengthField label={t('Radio')} mm={bevel.da} units={units} min={0.5} max={Math.min(maxA, maxB)} onCommit={(v) => onChange((b) => void (b.da = b.db = v))} />
        </div>
      ) : (
        <div className={styles.pocketFields}>
          <LengthField label={cap(t('en {face}', { face: faceLabel(bevel.a) }))} mm={bevel.da} units={units} min={0.5} max={maxA} onCommit={(v) => onChange((b) => void (b.da = v))} />
          <LengthField label={cap(t('en {face}', { face: faceLabel(bevel.b) }))} mm={bevel.db} units={units} min={0.5} max={maxB} onCommit={(v) => onChange((b) => void (b.db = v))} />
          <AngleField
            label={t('Ángulo con {face}', { face: faceLabel(bevel.a) })}
            deg={bevelAngle(bevel)}
            max={bevelAngle({ da: bevel.da, db: maxB })}
            onCommit={(deg) => onChange((b) => void (b.db = Math.round(b.da * Math.tan((deg * Math.PI) / 180) * 100) / 100))}
          />
        </div>
      )}
    </div>
  );
}

/** Un tramo con otra sección: de dónde a dónde va y cuánto mide de través. */
function SectionCard({ section, part, units, onChange, onRemove }: { section: Section; part: Part; units: Units; onChange: (recipe: (s: Section) => void) => void; onRemove: () => void }) {
  const n = (mm: number) => `${formatNumber(mm, units)}${units === 'cm' ? ' cm' : '″'}`;
  const len = boxSize(partBox(part))[section.axis];
  const [u, v] = otherAxes(section.axis);
  const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
  return (
    <div className={styles.pocketCard}>
      <div className={styles.pocketHead}>
        <span className={styles.pocketTitle}>
          <strong>{section.id}</strong> {cap(describeSection(section, n))}
        </span>
        <button type="button" className={styles.iconBtnSmall} aria-label={t('Borrar {id}', { id: section.id })} title={t('Borrar')} onClick={onRemove}>
          <IconTrash />
        </button>
      </div>
      <div className={styles.pocketFields}>
        <LengthField label={t('Desde {side}', { side: t(MEASURED_FROM[section.axis]) })} mm={section.from} units={units} min={0} max={section.to - 1} onCommit={(x) => onChange((s) => void (s.from = x))} />
        <LengthField label={t('Hasta')} mm={section.to} units={units} min={section.from + 1} max={len} onCommit={(x) => onChange((s) => void (s.to = x))} />
        <LengthField label={t(AXIS_LABELS[u])} mm={section.size[0]} units={units} min={1} onCommit={(x) => onChange((s) => void (s.size[0] = x))} />
        <LengthField label={t(AXIS_LABELS[v])} mm={section.size[1]} units={units} min={1} onCommit={(x) => onChange((s) => void (s.size[1] = x))} />
      </div>
    </div>
  );
}

type EdgeKind = 'rectos' | 'round' | 'chamfer';

function PartEditor({ part, project }: { part: Part; project: Project }) {
  const commit = useEditor((s) => s.commit);
  const propose = useEditor((s) => s.propose);
  const setGhost = useEditor((s) => s.setGhost);
  const select = useEditor((s) => s.select);
  const setTool = useEditor((s) => s.setTool);
  // Al cambiar de pieza, el fantasma de una medida a medio escribir se va.
  useEffect(() => () => setGhost(null), [part.id, setGhost]);
  const units = project.units;
  const nameId = useId();
  const woodId = useId();
  const size = part.base.kind === 'box' ? part.base.size : [0, 0, 0];
  const op = part.ops[0];
  const edge: EdgeKind = !op ? 'rectos' : op.kind;
  const edgeSize = op ? (op.kind === 'round' ? op.radius : op.size) : 3;
  const joints = project.joints.filter((j) => j.partA === part.id || j.partB === part.id);
  const component = project.components.find((c) => c.id === part.component);
  const inGroup = groupOf(project, part.id);
  const n = (mm: number) => `${formatNumber(mm, units)}${units === 'cm' ? ' cm' : '″'}`;

  // Forma se abre sola cuando se le suma algo a la pieza (un vaciado recién dibujado, un bisel), para editarlo.
  const features = part.pockets.length + part.bevels.length + part.sections.length + (part.turning ? 1 : 0);
  const [open, setOpen] = useState(() => ({ ...foldOpen, forma: foldOpen.forma || features > 0 }));
  const [seen, setSeen] = useState(features);
  if (seen !== features) {
    setSeen(features);
    if (features > seen && !open.forma) setOpen({ ...open, forma: true });
  }
  const toggle = (k: keyof typeof foldOpen) => {
    foldOpen[k] = !open[k];
    setOpen({ ...open, [k]: !open[k] });
  };

  const update = (recipe: (p: Part) => void) =>
    commit((d) => {
      const q = d.parts.find((x) => x.id === part.id);
      if (q) recipe(q as Part);
    });
  const rotate = (axis: Axis) =>
    commit((d) => {
      const q = d.parts.find((x) => x.id === part.id);
      if (q) turnPart(q as Part, axis);
    }, component ? t('Giraste {id}, solo esta copia: lo que le hagas a cualquier copia le llega a cada una en su lugar', { id: part.id }) : t('Giraste {id}', { id: part.id }));
  const setEdges = (kind: EdgeKind, mm = edgeSize) =>
    update((q) => {
      q.ops = kind === 'rectos' ? [] : kind === 'round' ? [{ kind: 'round', edges: 'all', radius: mm }] : [{ kind: 'chamfer', edges: 'all', size: mm }];
    });

  const shape = [
    edge === 'rectos' ? t('Cantos rectos') : edge === 'round' ? t('Cantos redondeados de {r}', { r: n(edgeSize) }) : t('Cantos con chaflán de {r}', { r: n(edgeSize) }),
    part.pockets.length && (part.pockets.length === 1 ? t('1 vaciado') : t('{n} vaciados', { n: part.pockets.length })),
    part.bevels.length && (part.bevels.length === 1 ? t('1 bisel') : t('{n} biseles', { n: part.bevels.length })),
    part.sections.length && (part.sections.length === 1 ? t('1 tramo') : t('{n} tramos', { n: part.sections.length })),
    part.turning && t('torneada'),
  ]
    .filter(Boolean)
    .join(' · ');
  const byType = new Map<Joint['type'], number>();
  for (const j of joints) byType.set(j.type, (byType.get(j.type) ?? 0) + 1);
  const jointSummary = joints.length
    ? [...byType].map(([type, count]) => `${t(JOINT_NAMES[type])} ×${count}`).join(' · ')
    : t('Ninguna todavía');
  // Dónde está: desde la izquierda, desde el piso y desde atrás. Así se sube o se baja una pieza escribiendo.
  const place = partPlace(project.parts, part);
  const tools: [Parameters<typeof setTool>[0], string][] = [
    ['draw', tk('Dibujar')],
    ['bevel', tk('Biselar')],
    ['section', tk('Tramo')],
    ['turn', tk('Tornear')],
  ];

  return (
    <>
      <div className={styles.partHead}>
        <div className={styles.panelHead}>
          {/* Siempre a mano, arriba: cambiar de pieza sin buscar la lista ni tocar piezas finas en el modelo. */}
          <label className={styles.partPick} data-tour="part-pick">
            <span className={styles.srOnly}>{t('Pieza elegida')}</span>
            <select value={part.id} onChange={(e) => select(e.target.value)}>
              {project.parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <PartViewButtons id={part.id} />
          <button type="button" className={styles.link} onClick={() => select(null)}>
            {t('Ver el mueble')}
          </button>
        </div>
        <label className={styles.srOnly} htmlFor={nameId}>
          {t('Nombre')}
        </label>
        <input
          id={nameId}
          className={styles.nameInput}
          key={`${part.id}-${part.name}`}
          defaultValue={part.name}
          title={t('Tocá para cambiar el nombre')}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== part.name) {
              // El código sigue al nombre: una copia de faldón que pasa a llamarse "Listón…" queda como L.
              let id = part.id;
              commit((d) => void (id = renamePart(d, part.id, v)));
              if (id !== part.id) {
                select(id);
                useEditor.getState().warn(t('{old} ahora es {id}: el código va con el nombre nuevo.', { old: part.id, id }));
              }
            }
            else e.target.value = part.name;
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        {inGroup && (
          <p className={styles.groupNote}>
            <IconGroup />
            <span>{t('Parte de {name}', { name: inGroup.name })}</span>
            <button type="button" className={`${styles.link} ${styles.inlineLink}`} onClick={() => useEditor.getState().pick(inGroup.parts)}>
              {t('Elegir el grupo')}
            </button>
          </p>
        )}
      </div>
      <PartNotes project={project} partId={part.id} />
      <fieldset className={styles.dims} data-tour="part-dims">
        <legend className={styles.legend}>{t('Medidas terminadas ({units})', { units: units === 'cm' ? 'cm' : t('pulgadas') })}</legend>
        {/* Siempre en el mismo orden y con el nombre de la dirección: no cambian al girar la pieza con las medidas. */}
        {([0, 1, 2] as const).map((axis) => (
          <LengthField
            key={axis}
            label={t(AXIS_LABELS[axis])}
            mm={size[axis] ?? 0}
            units={units}
            min={3}
            onDraft={(v) =>
              setGhost(
                v === null
                  ? null
                  : (d) => {
                      const q = d.parts.find((x) => x.id === part.id);
                      if (q?.base.kind === 'box') q.base.size[axis] = v;
                    },
              )
            }
            onCommit={(v) =>
              update((q) => {
                if (q.base.kind === 'box') q.base.size[axis] = v;
              })
            }
          />
        ))}
      </fieldset>
      {/* Dónde está, a la vista junto a las medidas: así se sube, se baja o se corre una pieza escribiendo. */}
      <fieldset className={styles.dims}>
        <legend className={styles.legend}>{t('Posición ({units})', { units: units === 'cm' ? 'cm' : t('pulgadas') })}</legend>
        {([1, 0, 2] as const).map((axis) => (
          <LengthField
            key={axis}
            label={t(PLACE_LABELS[axis])}
            mm={place[axis]}
            units={units}
            min={0}
            onDraft={(v) => setGhost(v === null ? null : (d) => setPlace(d.parts as Part[], part.id, axis, v))}
            onCommit={(v) => commit((d) => setPlace(d.parts as Part[], part.id, axis, v), t('Moviste {id}', { id: part.id }))}
          />
        ))}
      </fieldset>
      {/* Girar pasa también los vaciados, biseles, tramos y torneado: cambiar las medidas a mano los dejaría en otra cara. */}
      <div className={styles.rotateRow} role="group" aria-label={t('Girar 90°')}>
        <span className={styles.rotateTitle}>
          <IconRotate />
          {t('Girar 90°')}
        </span>
        {ROTATIONS.map(([axis, label, title]) => (
          <button key={axis} type="button" title={t(title)} onClick={() => rotate(axis)}>
            {t(label)}
          </button>
        ))}
      </div>
      <label className={styles.field} htmlFor={woodId}>
        {t('Madera')}
        <select
          id={woodId}
          value={part.wood}
          onChange={(e) => {
            const id = e.target.value;
            update((q) => {
              q.wood = id;
              // Una placa viene en espesores fijos: la pieza pasa al más cercano.
              const sheet = sheetById(id);
              if (sheet && q.base.kind === 'box') {
                const thin = q.base.size.indexOf(Math.min(...q.base.size));
                q.base.size[thin] = nearestSheetThickness(sheet, q.base.size[thin]!);
              }
            });
          }}
        >
          <MaterialOptions />
        </select>
        {sheetNote(part.wood) && <span className={styles.fieldNote}>{sheetNote(part.wood)}</span>}
      </label>
      {component && <ComponentNote project={project} part={part} name={component.name} />}
      <div className={styles.folds}>
        <Fold title={t('Forma')} summary={shape} open={open.forma} onToggle={() => toggle('forma')}>
          <fieldset className={styles.plainFieldset}>
            <legend className={styles.legend}>
              {t('Cantos')}
              <HelpTip term="cantos" />
            </legend>
            <div className={styles.row}>
              <div className={styles.seg} role="group" aria-label={t('Tipo de canto')}>
                {(
                  [
                    ['rectos', tk('Rectos')],
                    ['round', tk('Redondeados')],
                    ['chamfer', tk('Chaflán')],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={edge === k} onClick={() => setEdges(k)}>
                    {t(label)}
                  </button>
                ))}
              </div>
              {edge !== 'rectos' && (
                <LengthField compact label={edge === 'round' ? t('Radio') : t('Medida')} mm={edgeSize} units={units} min={0.5} onCommit={(v) => setEdges(edge, v)} />
              )}
            </div>
          </fieldset>
          {part.pockets.length > 0 && (
            <div className={styles.stack}>
              <span className={styles.legend}>
                {t('Vaciados y calados ({n})', { n: part.pockets.length })}
                <HelpTip term="vaciados" />
              </span>
              {part.pockets.map((pk) => (
                <PocketCard
                  key={pk.id}
                  pocket={pk}
                  part={part}
                  units={units}
                  onChange={(recipe) =>
                    update((q) => {
                      const x = q.pockets.find((y) => y.id === pk.id);
                      if (x) recipe(x);
                    })
                  }
                  onRemove={() => update((q) => void (q.pockets = q.pockets.filter((y) => y.id !== pk.id)))}
                />
              ))}
            </div>
          )}
          {part.bevels.length > 0 && (
            <div className={styles.stack}>
              <span className={styles.legend}>
                {t('Biseles, redondeos y cortes en ángulo ({n})', { n: part.bevels.length })}
                <HelpTip term="biseles" />
              </span>
              {part.bevels.map((bv) => (
                <BevelCard
                  key={bv.id}
                  bevel={bv}
                  part={part}
                  units={units}
                  onChange={(recipe) =>
                    update((q) => {
                      const x = q.bevels.find((y) => y.id === bv.id);
                      if (x) recipe(x);
                    })
                  }
                  onRemove={() => update((q) => void (q.bevels = q.bevels.filter((y) => y.id !== bv.id)))}
                />
              ))}
            </div>
          )}
          {part.sections.length > 0 && (
            <div className={styles.stack}>
              <span className={styles.legend}>
                {t('Tramos ({n})', { n: part.sections.length })}
                <HelpTip term="tramos" />
              </span>
              {part.sections.map((sec) => (
                <SectionCard
                  key={sec.id}
                  section={sec}
                  part={part}
                  units={units}
                  onChange={(recipe) =>
                    update((q) => {
                      const x = q.sections.find((y) => y.id === sec.id);
                      if (x) recipe(x);
                    })
                  }
                  onRemove={() => update((q) => void (q.sections = q.sections.filter((y) => y.id !== sec.id)))}
                />
              ))}
            </div>
          )}
          {part.turning && (
            <div className={styles.stack}>
              <span className={styles.legend}>
                {t('Torneado')}
                <HelpTip term="torneado" />
              </span>
              <TurningCard
                part={part}
                units={units}
                onChange={(turning) =>
                  update((q) => {
                    if (turning) q.turning = turning;
                    else delete q.turning;
                  })
                }
              />
            </div>
          )}
          <div className={styles.stack}>
            <span className={styles.legend}>{t('Más forma con las herramientas')}</span>
            <div className={styles.toolChips}>
              {tools.map(([tool, label]) => (
                <button key={tool} type="button" onClick={() => setTool(tool)}>
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
        </Fold>
        <Fold title={t('Uniones ({n})', { n: joints.length })} summary={jointSummary} open={open.uniones} onToggle={() => toggle('uniones')}>
          {joints.length === 0 ? (
            <p className={styles.muted}>{t('Acercá esta pieza a otra hasta que se toquen y se propone un encastre.')}</p>
          ) : (
            <>
              <ul className={styles.jointRows}>
                {joints.map((j) => (
                  <JointRow key={j.id} joint={j} partId={part.id} project={project} />
                ))}
              </ul>
              <a className={styles.link} href={sectionHref(project.id, 'uniones')}>
                {t('Ver las medidas en Uniones')}
              </a>
            </>
          )}
        </Fold>
      </div>
      <div className={styles.panelActions} data-tour="part-actions">
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            const copy = duplicatePart(project.parts, part);
            propose((d) => void d.parts.push(copy), t('Duplicaste {id}: la copia es {copy}', { id: part.id, copy: copy.id }), {
              title: t('Copia de {id} al costado del mueble', { id: part.id }),
              select: copy.id,
            });
          }}
        >
          {t('Duplicar')}
        </button>
        {/* La gemela del otro lado (pata trasera, faldón derecho), con el mismo retiro: no hay que medir dónde va. */}
        <button
          type="button"
          className={styles.btn}
          title={t('Hace la misma pieza del otro lado del mueble, a la misma distancia del borde.')}
          onClick={() => {
            const res = mirrorPart(project.parts, part);
            if (!res) {
              useEditor.getState().warn(t('Del otro lado ya hay una pieza igual, o esta pieza está en el medio.'));
              return;
            }
            propose((d) => void d.parts.push(res.part), t('Agregaste {id} del otro lado', { id: res.part.id }), {
              title: t('{name}, del otro lado', { name: res.part.name }),
              select: res.part.id,
            });
          }}
        >
          {t('Del otro lado')}
        </button>
        {component ? (
          <button type="button" className={styles.btn} onClick={() => commit((d) => makeUnique(d as Project, part.id))}>
            {t('Hacer única')}
          </button>
        ) : (
          <button
            type="button"
            className={styles.btn}
            title={t('Si hacés un componente, cada copia de esta pieza cambia junto con las demás.')}
            onClick={() => commit((d) => void makeComponent(d as Project, part.id))}
          >
            {t('Hacer componente')}
          </button>
        )}
        <HelpTip term="componente" />
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.dangerIcon}`}
          aria-label={t('Eliminar {id}', { id: part.id })}
          title={t('Eliminar')}
          onClick={() =>
            propose((d) => void (d.parts = d.parts.filter((x) => x.id !== part.id)), t('Borraste {id}', { id: part.id }), {
              title: t('¿Borrar {id} {name}?', { id: part.id, name: part.name }),
            })
          }
        >
          <IconTrash />
        </button>
      </div>
    </>
  );
}

/**
 * Varias piezas elegidas juntas: un grupo (se nombra y se desagrupa) o las que se sumaron con Shift (se agrupan).
 * Lo de abajo vale para todas: ocultar, duplicar, borrar.
 */
function PickedPanel({ project, ids }: { project: Project; ids: string[] }) {
  const commit = useEditor((s) => s.commit);
  const propose = useEditor((s) => s.propose);
  const select = useEditor((s) => s.select);
  const pick = useEditor((s) => s.pick);
  const nameId = useId();
  const group = groupOf(project, ids[0]!);
  const whole = isWholeGroup(group, ids) ? group : undefined;
  const label = partsLabel(project, ids);
  const parts = ids.map((id) => project.parts.find((p) => p.id === id)).filter((p): p is Part => !!p);
  return (
    <>
      <div className={styles.partHead}>
        <div className={styles.panelHead}>
          <span className={styles.eyebrow}>
            {whole ? t('Grupo · {n} piezas', { n: ids.length }) : t('{n} piezas elegidas', { n: ids.length })}
          </span>
          <PartViewButtons id={ids} name={label} />
          <button type="button" className={styles.link} onClick={() => select(null)}>
            {t('Ver el mueble')}
          </button>
        </div>
        {whole ? (
          <>
            <label className={styles.srOnly} htmlFor={nameId}>
              {t('Nombre del grupo')}
            </label>
            <input
              id={nameId}
              className={styles.nameInput}
              key={`${whole.id}-${whole.name}`}
              defaultValue={whole.name}
              title={t('Tocá para cambiar el nombre')}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== whole.name)
                  commit((d) => {
                    const g = d.groups.find((x) => x.id === whole.id);
                    if (g) g.name = v;
                  });
                else e.target.value = whole.name;
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </>
        ) : (
          <h2 className={styles.panelTitle}>{t('Varias piezas')}</h2>
        )}
      </div>
      <p className={styles.muted}>
        {whole
          ? t('Se mueven, se copian, se ocultan y se borran juntas. Para editar una sola, tocala otra vez en el modelo o elegila en la lista.')
          : t('Agrupalas para que se muevan juntas. Shift + clic (o Elegir varias) suma o saca piezas.')}
      </p>
      <FurnitureSize key={ids.join()} project={project} ids={ids} />
      <ul className={styles.partList} data-many={parts.length > PART_LIST_MAX || undefined}>
        {parts.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => select(p.id)}>
              <strong>{p.id}</strong>
              <span>{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.panelActions} data-tour="part-actions">
        {whole ? (
          <button type="button" className={styles.btn} onClick={() => commit((d) => ungroup(d as Project, whole.id), t('Desagrupaste {name}', { name: whole.name }))}>
            {t('Desagrupar')}
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => {
              let made: string | undefined;
              commit((d) => void (made = makeGroup(d as Project, ids)?.name), t('Agrupaste {ids}', { ids: [...ids].sort().join(', ') }));
              if (made) pick(ids);
            }}
          >
            {t('Agrupar')}
          </button>
        )}
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            const copies = duplicateParts(project.parts, ids);
            propose((d) => void addCopies(d as Project, ids, copies), t('Duplicaste {id}', { id: label }), {
              title: t('Copia de {id} al costado del mueble', { id: label }),
              select: copies.map((c) => c.id),
            });
          }}
        >
          {t('Duplicar')}
        </button>
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.dangerIcon}`}
          aria-label={t('Eliminar {id}', { id: label })}
          title={t('Eliminar')}
          onClick={() =>
            propose((d) => void (d.parts = d.parts.filter((x) => !ids.includes(x.id))), t('Borraste {id}', { id: label }), {
              title: t('¿Borrar {id}? Son {n} piezas.', { id: label, n: ids.length }),
            })
          }
        >
          <IconTrash />
        </button>
      </div>
    </>
  );
}

/** Si la pieza es parte de un componente: cuántas copias tiene y qué cambia junto. */
function ComponentNote({ project, part, name }: { project: Project; part: Part; name: string }) {
  const copies = componentCopies(project, part);
  const others = copies.filter((p) => p.id !== part.id).map((p) => p.id);
  return (
    <div className={`${styles.componentBox} ${styles.componentOn}`}>
      <span className={styles.componentTitle}>
        <IconLink />
        {copies.length === 1 ? t('Componente {name} · {n} copia', { name, n: 1 }) : t('Componente {name} · {n} copias', { name, n: copies.length })}
      </span>
      <p className={styles.muted}>
        {others.length ? t('Medidas, madera y cantos cambian junto con {ids}.', { ids: others.join(', ') }) : t('Duplicala o copiala al mover y las copias quedan vinculadas.')}
        {part.orient && ` ${t('Esta copia va girada: los biseles y vaciados le llegan en su lugar.')}`}
      </p>
    </div>
  );
}

export function UnitsToggle({ units }: { units: Units }) {
  const setUnits = useEditor((s) => s.setUnits);
  return (
    <div className={styles.seg} role="group" aria-label={t('Unidades')}>
      {(['cm', 'in'] as const).map((u) => (
        <button key={u} type="button" aria-pressed={units === u} onClick={() => setUnits(u)}>
          {u === 'cm' ? 'cm' : t('pulgadas')}
        </button>
      ))}
    </div>
  );
}

/** Nombre y medida de cada pieza nueva, marcados con `tk`: se traducen al mostrarlos con `t(label)` y `t(size)`. */
export const ADD_OPTIONS: [NewPartKind, string, string][] = [
  ['tabla', tk('Tabla'), tk('60 × 14,6 × 2,2 cm')],
  ['liston', tk('Listón'), tk('60 × 4,5 × 4,5 cm')],
  ['tablero', tk('Tablero'), tk('60 × 40 × 1,8 cm')],
];

/** Agrega una pieza y la deja elegida. */
export function useAddPart() {
  const commit = useEditor((s) => s.commit);
  const select = useEditor((s) => s.select);
  const setView = useEditor((s) => s.setView);
  return (kind: NewPartKind) => {
    const { project, view } = useEditor.getState();
    if (!project) return;
    const wood = project.parts[0]?.wood ?? 'guatambu';
    const part = newPart(project.parts, kind, wood);
    commit((d) => void d.parts.push(part));
    select(part.id);
    setView(view);
  };
}

/** Cajón y puerta: no son una pieza sino varias, armadas en un hueco del mueble. */
export const FITTING_OPTIONS: [FittingKind, string, string][] = [
  ['cajon', tk('Cajón'), tk('Frente, costados, trasera y fondo')],
  ['puerta', tk('Puerta'), tk('De una tabla o de marco y tablero')],
  ['estantes', tk('Estantes'), tk('Repartidos parejo en un hueco')],
];

const SIZE_NAMES = [tk('ancho'), tk('alto'), tk('fondo')] as const;

/**
 * Ancho, alto y fondo de todo el mueble. Al cambiarlos se estiran las piezas largas sobre ese eje y las demás se
 * corren o se reparten, sin cambiar espesores.
 */
/**
 * Medidas del mueble, o de las piezas `ids` (un grupo) como si fueran un mueble solo: las largas se estiran,
 * las demás se corren y los espesores no cambian.
 */
function FurnitureSize({ project, heading = true, ids }: { project: Project; heading?: boolean; ids?: string[] }) {
  const propose = useEditor((s) => s.propose);
  const setGhost = useEditor((s) => s.setGhost);
  const box = ids ? partsBox(project.parts, ids) : furnitureBox(project.parts);
  // Al soltar el grupo, el fantasma de una medida a medio escribir se va.
  useEffect(() => () => setGhost(null), [setGhost]);
  if (!box) return null;
  const size = boxSize(box);
  const run = (parts: Part[], axis: Axis, mm: number) => (ids ? resizeGroup(parts, ids, axis, mm) : resizeFurniture(parts, axis, mm));
  const who = ids ? partsLabel(project, ids) : null;
  const resize = (axis: Axis, mm: number) => {
    // Se prueba antes en una copia: si no entra, no se toca el proyecto.
    const r = run(structuredClone(project.parts), axis, mm);
    if (!r) {
      useEditor.getState().warn(t('No se puede achicar tanto: no queda lugar libre entre las piezas. Achicá antes alguna pieza.'));
      return;
    }
    const args = { mm: formatLength(mm, project.units), axis: t(SIZE_NAMES[axis]), s: r.stretched.length, m: r.moved.length };
    const label = who
      ? t('{who} ahora mide {mm} de {axis}: se estiraron {s} piezas y se corrieron {m}', { ...args, who })
      : t('El mueble ahora mide {mm} de {axis}: se estiraron {s} piezas y se corrieron {m}', args);
    propose((d) => void run(d.parts as Part[], axis, mm), label, {
      title: who ? t('{who} pasa a medir {mm} de {axis}', { ...args, who }) : t('El mueble pasa a medir {mm} de {axis}', args),
      ...(ids ? { select: ids } : {}),
    });
  };
  return (
    <fieldset className={styles.dims}>
      <legend className={heading ? styles.legend : styles.srOnly}>{ids ? t('Medidas del grupo') : t('Medidas del mueble')}</legend>
      {AXIS_LABELS.map((label, k) => (
        <LengthField key={label} label={t(label)} mm={size[k]!} units={project.units} min={ids ? 1 : 30} max={6000} onDraft={(mm) => setGhost(mm === null ? null : (d) => void run(d.parts as Part[], k as Axis, mm))}
          onCommit={(mm) => resize(k as Axis, mm)}
        />
      ))}
    </fieldset>
  );
}

type OverviewFold = 'medidas' | 'revision' | 'aurea' | 'piezas';
/** Qué secciones del panel quedaron abiertas: se recuerda al ir y volver de una pieza. */
let overviewOpen = new Set<OverviewFold>(['medidas', 'piezas']);

/** Con más piezas que estas, la lista pasa a ser una lista desplegable para que el panel entre sin desplazar. */
/** Con más piezas que estas, la lista se desplaza adentro y el panel no crece. */
const PART_LIST_MAX = 6;

function ProjectOverview({ project }: { project: Project }) {
  const select = useEditor((s) => s.select);
  const notes = useReview(project);
  const checks = useMemo(() => goldenChecks(project), [project]);
  const [open, setOpen] = useState(overviewOpen);
  const toggle = (k: OverviewFold, on: boolean) => {
    const next = new Set(open);
    if (on) next.add(k);
    else next.delete(k);
    overviewOpen = next;
    setOpen(next);
  };
  // La píldora de avisos del modelo abre la revisión.
  useEffect(() => {
    const show = () =>
      setOpen((o) => {
        overviewOpen = new Set(o).add('revision');
        return overviewOpen;
      });
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);
  const box = furnitureBox(project.parts);
  const unit = project.units === 'cm' ? ' cm' : '″';
  const size = box ? boxSize(box).map((mm) => formatLength(mm, project.units).replace(/ cm|″/, '')).join(' × ') + unit : '';
  const many = project.parts.length + project.groups.length > PART_LIST_MAX;
  return (
    <>
      <div>
        <span className={styles.eyebrow}>
          {t('{parts} piezas · {joints} uniones', { parts: project.parts.length, joints: project.joints.length })}
        </span>
        <h2 className={styles.panelTitle}>{t('El mueble')}</h2>
        <p className={styles.muted}>
          {project.parts.length ? t('Tocá una pieza en el modelo o elegila en la lista para editarla.') : t('Todavía no hay piezas. Agregá la primera acá abajo o en el medio de la vista.')}
        </p>
      </div>
      {project.parts.length > 0 && (
        <div className={styles.overviewFolds}>
          {project.parts.length > 1 && (
            <Accordion variant="line" title={t('Medidas del mueble')} summary={`${t('Ancho × alto × fondo')} · ${size}`} open={open.has('medidas')} onToggle={(on) => toggle('medidas', on)}>
              <FurnitureSize project={project} heading={false} />
            </Accordion>
          )}
          <Accordion
            variant="line"
            title={t('Revisión del diseño')}
            summary={reviewSummary(notes.length)}
            meta={notes.length > 0 ? <span className={styles.foldWarn}>{notes.length}</span> : undefined}
            done={notes.length === 0}
            open={open.has('revision')}
            onToggle={(on) => toggle('revision', on)}
          >
            <ReviewCard project={project} heading={false} />
          </Accordion>
          {project.parts.length > 1 && checks.length > 0 && (
            <Accordion variant="line" title={t('Proporción áurea')} summary={t('Guía para medidas equilibradas')} meta={goldenCount(checks)} open={open.has('aurea')} onToggle={(on) => toggle('aurea', on)}>
              <GoldenCard project={project} heading={false} />
            </Accordion>
          )}
          <Accordion
            variant="line"
            title={t('Piezas')}
            summary={[
              project.parts.length === 1 ? t('1 pieza') : t('{n} piezas', { n: project.parts.length }),
              project.groups.length && (project.groups.length === 1 ? t('1 grupo') : t('{n} grupos', { n: project.groups.length })),
            ]
              .filter(Boolean)
              .join(' · ')}
            open={open.has('piezas')}
            onToggle={(on) => toggle('piezas', on)}
          >
            <ul className={styles.partList} data-many={many || undefined}>
              {project.groups.map((g) => (
                <li key={g.id} data-group>
                  <button type="button" onClick={() => useEditor.getState().pick(g.parts)}>
                    <IconGroup />
                    <span className={styles.groupRow}>
                      <span>{g.name}</span>
                      <span className={styles.groupIds}>{g.parts.join(', ')}</span>
                    </span>
                  </button>
                  <EyeToggle id={g.id} ids={g.parts} name={g.name} />
                </li>
              ))}
              {project.parts.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => select(p.id)}>
                    <strong>{p.id}</strong>
                    <span>{p.name}</span>
                  </button>
                  <EyeToggle id={p.id} />
                </li>
              ))}
            </ul>
          </Accordion>
        </div>
      )}
      <div className={`${styles.stack} ${styles.mobileOnly}`}>
        <span className={styles.legend}>{t('Unidades')}</span>
        <UnitsToggle units={project.units} />
      </div>
      <div className={`${styles.panelActions} ${styles.overviewActions}`}>
        <AddPartMenu fittings={project.parts.length > 0} />
      </div>
    </>
  );
}

/** "Agregar pieza": un botón que despliega las piezas sueltas y, si ya hay mueble, cajón, puerta y estantes. */
function AddPartMenu({ fittings }: { fittings: boolean }) {
  const [open, setOpen] = useState(false);
  const add = useAddPart();
  const setFitting = useEditor((s) => s.setFitting);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={ref} className={styles.addDrop}>
      {open && (
        <div id={menuId} className={styles.addDropMenu} role="menu" aria-label={t('Agregar pieza')}>
          <span className={styles.addDropGroup} aria-hidden="true">
            {t('Una pieza')}
          </span>
          {ADD_OPTIONS.map(([k, label, size]) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              onClick={() => {
                add(k);
                setOpen(false);
              }}
            >
              <strong>{t(label)}</strong>
              <span>{t(size)}</span>
            </button>
          ))}
          {fittings && (
            <>
              <span className={styles.addDropGroup} aria-hidden="true">
                {t('Armado en un hueco')}
              </span>
              {FITTING_OPTIONS.map(([k, label, what]) => (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setFitting(k);
                    setOpen(false);
                  }}
                >
                  <strong>{t(label)}</strong>
                  <span className={styles.addWhat}>{t(what)}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <button type="button" className={styles.addDropBtn} data-tour="add" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(!open)}>
        <IconPlus />
        {t('Agregar pieza')}
        <svg className={styles.addDropChevron} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 10l4-4 4 4" />
        </svg>
      </button>
    </div>
  );
}

export function PartPanel() {
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const picked = useEditor((s) => s.picked);
  const fitting = useEditor((s) => s.fitting);
  if (!project) return null;
  if (fitting) return <FittingPanel key={fitting} project={project} kind={fitting} />;
  if (picked.length > 1) return <PickedPanel project={project} ids={picked} />;
  const part = selectedId ? project.parts.find((p) => p.id === selectedId) : undefined;
  return part ? <PartEditor key={part.id} part={part} project={project} /> : <ProjectOverview project={project} />;
}

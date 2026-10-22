import { useId, useState } from 'react';
import {
  acrossFace,
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
  endJoint,
  formatNumber,
  JOINT_NAMES,
  jointOptions,
  locale,
  makeComponent,
  makeUnique,
  MEASURED_FROM,
  newPart,
  parseLength,
  partAxesBySize,
  partBox,
  t,
  tk,
  WOODS,
  type Axis,
  type Bevel,
  type Joint,
  type NewPartKind,
  type Part,
  type Pocket,
  type Project,
  type Section,
  type Units,
} from '@kitc/core';
import { HelpTip } from '../help/Help';
import { IconLink, IconTrash, IconWarn } from './icons';
import { TurningCard } from './TurningCard';
import { useEditor } from './store';
import styles from './Editor.module.css';

const HARDNESS = { dura: tk('dura'), semidura: tk('semidura'), blanda: tk('blanda') } as const;

interface LengthFieldProps {
  label: string;
  mm: number;
  units: Units;
  min?: number;
  max?: number;
  onCommit: (mm: number) => void;
  compact?: boolean;
  /** Id de un aviso que describe el campo (por ejemplo, una medida fuera de lo habitual). */
  describedBy?: string;
}

/** Campo de medida: se escribe en la unidad elegida y se valida al salir del campo. */
export function LengthField({ label, mm, units, min = 1, max, onCommit, compact, describedBy }: LengthFieldProps) {
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

const DIM_LABELS = [tk('Largo'), tk('Ancho'), tk('Espesor')] as const;

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

function JointCard({ joint, partId, project }: { joint: Joint; partId: string; project: Project }) {
  const commit = useEditor((s) => s.commit);
  const otherId = joint.partA === partId ? joint.partB : joint.partA;
  const other = project.parts.find((p) => p.id === otherId);
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  const options = a && b ? jointOptions(partBox(a), partBox(b)) : [];
  if (!options.includes(joint.type)) options.unshift(joint.type);
  const selectId = useId();
  return (
    <div className={styles.jointCard}>
      <span className={styles.jointDot} aria-hidden="true" />
      <span className={styles.jointText}>
        <label htmlFor={selectId} className={styles.srOnly}>
          {t('Encastre con {id}', { id: otherId })}
        </label>
        <select
          id={selectId}
          className={styles.jointSelect}
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
              {t(JOINT_NAMES[type])}
            </option>
          ))}
        </select>
        <span className={styles.muted}>
          {t('con {id}', { id: otherId })}
          {other ? ` · ${other.name}` : ''} · {describeJoint(joint, project)}
        </span>
      </span>
    </div>
  );
}

const AXIS_LABELS = [tk('Ancho'), tk('Alto'), tk('Fondo')] as const;

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
      <div className={styles.pocketFields}>
        {s.kind === 'arc' ? (
          <>
            <LengthField label={t('Inicio desde {side}', { side: side(0) })} mm={s.u} units={units} min={0} max={size[0]} onCommit={(v) => onChange((p) => void (p.shape.u = v))} />
            <LengthField label={t('Inicio desde {side}', { side: side(1) })} mm={s.v} units={units} min={0} max={size[1]} onCommit={(v) => onChange((p) => void (p.shape.v = v))} />
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
        ) : (
          <>
            {s.kind === 'rect' ? (
              <>
                <LengthField label={t(AXIS_LABELS[axes[0]])} mm={s.w} units={units} max={size[0]} onCommit={(v) => onChange((p) => p.shape.kind === 'rect' && (p.shape.w = v))} />
                <LengthField label={t(AXIS_LABELS[axes[1]])} mm={s.h} units={units} max={size[1]} onCommit={(v) => onChange((p) => p.shape.kind === 'rect' && (p.shape.h = v))} />
              </>
            ) : (
              <LengthField label={t('Diámetro')} mm={s.d} units={units} max={Math.max(...size)} onCommit={(v) => onChange((p) => p.shape.kind === 'circle' && (p.shape.d = v))} />
            )}
            <LengthField label={from(0)} mm={s.u} units={units} min={0} max={size[0]} onCommit={(v) => onChange((p) => void (p.shape.u = v))} />
            <LengthField label={from(1)} mm={s.v} units={units} min={0} max={size[1]} onCommit={(v) => onChange((p) => void (p.shape.v = v))} />
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
      {s.kind === 'arc' && (
        <label className={styles.check} htmlFor={otherId}>
          <input id={otherId} type="checkbox" checked={s.outside} onChange={(e) => onChange((p) => p.shape.kind === 'arc' && (p.shape.outside = e.target.checked))} />
          {t('Sacar lo de afuera del arco (esquina redondeada)')}
        </label>
      )}
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
  const select = useEditor((s) => s.select);
  const setTool = useEditor((s) => s.setTool);
  const units = project.units;
  const nameId = useId();
  const woodId = useId();
  // El orden largo/ancho/espesor se fija al elegir la pieza (el panel se monta de nuevo con cada pieza),
  // para que los campos no cambien de lugar mientras se edita.
  const [axes] = useState<[Axis, Axis, Axis]>(() => partAxesBySize(part));
  const size = part.base.kind === 'box' ? part.base.size : [0, 0, 0];
  const op = part.ops[0];
  const edge: EdgeKind = !op ? 'rectos' : op.kind;
  const edgeSize = op ? (op.kind === 'round' ? op.radius : op.size) : 3;
  const joints = project.joints.filter((j) => j.partA === part.id || j.partB === part.id);

  const update = (recipe: (p: Part) => void) =>
    commit((d) => {
      const q = d.parts.find((x) => x.id === part.id);
      if (q) recipe(q as Part);
    });
  const setEdges = (kind: EdgeKind, mm = edgeSize) =>
    update((q) => {
      q.ops = kind === 'rectos' ? [] : kind === 'round' ? [{ kind: 'round', edges: 'all', radius: mm }] : [{ kind: 'chamfer', edges: 'all', size: mm }];
    });

  return (
    <>
      <div>
        <div className={styles.panelHead}>
          <span className={styles.eyebrow}>{t('{id} · pieza seleccionada', { id: part.id })}</span>
          <button type="button" className={styles.link} onClick={() => select(null)}>
            {t('Ver todas las piezas')}
          </button>
        </div>
        <label className={styles.field} htmlFor={nameId}>
          {t('Nombre')}
          <input
            id={nameId}
            key={`${part.id}-${part.name}`}
            defaultValue={part.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== part.name) update((q) => void (q.name = v));
              else e.target.value = part.name;
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
      </div>
      <fieldset className={styles.dims}>
        <legend className={styles.legend}>{t('Medidas terminadas ({units})', { units: units === 'cm' ? 'cm' : t('pulgadas') })}</legend>
        {axes.map((axis, i) => (
          <LengthField
            key={axis}
            label={t(DIM_LABELS[i]!)}
            mm={size[axis] ?? 0}
            units={units}
            min={3}
            onCommit={(v) =>
              update((q) => {
                if (q.base.kind === 'box') q.base.size[axis] = v;
              })
            }
          />
        ))}
      </fieldset>
      <label className={styles.field} htmlFor={woodId}>
        {t('Madera')}
        <select id={woodId} value={part.wood} onChange={(e) => update((q) => void (q.wood = e.target.value))}>
          {WOODS.map((w) => (
            <option key={w.id} value={w.id}>
              {t(w.name)} · {t(HARDNESS[w.hardness])}
            </option>
          ))}
        </select>
      </label>
      <ComponentBox project={project} part={part} />
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
      <div className={styles.stack}>
        <span className={styles.legend}>
          {t('Vaciados y calados ({n})', { n: part.pockets.length })}
          <HelpTip term="vaciados" />
        </span>
        {part.pockets.length === 0 && (
          <p className={styles.muted}>
            {t('Con')}{' '}
            <button type="button" className={`${styles.link} ${styles.inlineLink}`} onClick={() => setTool('draw')}>
              {t('Dibujar')}
            </button>{' '}
            {t('marcás un rectángulo o un círculo en una cara y se saca de la pieza.')}
          </p>
        )}
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
      <div className={styles.stack}>
        <span className={styles.legend}>
          {t('Biseles, redondeos y cortes en ángulo ({n})', { n: part.bevels.length })}
          <HelpTip term="biseles" />
        </span>
        {part.bevels.length === 0 && (
          <p className={styles.muted}>
            {t('Con')}{' '}
            <button type="button" className={`${styles.link} ${styles.inlineLink}`} onClick={() => setTool('bevel')}>
              {t('Biselar')}
            </button>{' '}
            {t('tocás una cara cerca de una arista o una esquina y arrastrás hacia adentro. En la barra elegís bisel o redondeo; si un bisel cruza toda la cara, es un corte en ángulo.')}
          </p>
        )}
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
      <div className={styles.stack}>
        <span className={styles.legend}>
          {t('Tramos ({n})', { n: part.sections.length })}
          <HelpTip term="tramos" />
        </span>
        {part.sections.length === 0 && (
          <p className={styles.muted}>
            {t('Con')}{' '}
            <button type="button" className={`${styles.link} ${styles.inlineLink}`} onClick={() => setTool('section')}>
              {t('Tramo')}
            </button>{' '}
            {t('arrastrás a lo largo de la pieza y ese tramo pasa a tener otra medida: el pie más grueso de una pata, un cuello más fino.')}
          </p>
        )}
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
      <div className={styles.stack}>
        <span className={styles.legend}>
          {t('Torneado')}
          <HelpTip term="torneado" />
        </span>
        {part.turning ? (
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
        ) : (
          <p className={styles.muted}>
            {t('Con')}{' '}
            <button type="button" className={`${styles.link} ${styles.inlineLink}`} onClick={() => setTool('turn')}>
              {t('Tornear')}
            </button>{' '}
            {t('tocás una pieza larga y pasa a ser su taco girado en el torno: una pata, una columna, un barrote.')}
          </p>
        )}
      </div>
      <div className={styles.stack}>
        <span className={styles.legend}>{t('Uniones de esta pieza ({n})', { n: joints.length })}</span>
        {joints.length === 0 && <p className={styles.muted}>{t('Acercá esta pieza a otra hasta que se toquen y se propone un encastre.')}</p>}
        {joints.map((j) => (
          <JointCard key={j.id} joint={j} partId={part.id} project={project} />
        ))}
      </div>
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            const copy = duplicatePart(project.parts, part);
            commit((d) => void d.parts.push(copy));
            select(copy.id);
          }}
        >
          {t('Duplicar')}
        </button>
        <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => commit((d) => void (d.parts = d.parts.filter((x) => x.id !== part.id)), t('Borraste {id}', { id: part.id }))}>
          {t('Eliminar')}
        </button>
      </div>
    </>
  );
}

/** Componente de la pieza: cuántas copias vinculadas tiene, o el botón para crear uno. */
function ComponentBox({ project, part }: { project: Project; part: Part }) {
  const commit = useEditor((s) => s.commit);
  const copies = componentCopies(project, part);
  const component = project.components.find((c) => c.id === part.component);
  if (!component) {
    return (
      <div className={styles.componentBox}>
        <p className={styles.muted}>{t('Si hacés un componente, cada copia de esta pieza cambia junto con las demás.')}</p>
        <button type="button" className={styles.btn} onClick={() => commit((d) => void makeComponent(d as Project, part.id))}>
          {t('Hacer componente')}
        </button>
      </div>
    );
  }
  const others = copies.filter((p) => p.id !== part.id).map((p) => p.id);
  return (
    <div className={`${styles.componentBox} ${styles.componentOn}`}>
      <span className={styles.componentTitle}>
        <IconLink />
        {copies.length === 1
          ? t('Componente {name} · {n} copia', { name: component.name, n: 1 })
          : t('Componente {name} · {n} copias', { name: component.name, n: copies.length })}
      </span>
      <p className={styles.muted}>
        {others.length
          ? t('Las medidas, la madera y los cantos cambian también en {ids}. Mover una copia no mueve las otras.', { ids: others.join(', ') })
          : t('Duplicala o copiala al mover y las copias quedan vinculadas.')}
      </p>
      <button type="button" className={styles.btn} onClick={() => commit((d) => makeUnique(d as Project, part.id))}>
        {t('Hacer única')}
      </button>
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

function ProjectOverview({ project }: { project: Project }) {
  const select = useEditor((s) => s.select);
  const add = useAddPart();
  return (
    <>
      <div>
        <span className={styles.eyebrow}>
          {t('{parts} piezas · {joints} uniones', { parts: project.parts.length, joints: project.joints.length })}
        </span>
        <h2 className={styles.panelTitle}>{t('Piezas')}</h2>
        <p className={styles.muted}>
          {project.parts.length ? t('Tocá una pieza en el modelo o en la lista para editarla.') : t('Todavía no hay piezas. Agregá la primera acá abajo o en el medio de la vista.')}
        </p>
      </div>
      <ul className={styles.partList}>
        {project.parts.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => select(p.id)}>
              <strong>{p.id}</strong>
              <span>{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className={`${styles.stack} ${styles.mobileOnly}`}>
        <span className={styles.legend}>{t('Unidades')}</span>
        <UnitsToggle units={project.units} />
      </div>
      <div className={styles.stack}>
        <span className={styles.legend}>{t('Agregar pieza')}</span>
        <div className={styles.addRow}>
          {ADD_OPTIONS.map(([k, label, size]) => (
            <button key={k} type="button" className={styles.addBtn} onClick={() => add(k)}>
              <strong>{t(label)}</strong>
              <span>{t(size)}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function PartPanel() {
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  if (!project) return null;
  const part = selectedId ? project.parts.find((p) => p.id === selectedId) : undefined;
  return part ? <PartEditor key={part.id} part={part} project={project} /> : <ProjectOverview project={project} />;
}

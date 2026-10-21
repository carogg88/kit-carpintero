import { useId, useState } from 'react';
import {
  componentCopies,
  defaultJointParams,
  duplicatePart,
  endJoint,
  formatNumber,
  JOINT_NAMES,
  jointOptions,
  makeComponent,
  makeUnique,
  newPart,
  parseLength,
  partAxesBySize,
  partBox,
  WOODS,
  type Axis,
  type Joint,
  type NewPartKind,
  type Part,
  type Project,
  type Units,
} from '@kitc/core';
import { IconLink, IconWarn } from './icons';
import { useEditor } from './store';
import styles from './Editor.module.css';

const HARDNESS = { dura: 'dura', semidura: 'semidura', blanda: 'blanda' } as const;

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
  const [text, setText] = useState(() => (mm ? formatNumber(mm, units) : ''));
  const [error, setError] = useState<string | null>(null);
  // Si la medida cambia desde afuera (deshacer, arrastrar), el campo la muestra de nuevo.
  const [shown, setShown] = useState({ mm, units });
  if (shown.mm !== mm || shown.units !== units) {
    setShown({ mm, units });
    setText(mm ? formatNumber(mm, units) : '');
    setError(null);
  }
  const commit = () => {
    const v = parseLength(text, units);
    if (v === null) return setError(units === 'cm' ? 'Escribí un número, por ejemplo 72,5' : 'Escribí pulgadas, por ejemplo 2 7/8');
    if (v < min) return setError(`Tiene que ser de ${formatNumber(min, units)} o más`);
    if (max !== undefined && v > max) return setError(`Tiene que ser de ${formatNumber(max, units)} o menos`);
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

const DIM_LABELS = ['Largo', 'Ancho', 'Espesor'] as const;

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
      return 'apoyada, sin cortes';
    case 'mortaja': {
      const e = endJoint(ba, bb);
      const wide = e ? e.section.max[e.wide] - e.section.min[e.wide] - 2 * (p.shoulder ?? 0) : 0;
      if (wide <= 0) return 'mortaja y espiga';
      return `mortaja ${n(p.thickness ?? 0)} × ${n(wide)} × ${n((p.length ?? 0) + 2)}${unit}`;
    }
    case 'canal':
    case 'rebaje':
      return `${j.type === 'canal' ? 'canal' : 'rebaje'} de ${n(p.depth ?? 0)}${unit} de profundidad`;
    case 'media-madera':
      return 'cada pieza rebajada a la mitad';
    case 'clavija':
      return `${p.count ?? 0} tarugos de ${p.diameter ?? 0} mm`;
    case 'cola-milano':
      return `${p.count ?? 0} ${p.count === 1 ? 'cola' : 'colas'} de milano 1:${p.slope ?? 8}`;
    case 'dedos':
      return `${p.count ?? 0} dedos de ${n(p.depth ?? 0)}${unit}`;
    case 'brida':
      return `brida, lengüeta de ${n(p.thickness ?? 0)}${unit}`;
    case 'inglete':
      return 'esquina en inglete';
    case 'galleta':
      return `${p.count ?? 0} ${p.count === 1 ? 'galleta' : 'galletas'} del ${p.size ?? 20}`;
    case 'machiembrado':
      return `machimbre, lengüeta de ${n(p.thickness ?? 0)} × ${n(p.depth ?? 0)}${unit}`;
    case 'bolsillo':
      return `${p.count ?? 0} ${p.count === 1 ? 'tornillo' : 'tornillos'} de bolsillo`;
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
          Encastre con {otherId}
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
          {options.map((t) => (
            <option key={t} value={t}>
              {JOINT_NAMES[t]}
            </option>
          ))}
        </select>
        <span className={styles.muted}>
          con {otherId}
          {other ? ` · ${other.name}` : ''} · {describeJoint(joint, project)}
        </span>
      </span>
    </div>
  );
}

type EdgeKind = 'rectos' | 'round' | 'chamfer';

function PartEditor({ part, project }: { part: Part; project: Project }) {
  const commit = useEditor((s) => s.commit);
  const select = useEditor((s) => s.select);
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
          <span className={styles.eyebrow}>{part.id} · pieza seleccionada</span>
          <button type="button" className={styles.link} onClick={() => select(null)}>
            Ver todas las piezas
          </button>
        </div>
        <label className={styles.field} htmlFor={nameId}>
          Nombre
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
        <legend className={styles.legend}>Medidas terminadas ({units === 'cm' ? 'cm' : 'pulgadas'})</legend>
        {axes.map((axis, i) => (
          <LengthField
            key={axis}
            label={DIM_LABELS[i]!}
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
        Madera
        <select id={woodId} value={part.wood} onChange={(e) => update((q) => void (q.wood = e.target.value))}>
          {WOODS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} · {HARDNESS[w.hardness]}
            </option>
          ))}
        </select>
      </label>
      <ComponentBox project={project} part={part} />
      <fieldset className={styles.plainFieldset}>
        <legend className={styles.legend}>Cantos</legend>
        <div className={styles.row}>
          <div className={styles.seg} role="group" aria-label="Tipo de canto">
            {(
              [
                ['rectos', 'Rectos'],
                ['round', 'Redondeados'],
                ['chamfer', 'Chaflán'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={edge === k} onClick={() => setEdges(k)}>
                {label}
              </button>
            ))}
          </div>
          {edge !== 'rectos' && (
            <LengthField compact label={edge === 'round' ? 'Radio' : 'Medida'} mm={edgeSize} units={units} min={0.5} onCommit={(v) => setEdges(edge, v)} />
          )}
        </div>
      </fieldset>
      <div className={styles.stack}>
        <span className={styles.legend}>Uniones de esta pieza ({joints.length})</span>
        {joints.length === 0 && <p className={styles.muted}>Acercá esta pieza a otra hasta que se toquen y se propone un encastre.</p>}
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
          Duplicar
        </button>
        <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => commit((d) => void (d.parts = d.parts.filter((x) => x.id !== part.id)))}>
          Eliminar
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
        <p className={styles.muted}>Si hacés un componente, cada copia de esta pieza cambia junto con las demás.</p>
        <button type="button" className={styles.btn} onClick={() => commit((d) => void makeComponent(d as Project, part.id))}>
          Hacer componente
        </button>
      </div>
    );
  }
  const others = copies.filter((p) => p.id !== part.id).map((p) => p.id);
  return (
    <div className={`${styles.componentBox} ${styles.componentOn}`}>
      <span className={styles.componentTitle}>
        <IconLink />
        Componente {component.name} · {copies.length} {copies.length === 1 ? 'copia' : 'copias'}
      </span>
      <p className={styles.muted}>
        {others.length
          ? `Las medidas, la madera y los cantos cambian también en ${others.join(', ')}. Mover una copia no mueve las otras.`
          : 'Duplicala o copiala al mover y las copias quedan vinculadas.'}
      </p>
      <button type="button" className={styles.btn} onClick={() => commit((d) => makeUnique(d as Project, part.id))}>
        Hacer única
      </button>
    </div>
  );
}

export function UnitsToggle({ units }: { units: Units }) {
  const setUnits = useEditor((s) => s.setUnits);
  return (
    <div className={styles.seg} role="group" aria-label="Unidades">
      {(['cm', 'in'] as const).map((u) => (
        <button key={u} type="button" aria-pressed={units === u} onClick={() => setUnits(u)}>
          {u === 'cm' ? 'cm' : 'pulgadas'}
        </button>
      ))}
    </div>
  );
}

export const ADD_OPTIONS: [NewPartKind, string, string][] = [
  ['tabla', 'Tabla', '60 × 14,6 × 2,2 cm'],
  ['liston', 'Listón', '60 × 4,5 × 4,5 cm'],
  ['tablero', 'Tablero', '60 × 40 × 1,8 cm'],
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
        <span className={styles.eyebrow}>{project.parts.length} piezas · {project.joints.filter((j) => j.type !== 'tope').length} encastres</span>
        <h2 className={styles.panelTitle}>Piezas</h2>
        <p className={styles.muted}>Tocá una pieza en el modelo o en la lista para editarla.</p>
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
        <span className={styles.legend}>Unidades</span>
        <UnitsToggle units={project.units} />
      </div>
      <div className={styles.stack}>
        <span className={styles.legend}>Agregar pieza</span>
        <div className={styles.addRow}>
          {ADD_OPTIONS.map(([k, label, size]) => (
            <button key={k} type="button" className={styles.addBtn} onClick={() => add(k)}>
              <strong>{label}</strong>
              <span>{size}</span>
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

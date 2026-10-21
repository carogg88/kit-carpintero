import { useId, useState } from 'react';
import {
  defaultJointParams,
  endJoint,
  formatNumber,
  groupJoints,
  JOINT_NAMES,
  jointContact,
  jointGrowth,
  jointOptions,
  partBox,
  partWord,
  type Joint,
  type JointGroup,
  type JointType,
  type Part,
  type Project,
} from '@kitc/core';
import { sectionHref } from '../routes';
import { IconBack, IconInfo, IconWarn } from './icons';
import { JointDetail3D } from './JointDetail3D';
import { describeJoint, LengthField } from './PartPanel';
import { useEditor } from './store';
import type { ExactMesh } from './useGeometry';
import styles from './Sections.module.css';

const ABOUT: Partial<Record<JointType, string>> = {
  tope: 'Las piezas solo se apoyan, sin cortes. Se fijan con tornillos, clips de fijación o cola.',
  mortaja: 'Encastre clásico para patas y faldones: fuerte y oculto. Se hace con escoplo o fresadora; la espiga va encolada.',
  'media-madera': 'Cada pieza se rebaja a la mitad de su espesor y quedan al ras. Se hace con sierra y formón, o con fresadora.',
  canal: 'Una ranura a lo largo de una pieza donde entra el canto de la otra. Ideal para fondos y paneles; se hace con fresadora o sierra de mesa.',
  rebaje: 'Un escalón en el canto de una pieza donde apoya la otra. Se usa en fondos y tapas; se hace con fresadora o sierra de mesa.',
  clavija: 'Tarugos de madera encolados en agujeros enfrentados. Rápido y prolijo con una plantilla para tarugos.',
};

const DOWEL_SIZES = [6, 8, 10, 12];
const SHOWN = 4;

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1);
const minDim = (p: Part) => {
  const b = partBox(p);
  return Math.min(...b.max.map((v, i) => v - b.min[i]!));
};

function JointList({ groups, current, onPick }: { groups: JointGroup[]; current: Joint; onPick: (j: Joint) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <aside className={styles.jointList} aria-labelledby="uniones-titulo">
      <h1 id="uniones-titulo" className={styles.h1}>
        Uniones del mueble
      </h1>
      <p className={styles.muted}>La app encuentra dónde se tocan las piezas y te ofrece solo los encastres posibles en cada lugar.</p>
      {groups.map((g) => {
        const at = g.joints.findIndex((j) => j.id === current.id);
        const all = open[g.key] || g.joints.length <= SHOWN + 1 || at >= SHOWN;
        const shown = all ? g.joints : g.joints.slice(0, SHOWN);
        return (
          <section key={g.key} className={styles.group} aria-label={`${g.label}, ${g.joints.length} uniones`}>
            <h2 className={styles.eyebrow}>
              {g.label} · {g.joints.length}
            </h2>
            <ul className={styles.jointItems}>
              {shown.map((j) => (
                <li key={j.id}>
                  <button type="button" aria-current={j.id === current.id ? 'true' : undefined} onClick={() => onPick(j)}>
                    <span className={styles.dot} data-plain={j.type === 'tope' || undefined} aria-hidden="true" />
                    <span className={styles.pair}>
                      {j.partA} ↔ {j.partB}
                    </span>
                    <span className={styles.typeName}>{JOINT_NAMES[j.type]}</span>
                  </button>
                </li>
              ))}
            </ul>
            {!all && (
              <button type="button" className={styles.more} onClick={() => setOpen({ ...open, [g.key]: true })}>
                Ver {g.joints.length - SHOWN} más
              </button>
            )}
          </section>
        );
      })}
    </aside>
  );
}

/** Regla de taller para elegir las medidas del encastre. */
function ruleHint(j: Joint, a: Part, b: Part, n: (mm: number) => string): string {
  const e = endJoint(partBox(a), partBox(b));
  switch (j.type) {
    case 'mortaja': {
      const thin = e ? partBox(b).max[e.thin] - partBox(b).min[e.thin] : minDim(b);
      return `Regla del tercio: la espiga mide un tercio del espesor de ${b.id} (${n(thin)}), o sea ${n(thin / 3)}.`;
    }
    case 'clavija': {
      const thin = Math.min(minDim(a), minDim(b));
      const best = DOWEL_SIZES.reduce((x, y) => (Math.abs(y - thin / 2) < Math.abs(x - thin / 2) ? y : x));
      return `El tarugo mide cerca de la mitad del espesor de la pieza más fina (${n(thin)}): conviene uno de ${best} mm.`;
    }
    case 'canal':
    case 'rebaje':
      return `La profundidad no debería pasar de la mitad del espesor de ${a.id} (${n(minDim(a))}).`;
    case 'media-madera':
      return 'Cada pieza pierde la mitad de su espesor en el cruce, así quedan al ras.';
    default:
      return 'No lleva cortes: se fija con tornillos, clips de fijación o cola.';
  }
}

/** Qué cambia en la lista de cortes con este encastre. */
function cutChanges(j: Joint, a: Part, b: Part, project: Project, n: (mm: number) => string): string[] {
  const lines = jointGrowth(project, j).map((g) => `+${n(g.mm)} al ${g.along} de corte de ${g.partId}`);
  switch (j.type) {
    case 'tope':
      return ['No cambia ningún corte.'];
    case 'mortaja':
    case 'canal':
    case 'rebaje':
      return [...lines, `${capitalize(describeJoint(j, project))} en ${a.id}`];
    case 'media-madera':
      return [`Rebaje a media madera en ${a.id} y en ${b.id}`];
    case 'clavija': {
      const p = { ...defaultJointParams('clavija', partBox(a), partBox(b)), ...j.params };
      return [`${p.count ?? 0} agujeros de ${p.diameter ?? 0} mm en ${a.id} y en ${b.id}`];
    }
    default:
      return lines;
  }
}

interface DetailProps {
  project: Project;
  joint: Joint;
  group: JointGroup;
  meshes: ReadonlyMap<string, ExactMesh>;
  applyAll: boolean;
  setApplyAll: (on: boolean) => void;
  onBack: () => void;
}

function JointDetail({ project, joint, group, meshes, applyAll, setApplyAll, onBack }: DetailProps) {
  const commit = useEditor((s) => s.commit);
  const typeName = useId();
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  if (!a || !b) return null;
  const units = project.units;
  const unit = units === 'cm' ? ' cm' : '″';
  const n = (mm: number) => `${formatNumber(mm, units)}${unit}`;
  const ba = partBox(a);
  const bb = partBox(b);
  const options = jointOptions(ba, bb);
  if (!options.includes(joint.type)) options.unshift(joint.type);
  const params = { ...defaultJointParams(joint.type, ba, bb), ...joint.params };
  const targets = applyAll ? group.joints : [joint];
  const warning = meshes.get(a.id)?.warning ?? meshes.get(b.id)?.warning;

  const setType = (type: JointType) =>
    commit((d) => {
      for (const t of targets) {
        const j = d.joints.find((x) => x.id === t.id);
        const pa = d.parts.find((p) => p.id === t.partA);
        const pb = d.parts.find((p) => p.id === t.partB);
        if (!j || !pa || !pb) continue;
        if (t.id === joint.id || jointOptions(partBox(pa as Part), partBox(pb as Part)).includes(type)) {
          j.type = type;
          j.params = {};
        }
      }
    });
  const setParam = (key: string, value: number) =>
    commit((d) => {
      for (const t of targets) {
        const j = d.joints.find((x) => x.id === t.id);
        if (j && j.type === joint.type) j.params[key] = value;
      }
    });

  const length = (key: string, label: string, min = 1) => (
    <LengthField key={`${joint.id}-${key}`} label={label} mm={params[key] ?? 0} units={units} min={min} onCommit={(v) => setParam(key, v)} />
  );
  const fields: React.ReactNode[] =
    joint.type === 'mortaja'
      ? [length('length', 'Largo', 5), length('thickness', 'Espesor', 3), length('shoulder', 'Hombro', 0)]
      : joint.type === 'canal' || joint.type === 'rebaje'
        ? [length('depth', 'Profundidad')]
        : joint.type === 'clavija'
          ? [
              <label key="d" className={styles.field}>
                Diámetro
                <select value={params.diameter ?? 8} onChange={(e) => setParam('diameter', Number(e.target.value))}>
                  {DOWEL_SIZES.map((d) => (
                    <option key={d} value={d}>
                      {d} mm
                    </option>
                  ))}
                </select>
              </label>,
              <label key="c" className={styles.field}>
                Cantidad
                <select value={params.count ?? 2} onChange={(e) => setParam('count', Number(e.target.value))}>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>,
              length('depthA', `Hondo en ${a.id}`, 5),
              length('depthB', `Hondo en ${b.id}`, 5),
            ]
          : [];
  const legendB = joint.type === 'mortaja' ? 'Espiga' : `${b.id} ${b.name}`;

  return (
    <div className={styles.detailGrid}>
      <div className={styles.detailMain}>
        <button type="button" className={`${styles.backLink} ${styles.mobileOnly}`} onClick={onBack}>
          <IconBack />
          Todas las uniones
        </button>
        <div>
          <span className={styles.mono}>
            {a.id} {a.name} ↔ {b.id} {b.name} · {jointContact(a, b)}
          </span>
          <h2 id="detalle" className={styles.h2}>
            {JOINT_NAMES[joint.type]}
          </h2>
        </div>
        <figure className={styles.detailFigure}>
          <JointDetail3D
            project={project}
            joint={joint}
            meshes={meshes}
            label={`Detalle en rayos X: ${b.id} ${b.name} entra en ${a.id} ${a.name} con ${JOINT_NAMES[joint.type].toLocaleLowerCase('es')}`}
          />
          <span className={styles.legend} style={{ top: 12 }}>
            <span className={styles.swatchSolid} aria-hidden="true" />
            {legendB}
          </span>
          <span className={styles.legend} style={{ top: 44 }}>
            <span className={styles.swatchXray} aria-hidden="true" />
            {partWord(a)} en rayos X
          </span>
          <figcaption>Arrastrá para girar el detalle</figcaption>
        </figure>
        <p className={styles.muted}>{ABOUT[joint.type] ?? 'Este encastre todavía no tiene cortes en el modelo.'}</p>
        {warning && (
          <p className={styles.warn} role="alert">
            <IconWarn />
            El encastre no se pudo cortar del todo en el modelo. Revisá las medidas.
          </p>
        )}
      </div>

      <div className={styles.detailSide}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.eyebrow}>Tipo de encastre</legend>
          {options.map((t) => (
            <label key={t} className={styles.radio}>
              <input type="radio" name={typeName} checked={joint.type === t} onChange={() => setType(t)} />
              {JOINT_NAMES[t]}
            </label>
          ))}
          <span className={styles.note}>Cola de milano, brida, galleta y los demás encastres llegan en una próxima versión.</span>
        </fieldset>

        {fields.length > 0 && (
          <fieldset className={styles.params} data-count={fields.length}>
            <legend className={styles.eyebrow}>
              Medidas {joint.type === 'mortaja' ? 'de la espiga' : 'del encastre'} ({units === 'cm' ? 'cm' : 'pulgadas'})
            </legend>
            {fields}
          </fieldset>
        )}
        <p className={styles.tip}>
          <IconInfo />
          <span>{ruleHint(joint, a, b, n)}</span>
        </p>

        <div className={styles.changes}>
          <span className={styles.eyebrow}>Qué cambia en los cortes</span>
          {cutChanges(joint, a, b, project, n).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        {group.joints.length > 1 && (
          <label className={styles.check}>
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
            Aplicar a las {group.joints.length} uniones de {group.label.toLocaleLowerCase('es')}
          </label>
        )}
      </div>
    </div>
  );
}

export function JointsView({ project, meshes }: { project: Project; meshes: ReadonlyMap<string, ExactMesh> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [applyAll, setApplyAll] = useState(true);
  const groups = groupJoints(project);
  const joint = project.joints.find((j) => j.id === selectedId) ?? groups[0]?.joints[0];
  const group = joint && groups.find((g) => g.joints.some((j) => j.id === joint.id));

  if (!joint || !group) {
    return (
      <main className={styles.empty}>
        <h1 className={styles.h1}>Todavía no hay uniones</h1>
        <p className={styles.muted}>En el modelo, acercá dos piezas hasta que se toquen y la app te propone un encastre.</p>
        <a className={styles.primary} href={sectionHref(project.id, 'modelo')}>
          Ir al modelo
        </a>
      </main>
    );
  }
  return (
    <main className={styles.joints} data-detail={detailOpen || undefined}>
      <JointList
        groups={groups}
        current={joint}
        onPick={(j) => {
          setSelectedId(j.id);
          setDetailOpen(true);
        }}
      />
      <section className={styles.jointDetail} aria-labelledby="detalle">
        <JointDetail
          key={joint.id}
          project={project}
          joint={joint}
          group={group}
          meshes={meshes}
          applyAll={applyAll}
          setApplyAll={setApplyAll}
          onBack={() => setDetailOpen(false)}
        />
      </section>
    </main>
  );
}

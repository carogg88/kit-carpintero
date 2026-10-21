import { useId, useState } from 'react';
import {
  BISCUITS,
  defaultJointParams,
  endJoint,
  formatNumber,
  groupJoints,
  JOINT_NAMES,
  jointContact,
  jointGrowth,
  jointOptions,
  locale,
  partBox,
  partWord,
  t,
  type Joint,
  type JointGroup,
  type JointType,
  type Part,
  type Project,
} from '@kitc/core';
import { JOINT_ABOUT } from '../help/terms';
import { sectionHref } from '../routes';
import { IconBack, IconInfo, IconWarn } from './icons';
import { JointDetail3D } from './JointDetail3D';
import { describeJoint, LengthField } from './PartPanel';
import { useEditor } from './store';
import type { ExactMesh } from './useGeometry';
import styles from './Sections.module.css';


const SLOPES = [6, 8];

const DOWEL_SIZES = [6, 8, 10, 12];
const SHOWN = 4;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const minDim = (p: Part) => {
  const b = partBox(p);
  return Math.min(...b.max.map((v, i) => v - b.min[i]!));
};

function JointList({ groups, current, onPick }: { groups: JointGroup[]; current: Joint; onPick: (j: Joint) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <aside className={styles.jointList} aria-labelledby="uniones-titulo">
      <h1 id="uniones-titulo" className={styles.h1}>
        {t('Uniones del mueble')}
      </h1>
      <p className={styles.muted}>{t('La app encuentra dónde se tocan las piezas y te ofrece solo los encastres posibles en cada lugar.')}</p>
      {groups.map((g) => {
        const at = g.joints.findIndex((j) => j.id === current.id);
        const all = open[g.key] || g.joints.length <= SHOWN + 1 || at >= SHOWN;
        const shown = all ? g.joints : g.joints.slice(0, SHOWN);
        return (
          <section key={g.key} className={styles.group} aria-label={t('{group}, {n} uniones', { group: g.label, n: g.joints.length })}>
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
                    <span className={styles.typeName}>{t(JOINT_NAMES[j.type])}</span>
                  </button>
                </li>
              ))}
            </ul>
            {!all && (
              <button type="button" className={styles.more} onClick={() => setOpen({ ...open, [g.key]: true })}>
                {t('Ver {n} más', { n: g.joints.length - SHOWN })}
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
      return t('Regla del tercio: la espiga mide un tercio del espesor de {id} ({thick}), o sea {size}.', { id: b.id, thick: n(thin), size: n(thin / 3) });
    }
    case 'clavija': {
      const thin = Math.min(minDim(a), minDim(b));
      const best = DOWEL_SIZES.reduce((x, y) => (Math.abs(y - thin / 2) < Math.abs(x - thin / 2) ? y : x));
      return t('El tarugo mide cerca de la mitad del espesor de la pieza más fina ({thick}): conviene uno de {d} mm.', { thick: n(thin), d: best });
    }
    case 'canal':
    case 'rebaje':
      return t('La profundidad no debería pasar de la mitad del espesor de {id} ({thick}).', { id: a.id, thick: n(minDim(a)) });
    case 'media-madera':
      return t('Cada pieza pierde la mitad de su espesor en el cruce, así quedan al ras.');
    case 'cola-milano':
      return t('Pendiente 1:8 para maderas duras y 1:6 para blandas. Con el largo igual al espesor de la otra pieza, las colas quedan pasantes.');
    case 'dedos':
      return t('Los dedos andan bien del ancho del espesor de {id} ({thick}).', { id: b.id, thick: n(minDim(b)) });
    case 'brida': {
      const thin = e ? partBox(b).max[e.thin] - partBox(b).min[e.thin] : minDim(b);
      return t('Regla del tercio: cada mejilla de la horquilla y la lengüeta del medio miden un tercio del espesor de {id} ({size}).', { id: b.id, size: n(thin / 3) });
    }
    case 'inglete':
      return t('Con las dos piezas del mismo espesor, el corte queda a 45°.');
    case 'galleta':
      return t('Usá la galleta más grande que entre: del 20 si el ancho pasa los 8 cm. Una cada 15 cm.');
    case 'machiembrado':
      return t('La lengüeta mide un tercio del espesor de {id} ({thick}) y entra la mitad de ese espesor.', { id: b.id, thick: n(minDim(b)) });
    case 'bolsillo':
      return t('Tornillos de cabeza plana, de unos 3 cm para madera de 19 mm. Uno cada 12 cm.');
    default:
      return t('No lleva cortes: se fija con tornillos, clips de fijación o cola.');
  }
}

/** Qué cambia en la lista de cortes con este encastre. */
function cutChanges(j: Joint, a: Part, b: Part, project: Project, n: (mm: number) => string): string[] {
  const lines = jointGrowth(project, j).map((g) => {
    const vars = { mm: n(g.mm), id: g.partId };
    if (g.along === 'largo') return t('+{mm} al largo de corte de {id}', vars);
    if (g.along === 'ancho') return t('+{mm} al ancho de corte de {id}', vars);
    return t('+{mm} al espesor de corte de {id}', vars);
  });
  switch (j.type) {
    case 'tope':
      return [t('No cambia ningún corte.')];
    case 'mortaja':
    case 'canal':
    case 'rebaje':
      return [...lines, t('{joint} en {id}', { joint: capitalize(describeJoint(j, project)), id: a.id })];
    case 'media-madera':
      return [t('Rebaje a media madera en {a} y en {b}', { a: a.id, b: b.id })];
    case 'clavija': {
      const p = { ...defaultJointParams('clavija', partBox(a), partBox(b)), ...j.params };
      return [t('{count} agujeros de {d} mm en {a} y en {b}', { count: p.count ?? 0, d: p.diameter ?? 0, a: a.id, b: b.id })];
    }
    case 'galleta':
    case 'bolsillo':
      return [capitalize(describeJoint(j, project))];
    default:
      return [...lines, t('{joint} entre {a} y {b}', { joint: capitalize(describeJoint(j, project)), a: a.id, b: b.id })];
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
      for (const target of targets) {
        const j = d.joints.find((x) => x.id === target.id);
        const pa = d.parts.find((p) => p.id === target.partA);
        const pb = d.parts.find((p) => p.id === target.partB);
        if (!j || !pa || !pb) continue;
        if (target.id === joint.id || jointOptions(partBox(pa as Part), partBox(pb as Part)).includes(type)) {
          j.type = type;
          j.params = {};
        }
      }
    });
  const setParam = (key: string, value: number) =>
    commit((d) => {
      for (const target of targets) {
        const j = d.joints.find((x) => x.id === target.id);
        if (j && j.type === joint.type) j.params[key] = value;
      }
    });

  const length = (key: string, label: string, min = 1) => (
    <LengthField key={`${joint.id}-${key}`} label={label} mm={params[key] ?? 0} units={units} min={min} onCommit={(v) => setParam(key, v)} />
  );
  const choose = (key: string, label: string, values: number[], text: (v: number) => string = String) => (
    <label key={key} className={styles.field}>
      {label}
      <select value={params[key] ?? values[0]} onChange={(e) => setParam(key, Number(e.target.value))}>
        {values.map((v) => (
          <option key={v} value={v}>
            {text(v)}
          </option>
        ))}
      </select>
    </label>
  );
  const upTo = (max: number) => Array.from({ length: max }, (_, i) => i + 1);
  const fineFields: Partial<Record<JointType, React.ReactNode[]>> = {
    'cola-milano': [choose('count', t('Colas'), upTo(8)), choose('slope', t('Pendiente'), SLOPES, (v) => `1:${v}`), length('depth', t('Largo'), 3)],
    dedos: [choose('count', t('Dedos'), upTo(12)), length('depth', t('Largo'), 3)],
    brida: [length('thickness', t('Lengüeta'), 3), length('depth', t('Largo'), 5)],
    galleta: [choose('size', t('Galleta'), BISCUITS.map(([size]) => size), (v) => t('Nº {size}', { size: v })), choose('count', t('Cantidad'), upTo(6))],
    machiembrado: [length('thickness', t('Espesor'), 2), length('depth', t('Largo'), 3)],
    bolsillo: [choose('count', t('Tornillos'), upTo(6))],
  };
  const fields: React.ReactNode[] =
    fineFields[joint.type] ??
    (joint.type === 'mortaja'
      ? [length('length', t('Largo'), 5), length('thickness', t('Espesor'), 3), length('shoulder', t('Hombro'), 0)]
      : joint.type === 'canal' || joint.type === 'rebaje'
        ? [length('depth', t('Profundidad'))]
        : joint.type === 'clavija'
          ? [
              <label key="d" className={styles.field}>
                {t('Diámetro')}
                <select value={params.diameter ?? 8} onChange={(e) => setParam('diameter', Number(e.target.value))}>
                  {DOWEL_SIZES.map((d) => (
                    <option key={d} value={d}>
                      {d} mm
                    </option>
                  ))}
                </select>
              </label>,
              <label key="c" className={styles.field}>
                {t('Cantidad')}
                <select value={params.count ?? 2} onChange={(e) => setParam('count', Number(e.target.value))}>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>,
              length('depthA', t('Hondo en {id}', { id: a.id }), 5),
              length('depthB', t('Hondo en {id}', { id: b.id }), 5),
            ]
          : []);
  const legendB = joint.type === 'mortaja' ? t('Espiga') : joint.type === 'cola-milano' ? t('Colas') : `${b.id} ${b.name}`;

  return (
    <div className={styles.detailGrid}>
      <div className={styles.detailMain}>
        <button type="button" className={`${styles.backLink} ${styles.mobileOnly}`} onClick={onBack}>
          <IconBack />
          {t('Todas las uniones')}
        </button>
        <div>
          <span className={styles.mono}>
            {a.id} {a.name} ↔ {b.id} {b.name} · {jointContact(a, b)}
          </span>
          <h2 id="detalle" className={styles.h2}>
            {t(JOINT_NAMES[joint.type])}
          </h2>
        </div>
        <figure className={styles.detailFigure}>
          <JointDetail3D
            project={project}
            joint={joint}
            meshes={meshes}
            label={t('Detalle en rayos X: {b} entra en {a} con {joint}', {
              b: `${b.id} ${b.name}`,
              a: `${a.id} ${a.name}`,
              joint: t(JOINT_NAMES[joint.type]).toLocaleLowerCase(locale()),
            })}
          />
          <span className={styles.legend} style={{ top: 12 }}>
            <span className={styles.swatchSolid} aria-hidden="true" />
            {legendB}
          </span>
          <span className={styles.legend} style={{ top: 44 }}>
            <span className={styles.swatchXray} aria-hidden="true" />
            {t('{part} en rayos X', { part: partWord(a) })}
          </span>
          <figcaption>{t('Arrastrá para girar el detalle')}</figcaption>
        </figure>
        <p className={styles.muted}>{t(JOINT_ABOUT[joint.type] ?? 'Este encastre todavía no tiene cortes en el modelo.')}</p>
        {warning && (
          <p className={styles.warn} role="alert">
            <IconWarn />
            {t('El encastre no se pudo cortar del todo en el modelo. Revisá las medidas.')}
          </p>
        )}
      </div>

      <div className={styles.detailSide}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.eyebrow}>{t('Tipo de encastre')}</legend>
          {options.map((type) => (
            <label key={type} className={styles.radio}>
              <input type="radio" name={typeName} checked={joint.type === type} onChange={() => setType(type)} />
              {t(JOINT_NAMES[type])}
            </label>
          ))}
        </fieldset>

        {fields.length > 0 && (
          <fieldset className={styles.params} data-count={fields.length}>
            <legend className={styles.eyebrow}>
              {joint.type === 'mortaja'
                ? t('Medidas de la espiga ({units})', { units: units === 'cm' ? 'cm' : t('pulgadas') })
                : t('Medidas del encastre ({units})', { units: units === 'cm' ? 'cm' : t('pulgadas') })}
            </legend>
            {fields}
          </fieldset>
        )}
        <p className={styles.tip}>
          <IconInfo />
          <span>{ruleHint(joint, a, b, n)}</span>
        </p>

        <div className={styles.changes}>
          <span className={styles.eyebrow}>{t('Qué cambia en los cortes')}</span>
          {cutChanges(joint, a, b, project, n).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        {group.joints.length > 1 && (
          <label className={styles.check}>
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
            {t('Aplicar a las {n} uniones de {group}', { n: group.joints.length, group: group.label.toLocaleLowerCase(locale()) })}
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
        <h1 className={styles.h1}>{t('Todavía no hay uniones')}</h1>
        <p className={styles.muted}>{t('En el modelo, acercá dos piezas hasta que se toquen y la app te propone un encastre.')}</p>
        <a className={styles.primary} href={sectionHref(project.id, 'modelo')}>
          {t('Ir al modelo')}
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

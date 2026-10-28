import { useEffect, useId, useState } from 'react';
import { produce, type Draft } from 'immer';
import {
  applyJointFix,
  applyReviewFix,
  BISCUITS,
  boxSize,
  canSwap,
  defaultJointParams,
  endJoint,
  fitJointDepths,
  formatNumber,
  groupJoints,
  jointChoices,
  jointContact,
  jointGrowth,
  jointName,
  jointNotes,
  jointOptions,
  isThrough,
  locale,
  nearMisses,
  overlapBox,
  recommendedJoint,
  partBox,
  partWord,
  styleDefaults,
  swapJoint,
  t,
  TENON_STYLES,
  tenonStyle,
  tk,
  type Joint,
  type JointGroup,
  type JointType,
  type NearMiss,
  type TenonStyle,
  type Part,
  type Project,
} from '@kitc/core';
import { JointMeta } from '../help/Help';
import { Accordion } from '../ui/Accordion';
import { InfoTip } from '../ui/InfoTip';
import { JOINT_ABOUT, JOINT_DRAWING } from '../help/terms';
import { sectionHref } from '../routes';
import { IconBack, IconInfo, IconWarn } from './icons';
import { JointDetail3D } from './JointDetail3D';
import { JointLocator } from './JointLocator';
import { describeJoint, LengthField } from './PartPanel';
import { useEditor } from './store';
import type { ExactMesh } from './useGeometry';
import styles from './Sections.module.css';

/** Nombre del encastre entre dos piezas: a tope entre piezas que se cruzan es apoyar en una muesca. */
const nameOf = (type: JointType, x?: Part, y?: Part) => t(jointName(type, !!x && !!y && !!overlapBox(partBox(x), partBox(y))));


const SLOPES = [6, 8];

/** Cómo se llama cada forma de trabar la caja y espiga en el panel. */
const STYLE_NAMES: Record<TenonStyle, string> = {
  ciega: tk('Ciega'),
  pasante: tk('Pasante'),
  cunas: tk('Pasante con cuñas'),
  'ciega-cunas': tk('Ciega con cuñas'),
  tarugada: tk('Tarugada'),
  llave: tk('Pasante con llave'),
};

/** Qué es cada una, en una línea, debajo de las medidas. */
const STYLE_ABOUT: Record<TenonStyle, string> = {
  ciega: tk('El largo llega hasta {max}, el espesor de {id}: con ese largo la espiga es pasante.'),
  pasante: tk('La espiga atraviesa {id} ({max}) y se ve del otro lado.'),
  cunas: tk('La espiga atraviesa {id} ({max}); dos cuñas en cortes de sierra la abren contra la mortaja y la traban.'),
  'ciega-cunas': tk('Las cuñas van en la espiga antes de entrarla: al apretar, chocan con el fondo y la abren. No se desarma.'),
  tarugada: tk('Un tarugo cruza {id} y la espiga. El agujero de la espiga va corrido hacia el hombro: al meter el tarugo, cierra la unión.'),
  llave: tk('La espiga atraviesa {id} y asoma; una llave de madera la traba del otro lado. Se puede desarmar.'),
};

const PIN_SIZES = [6, 8, 10, 12];

const DOWEL_SIZES = [6, 8, 10, 12];
const SHOWN = 4;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const minDim = (p: Part) => {
  const b = partBox(p);
  return Math.min(...b.max.map((v, i) => v - b.min[i]!));
};

/** "Pata trasera izquierda con faldón trasero": las dos piezas por su nombre, para no tener que abrir la unión. */
function pairNames(parts: readonly Part[], j: Joint): string {
  const a = parts.find((p) => p.id === j.partA)?.name ?? j.partA;
  const b = parts.find((p) => p.id === j.partB)?.name ?? j.partB;
  return t('{a} con {b}', { a, b: b.toLocaleLowerCase(locale()) });
}

/** Piezas a las que les faltan unos milímetros para tocarse: sin unión, con el botón que las junta. */
function NearMisses({ misses, parts, onFix }: { misses: NearMiss[]; parts: readonly Part[]; onFix: (m: NearMiss) => void }) {
  if (!misses.length) return null;
  const nameOf = (id: string) => parts.find((p) => p.id === id)?.name ?? id;
  return (
    <section className={styles.near} aria-labelledby="casi-titulo">
      <h2 id="casi-titulo" className={styles.eyebrow}>
        {t('Casi se tocan')}
      </h2>
      <p className={styles.note}>{t('A estas piezas les faltan unos milímetros para tocarse, así que no tienen unión.')}</p>
      <ul className={styles.nearList}>
        {misses.map((m) => (
          <li key={`${m.a}-${m.b}`}>
            <span className={styles.pair}>
              <span className={styles.pairCodes}>
                {m.b} ↔ {m.a}
              </span>
              <span className={styles.pairNames}>{t('{a} con {b}', { a: nameOf(m.b), b: nameOf(m.a).toLocaleLowerCase(locale()) })}</span>
            </span>
            <button type="button" className={styles.fixBtn} onClick={() => onFix(m)}>
              {m.fix.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function JointList({
  groups,
  parts,
  current,
  warned,
  onPick,
  misses,
  onFixMiss,
}: {
  groups: JointGroup[];
  parts: readonly Part[];
  current: Joint;
  /** Uniones con un aviso de taller: cortes que chocan, espigas muy angostas. */
  warned: ReadonlySet<string>;
  onPick: (j: Joint) => void;
  misses: NearMiss[];
  onFixMiss: (m: NearMiss) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [more, setMore] = useState<Record<string, boolean>>({});
  return (
    <aside className={styles.jointList} aria-labelledby="uniones-titulo">
      <h1 id="uniones-titulo" className={styles.h1}>
        {t('Uniones del mueble')}
      </h1>
      <p className={styles.muted}>{t('La app encuentra dónde se tocan las piezas. En cada unión ves los encastres que van y, en “Cambiar”, por qué no van los otros.')}</p>
      <NearMisses misses={misses} parts={parts} onFix={onFixMiss} />
      <div className={styles.groups}>
        {groups.map((g) => {
          const at = g.joints.findIndex((j) => j.id === current.id);
          const all = more[g.key] || g.joints.length <= SHOWN + 1 || at >= SHOWN;
          const shown = all ? g.joints : g.joints.slice(0, SHOWN);
          const warns = g.joints.some((j) => warned.has(j.id));
          return (
            <Accordion
              key={g.key}
              variant="line"
              level={2}
              title={g.label}
              summary={[...new Set(g.joints.map((j) => nameOf(j.type, parts.find((x) => x.id === j.partA), parts.find((x) => x.id === j.partB))))].join(' · ')}
              meta={
                <span className={styles.groupMeta}>
                  {warns && (
                    <span className={styles.rowWarn} role="img" aria-label={t('Tiene un aviso')}>
                      <IconWarn />
                    </span>
                  )}
                  {g.joints.length}
                </span>
              }
              // El grupo de la unión elegida arranca abierto; los demás, plegados.
              open={open[g.key] ?? at >= 0}
              onToggle={(on) => setOpen({ ...open, [g.key]: on })}
            >
              <ul className={styles.jointItems} aria-label={t('{group}, {n} uniones', { group: g.label, n: g.joints.length })}>
                {shown.map((j) => (
                  <li key={j.id}>
                    <button type="button" aria-current={j.id === current.id ? 'true' : undefined} onClick={() => onPick(j)}>
                      <span className={styles.thumb} data-plain={j.type === 'tope' || undefined} aria-hidden="true">
                        {JOINT_DRAWING[j.type]}
                      </span>
                      <span className={styles.pair}>
                        <span className={styles.pairTop}>
                          <span className={styles.pairCodes}>
                            {j.partA} ↔ {j.partB}
                          </span>
                          {warned.has(j.id) && (
                            <span className={styles.rowWarn} role="img" aria-label={t('Tiene un aviso')}>
                              <IconWarn />
                            </span>
                          )}
                          <span className={styles.typeName}>{nameOf(j.type, parts.find((x) => x.id === j.partA), parts.find((x) => x.id === j.partB))}</span>
                        </span>
                        <span className={styles.pairNames}>{pairNames(parts, j)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!all && (
                <button type="button" className={styles.more} onClick={() => setMore({ ...more, [g.key]: true })}>
                  {t('Ver {n} más', { n: g.joints.length - SHOWN })}
                </button>
              )}
            </Accordion>
          );
        })}
      </div>
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
  /** Se llegó desde un aviso de la revisión: qué medida marcar y qué dice el aviso. */
  hint?: { field: string; text: string } | null;
}

/** Separar las piezas vale para todas las uniones mientras la app está abierta. */
let apartOn = false;

function JointDetail({ project, joint, group, meshes, applyAll, setApplyAll, onBack, hint }: DetailProps) {
  const commit = useEditor((s) => s.commit);
  const typeName = useId();
  const typeListId = useId();
  // La lista de tipos se abre a pedido: lo que más se toca son las medidas.
  const [choosing, setChoosing] = useState(false);
  // Un cambio que va a todo el grupo espera confirmación, con lo que cambia en los cortes a la vista.
  const [pendingAll, setPendingAll] = useState<{ title: string; recipe: (d: Draft<Project>) => void; single?: boolean } | null>(null);
  // Mientras se escribe una medida, el detalle 3D ya muestra cómo queda (solo esta unión).
  const [draft, setDraft] = useState<Project | null>(null);
  const [apart, setApartState] = useState(apartOn);
  const setApart = (on: boolean) => {
    apartOn = on;
    setApartState(on);
  };
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  if (!a || !b) return null;
  const units = project.units;
  const unit = units === 'cm' ? ' cm' : '″';
  const n = (mm: number) => `${formatNumber(mm, units)}${unit}`;
  const ba = partBox(a);
  const bb = partBox(b);
  // Todos los encastres: los que van, y los que no con el motivo y el arreglo.
  const choices = jointChoices(a, b, n);
  const options = choices.filter((c) => c.ok).map((c) => c.type);
  if (!options.includes(joint.type)) options.unshift(joint.type);
  const off = choices.filter((c) => !c.ok && c.type !== joint.type);
  const crossing = !!overlapBox(ba, bb);
  const style = tenonStyle(joint.params);
  const through = joint.type === 'mortaja' && isThrough(style);
  // Hasta dónde puede entrar una espiga, unas colas o un tarugo: el espesor de la pieza que recibe.
  const contact = endJoint(ba, bb);
  const reachA = contact ? boxSize(ba)[contact.axis] : undefined;
  const reachB = contact ? boxSize(bb)[contact.axis] : undefined;
  // El recomendado va primero, con su marca.
  const recommended = recommendedJoint(ba, bb);
  if (recommended) options.sort((x, y) => Number(y === recommended) - Number(x === recommended));
  // Con un cambio esperando, los campos y lo que cambia en los cortes muestran cómo quedaría.
  const preview = pendingAll ? produce(project, pendingAll.recipe) : null;
  const shown = preview?.joints.find((j) => j.id === joint.id) ?? joint;
  const given = { ...defaultJointParams(joint.type, ba, bb), ...(shown.type === joint.type ? shown.params : joint.params) };
  // En la caja y espiga, lo de cada forma de trabarla arranca con las medidas de taller (y sin media caja).
  const params: Record<string, number> = joint.type === 'mortaja' ? { ...styleDefaults({ length: given.length ?? 0, thickness: given.thickness ?? 0 }), haunch: 0, style: 0, ...given } : given;
  const targets = applyAll ? group.joints : [joint];
  // Con un arreglo esperando, las piezas pueden haber cambiado de papel: se muestran como quedan.
  const shownA = preview?.parts.find((p) => p.id === shown.partA) ?? a;
  const shownB = preview?.parts.find((p) => p.id === shown.partB) ?? b;
  const warning = meshes.get(a.id)?.warning ?? meshes.get(b.id)?.warning;

  // Con varias uniones, primero la vista previa; con una sola, directo.
  const change = (title: string, recipe: (d: Draft<Project>) => void) => {
    if (targets.length > 1) setPendingAll({ title, recipe });
    else commit(recipe);
  };
  const setType = (type: JointType) =>
    change(t('Pasar a {joint}', { joint: nameOf(type, a, b).toLocaleLowerCase(locale()) }), (d) => {
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
      // Con las medidas de siempre, la espiga nueva puede cruzarse adentro de la pieza con otra: se acorta sola.
      fitJointDepths(d, new Set(targets.map((x) => x.id)));
    });
  const setParam = (key: string, value: number, label: string, shownValue?: string) =>
    change(t('{field}: {value}', { field: label, value: shownValue ?? (key === 'count' || key === 'slope' || key === 'size' || key === 'diameter' ? String(value) : n(value)) }), (d) => {
      for (const target of targets) {
        const j = d.joints.find((x) => x.id === target.id);
        if (j && j.type === joint.type) j.params[key] = value;
      }
      // Una pasante atraviesa la pieza: la espiga ciega que se cruce con ella se acorta sola.
      if (key === 'style') fitJointDepths(d, new Set(targets.map((x) => x.id)));
    });

  const length = (key: string, label: string, min = 1, max?: number) => (
    <LengthField
      key={`${joint.id}-${key}`}
      label={label}
      mm={params[key] ?? 0}
      units={units}
      min={min}
      max={max}
      highlight={hint?.field === key}
      onCommit={(v) => setParam(key, v, label)}
      onDraft={(v) =>
        setDraft(
          v === null
            ? null
            : produce(project, (d) => {
                const j = d.joints.find((x) => x.id === joint.id);
                if (j) j.params[key] = v;
              }),
        )
      }
    />
  );
  const choose = (key: string, label: string, values: number[], text: (v: number) => string = String, wide = false) => (
    <label key={key} className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      {label}
      <select value={params[key] ?? values[0]} onChange={(e) => setParam(key, Number(e.target.value), label, text(Number(e.target.value)))}>
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
    'cola-milano': [choose('count', t('Colas'), upTo(8)), choose('slope', t('Pendiente'), SLOPES, (v) => `1:${v}`), length('depth', t('Largo'), 3, reachA)],
    dedos: [choose('count', t('Dedos'), upTo(12)), length('depth', t('Largo'), 3, reachA)],
    brida: [length('thickness', t('Lengüeta'), 3), length('depth', t('Largo'), 5, reachA)],
    galleta: [choose('size', t('Galleta'), BISCUITS.map(([size]) => size), (v) => t('Nº {size}', { size: v })), choose('count', t('Cantidad'), upTo(6))],
    machiembrado: [length('thickness', t('Espesor'), 2), length('depth', t('Largo'), 3, reachA)],
    bolsillo: [choose('count', t('Tornillos'), upTo(6))],
  };
  const fields: React.ReactNode[] =
    fineFields[joint.type] ??
    (joint.type === 'mortaja'
      ? [
          // Cómo se traba: la de siempre (ciega), pasante, con cuñas, tarugada o con llave.
          choose('style', t('Cómo se traba'), TENON_STYLES.map((_, i) => i), (v) => t(STYLE_NAMES[TENON_STYLES[v] ?? 'ciega']), true),
          // Una pasante atraviesa la pieza: el largo es el de la pieza.
          ...(through ? [] : [length('length', t('Largo'), 5, reachA)]),
          length('thickness', t('Espesor'), 3),
          length('shoulder', t('Hombro'), 0),
          // Doble: dos espigas lado a lado con madera en el medio, para piezas anchas.
          choose('count', t('Espigas'), [1, 2], (v) => (v === 1 ? t('Una') : t('Doble'))),
          ...((params.count ?? 1) > 1 ? [length('gap', t('Entre espigas'), 3)] : []),
          ...(style === 'tarugada'
            ? [choose('pin', t('Tarugo'), PIN_SIZES, (v) => `${v} mm`), length('offset', t('Corrido'), 0.5, 3)]
            : style === 'llave'
              ? [length('protrude', t('Asoma'), 20), length('key', t('Llave'), 6)]
              : []),
          <label key="haunch-on" className={styles.field}>
            {t('Media caja')}
            <select
              value={(params.haunch ?? 0) > 0 ? 1 : 0}
              onChange={(e) => {
                const on = e.target.value === '1';
                setParam('haunch', on ? styleDefaults({ length: params.length ?? 0, thickness: params.thickness ?? 0 }).haunch : 0, t('Media caja'), on ? t('Sí') : t('No'));
              }}
            >
              <option value={0}>{t('No')}</option>
              <option value={1}>{t('Sí')}</option>
            </select>
          </label>,
          ...((params.haunch ?? 0) > 0 ? [length('haunch', t('Hondo de la media caja'), 3, params.length)] : []),
        ]
      : joint.type === 'canal' || joint.type === 'rebaje'
        ? [length('depth', t('Profundidad'))]
        : joint.type === 'clavija'
          ? [
              <label key="d" className={styles.field}>
                {t('Diámetro')}
                <select value={params.diameter ?? 8} onChange={(e) => setParam('diameter', Number(e.target.value), t('Diámetro'))}>
                  {DOWEL_SIZES.map((d) => (
                    <option key={d} value={d}>
                      {d} mm
                    </option>
                  ))}
                </select>
              </label>,
              <label key="c" className={styles.field}>
                {t('Cantidad')}
                <select value={params.count ?? 2} onChange={(e) => setParam('count', Number(e.target.value), t('Cantidad'))}>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>,
              length('depthA', t('Hondo en {id}', { id: a.id }), 5, reachA),
              length('depthB', t('Hondo en {id}', { id: b.id }), 5, reachB),
            ]
          : []);
  if (joint.type === 'mortaja' && reachA)
    fields.push(
      <p key="reach" className={`${styles.note} ${styles.fieldNote}`}>
        {t(STYLE_ABOUT[style], { max: n(reachA), id: a.id })}
      </p>,
    );
  const notes = jointNotes(project, joint, n);
  const fix = (c: (typeof off)[number]) => {
    if (!c.fix) return;
    const action = c.fix;
    setChoosing(false);
    setPendingAll({
      title: t('{fix} y pasar a {joint}', { fix: action.label, joint: nameOf(c.type).toLocaleLowerCase(locale()) }),
      recipe: (d) => applyJointFix(d, joint.id, c.type, action),
      single: true,
    });
  };
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
          <div className={styles.titleRow}>
            <h2 id="detalle" className={styles.h2}>
              {nameOf(joint.type, a, b)}
              {joint.type === 'mortaja' && style !== 'ciega' && <span className={styles.styleName}> · {t(STYLE_NAMES[style]).toLocaleLowerCase(locale())}</span>}
            </h2>
            {canSwap(a, b) && (
              <button
                type="button"
                className={styles.swapBtn}
                title={crossing ? t('Cambia cuál de las dos piezas queda arriba en el cruce') : t('Cambia cuál de las dos piezas lleva la caja, el rebaje o los huecos')}
                onClick={() => commit((d) => swapJoint(d, joint.id), crossing ? t('Cruce dado vuelta') : t('Ahora recibe {id}', { id: b.id }))}
              >
                <span aria-hidden="true">⇄</span>
                {crossing ? t('Dar vuelta el cruce') : t('Que reciba {id}', { id: b.id })}
              </button>
            )}
          </div>
        </div>
        {/* Los avisos arriba, antes del detalle: abajo quedaban fuera de la pantalla. */}
        {warning && (
          <p className={styles.warn} role="alert">
            <IconWarn />
            {t('El encastre no se pudo cortar del todo en el modelo. Revisá las medidas.')}
          </p>
        )}
        {notes
          .filter((note) => note.level === 'warn')
          .map((note) => (
            <p key={note.text} className={styles.warn} role="alert">
              <IconWarn />
              <span>{note.text}</span>
            </p>
          ))}
        <figure className={styles.detailFigure}>
          <JointDetail3D
            project={project}
            joint={joint}
            meshes={meshes}
            draft={draft ?? preview}
            apart={apart}
            label={t('Detalle en rayos X: {b} entra en {a} con {joint}', {
              b: `${b.id} ${b.name}`,
              a: `${a.id} ${a.name}`,
              joint: nameOf(joint.type, a, b).toLocaleLowerCase(locale()),
            })}
          />
          <span className={styles.legend} style={{ top: 12 }}>
            <span className={styles.swatchSolid} aria-hidden="true" />
            {legendB}
          </span>
          <span className={styles.legend} style={{ top: 44 }}>
            <span className={apart ? styles.swatchWood : styles.swatchXray} aria-hidden="true" />
            {apart ? partWord(a) : t('{part} en rayos X', { part: partWord(a) })}
          </span>
          <button type="button" className={styles.apartBtn} aria-pressed={apart} title={t('Separa las dos piezas para ver la espiga afuera y la caja vacía')} onClick={() => setApart(!apart)}>
            {apart ? t('Juntar') : t('Separar piezas')}
          </button>
          <JointLocator project={project} joint={joint} meshes={meshes} />
          <figcaption>{t('Arrastrá para girar el detalle')}</figcaption>
        </figure>
        <JointMeta type={joint.type} recommended={joint.type === recommended} />
        <p className={styles.muted}>{t(JOINT_ABOUT[joint.type] ?? 'Este encastre todavía no tiene cortes en el modelo.')}</p>
        {notes
          .filter((note) => note.level !== 'warn')
          .map((note) => (
            <p key={note.text} className={`${styles.tip} ${styles.flat}`}>
              <IconInfo />
              <span>{note.text}</span>
            </p>
          ))}
      </div>

      <div className={styles.detailSide}>
        {fields.length > 0 && (
          <fieldset className={styles.params} data-count={fields.length}>
            <legend className={styles.eyebrow}>
              {joint.type === 'mortaja'
                ? t('Medidas de la espiga ({units})', { units: units === 'cm' ? 'cm' : t('pulgadas') })
                : t('Medidas del encastre ({units})', { units: units === 'cm' ? 'cm' : t('pulgadas') })}
            </legend>
            {hint && (
              <p className={styles.reviewHint}>
                <IconWarn />
                <span>{hint.text}</span>
              </p>
            )}
            {fields}
          </fieldset>
        )}
        {pendingAll && preview && (
          <div className={styles.pendingAll} role="group" aria-labelledby={`${joint.id}-pend`}>
            <span className={styles.eyebrow} id={`${joint.id}-pend`}>
              {pendingAll.single ? t('Vista previa') : t('Vista previa · {n} uniones de {group}', { n: targets.length, group: group.label.toLocaleLowerCase(locale()) })}
            </span>
            <strong>{pendingAll.title}</strong>
            {cutChanges(shown, shownA, shownB, preview, n).map((line) => (
              <span key={line} className={styles.pendingLine}>
                {line}
              </span>
            ))}
            <div className={styles.pendingActions}>
              <button type="button" className={styles.pendingCancel} onClick={() => setPendingAll(null)}>
                {t('Cancelar')}
              </button>
              <button
                type="button"
                className={styles.pendingOk}
                onClick={() => {
                  commit(pendingAll.recipe);
                  setPendingAll(null);
                }}
              >
                {pendingAll.single ? t('Aplicar') : t('Aplicar a las {n}', { n: targets.length })}
              </button>
            </div>
          </div>
        )}
        <p className={styles.tip}>
          <IconInfo />
          <span>{ruleHint(joint, a, b, n)}</span>
        </p>
        {/* En el celular, el aviso queda lejos de las medidas: se repite al lado de lo que se acaba de cambiar. */}
        {notes
          .filter((note) => note.level === 'warn')
          .map((note) => (
            <p key={note.text} className={`${styles.warn} ${styles.mobileOnly}`}>
              <IconWarn />
              <span>{note.text}</span>
            </p>
          ))}

        <div className={styles.typeBlock}>
          <div className={styles.typeRow}>
            <span className={styles.typeCurrent}>
              <span className={styles.eyebrow}>{t('Tipo de encastre')}</span>
              <strong>{nameOf(joint.type, a, b)}</strong>
            </span>
            <button type="button" className={styles.changeBtn} aria-expanded={choosing} aria-controls={typeListId} onClick={() => setChoosing(!choosing)}>
              {choosing ? t('Listo') : t('Cambiar')}
            </button>
          </div>
          <fieldset id={typeListId} className={styles.typeGrid} hidden={!choosing}>
            <legend className={styles.srOnly}>{t('Tipo de encastre')}</legend>
            {options.map((type) => (
              <label key={type} className={styles.radio}>
                <input
                  type="radio"
                  name={typeName}
                  checked={joint.type === type}
                  onChange={() => {
                    setType(type);
                    setChoosing(false);
                  }}
                />
                <span className={styles.radioText}>
                  <span className={styles.radioName}>{nameOf(type, a, b)}</span>
                  <JointMeta type={type} recommended={type === recommended} short />
                </span>
                <InfoTip label={nameOf(type, a, b)} align="end" side="top" wide card>
                  <span className={styles.tipDrawing}>{JOINT_DRAWING[type]}</span>
                  <strong className={styles.tipTitle}>{nameOf(type, a, b)}</strong>
                  <JointMeta type={type} />
                  {JOINT_ABOUT[type] && <span className={styles.tipText}>{t(JOINT_ABOUT[type])}</span>}
                </InfoTip>
              </label>
            ))}
          </fieldset>
          {off.length > 0 && (
            <div className={styles.offBlock} hidden={!choosing}>
              <span className={styles.eyebrow}>{t('No van acá, y por qué')}</span>
              <ul className={styles.offList}>
                {off.map((c) => (
                  <li key={c.type} className={styles.offItem}>
                    <span className={styles.offName}>{nameOf(c.type, a, b)}</span>
                    <span className={styles.offWhy}>{c.reason}</span>
                    {c.fix && (
                      <button type="button" className={styles.fixBtn} onClick={() => fix(c)}>
                        {c.fix.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

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
  // Si se llegó desde una pieza en el Modelo, se abre esa unión.
  const [selectedId, setSelectedId] = useState<string | null>(() => useEditor.getState().jointFocus);
  const [detailOpen, setDetailOpen] = useState(() => !!useEditor.getState().jointFocus);
  // Si se llegó desde un aviso, la medida a cambiar queda marcada en esa unión.
  const [hint] = useState(() => {
    const { jointFocus, jointHint } = useEditor.getState();
    return jointFocus && jointHint ? { joint: jointFocus, ...jointHint } : null;
  });
  useEffect(() => useEditor.getState().setJointFocus(null), []);
  const [applyAll, setApplyAll] = useState(true);
  const groups = groupJoints(project);
  const joint = project.joints.find((j) => j.id === selectedId) ?? groups[0]?.joints[0];
  const group = joint && groups.find((g) => g.joints.some((j) => j.id === joint.id));

  const units = project.units;
  const fmt = (mm: number) => `${formatNumber(mm, units)}${units === 'cm' ? ' cm' : '″'}`;
  const misses = nearMisses(project, fmt);
  // Al juntar dos piezas aparece su unión: se abre.
  const fixMiss = (m: NearMiss) => {
    useEditor.getState().commit((d) => applyReviewFix(d, m.fix), m.fix.label);
    const made = useEditor.getState().project?.joints.find((j) => [j.partA, j.partB].sort().join('|') === [m.a, m.b].sort().join('|'));
    if (made) {
      setSelectedId(made.id);
      setDetailOpen(true);
    }
  };
  if (!joint || !group) {
    return (
      <main className={styles.empty}>
        <h1 className={styles.h1}>{t('Todavía no hay uniones')}</h1>
        <p className={styles.muted}>{t('En el modelo, acercá dos piezas hasta que se toquen y la app te propone un encastre.')}</p>
        <NearMisses misses={misses} parts={project.parts} onFix={fixMiss} />
        <a className={styles.primary} href={sectionHref(project.id, 'modelo')}>
          {t('Ir al modelo')}
        </a>
      </main>
    );
  }
  const warned = new Set(project.joints.filter((j) => jointNotes(project, j, String).some((x) => x.level === 'warn')).map((j) => j.id));
  return (
    <main className={styles.joints} data-detail={detailOpen || undefined}>
      <JointList
        groups={groups}
        parts={project.parts}
        current={joint}
        warned={warned}
        misses={misses}
        onFixMiss={fixMiss}
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
          hint={hint?.joint === joint.id ? hint : null}
        />
      </section>
    </main>
  );
}

import { useMemo, useState } from 'react';
import {
  buildTemplate,
  JOINT_NAMES,
  t,
  templateDefaults,
  templateWarnings,
  WOODS,
  type JointType,
  type Project,
  type TemplateDef,
  type TemplateField,
  type Units,
} from '@kitc/core';
import { LengthField } from '../editor/PartPanel';
import { IconWarn } from '../editor/icons';
import { JointExplainer } from '../help/Help';
import { navigate, sectionHref } from '../routes';
import { saveProject } from '../storage/db';
import { clearDraft, peekDraft } from './draft';
import { BackHeader, UnitsToggle } from './parts';
import { dimensionText, Preview3D } from './Preview3D';
import styles from './Nuevo.module.css';

/** El mueble en 3D. Con un campo elegido, marca qué mide y dice qué es. */
export function Preview({ project, field, units, compact }: { project: Project; field?: TemplateField; units: Units; compact?: boolean }) {
  const [label, setLabel] = useState<{ x: number; y: number } | null>(null);
  const text = field ? dimensionText(field, project, units) : '';
  return (
    <figure className={compact ? `${styles.preview} ${styles.compact}` : styles.preview} aria-label={t('El mueble en 3D, con la medida elegida marcada')}>
      <Preview3D project={project} field={field} onLabel={setLabel} />
      {field && label && text && (
        <span className={styles.dimLabel} style={{ left: label.x, top: label.y }} aria-hidden="true">
          {text}
        </span>
      )}
      <figcaption className={field ? styles.hintOn : undefined} aria-live="polite">
        {field ? (
          <>
            <span>
              <strong>{t(field.label)}</strong>
              {text ? ` · ${text}` : ''}
            </span>
            <span>{t(field.hint)}</span>
          </>
        ) : (
          <>
            <strong>{t('Tocá una medida para verla en el dibujo')}</strong>
            <span>
              {project.parts.length === 1 ? t('1 pieza') : t('{n} piezas', { n: project.parts.length })} ·{' '}
              {project.joints.length === 1 ? t('1 unión') : t('{n} uniones', { n: project.joints.length })}
            </span>
          </>
        )}
      </figcaption>
    </figure>
  );
}

interface FieldsProps {
  fields: TemplateField[];
  values: Record<string, number>;
  units: Units;
  warnings: Map<string, string>;
  onChange: (k: string, v: number) => void;
  /** Campo con el foco o con el mouse encima, para marcarlo en el dibujo. */
  onPoint: (k: string | null, how: 'focus' | 'hover') => void;
}

function Fields({ fields, values, units, warnings, onChange, onPoint }: FieldsProps) {
  return (
    <>
      {fields.map((f) => {
        const warn = warnings.get(f.key);
        const point = {
          onFocus: () => onPoint(f.key, 'focus'),
          onBlur: () => onPoint(null, 'focus'),
          onMouseEnter: () => onPoint(f.key, 'hover'),
          onMouseLeave: () => onPoint(null, 'hover'),
        };
        if (f.count) {
          const n: number[] = [];
          for (let i = f.min; i <= f.max; i++) n.push(i);
          return (
            <label key={f.key} className={styles.field} {...point}>
              {t(f.label)}
              <select aria-describedby={`ayuda-${f.key}`} value={values[f.key]} onChange={(e) => onChange(f.key, Number(e.target.value))}>
                {n.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              <span id={`ayuda-${f.key}`} className={styles.srOnly}>
                {t(f.hint)}
              </span>
            </label>
          );
        }
        return (
          <div key={f.key} className={warn ? styles.warnField : undefined} {...point}>
            <LengthField
              label={t(f.label)}
              mm={values[f.key]!}
              units={units}
              min={f.min}
              max={f.max}
              describedBy={[`ayuda-${f.key}`, warn ? `aviso-${f.key}` : ''].filter(Boolean).join(' ')}
              onCommit={(v) => onChange(f.key, v)}
            />
            <span id={`ayuda-${f.key}`} className={styles.srOnly}>
              {t(f.hint)}
            </span>
          </div>
        );
      })}
    </>
  );
}

function Warnings({ fields, warnings }: { fields: TemplateField[]; warnings: Map<string, string> }) {
  return (
    <>
      {fields
        .filter((f) => warnings.has(f.key))
        .map((f) => (
          <p key={f.key} id={`aviso-${f.key}`} className={styles.warn}>
            <IconWarn />
            <span>
              <strong>{t('Aviso:')}</strong> {t('{note}. Podés seguir igual.', { note: t(warnings.get(f.key)!) })}
            </span>
          </p>
        ))}
    </>
  );
}

export function TemplateForm({ def }: { def: TemplateDef }) {
  const [fromPhoto] = useState(() => peekDraft(def.id));
  const [values, setValues] = useState(() => ({ ...templateDefaults(def), ...fromPhoto?.values }));
  const [units, setUnits] = useState<Units>(fromPhoto?.units ?? 'cm');
  const [wood, setWood] = useState<string>(def.id === 'caja' ? 'cedro' : 'guatambu');
  const [joint, setJoint] = useState<JointType | undefined>(def.joints?.default);
  const [busy, setBusy] = useState(false);

  // Mismo armado que al crear, con una fecha fija para no rehacerlo en cada render.
  const preview = useMemo(() => buildTemplate(def, values, wood, joint, '2000-01-01T00:00:00.000Z'), [def, values, wood, joint]);
  const warnings = new Map(templateWarnings(def, values).map((w) => [w.key, w.note]));
  const general = def.fields.filter((f) => f.group === 'general');
  const pieces = def.fields.filter((f) => f.group === 'piezas');
  const change = (k: string, v: number) => setValues((s) => ({ ...s, [k]: v }));
  // El mouse encima manda sobre el foco, así se puede recorrer el formulario con la vista.
  const [pointed, setPointed] = useState<{ focus: string | null; hover: string | null }>({ focus: null, hover: null });
  const point = (k: string | null, how: 'focus' | 'hover') => setPointed((p) => ({ ...p, [how]: k }));
  const active = def.fields.find((f) => f.key === (pointed.hover ?? pointed.focus));

  const create = async () => {
    setBusy(true);
    const p = { ...buildTemplate(def, values, wood, joint), units };
    await saveProject(p);
    clearDraft();
    navigate(sectionHref(p.id, 'modelo'));
  };

  return (
    <div className={styles.screen}>
      <BackHeader overline={t('Plantilla')} title={t(def.name)} back="#/">
        <UnitsToggle units={units} onChange={setUnits} />
      </BackHeader>
      <div className={styles.layout}>
        <div className={styles.aside}>
          <Preview project={preview} field={active} units={units} />
          {fromPhoto && (
            <p className={styles.note}>
              {t('Las medidas que calcaste en la foto ya están cargadas. Revisalas y completá las que no se veían.')}
            </p>
          )}
        </div>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <fieldset className={styles.grid}>
            <legend className={styles.legend}>{t('Medidas generales')}</legend>
            <Fields fields={general} values={values} units={units} warnings={warnings} onChange={change} onPoint={point} />
          </fieldset>
          <Warnings fields={general} warnings={warnings} />
          <fieldset className={styles.grid}>
            <legend className={styles.legend}>{t('Piezas')}</legend>
            <Fields fields={pieces} values={values} units={units} warnings={warnings} onChange={change} onPoint={point} />
          </fieldset>
          <Warnings fields={pieces} warnings={warnings} />
          <label className={styles.field}>
            {t('Madera')}
            <select value={wood} onChange={(e) => setWood(e.target.value)}>
              {WOODS.map((w) => (
                <option key={w.id} value={w.id}>
                  {t(w.name)} · {t(w.hardness)}
                </option>
              ))}
            </select>
          </label>
          {def.joints && (
            <fieldset className={styles.plain}>
              <legend className={styles.label}>{t(def.joints.label)}</legend>
              <div className={styles.chips}>
                {def.joints.options.map((o) => (
                  <label key={o} className={styles.chip}>
                    <input type="radio" name="union" value={o} checked={joint === o} onChange={() => setJoint(o)} />
                    {t(JOINT_NAMES[o])}
                  </label>
                ))}
              </div>
              {joint && <JointExplainer type={joint} />}
            </fieldset>
          )}
          <div className={styles.footer}>
            <button type="submit" className={styles.primary} disabled={busy}>
              {busy ? t('Creando…') : t(def.createLabel)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

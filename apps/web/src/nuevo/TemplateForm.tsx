import { useMemo, useState } from 'react';
import {
  buildTemplate,
  drawView,
  JOINT_NAMES,
  t,
  templateDefaults,
  templateWarnings,
  WOODS,
  type Drawing,
  type JointType,
  type Project,
  type TemplateDef,
  type TemplateField,
  type Units,
} from '@kitc/core';
import { LengthField } from '../editor/PartPanel';
import { IconWarn } from '../editor/icons';
import { navigate, sectionHref } from '../routes';
import { saveProject } from '../storage/db';
import { clearDraft, peekDraft } from './draft';
import { BackHeader, UnitsToggle } from './parts';
import styles from './Nuevo.module.css';

/** Frente y costado del mueble, con las líneas que se ven. */
function Preview({ project }: { project: Project }) {
  const views: [Drawing, string][] = [
    [drawView(project, 'front'), t('Frente')],
    [drawView(project, 'side'), t('Costado')],
  ];
  const H = Math.max(...views.map(([d]) => d.bounds.v1 - d.bounds.v0));
  const gap = H * 0.25;
  const label = H * 0.2;
  let x = 0;
  const placed = views.map(([d, title]) => {
    const at = { d, title, x };
    x += d.bounds.u1 - d.bounds.u0 + gap;
    return at;
  });
  const W = x - gap;
  const pad = H * 0.04;
  return (
    <figure className={styles.preview}>
      <svg
        viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + label + 2 * pad}`}
        role="img"
        aria-label={t('Vista previa de frente y de costado, con las medidas actuales')}
      >
        {placed.map(({ d, title, x: ox }) => {
          const tx = (u: number) => ox + u - d.bounds.u0;
          const ty = (v: number) => H - (v - d.bounds.v0);
          return (
            <g key={title}>
              {d.lines
                .filter((l) => !l.hidden && !l.joint)
                .map((l, i) => (
                  <line key={i} x1={tx(l.a[0])} y1={ty(l.a[1])} x2={tx(l.b[0])} y2={ty(l.b[1])} vectorEffect="non-scaling-stroke" />
                ))}
              <text x={tx((d.bounds.u0 + d.bounds.u1) / 2)} y={H + label * 0.85} fontSize={label * 0.62} textAnchor="middle">
                {title}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        {project.parts.length === 1 ? t('1 pieza') : t('{n} piezas', { n: project.parts.length })} ·{' '}
        {project.joints.length === 1 ? t('1 unión') : t('{n} uniones', { n: project.joints.length })}
      </figcaption>
    </figure>
  );
}

function Fields({ fields, values, units, warnings, onChange }: { fields: TemplateField[]; values: Record<string, number>; units: Units; warnings: Map<string, string>; onChange: (k: string, v: number) => void }) {
  return (
    <>
      {fields.map((f) => {
        const warn = warnings.get(f.key);
        if (f.count) {
          const n: number[] = [];
          for (let i = f.min; i <= f.max; i++) n.push(i);
          return (
            <label key={f.key} className={styles.field}>
              {t(f.label)}
              <select value={values[f.key]} onChange={(e) => onChange(f.key, Number(e.target.value))}>
                {n.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        return (
          <div key={f.key} className={warn ? styles.warnField : undefined}>
            <LengthField label={t(f.label)} mm={values[f.key]!} units={units} min={f.min} max={f.max} describedBy={warn ? `aviso-${f.key}` : undefined} onCommit={(v) => onChange(f.key, v)} />
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
          <Preview project={preview} />
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
            <Fields fields={general} values={values} units={units} warnings={warnings} onChange={change} />
          </fieldset>
          <Warnings fields={general} warnings={warnings} />
          <fieldset className={styles.grid}>
            <legend className={styles.legend}>{t('Piezas')}</legend>
            <Fields fields={pieces} values={values} units={units} warnings={warnings} onChange={change} />
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
                    {o === 'clavija' ? t('Clavijas') : t(JOINT_NAMES[o])}
                  </label>
                ))}
              </div>
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

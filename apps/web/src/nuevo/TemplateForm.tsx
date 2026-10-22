import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  buildTemplate,
  formatNumber,
  furnitureBox,
  goldenChecks,
  JOINT_NAMES,
  t,
  templateDefaults,
  templateWarnings,
  nearestSheetThickness,
  sheetById,
  woodById,
  type GoldenFix,
  type JointType,
  type Project,
  type TemplateDef,
  type TemplateField,
  type Units,
} from '@kitc/core';
import { LengthField } from '../editor/PartPanel';
import { MaterialOptions, sheetNote } from '../editor/MaterialOptions';
import { goldenCount, GoldenList } from '../editor/Golden';
import { Accordion } from '../ui/Accordion';
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
        // Sin asiento no hay espesor de asiento que pedir.
        if (f.unlessKey && values[f.unlessKey.key] === f.unlessKey.value) return null;
        const warn = warnings.get(f.key);
        const point = {
          onFocus: () => onPoint(f.key, 'focus'),
          onBlur: () => onPoint(null, 'focus'),
          onMouseEnter: () => onPoint(f.key, 'hover'),
          onMouseLeave: () => onPoint(null, 'hover'),
        };
        if (f.choices) {
          return (
            <fieldset key={f.key} className={`${styles.plain} ${styles.wide}`} aria-describedby={`ayuda-${f.key}`} {...point}>
              <legend className={styles.label}>{t(f.label)}</legend>
              <div className={styles.chips}>
                {f.choices.map((label, i) => (
                  <label key={label} className={styles.chip}>
                    <input type="radio" name={f.key} value={i} checked={values[f.key] === i} onChange={() => onChange(f.key, i)} />
                    {t(label)}
                  </label>
                ))}
              </div>
              <span id={`ayuda-${f.key}`} className={styles.srOnly}>
                {t(f.hint)}
              </span>
            </fieldset>
          );
        }
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

/** Lo cargado en una sección, en una línea, para verlo con la sección cerrada: "Largo 180 · Fondo 90 · Alto 75". */
function fieldsSummary(fields: TemplateField[], values: Record<string, number>, units: Units): string {
  return fields
    .filter((f) => !f.unlessKey || values[f.unlessKey.key] !== f.unlessKey.value)
    .map((f) => {
      const v = values[f.key]!;
      const shown = f.choices ? t(f.choices[v] ?? '') : f.count ? String(v) : formatNumber(v, units);
      return `${t(f.label)} ${shown}`;
    })
    .join(' · ');
}

/** "Guatambú", "MDF": el nombre de la madera o la placa elegida. */
const woodLabel = (id: string) => {
  const name = woodById(id)?.name;
  return name ? t(name) : '';
};

type Step = 'general' | 'aurea' | 'piezas' | 'material';

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
  // Secciones abiertas y las que ya se tocaron: se tildan para mostrar el avance, pero se pueden seguir editando.
  const [open, setOpen] = useState<Set<Step>>(() => new Set<Step>(['general']));
  const [done, setDone] = useState<Set<Step>>(() => new Set<Step>());
  const mark = (step: Step) => setDone((d) => (d.has(step) ? d : new Set(d).add(step)));
  const toggle = (step: Step, on: boolean) =>
    setOpen((o) => {
      const next = new Set(o);
      if (on) next.add(step);
      else next.delete(step);
      return next;
    });
  const stepOf = (k: string): Step => (def.fields.find((f) => f.key === k)?.group === 'piezas' ? 'piezas' : 'general');
  const change = (k: string, v: number) => {
    setValues((s) => ({ ...s, [k]: v }));
    mark(stepOf(k));
  };
  // Proporción áurea de las medidas que se están pensando: el mueble armado, medido como en el editor.
  const golden = useMemo(() => goldenChecks({ ...preview, units }), [preview, units]);
  const fixGolden = (fix: GoldenFix) => {
    mark('aurea');
    if (fix.kind === 'drawers') return change('graded', 1);
    // El campo de ese eje sube o baja lo mismo que tiene que cambiar el mueble entero.
    const field = def.fields.find((f) => f.key === (['width', 'height', 'depth'] as const)[fix.axis]);
    const box = furnitureBox(preview.parts);
    if (!field || !box) return;
    const now = box.max[fix.axis] - box.min[fix.axis];
    change(field.key, Math.min(field.max, Math.max(field.min, Math.round((values[field.key]! + fix.mm - now) * 10) / 10)));
  };
  // Una placa viene en espesores fijos: el de las tablas pasa al más cercano.
  const pickWood = (id: string) => {
    setWood(id);
    mark('material');
    const sheet = sheetById(id);
    if (sheet && values.board !== undefined) change('board', nearestSheetThickness(sheet, values.board));
    setJoint(recommendedJoint(id));
  };
  // La melamina se arma con tarugos: la cara plástica no se encastra.
  const recommendedJoint = (id: string) => (sheetById(id)?.banding && def.joints?.options.includes('clavija') ? 'clavija' : def.joints?.default);
  const recommended = recommendedJoint(wood);
  // El mouse encima manda sobre el foco, así se puede recorrer el formulario con la vista.
  const [pointed, setPointed] = useState<{ focus: string | null; hover: string | null }>({ focus: null, hover: null });
  const point = (k: string | null, how: 'focus' | 'hover') => setPointed((p) => ({ ...p, [how]: k }));
  const active = def.fields.find((f) => f.key === (pointed.hover ?? pointed.focus));

  const creating = useRef(false);
  const create = async () => {
    if (creating.current) return;
    creating.current = true;
    setBusy(true);
    const p = { ...buildTemplate(def, values, wood, joint), units };
    await saveProject(p);
    clearDraft();
    navigate(sectionHref(p.id, 'modelo'));
  };

  // Al tocar Crear con una medida a medio escribir: el campo se guarda al perder el foco y la lista de proporciones
  // cambia de alto, así que el botón se corre antes de soltar y el toque se perdía. Se crea con las medidas ya guardadas.
  const [wantCreate, setWantCreate] = useState(false);
  const onWantCreate = useEffectEvent(() => void create());
  useEffect(() => {
    if (wantCreate) onWantCreate();
  }, [wantCreate]);

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
          <Accordion
            title={t('Medidas generales')}
            summary={fieldsSummary(general, values, units)}
            done={done.has('general')}
            open={open.has('general')}
            onToggle={(on) => toggle('general', on)}
          >
            <fieldset className={styles.grid}>
              <legend className={styles.srOnly}>{t('Medidas generales')}</legend>
              <Fields fields={general} values={values} units={units} warnings={warnings} onChange={change} onPoint={point} />
            </fieldset>
            <Warnings fields={general} warnings={warnings} />
          </Accordion>
          {golden.length > 0 && (
            <Accordion
              title={t('Proporción áurea')}
              summary={t('Guía para medidas equilibradas')}
              meta={goldenCount(golden)}
              done={done.has('aurea') || golden.every((c) => c.status === 'aurea')}
              open={open.has('aurea')}
              onToggle={(on) => toggle('aurea', on)}
            >
              <GoldenList checks={golden} onFix={fixGolden} heading={false} />
            </Accordion>
          )}
          {pieces.length > 0 && (
            <Accordion
              title={t('Piezas')}
              summary={fieldsSummary(pieces, values, units)}
              done={done.has('piezas')}
              open={open.has('piezas')}
              onToggle={(on) => toggle('piezas', on)}
            >
              <fieldset className={styles.grid}>
                <legend className={styles.srOnly}>{t('Piezas')}</legend>
                <Fields fields={pieces} values={values} units={units} warnings={warnings} onChange={change} onPoint={point} />
              </fieldset>
              <Warnings fields={pieces} warnings={warnings} />
            </Accordion>
          )}
          <Accordion
            title={def.joints ? t('Madera y uniones') : t('Madera')}
            summary={[woodLabel(wood), joint && t(JOINT_NAMES[joint])].filter(Boolean).join(' · ')}
            done={done.has('material')}
            open={open.has('material')}
            onToggle={(on) => toggle('material', on)}
          >
            <label className={styles.field}>
              {t('Madera')}
              <select value={wood} onChange={(e) => pickWood(e.target.value)}>
                <MaterialOptions sheets={!!def.sheets} />
              </select>
              {sheetNote(wood) && <span className={styles.note}>{sheetNote(wood)}</span>}
            </label>
            {def.joints && (
              <fieldset className={styles.plain}>
                <legend className={styles.label}>{t(def.joints.label)}</legend>
                <div className={styles.chips}>
                  {def.joints.options.map((o) => (
                    <label key={o} className={styles.chip}>
                      <input
                        type="radio"
                        name="union"
                        value={o}
                        checked={joint === o}
                        onChange={() => {
                          setJoint(o);
                          mark('material');
                        }}
                      />
                      {t(JOINT_NAMES[o])}
                      {o === recommended && <span className={styles.chipValue}>· {t('recomendado')}</span>}
                    </label>
                  ))}
                </div>
                {joint && <JointExplainer type={joint} recommended={joint === recommended} />}
              </fieldset>
            )}
          </Accordion>
          <div className={styles.footer}>
            <button
              type="submit"
              className={styles.primary}
              disabled={busy}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                (document.activeElement as HTMLElement | null)?.blur();
                setWantCreate(true);
              }}
            >
              {busy ? t('Creando…') : t(def.createLabel)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

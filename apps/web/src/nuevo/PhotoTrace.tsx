import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { buildTemplate, formatLength, t, templateById, tk, TEMPLATES, type TemplateDef, type Units } from '@kitc/core';
import { LengthField } from '../editor/PartPanel';
import { IconUndo } from '../editor/icons';
import { navigate, sectionHref } from '../routes';
import { saveProject } from '../storage/db';
import { clearDraft, setDraft } from './draft';
import { BackHeader, UnitsToggle } from './parts';
import styles from './Nuevo.module.css';

/** Punto en píxeles de la foto original. */
type Pt = [number, number];
type Seg = [Pt, Pt];

interface Photo {
  url: string;
  w: number;
  h: number;
}

const STEPS = [tk('Foto'), tk('Medida'), tk('Calcar piezas')] as const;
const dist = ([a, b]: Seg) => Math.hypot(b[0] - a[0], b[1] - a[1]);

const IconZoom = ({ out }: { out: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="6" />
    <path d={out ? 'm20 20-4-4M8 11h6' : 'm20 20-4-4M11 8v6M8 11h6'} />
  </svg>
);

/** Ancho y alto en pantalla para que la foto entre entera en el lugar disponible. */
function useFit(photo: Photo | null, zoom: boolean) {
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: el.clientWidth, h: Math.max(240, Math.min(window.innerHeight * 0.58, 640)) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [photo]);
  if (!photo || !avail.w) return { box, w: 0, h: 0 };
  const s = Math.min(avail.w / photo.w, avail.h / photo.h) * (zoom ? 2 : 1);
  return { box, w: Math.round(photo.w * s), h: Math.round(photo.h * s) };
}

/** La foto con los puntos y líneas marcados. Toca y devuelve el punto en píxeles de la foto. */
function Stage({
  photo,
  hint,
  segs,
  pending,
  onTap,
  onUndo,
  canUndo,
  description,
}: {
  photo: Photo;
  hint: string;
  segs: { seg: Seg; label: string; kind: 'ref' | 'trace' | 'current' }[];
  pending: Pt | null;
  onTap: (p: Pt) => void;
  onUndo: () => void;
  canUndo: boolean;
  description: string;
}) {
  const [zoom, setZoom] = useState(false);
  const { box, w, h } = useFit(photo, zoom);
  // Grosor y radio en píxeles de la foto, para que en pantalla se vean siempre igual.
  const k = w ? photo.w / w : 1;
  const tap = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onTap([((e.clientX - r.left) / r.width) * photo.w, ((e.clientY - r.top) / r.height) * photo.h]);
  };
  const dot = (p: Pt, kind: string, key: string) => <circle key={key} cx={p[0]} cy={p[1]} r={7 * k} strokeWidth={3 * k} className={styles[`dot_${kind}`]} />;
  return (
    <div className={styles.stageWrap}>
      <div ref={box} className={`${styles.stage} ${zoom ? styles.zoomed : ''}`}>
        {w > 0 && (
          <div className={styles.photoBox} style={{ width: w, height: h }}>
            <img src={photo.url} alt={t('Tu foto')} width={w} height={h} draggable={false} />
            <svg viewBox={`0 0 ${photo.w} ${photo.h}`} width={w} height={h} onClick={tap} role="img" aria-label={description}>
              {segs.map(({ seg, kind }, i) => (
                <g key={i} className={styles[`seg_${kind}`]}>
                  <line x1={seg[0][0]} y1={seg[0][1]} x2={seg[1][0]} y2={seg[1][1]} strokeWidth={7 * k} className={styles.halo} />
                  <line x1={seg[0][0]} y1={seg[0][1]} x2={seg[1][0]} y2={seg[1][1]} strokeWidth={3 * k} />
                  {dot(seg[0], kind, 'a')}
                  {dot(seg[1], kind, 'b')}
                </g>
              ))}
              {pending && dot(pending, 'pending', 'p')}
            </svg>
            {segs.map(({ seg, label, kind }, i) => (
              <span
                key={i}
                className={`${styles.segLabel} ${kind === 'ref' ? styles.segLabelRef : ''} ${Math.abs(seg[1][1] - seg[0][1]) > Math.abs(seg[1][0] - seg[0][0]) ? styles.segLabelSide : ''}`}
                style={{ left: `${((seg[0][0] + seg[1][0]) / 2 / photo.w) * 100}%`, top: `${((seg[0][1] + seg[1][1]) / 2 / photo.h) * 100}%` }}
                aria-hidden="true"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className={styles.stageHint}>{hint}</span>
      <div className={styles.stageTools}>
        <button type="button" aria-label={t('Deshacer el último punto')} onClick={onUndo} disabled={!canUndo}>
          <IconUndo />
        </button>
        <button type="button" aria-label={zoom ? t('Achicar la foto') : t('Ampliar la foto')} aria-pressed={zoom} onClick={() => setZoom(!zoom)}>
          <IconZoom out={zoom} />
        </button>
      </div>
    </div>
  );
}

function Steps({ step }: { step: number }) {
  return (
    <ol className={styles.steps} aria-label={t('Pasos')}>
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === step ? 'step' : undefined} className={i <= step ? styles.stepOn : undefined}>
          <span aria-hidden="true" />
          {i + 1} · {t(s)}
        </li>
      ))}
    </ol>
  );
}

export function PhotoTrace() {
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState('mesa');
  const def = templateById(templateId) as TemplateDef;
  const [units, setUnits] = useState<Units>('cm');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Paso 2: la medida conocida.
  const [ref, setRef] = useState<Pt[]>([]);
  const [refMm, setRefMm] = useState<number | null>(null);
  const [refField, setRefField] = useState<string>('');

  // Paso 3: una línea por medida de la plantilla.
  const fields = def.fields.filter((f) => !f.count);
  const [traces, setTraces] = useState<Record<string, Seg>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [pending, setPending] = useState<Pt | null>(null);

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const pick = (file: File) => {
    setPhotoError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPhoto({ url, w: img.naturalWidth, h: img.naturalHeight });
      setRef([]);
      setTraces({});
      setOrder([]);
      setStep(1);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setPhotoError(t('No pudimos abrir esa imagen. Probá con una foto JPG o PNG.'));
    };
    img.src = url;
  };

  const refSeg = ref.length === 2 ? (ref as Seg) : null;
  const mmPerPx = refSeg && refMm ? refMm / dist(refSeg) : null;
  const measured = (k: string) => (traces[k] && mmPerPx ? Math.round(dist(traces[k]) * mmPerPx) : null);
  const values = Object.fromEntries(fields.flatMap((f) => (measured(f.key) === null ? [] : [[f.key, measured(f.key)!]])));
  const outOfRange = fields.filter((f) => values[f.key] !== undefined && (values[f.key]! < f.min || values[f.key]! > f.max));
  const usable = Object.fromEntries(Object.entries(values).filter(([k]) => !outOfRange.some((f) => f.key === k)));

  const startTracing = () => {
    const next = { ...traces };
    if (refField && refSeg) next[refField] = refSeg;
    setTraces(next);
    setOrder(Object.keys(next));
    setCurrent(fields.find((f) => !next[f.key])?.key ?? fields[0]!.key);
    setPending(null);
    setStep(2);
  };

  const tapTrace = (p: Pt) => {
    if (!pending) return setPending(p);
    const next = { ...traces, [current]: [pending, p] as Seg };
    setTraces(next);
    setOrder((o) => [...o.filter((k) => k !== current), current]);
    setPending(null);
    const after = fields.find((f) => !next[f.key]);
    if (after) setCurrent(after.key);
  };

  const undoTrace = () => {
    if (pending) return setPending(null);
    const last = order[order.length - 1];
    if (!last) return;
    setTraces((tr) => Object.fromEntries(Object.entries(tr).filter(([k]) => k !== last)));
    setOrder(order.slice(0, -1));
    setCurrent(last);
  };

  const review = () => {
    setDraft({ template: def.id, values: usable, units });
    navigate(`#/nuevo/${def.id}`);
  };

  const build = async () => {
    const p = { ...buildTemplate(def, usable, def.id === 'caja' ? 'cedro' : 'guatambu', def.joints?.default), units };
    await saveProject(p);
    clearDraft();
    navigate(sectionHref(p.id, 'modelo'));
  };

  const fieldLabel = (k: string) => {
    const label = fields.find((f) => f.key === k)?.label;
    return label ? t(label) : '';
  };
  const refLabel = refMm ? formatLength(refMm, units) : t('Medida conocida');
  const traced = Object.keys(traces).length;

  return (
    <div className={styles.screen}>
      <BackHeader title={t('Nuevo desde foto')} back="#/">
        <UnitsToggle units={units} onChange={setUnits} />
      </BackHeader>
      <Steps step={step} />

      {step === 0 && (
        <div className={styles.body}>
          <section className={styles.block} aria-labelledby="que-mueble">
            <h2 id="que-mueble" className={styles.label}>
              {t('¿Qué mueble es?')}
            </h2>
            <div className={styles.chips} role="group" aria-labelledby="que-mueble">
              {TEMPLATES.map((tpl) => (
                <button key={tpl.id} type="button" className={styles.chip} aria-pressed={tpl.id === templateId} onClick={() => {
                    setTemplateId(tpl.id);
                    setRefField('');
                    setTraces({});
                    setOrder([]);
                  }}>
                  {t(tpl.name)}
                </button>
              ))}
            </div>
          </section>
          <button type="button" className={styles.drop} onClick={() => fileRef.current?.click()}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <strong>{t('Elegir o sacar una foto')}</strong>
            <span>{t('La foto queda en este dispositivo; no se sube a ningún lado.')}</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
              e.target.value = '';
            }}
          />
          {photoError && (
            <p className={styles.errorText} role="alert">
              {photoError}
            </p>
          )}
          <p className={styles.note}>{t('Sacala de frente y desde lo más lejos que puedas, con el mueble entero en la foto: así las medidas salen parejas.')}</p>
          {photo && (
            <button type="button" className={styles.secondary} onClick={() => setStep(1)}>
              {t('Seguir con la foto que elegiste')}
            </button>
          )}
        </div>
      )}

      {step === 1 && photo && (
        <>
          <Stage
            photo={photo}
            hint={ref.length < 2 ? t('Tocá los dos extremos de algo que sepas cuánto mide') : t('Escribí cuánto mide')}
            segs={refSeg ? [{ seg: refSeg, label: refLabel, kind: 'ref' }] : []}
            pending={ref.length === 1 ? ref[0]! : null}
            onTap={(p) => setRef(ref.length >= 2 ? [p] : [...ref, p])}
            onUndo={() => setRef(ref.slice(0, -1))}
            canUndo={ref.length > 0}
            description={refSeg ? t('Tu foto, con la medida conocida marcada') : t('Tu foto. Tocá dos puntos para marcar una medida conocida')}
          />
          <div className={styles.body}>
            <p className={styles.note}>
              {t('Puede ser el alto del mueble, el largo de la tapa o una cinta métrica apoyada al lado. Cuanto más larga, mejor sale el resto.')}
            </p>
            {refSeg && (
              <div className={styles.grid2}>
                <label className={styles.field}>
                  {t('¿Qué es?')}
                  <select value={refField} onChange={(e) => setRefField(e.target.value)}>
                    <option value="">{t('Otra cosa')}</option>
                    {fields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {t(f.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <LengthField label={t('¿Cuánto mide?')} mm={refMm ?? 0} units={units} min={10} onCommit={setRefMm} />
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setStep(0)}>
              {t('Cambiar foto')}
            </button>
            <button type="button" className={styles.primary} disabled={!mmPerPx} onClick={startTracing}>
              {t('Seguir')}
            </button>
          </div>
        </>
      )}

      {step === 2 && photo && (
        <>
          <Stage
            photo={photo}
            hint={pending ? t('Ahora tocá el otro extremo') : t('Tocá los dos extremos: {field}', { field: fieldLabel(current).toLowerCase() })}
            segs={[
              ...(refSeg && !Object.values(traces).includes(refSeg) ? [{ seg: refSeg, label: refLabel, kind: 'ref' as const }] : []),
              ...Object.entries(traces).map(([k, seg]) => ({ seg, label: `${fieldLabel(k)} ${formatLength(measured(k) ?? 0, units)}`, kind: k === current ? ('current' as const) : ('trace' as const) })),
            ]}
            pending={pending}
            onTap={tapTrace}
            onUndo={undoTrace}
            canUndo={!!pending || order.length > 0}
            description={traced === 1 ? t('Tu foto, con 1 medida calcada') : t('Tu foto, con {n} medidas calcadas', { n: traced })}
          />
          <section className={styles.body} aria-labelledby="calcando">
            <h2 id="calcando" className={styles.label}>
              {t('¿Qué estás calcando?')}
            </h2>
            <div className={styles.chips}>
              {fields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={styles.chip}
                  aria-pressed={f.key === current}
                  onClick={() => {
                    setCurrent(f.key);
                    setPending(null);
                  }}
                >
                  {t(f.label)}
                  {traces[f.key] && <span className={styles.chipValue}>{formatLength(measured(f.key) ?? 0, units)} ✓</span>}
                </button>
              ))}
            </div>
            {outOfRange.map((f) => (
              <p key={f.key} className={styles.errorText} role="alert">
                {t('{field} da {value}, fuera de lo que admite la plantilla ({min} a {max}). Volvé a calcarla.', {
                  field: t(f.label),
                  value: formatLength(values[f.key]!, units),
                  min: formatLength(f.min, units),
                  max: formatLength(f.max, units),
                })}
              </p>
            ))}
            <p className={styles.note}>
              {t('Lo que no se ve en la foto, como el fondo o las patas de atrás, se completa con medidas habituales. Lo revisás en el paso siguiente.')}
            </p>
          </section>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={review}>
              {t('Revisar medidas')}
            </button>
            <button type="button" className={`${styles.primary} ${styles.grow}`} onClick={() => void build()}>
              {t('Armar el modelo')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

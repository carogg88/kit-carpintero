import { useEffect, useId, useRef, useState } from 'react';
import * as THREE from 'three';
import { FINISHES, finishById, PAINT_COLORS, t, tk, type Finish, type Part, type Project } from '@kitc/core';
import { engineMeshes } from './useGeometry';
import { buildStudio, DEFAULT_PHOTO, setupRenderer, takePhoto } from './photo';
import { useEditor } from './store';
import styles from './Editor.module.css';
import photo from './Photo.module.css';
import own from './Finish.module.css';

/**
 * Elegir la terminación: la del mueble (en el panel del mueble) y la de cada pieza (en su panel), con los colores de
 * pintura a un toque. "Comparar" dibuja el mueble con cuatro terminaciones lado a lado, para elegir mirando.
 */

const GROUPS: [string, (id: string) => boolean][] = [
  [tk('Al natural'), (id) => id === 'natural' || id === 'aceite' || id === 'cera' || id === 'lustre'],
  [tk('Laca'), (id) => id.startsWith('laca')],
  [tk('Tinte y laca'), (id) => id.startsWith('tinte') || id === 'ebonizado'],
  [tk('Pintura'), (id) => id === 'pintura'],
];

function FinishOptions() {
  return (
    <>
      {GROUPS.map(([label, has]) => (
        <optgroup key={label} label={t(label)}>
          {FINISHES.filter((f) => has(f.id)).map((f) => (
            <option key={f.id} value={f.id}>
              {t(f.name)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/** Los colores de la pintura, como muestras para tocar. */
function PaintSwatches({ value, onPick }: { value?: string; onPick: (c: string) => void }) {
  return (
    <div className={own.swatches} role="group" aria-label={t('Color de la pintura')}>
      {PAINT_COLORS.map((c) => (
        <button key={c} type="button" aria-pressed={value === c} aria-label={c} title={c} style={{ background: c }} onClick={() => onPick(c)} />
      ))}
      <label className={own.custom} title={t('Otro color')}>
        <input type="color" value={value ?? PAINT_COLORS[0]} onChange={(e) => onPick(e.target.value)} aria-label={t('Otro color')} />
      </label>
    </div>
  );
}

const withColor = (id: string, color?: string): Finish => (id === 'pintura' ? { id, color: color ?? PAINT_COLORS[0] } : { id });

/** La terminación de todo el mueble, con lo que es y el botón para comparar. */
export function FinishCard({ project }: { project: Project }) {
  const commit = useEditor((s) => s.commit);
  const id = useId();
  const f = project.finish;
  const def = f && finishById(f.id);
  const own_ = project.parts.filter((p) => p.finish).length;
  const set = (next: Finish | undefined) =>
    commit((d) => {
      if (next) d.finish = next;
      else delete d.finish;
    }, next ? t('Terminación: {finish}', { finish: t(finishById(next.id)!.name) }) : t('Sacaste la terminación'));
  return (
    <div className={own.card}>
      <label className={styles.field} htmlFor={id}>
        {t('Terminación del mueble')}
        <select id={id} value={f?.id ?? ''} onChange={(e) => set(e.target.value ? withColor(e.target.value, f?.color) : undefined)}>
          <option value="">{t('Sin elegir')}</option>
          <FinishOptions />
        </select>
      </label>
      {f?.id === 'pintura' && <PaintSwatches value={f.color} onPick={(color) => set({ id: 'pintura', color })} />}
      {def && <p className={styles.fieldNote}>{t(def.about)}</p>}
      {own_ > 0 && <p className={styles.fieldNote}>{own_ === 1 ? t('1 pieza tiene la suya.') : t('{n} piezas tienen la suya.', { n: own_ })}</p>}
      <CompareButton project={project} onPick={set} />
      <p className={styles.fieldNote}>{t('Los colores son orientativos: dependen de la madera y de la marca. Probá antes en un retazo.')}</p>
    </div>
  );
}

/** La terminación de una pieza: la del mueble, u otra. */
export function FinishRow({ project, part }: { project: Project; part: Part }) {
  const commit = useEditor((s) => s.commit);
  const id = useId();
  if (part.wood === 'melamina' && !part.finish) return null;
  const f = part.finish;
  const set = (next: Finish | undefined) =>
    commit((d) => {
      const q = d.parts.find((x) => x.id === part.id);
      if (!q) return;
      if (next) q.finish = next;
      else delete q.finish;
    }, t('Terminación de {id}', { id: part.id }));
  const inherited = project.finish ? t('Como el mueble ({finish})', { finish: t(finishById(project.finish.id)?.name ?? '').toLocaleLowerCase() }) : t('Como el mueble');
  return (
    <label className={styles.field} htmlFor={id}>
      {t('Terminación')}
      <select id={id} value={f?.id ?? ''} onChange={(e) => set(e.target.value ? withColor(e.target.value, f?.color ?? project.finish?.color) : undefined)}>
        <option value="">{inherited}</option>
        <FinishOptions />
      </select>
      {f?.id === 'pintura' && <PaintSwatches value={f.color} onPick={(color) => set({ id: 'pintura', color })} />}
    </label>
  );
}

/** Las cuatro que se comparan: la elegida y las más distintas entre sí. */
function compareSet(current?: Finish): Finish[] {
  const base: Finish[] = [{ id: 'aceite' }, { id: 'laca-satinada' }, { id: 'tinte-nogal' }, { id: 'pintura', color: PAINT_COLORS[3] }];
  if (!current || current.id === 'natural') return base;
  return [current, ...base.filter((x) => x.id !== current.id)].slice(0, 4);
}

function CompareButton({ project, onPick }: { project: Project; onPick: (f: Finish) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={own.compare}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        {t('Comparar terminaciones')}
      </button>
      <dialog ref={dialog} className={photo.dialog} aria-labelledby="comparar-titulo" onClose={() => setOpen(false)}>
        {open && (
          <CompareBody
            project={project}
            onClose={() => dialog.current?.close()}
            onPick={(f) => {
              onPick(f);
              dialog.current?.close();
            }}
          />
        )}
      </dialog>
    </>
  );
}

/** Dibuja el mueble con cada terminación, de a una, con la luz de la foto. */
function CompareBody({ project, onClose, onPick }: { project: Project; onClose: () => void; onPick: (f: Finish) => void }) {
  const [options] = useState(() => compareSet(project.finish));
  const [shots, setShots] = useState<(string | null)[]>(() => options.map(() => null));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    void engineMeshes(project)
      .catch(() => [])
      .then(async (meshes) => {
        let gl: THREE.WebGLRenderer;
        try {
          gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        } catch {
          setFailed(true);
          return;
        }
        setupRenderer(gl);
        for (const [i, f] of options.entries()) {
          if (!alive) break;
          // Todo el mueble con esta terminación, también las piezas que tienen la suya.
          const variant: Project = { ...project, finish: f, parts: project.parts.map(({ finish, ...p }) => (void finish, p)) };
          const studio = buildStudio(gl, variant, meshes);
          studio.set(DEFAULT_PHOTO, 4 / 3);
          const blob = await takePhoto(gl, studio, { width: 640, height: 480, type: 'image/jpeg' });
          studio.dispose();
          const url = URL.createObjectURL(blob);
          urls.push(url);
          if (alive) setShots((s) => s.map((x, k) => (k === i ? url : x)));
        }
        gl.dispose();
      });
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [project, options]);
  return (
    <div className={photo.body}>
      <div className={photo.head}>
        <h2 id="comparar-titulo">{t('Comparar terminaciones')}</h2>
        <button type="button" className={styles.iconBtn} aria-label={t('Cerrar')} onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      {failed ? (
        <p className={styles.muted}>{t('Este navegador no puede dibujar en 3D.')}</p>
      ) : (
        <div className={own.grid}>
          {options.map((f, i) => (
            <button key={f.id} type="button" className={own.option} aria-pressed={project.finish?.id === f.id} onClick={() => onPick(f)}>
              {shots[i] ? <img src={shots[i]!} alt="" /> : <span className={own.wait}>{t('Dibujando…')}</span>}
              <span className={own.name}>{t(finishById(f.id)!.name)}</span>
            </button>
          ))}
        </div>
      )}
      <p className={styles.fieldNote}>{t('Tocá una para ponérsela a todo el mueble. Los colores son orientativos: probá antes en un retazo.')}</p>
    </div>
  );
}

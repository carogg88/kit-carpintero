import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildOffsets, buildSteps, t, tk, type Project, type Vec3 } from '@kitc/core';
import { fileName } from '../storage/backup';
import { engineMeshes } from './useGeometry';
import { buildStudio, sizeCaption, DEFAULT_PHOTO, PHOTO_SIZES, setupRenderer, takePhoto, type PhotoAngle, type PhotoBackground, type PhotoOptions, type PhotoSize, type PhotoStudio } from './photo';
import { saveThumb } from './thumbs';
import { IconCamera } from './icons';
import { useEditor } from './store';
import styles from './Photo.module.css';
import editorStyles from './Editor.module.css';

/** Se pide abrir la foto desde otro lado (Compartir), sin pasar el proyecto: lo tiene el editor. */
export const PHOTO_EVENT = 'kitc:foto';
export const openPhoto = () => window.dispatchEvent(new Event(PHOTO_EVENT));

const ANGLE_LABELS: [PhotoAngle, string][] = [
  ['der', tk('3/4 derecha')],
  ['izq', tk('3/4 izquierda')],
  ['frente', tk('Frente')],
  ['costado', tk('Costado')],
  ['arriba', tk('Arriba')],
];
const BACKGROUND_LABELS: [PhotoBackground, string][] = [
  ['claro', tk('Claro')],
  ['blanco', tk('Blanco')],
  ['estudio', tk('Estudio')],
  ['transparente', tk('Sin fondo')],
];
type Shape = 'apaisada' | 'cuadrada' | 'vertical';
const SHAPES: [Shape, string, number][] = [
  ['apaisada', tk('Apaisada'), 4 / 3],
  ['cuadrada', tk('Cuadrada'), 1],
  ['vertical', tk('Vertical'), 4 / 5],
];
const SIZE_LABELS: [PhotoSize, string][] = [
  ['pantalla', tk('Normal')],
  ['alta', tk('Alta')],
  ['muy', tk('Muy alta')],
];

const NONE: Record<string, number> = {};

const canShareFiles = (f: File) => typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });

/** Botón del encabezado (en la compu): abre la foto del mueble. También se abre desde Compartir, en el celular también. */
export function PhotoButton({ project }: { project: Project }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => {
      setOpen(true);
      dialog.current?.showModal();
    };
    window.addEventListener(PHOTO_EVENT, show);
    return () => window.removeEventListener(PHOTO_EVENT, show);
  }, []);
  return (
    <>
      <button
        type="button"
        className={`${editorStyles.iconBtn} ${editorStyles.headerWide}`}
        data-tour="photo"
        aria-label={t('Foto del mueble')}
        title={t('Foto del mueble')}
        aria-haspopup="dialog"
        onClick={openPhoto}
      >
        <IconCamera />
      </button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby="foto-titulo" onClose={() => setOpen(false)}>
        {open && <PhotoBody project={project} onClose={() => dialog.current?.close()} />}
      </dialog>
    </>
  );
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset className={styles.group}>
      <legend>{label}</legend>
      <div className={styles.chips}>
        {options.map(([v, name]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
            {t(name)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function PhotoBody({ project, onClose }: { project: Project; onClose: () => void }) {
  const hidden = useEditor((s) => s.hidden);
  const opened = useEditor((s) => (s.trying ? s.opened : NONE));
  // Probando con Separar piezas, la foto sale en despiece.
  const apart = useEditor((s) => (s.trying ? s.apart : 0));
  const offsets = useMemo(() => {
    if (!apart) return new Map<string, Vec3>();
    return new Map([...buildOffsets(buildSteps(project), 0)].map(([id, o]) => [id, o.map((v) => v * apart) as Vec3]));
  }, [project, apart]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const studio = useRef<PhotoStudio | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const draw = useRef<() => void>(() => {});
  const [options, setOptions] = useState<PhotoOptions>(DEFAULT_PHOTO);
  const [shape, setShape] = useState<Shape>('apaisada');
  const [size, setSize] = useState<PhotoSize>('alta');
  const [caption, setCaption] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const aspect = SHAPES.find((s) => s[0] === shape)![2];

  // El estudio se arma una vez, con las mallas del motor.
  useEffect(() => {
    let alive = true;
    let gl: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let observer: ResizeObserver | null = null;
    void engineMeshes(project)
      .catch(() => [])
      .then((meshes) => {
        if (!alive || !canvas.current) return;
        try {
          gl = new THREE.WebGLRenderer({ canvas: canvas.current, antialias: true, alpha: true, preserveDrawingBuffer: true });
        } catch {
          setState('error');
          return;
        }
        setupRenderer(gl);
        gl.setPixelRatio(Math.min(2, window.devicePixelRatio));
        const s = buildStudio(gl, project, meshes, new Set(hidden), opened, offsets);
        studio.current = s;
        renderer.current = gl;
        const render = () => gl!.render(s.scene, s.camera);
        draw.current = render;
        controls = new OrbitControls(s.camera, canvas.current);
        controls.target.copy(s.center);
        controls.enableDamping = false;
        controls.enablePan = false;
        controls.minDistance = s.radius * 1.2;
        controls.maxDistance = s.radius * 12;
        controls.maxPolarAngle = Math.PI / 2 - 0.02;
        controls.addEventListener('change', render);
        const fit = () => {
          const box = frame.current;
          if (!box || !gl) return;
          gl.setSize(box.clientWidth, box.clientHeight, false);
          s.camera.aspect = box.clientWidth / Math.max(1, box.clientHeight);
          s.camera.updateProjectionMatrix();
          render();
        };
        observer = new ResizeObserver(fit);
        if (frame.current) observer.observe(frame.current);
        setState('ready');
      });
    return () => {
      alive = false;
      observer?.disconnect();
      controls?.dispose();
      studio.current?.dispose();
      studio.current = null;
      gl?.dispose();
      renderer.current = null;
    };
  }, [project, hidden, opened, offsets]);

  // Vista, luz y fondo: se aplican sin volver a armar el estudio.
  useEffect(() => {
    const s = studio.current;
    const box = frame.current;
    if (state !== 'ready' || !s || !box) return;
    s.set(options, box.clientWidth / Math.max(1, box.clientHeight));
    draw.current();
  }, [options, shape, state]);

  const file = (): { name: string; type: 'image/jpeg' | 'image/png' } => {
    const png = options.background === 'transparente';
    return { name: `${fileName(project)}.${png ? 'png' : 'jpg'}`, type: png ? 'image/png' : 'image/jpeg' };
  };

  const make = async (): Promise<File | null> => {
    const s = studio.current;
    const gl = renderer.current;
    if (!s || !gl) return null;
    const long = PHOTO_SIZES[size];
    const [w, h] = aspect >= 1 ? [long, Math.round(long / aspect)] : [Math.round(long * aspect), long];
    const { name, type } = file();
    const blob = await takePhoto(gl, s, { width: w, height: h, type, caption: caption ? sizeCaption(project) : undefined });
    draw.current();
    // La foto también queda como miniatura del proyecto en el inicio.
    void saveThumb(project, blob);
    return new File([blob], name, { type });
  };

  const save = async () => {
    setBusy(true);
    try {
      const f = await make();
      if (!f) return;
      const url = URL.createObjectURL(f);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDone(t('Guardaste la foto ({name}).', { name: f.name }));
    } catch {
      setDone(t('No se pudo armar la foto. Probá con un tamaño más chico.'));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const f = await make();
      if (!f) return;
      if (canShareFiles(f)) await navigator.share({ files: [f], title: project.name });
      else await save();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setDone(t('No se pudo compartir la foto: guardala y mandala como archivo.'));
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<PhotoOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const mobile = typeof navigator !== 'undefined' && typeof navigator.share === 'function' && 'ontouchstart' in window;
  return (
    <div className={styles.body}>
      <div className={styles.head}>
        <h2 id="foto-titulo">{t('Foto del mueble')}</h2>
        <button type="button" className={editorStyles.iconBtn} aria-label={t('Cerrar')} onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className={styles.layout}>
        <div className={styles.stage}>
          <div
            ref={frame}
            className={styles.frame}
            data-bg={options.background}
            style={{ ['--ar' as string]: String(aspect) }}
          >
            <canvas ref={canvas} className={styles.canvas} role="img" aria-label={t('Vista previa de la foto del mueble')} />
            {state === 'loading' && <p className={styles.wait}>{t('Armando la foto…')}</p>}
            {state === 'error' && <p className={styles.wait}>{t('Este navegador no puede dibujar en 3D.')}</p>}
            {caption && state === 'ready' && <p className={styles.caption}>{sizeCaption(project)}</p>}
          </div>
          <p className={styles.hint}>{t('Arrastrá la foto para girar el mueble; con la rueda o dos dedos, acercás.')}</p>
        </div>
        <div className={styles.controls}>
          <Seg label={t('Vista')} value={options.angle} options={ANGLE_LABELS} onChange={(angle) => set({ angle })} />
          <label className={styles.group}>
            <span className={styles.legend}>{t('Luz')}</span>
            <input
              type="range"
              min={-80}
              max={80}
              step={5}
              value={options.light}
              onChange={(e) => set({ light: Number(e.target.value) })}
              aria-valuetext={options.light < -20 ? t('Desde la izquierda') : options.light > 20 ? t('Desde la derecha') : t('Desde adelante')}
            />
            <span className={styles.ends} aria-hidden="true">
              <span>{t('Izquierda')}</span>
              <span>{t('Derecha')}</span>
            </span>
          </label>
          <Seg label={t('Fondo')} value={options.background} options={BACKGROUND_LABELS} onChange={(background) => set({ background })} />
          <Seg label={t('Forma')} value={shape} options={SHAPES.map(([v, n]) => [v, n] as [Shape, string])} onChange={setShape} />
          <Seg label={t('Tamaño')} value={size} options={SIZE_LABELS} onChange={setSize} />
          <label className={styles.check}>
            <input type="checkbox" checked={caption} onChange={(e) => setCaption(e.target.checked)} />
            {t('Escribir las medidas del mueble')}
          </label>
          <div className={styles.actions}>
            <button type="button" className={editorStyles.primaryBtn} disabled={state !== 'ready' || busy} aria-busy={busy} onClick={() => void (mobile ? share() : save())}>
              {busy ? t('Armando…') : mobile ? t('Compartir foto') : t('Guardar foto')}
            </button>
            {mobile && (
              <button type="button" className={editorStyles.secondaryBtn} disabled={state !== 'ready' || busy} onClick={() => void save()}>
                {t('Guardar foto')}
              </button>
            )}
          </div>
          <p className={styles.done} role="status">
            {done ?? (options.background === 'transparente' ? t('Sin fondo sale en PNG, para pegarla sobre otra imagen.') : '')}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildOffsets, buildStepLines, buildSteps, t, type BuildStep, type Project } from '@kitc/core';
import { engineMeshes } from './useGeometry';
import { buildStudio, DEFAULT_PHOTO, setupRenderer, type PhotoStudio } from './photo';
import { setGrainMotion } from './woodMaterial';
import styles from './Build.module.css';

/**
 * El armado animado: las piezas se acercan y entran en su lugar en el orden de armado, con la luz de la foto. Lo ya
 * armado va en color, la pieza que entra resaltada y lo que falta, en fantasma en su lugar. Se reproduce, se pausa,
 * se pasa de a un paso y se va y vuelve con la barra. Con "reducir movimiento" salta de un paso al otro sin animar.
 */

/** Segundos que tarda cada pieza en entrar. */
const STEP_SECONDS = 1.4;

const REDUCE = '(prefers-reduced-motion: reduce)';
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(REDUCE);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(REDUCE).matches,
    () => false,
  );
}

/** Suave al salir y al llegar. */
const ease = (x: number) => x * x * (3 - 2 * x);

/** En qué paso entra cada pieza: el primero que la mueve. */
function firstStep(steps: readonly BuildStep[]): Map<string, number> {
  const out = new Map<string, number>();
  steps.forEach((s, i) => s.parts.forEach((id) => out.has(id) || out.set(id, i)));
  return out;
}

/** Cómo se dibuja cada pieza: armada, entrando o todavía en fantasma. */
type Look = 'puesta' | 'entra' | 'falta';
const ACCENT = new THREE.Color('#c98a4e');
const NONE = new THREE.Color(0, 0, 0);
function setLook(mesh: THREE.Mesh, look: Look) {
  if (mesh.userData.look === look) return;
  mesh.userData.look = look;
  const m = mesh.material as THREE.MeshPhysicalMaterial;
  const ghost = look === 'falta';
  if (m.transparent !== ghost) m.needsUpdate = true;
  m.transparent = ghost;
  m.opacity = ghost ? 0.16 : 1;
  m.depthWrite = !ghost;
  m.emissive.copy(look === 'entra' ? ACCENT : NONE);
  m.emissiveIntensity = look === 'entra' ? 0.45 : 0;
  mesh.castShadow = !ghost;
}

export interface BuildPlayerProps {
  project: Project;
  /** Avisa en qué renglón del orden de armado (los del mueble, sin los de las partes) está la animación. */
  onLine?: (line: number) => void;
  className?: string;
}

export function BuildPlayer({ project, onLine, className }: BuildPlayerProps) {
  const steps = useMemo(() => buildSteps(project), [project]);
  const lines = useMemo(() => buildStepLines(project, steps), [project, steps]);
  // El renglón del mueble de cada paso: una parte que se arma aparte cuenta como el paso en que entra entera.
  const lineOf = useMemo(() => {
    const top = steps.map((s, i) => (s.unit === 'mueble' ? i : -1)).filter((i) => i >= 0);
    return steps.map((s, i) => {
      const at = s.unit === 'mueble' ? i : steps.findIndex((x, k) => k > i && x.unit === 'mueble' && x.parts.includes(s.parts[0]!));
      return Math.max(0, top.indexOf(at));
    });
  }, [steps]);
  const enters = useMemo(() => firstStep(steps), [steps]);
  const n = steps.length;
  const reduce = useReducedMotion();

  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const studio = useRef<PhotoStudio | null>(null);
  const draw = useRef<() => void>(() => {});
  // Dónde va la animación, de 0 (todo separado) a n (todo armado). Empieza separado: así se ve qué hay que armar.
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const at = useRef(0);

  // El estudio, una vez por modelo: las piezas en su lugar y la cámara encuadrando el mueble separado.
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
          gl = new THREE.WebGLRenderer({ canvas: canvas.current, antialias: true, alpha: true });
        } catch {
          setState('error');
          return;
        }
        setupRenderer(gl);
        gl.setPixelRatio(Math.min(2, window.devicePixelRatio));
        const s = buildStudio(gl, project, meshes, new Set(), {}, buildOffsets(steps, 0));
        studio.current = s;
        const render = () => gl!.render(s.scene, s.camera);
        draw.current = render;
        controls = new OrbitControls(s.camera, canvas.current);
        controls.enableDamping = false;
        controls.enablePan = false;
        controls.maxPolarAngle = Math.PI / 2 - 0.02;
        controls.addEventListener('change', render);
        const fit = () => {
          const box = frame.current;
          if (!box || !gl) return;
          const aspect = box.clientWidth / Math.max(1, box.clientHeight);
          gl.setSize(box.clientWidth, box.clientHeight, false);
          s.set(DEFAULT_PHOTO, aspect);
          controls!.target.copy(s.center);
          controls!.minDistance = s.radius * 1.2;
          controls!.maxDistance = s.radius * 12;
          controls!.update();
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
    };
  }, [project, steps]);

  // Las piezas donde van en este punto del armado, con su aspecto.
  useEffect(() => {
    const s = studio.current;
    if (state !== 'ready' || !s) return;
    const i = Math.min(n - 1, Math.floor(progress));
    const eased = Math.floor(progress) + ease(progress - Math.floor(progress));
    const offsets = buildOffsets(steps, progress >= n ? n : eased);
    const move = new THREE.Matrix4();
    for (const [id, mesh] of s.parts) {
      const first = enters.get(id) ?? 0;
      // Lo de la parte que se arma aparte ya está "puesto" cuando entra la parte entera.
      const moving = progress < n && steps[i]?.parts.includes(id) && steps[i]!.distance > 0;
      const look: Look = moving ? 'entra' : first <= i || progress >= n ? 'puesta' : 'falta';
      // Lo que falta, en fantasma en su lugar: así se ve adónde va.
      const o = look === 'falta' ? ([0, 0, 0] as const) : (offsets.get(id) ?? [0, 0, 0]);
      const base = mesh.userData.at as THREE.Vector3;
      mesh.position.set(base.x + o[0], base.y + o[1], base.z + o[2]);
      setGrainMotion(mesh.material as THREE.Material, o.some((v) => v) ? move.makeTranslation(o[0], o[1], o[2]) : null);
      setLook(mesh, look);
    }
    draw.current();
    onLine?.(lineOf[Math.min(n - 1, Math.floor(progress))] ?? 0);
  }, [progress, state, steps, enters, n, lineOf, onLine]);

  // Reproducir: avanza solo hasta el final. Con "reducir movimiento", de a un paso entero.
  useEffect(() => {
    if (!playing) return;
    if (reduce) {
      const id = setInterval(() => {
        const next = Math.min(n, Math.floor(at.current) + 1);
        at.current = next;
        setProgress(next);
        if (next >= n) setPlaying(false);
      }, STEP_SECONDS * 1000);
      return () => clearInterval(id);
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(n, at.current + (now - last) / 1000 / STEP_SECONDS);
      last = now;
      at.current = next;
      setProgress(next);
      if (next >= n) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, reduce, n]);

  const go = (p: number) => {
    const v = Math.max(0, Math.min(n, p));
    at.current = v;
    setProgress(v);
  };
  if (!n) return null;
  const i = Math.min(n - 1, Math.floor(progress));
  const finished = progress >= n;
  const caption = finished ? t('Listo: el mueble armado.') : lines[i];

  return (
    <div className={`${styles.player} ${className ?? ''}`}>
      <div className={styles.frame} ref={frame}>
        <canvas ref={canvas} className={styles.canvas} aria-label={t('El mueble armándose, paso a paso')} role="img" />
        {state === 'loading' && <p className={styles.wait}>{t('Armando la vista…')}</p>}
        {state === 'error' && <p className={styles.wait}>{t('Este navegador no puede dibujar en 3D.')}</p>}
      </div>
      <p className={styles.caption} aria-live="polite">
        <span className={styles.count}>{t('{n} de {total}', { n: finished ? n : i + 1, total: n })}</span>
        {caption}
      </p>
      <div className={styles.controls}>
        <button type="button" onClick={() => go(progress % 1 === 0 ? progress - 1 : Math.floor(progress))} disabled={progress <= 0} aria-label={t('Paso anterior')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 4 6 8l4 4" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={() => {
            if (playing) return setPlaying(false);
            if (finished) go(0);
            setPlaying(true);
          }}
          aria-label={playing ? t('Pausa') : finished ? t('Ver de nuevo') : t('Reproducir')}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5.5 3.5v9M10.5 3.5v9" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5 3.2v9.6L12.5 8z" fill="currentColor" />
            </svg>
          )}
        </button>
        <button type="button" onClick={() => go(Math.floor(progress) + 1)} disabled={finished} aria-label={t('Siguiente paso')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 4 4 4-4 4" />
          </svg>
        </button>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={n}
          step={0.01}
          value={progress}
          onChange={(e) => {
            setPlaying(false);
            go(Number(e.target.value));
          }}
          aria-label={t('Ir a un punto del armado')}
          aria-valuetext={t('Paso {n} de {total}', { n: finished ? n : i + 1, total: n })}
        />
      </div>
    </div>
  );
}

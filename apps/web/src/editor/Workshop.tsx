import { useEffect, useMemo, useRef, useState } from 'react';
import { cutList, describePartJoints, drawPart, facePattern, formatAngle, formatNumber, t, type CutRow, type Drawing, type Project } from '@kitc/core';
import { sectionHref, type Section } from '../routes';
import { woodName } from './cutsData';
import { IconCheck, IconChevron, IconClose } from './icons';
import { BuildPlayer } from './Build3D';
import styles from './Workshop.module.css';

/**
 * Modo taller: una pieza por pantalla, para el celular apoyado en el banco. Medidas de corte en letra grande, el
 * dibujo de la pieza con sus encastres y los pasos para tildar. La pantalla no se apaga mientras está abierto, y lo
 * tildado queda guardado para seguir otro día.
 */

/** De qué sección se entró, para volver ahí al salir. */
const FROM_KEY = 'kitc:taller:desde';
export function workshopFrom(): Section {
  try {
    const v = sessionStorage.getItem(FROM_KEY);
    return v === 'armado' || v === 'plano' || v === 'uniones' || v === 'modelo' ? v : 'cortes';
  } catch {
    return 'cortes';
  }
}

/** Botón para entrar al modo taller desde una sección. */
export function WorkshopLink({ projectId, from, className }: { projectId: string; from: Section; className?: string }) {
  return (
    <a
      className={className ?? styles.enter}
      href={sectionHref(projectId, 'taller')}
      onClick={() => {
        try {
          sessionStorage.setItem(FROM_KEY, from);
        } catch {
          // Sin almacenamiento: al salir vuelve a Cortes.
        }
      }}
    >
      <IconPhone />
      <span>
        <strong>{t('Modo taller')}</strong>
        <span>{t('Una pieza por pantalla, en letra grande, para el celu en el banco')}</span>
      </span>
      <IconChevron />
    </a>
  );
}

const IconPhone = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </svg>
);

const storeKey = (id: string) => `kitc:taller:${id}`;
interface Saved {
  done: string[];
  at: number;
}
function read(id: string): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(id)) ?? 'null') as Partial<Saved> | null;
    return { done: Array.isArray(v?.done) ? v.done.filter((x): x is string => typeof x === 'string') : [], at: typeof v?.at === 'number' ? v.at : 0 };
  } catch {
    return { done: [], at: 0 };
  }
}
function write(id: string, s: Saved) {
  try {
    localStorage.setItem(storeKey(id), JSON.stringify(s));
  } catch {
    // Sin almacenamiento: lo tildado vive mientras la página esté abierta.
  }
}

/** Que la pantalla no se apague. Se pide de nuevo al volver a la pestaña: el navegador la suelta al salir. */
function useWakeLock(): 'on' | 'off' | 'unsupported' {
  const [state, setState] = useState<'on' | 'off' | 'unsupported'>(() => ('wakeLock' in navigator ? 'off' : 'unsupported'));
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const ask = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (!alive) return void lock.release();
        setState('on');
        lock.addEventListener('release', () => alive && setState('off'));
      } catch {
        setState('off');
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && void ask();
    void ask();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);
  return state;
}

interface Task {
  key: string;
  text: string;
  kind: 'cortar' | 'trabajo' | 'encastre';
}

/** Los pasos de una pieza: cortarla a medida, lo que pide su madera y cada encastre, con dónde marcarlo. */
function tasks(project: Project, row: CutRow, n: (mm: number) => string, dims: (c: number[]) => string): Task[] {
  const part = project.parts.find((p) => p.id === row.ids[0]);
  const list: Task[] = [{ key: 'cortar', text: t('Cortar a {dims}', { dims: dims(row.cut) }), kind: 'cortar' }];
  // Las curvas y los calados se marcan con la plantilla impresa del plano, no con regla.
  if (part && facePattern(part, n)) list.push({ key: 'plantilla', text: t('Calcar la plantilla 1:1 del plano y sacar lo rayado'), kind: 'trabajo' });
  const marks = part ? describePartJoints(project, part, n) : [];
  // "2 mortajas" sobra si abajo está cada mortaja con dónde marcarla.
  const work = marks.length ? row.work.filter((w) => !row.jointWork.includes(w)) : row.work;
  work.forEach((w, i) => list.push({ key: `trabajo|${i}|${w}`, text: w.charAt(0).toLocaleUpperCase() + w.slice(1), kind: 'trabajo' }));
  marks.forEach((m) => list.push({ key: `encastre|${m}`, text: m, kind: 'encastre' }));
  return list.map((x) => ({ ...x, key: `${row.ids[0]}|${x.key}` }));
}

/** La pieza de frente, con las espigas y los cortes de sus encastres resaltados y lo oculto punteado. */
function PieceDrawing({ d, label }: { d: Drawing; label: string }) {
  const { u0, v0, u1, v1 } = d.bounds;
  const w = u1 - u0;
  const h = v1 - v0;
  const pad = Math.max(w, h) * 0.04;
  const stroke = Math.max(w, h) / 260;
  return (
    <svg className={styles.drawing} viewBox={`${u0 - pad} ${-v1 - pad} ${w + 2 * pad} ${h + 2 * pad}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {d.joints.map((r, i) => (
        <rect key={i} x={r.u0} y={-r.v1} width={r.u1 - r.u0} height={r.v1 - r.v0} className={styles.jointFill} />
      ))}
      {d.lines.map((l, i) => (
        <line
          key={i}
          x1={l.a[0]}
          y1={-l.a[1]}
          x2={l.b[0]}
          y2={-l.b[1]}
          strokeWidth={stroke}
          strokeDasharray={l.hidden ? `${stroke * 4} ${stroke * 3}` : undefined}
          className={l.joint ? styles.jointLine : styles.line}
        />
      ))}
      {/* Puntas en ángulo: el ángulo de la falsa escuadra, entre el canto y la punta larga. */}
      {d.angles?.map((m, i) => {
        const r = Math.max(w, h) * 0.08;
        const [x, y] = [m.at[0], -m.at[1]];
        const a = [m.a[0], -m.a[1]] as const;
        const b = [m.b[0], -m.b[1]] as const;
        const sweep = a[0] * b[1] - a[1] * b[0] > 0 ? 1 : 0;
        const mid = [a[0] + b[0], a[1] + b[1]] as const;
        const len = Math.hypot(mid[0], mid[1]) || 1;
        const size = Math.max(w, h) * 0.045;
        return (
          <g key={`a${i}`} className={styles.angle}>
            <path d={`M ${x + a[0] * r} ${y + a[1] * r} A ${r} ${r} 0 0 ${sweep} ${x + b[0] * r} ${y + b[1] * r}`} fill="none" strokeWidth={stroke} />
            <text x={x + (mid[0] / len) * r * 1.9} y={y + (mid[1] / len) * r * 1.9 + size / 3} fontSize={size} textAnchor="middle">
              {formatAngle(Math.round(m.deg * 2) / 2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Workshop({ project, onExit }: { project: Project; onExit: () => void }) {
  const units = project.units;
  const n = (mm: number) => formatNumber(mm, units);
  const dims = (c: number[]) => (units === 'cm' ? `${c.map(n).join(' × ')} cm` : c.map((v) => `${n(v)}″`).join(' × '));
  const rows = useMemo(() => cutList(project), [project]);
  const all = rows.map((r) => tasks(project, r, n, dims));
  const [saved, setSaved] = useState(() => read(project.id));
  const [listOpen, setListOpen] = useState(false);
  const wake = useWakeLock();
  const top = useRef<HTMLDivElement>(null);
  // Después de la última pieza, una pantalla más: el armado animado.
  const at = Math.min(saved.at, rows.length);
  const building = at === rows.length;
  const done = new Set(saved.done);
  const save = (next: Saved) => {
    setSaved(next);
    write(project.id, next);
  };
  const go = (i: number) => {
    save({ ...saved, at: Math.max(0, Math.min(rows.length, i)) });
    setListOpen(false);
    top.current?.scrollTo({ top: 0 });
  };
  const toggle = (key: string) => {
    const next = new Set(done);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    save({ ...saved, done: [...next] });
  };
  const rowDone = (i: number) => all[i]!.every((x) => done.has(x.key));
  const finished = rows.filter((_, i) => rowDone(i)).length;

  // Flechas del teclado para pasar de pieza en la compu; Escape sale.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowRight') go(at + 1);
      else if (e.key === 'ArrowLeft') go(at - 1);
      else if (e.key === 'Escape') {
        if (listOpen) setListOpen(false);
        else onExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!rows.length) {
    return (
      <div className={styles.shell}>
        <div className={styles.empty}>
          <p>{t('Todavía no hay piezas para trabajar.')}</p>
          <button type="button" className={styles.next} onClick={onExit}>
            {t('Volver')}
          </button>
        </div>
      </div>
    );
  }

  const row = rows[Math.min(at, rows.length - 1)]!;
  const part = project.parts.find((p) => p.id === row.ids[0]);
  const list = all[Math.min(at, rows.length - 1)]!;
  const left = list.filter((x) => !done.has(x.key)).length;
  const drawing = part && part.base.kind === 'box' ? drawPart(project, part) : null;
  const finishedLen = row.cut[0] - row.extraLength;

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <button type="button" className={styles.iconBtn} aria-label={t('Salir del modo taller')} onClick={onExit}>
          <IconClose />
        </button>
        <button type="button" className={styles.where} aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}>
          <span className={styles.whereTitle}>{building ? t('Armado') : t('Pieza {n} de {total}', { n: at + 1, total: rows.length })}</span>
          <span className={styles.whereSub}>{t('{n} listas · ver todas', { n: finished })}</span>
        </button>
        <span className={styles.wake} data-state={wake} title={wake === 'on' ? t('La pantalla no se apaga mientras trabajás.') : wake === 'unsupported' ? t('Este navegador no deja mantener la pantalla encendida.') : t('La pantalla se puede apagar.')}>
          <span className={styles.wakeDot} aria-hidden="true" />
          {wake === 'on' ? t('Pantalla encendida') : t('Puede apagarse')}
        </span>
      </header>
      <div className={styles.track} aria-hidden="true">
        {rows.map((r, i) => (
          <span key={r.ids.join(',')} data-done={rowDone(i) || undefined} data-current={i === at || undefined} />
        ))}
        <span data-current={building || undefined} />
      </div>

      {listOpen && (
        <nav className={styles.list} aria-label={t('Todas las piezas')}>
          <ul>
            {rows.map((r, i) => (
              <li key={r.ids.join(',')}>
                <button type="button" aria-current={i === at ? 'step' : undefined} onClick={() => go(i)}>
                  <span className={styles.listCheck} data-done={rowDone(i) || undefined}>
                    {rowDone(i) ? <IconCheck /> : i + 1}
                  </span>
                  <span className={styles.listName}>
                    <strong>{r.name}</strong>
                    <span>
                      {r.ids.join(' · ')} · {dims(r.cut)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button type="button" aria-current={building ? 'step' : undefined} onClick={() => go(rows.length)}>
                <span className={styles.listCheck}>{rows.length + 1}</span>
                <span className={styles.listName}>
                  <strong>{t('Armado')}</strong>
                  <span>{t('El orden para presentar en seco y encolar')}</span>
                </span>
              </button>
            </li>
          </ul>
        </nav>
      )}

      <div className={styles.scroll} ref={top}>
        {building ? (
          <main className={styles.piece}>
            <h1 className={styles.name}>{t('Armado')}</h1>
            <p className={styles.note}>{t('Presentá todo en seco en este orden y después encolá por partes. Arrastrá el dibujo para girarlo.')}</p>
            <BuildPlayer project={project} />
          </main>
        ) : (
          <main className={styles.piece} aria-live="polite">
            <p className={styles.ids}>
              {row.ids.join(' · ')}
              {row.ids.length > 1 && <span className={styles.count}>×{row.ids.length}</span>}
            </p>
            <h1 className={styles.name}>{row.name}</h1>
            <p className={styles.wood}>{woodName(row.wood)}</p>

            <dl className={styles.dims} aria-label={t('Medidas de corte')}>
              {[t('Largo'), t('Ancho'), t('Espesor')].map((label, i) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {n(row.cut[i]!)}
                    <small>{units === 'cm' ? 'cm' : '″'}</small>
                  </dd>
                </div>
              ))}
            </dl>
            {row.extraLength > 0 && (
              <p className={styles.note}>{t('Terminada mide {len} de largo: lo demás son las espigas, colas o lengüetas.', { len: dims([finishedLen]) })}</p>
            )}
            {row.ids.length > 1 && <p className={styles.note}>{t('Son {n} piezas iguales: hacé cada paso en todas, o en espejo donde haga falta.', { n: row.ids.length })}</p>}

            {drawing && <PieceDrawing d={drawing} label={t('Dibujo de {name}, con sus encastres', { name: row.name })} />}

            <h2 className={styles.stepsTitle}>{left ? t('Pasos · faltan {n}', { n: left }) : t('Pasos · todo listo')}</h2>
            <ul className={styles.steps}>
              {list.map((x) => (
                <li key={x.key}>
                  <label data-done={done.has(x.key) || undefined} data-kind={x.kind}>
                    <input type="checkbox" checked={done.has(x.key)} onChange={() => toggle(x.key)} />
                    <span className={styles.box} aria-hidden="true">
                      <IconCheck />
                    </span>
                    <span>{x.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </main>
        )}
      </div>

      <footer className={styles.footer}>
        <button type="button" className={styles.prev} disabled={at === 0} onClick={() => go(at - 1)} aria-label={t('Pieza anterior')}>
          <span className={styles.flip}>
            <IconChevron />
          </span>
        </button>
        <button type="button" className={styles.next} onClick={() => (building ? onExit() : go(at + 1))}>
          {building ? t('Terminar') : at === rows.length - 1 ? t('Ir al armado') : left ? t('Siguiente pieza') : t('Lista · siguiente')}
          <IconChevron />
        </button>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { assemblySteps, formatNumber, t, tk, type AssemblyKind, type Project } from '@kitc/core';
import { JointMeta } from '../help/Help';
import { sectionHref, type Section } from '../routes';
import styles from './Sections.module.css';

/** Pasos hechos de cada proyecto, en este navegador. Si no se puede guardar, viven mientras la página esté abierta. */
const storeKey = (id: string) => `kitc:armado:${id}`;
function readDone(id: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(id)) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function writeDone(id: string, keys: string[]) {
  try {
    localStorage.setItem(storeKey(id), JSON.stringify(keys));
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}

/** Adónde mirar en cada paso: la lista de cortes, el plano o la unión. */
const LINKS: Partial<Record<AssemblyKind, [Section, string]>> = {
  cortar: ['cortes', tk('Ver la lista de cortes')],
  tiras: ['cortes', tk('Ver la lista de cortes')],
  marcar: ['plano', tk('Ver el plano')],
  encastre: ['uniones', tk('Ver las uniones')],
};

/**
 * Cómo armarlo: el orden de trabajo, paso por paso, armado a partir del modelo. Cada paso se puede marcar como
 * hecho, para retomar otro día donde se dejó.
 */
export function AssemblyView({ project }: { project: Project }) {
  const units = project.units;
  const dims = (cut: [number, number, number]) => {
    const [l, w, th] = cut.map((mm) => formatNumber(mm, units));
    return units === 'cm' ? `${l} × ${w} × ${th} cm` : `${l}″ × ${w}″ × ${th}″`;
  };
  const steps = assemblySteps(project, dims);
  const [done, setDone] = useState(() => new Set(readDone(project.id)));
  // Un paso abierto a la vez: el que falta hacer, o el que la persona tocó (null: ninguno).
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const toggle = (key: string) => {
    const next = new Set(done);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDone(next);
    writeDone(project.id, [...next]);
    // Al terminar un paso se abre el siguiente que falta.
    if (next.has(key)) setOpen(undefined);
  };
  const count = steps.filter((s) => done.has(s.key)).length;
  const current = steps.find((s) => !done.has(s.key))?.key;
  const shown = open === undefined ? current : open;

  return (
    <main className={styles.assembly}>
      <div className={styles.assemblyHead}>
        <h1 className={styles.h1}>{t('Cómo armarlo')}</h1>
        <p className={styles.muted}>{t('El orden de trabajo para este mueble, de la madera cortada al mueble terminado. Marcá cada paso cuando lo termines.')}</p>
        <div className={styles.progress}>
          <span className={styles.progressBar} aria-hidden="true">
            <span style={{ width: `${(count / steps.length) * 100}%` }} />
          </span>
          <span role="status">{count === steps.length ? t('¡Terminado!') : t('{done} de {n} pasos hechos', { done: count, n: steps.length })}</span>
        </div>
      </div>
      <ol className={styles.stepList}>
        {steps.map((s, i) => {
          const isDone = done.has(s.key);
          const link = LINKS[s.kind];
          const isOpen = s.key === shown;
          const bodyId = `paso-${i}`;
          return (
            <li key={s.key} className={styles.stepCard} data-done={isDone || undefined} aria-current={s.key === current ? 'step' : undefined}>
              <h2 className={styles.h3}>
                <button type="button" className={styles.stepHead} aria-expanded={isOpen} aria-controls={bodyId} onClick={() => setOpen(isOpen ? null : s.key)}>
                  <span className={styles.stepBadge} aria-hidden="true">
                    {isDone ? (
                      <svg viewBox="0 0 16 16">
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className={styles.stepTitle}>{s.title}</span>
                  <svg className={styles.stepChevron} viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>
              </h2>
              <div className={styles.stepBody} id={bodyId} hidden={!isOpen}>
                <p className={styles.stepText}>{s.text}</p>
                {s.joint && <JointMeta type={s.joint} />}
                {s.items.length > 0 && (
                  <ul className={styles.stepItems}>
                    {s.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                <div className={styles.stepActions}>
                  <button type="button" className={styles.doneToggle} aria-pressed={isDone} onClick={() => toggle(s.key)}>
                    <span className={styles.doneBox} aria-hidden="true" />
                    {isDone ? t('Hecho') : t('Marcar como hecho')}
                  </button>
                  {link && (
                    <a className={styles.stepLink} href={sectionHref(project.id, link[0])}>
                      {t(link[1])}
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}

import { useEffect, useSyncExternalStore } from 'react';
import { t, tk } from '@kitc/core';
import { sectionHref, type Section } from '../routes';
import { IconChevron, IconClose } from './icons';
import styles from './Editor.module.css';

/** Después de crear el mueble, el camino de siempre: uniones, cortes, plano y armado. */
const STEPS: [Section, string][] = [
  ['uniones', tk('Revisá las uniones')],
  ['cortes', tk('Mirá los cortes')],
  ['plano', tk('Descargá el plano')],
  ['armado', tk('Seguí cómo armarlo')],
];

interface Seen {
  visited: Section[];
  closed: boolean;
}

const key = (id: string) => `kitc:sigue:${id}`;
// Lo leído por proyecto, para que las pestañas y la barra muestren lo mismo y se enteren juntas de cada cambio.
const cache = new Map<string, Seen>();
const listeners = new Set<() => void>();
function read(id: string): Seen {
  const hit = cache.get(id);
  if (hit) return hit;
  let seen: Seen = { visited: [], closed: false };
  try {
    const v = JSON.parse(localStorage.getItem(key(id)) ?? 'null') as Partial<Seen> | null;
    seen = { visited: Array.isArray(v?.visited) ? v.visited : [], closed: v?.closed === true };
  } catch {
    // Sin almacenamiento: se arranca de cero.
  }
  cache.set(id, seen);
  return seen;
}
function write(id: string, seen: Seen) {
  cache.set(id, seen);
  try {
    localStorage.setItem(key(id), JSON.stringify(seen));
  } catch {
    // Sin almacenamiento: vale mientras la app siga abierta.
  }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
const useSeen = (id: string) => useSyncExternalStore(subscribe, () => read(id));

/**
 * El camino de después de dibujar, para marcarlo en las pestañas: las secciones ya vistas y la que sigue.
 * `null` cuando no hay que mostrarlo: todavía no hay uniones, se cerró la guía o ya se pasó por todo.
 */
export function useStepMarks(projectId: string, active: boolean): { visited: Section[]; next: Section; hint: string } | null {
  const seen = useSeen(projectId);
  const next = STEPS.find(([s]) => !seen.visited.includes(s));
  if (!active || seen.closed || !next) return null;
  return { visited: seen.visited, next: next[0], hint: t(next[1]) };
}

/** Anota que se pasó por una sección del proyecto: la barra de qué sigue la tacha. */
export function useVisitSection(projectId: string | undefined, section: Section) {
  useEffect(() => {
    if (!projectId || section === 'modelo') return;
    const seen = read(projectId);
    if (!seen.visited.includes(section)) write(projectId, { ...seen, visited: [...seen.visited, section] });
  }, [projectId, section]);
}

/**
 * Barra de "qué sigue" en el modelo, en el celular: el paso que viene después de dibujar el mueble. Se esconde
 * mientras se usa una herramienta: ahí hace falta todo el lugar para la pieza. Se cierra con la X, o sola cuando
 * se pasó por todos. En la compu el mismo camino va marcado en las pestañas del encabezado.
 */
export function NextSteps({ projectId, busy = false }: { projectId: string; busy?: boolean }) {
  const seen = useSeen(projectId);
  const next = STEPS.find(([s]) => !seen.visited.includes(s));
  if (seen.closed || !next) return null;
  const close = () => write(projectId, { ...seen, closed: true });
  const index = STEPS.indexOf(next);
  return (
    <nav className={styles.nextSteps} aria-label={t('Qué sigue')} data-busy={busy || undefined}>
      <span className={styles.nextTitle}>{t('¿Qué sigue?')}</span>
      <ol className={styles.nextList}>
        {STEPS.map(([section, label], i) => {
          const done = seen.visited.includes(section);
          return (
            <li key={section} data-done={done || undefined} data-next={section === next[0] || undefined}>
              <a href={sectionHref(projectId, section)}>
                <span className={styles.nextNum} aria-hidden="true">
                  {done ? '✓' : i + 1}
                </span>
                <span className={done ? styles.nextDone : undefined}>{t(label)}</span>
                {done && <span className={styles.srOnly}>{t('(ya lo viste)')}</span>}
                {section === next[0] && <IconChevron />}
              </a>
            </li>
          );
        })}
      </ol>
      <span className={styles.nextCount} aria-hidden="true">
        {t('{n} de {total}', { n: index + 1, total: STEPS.length })}
      </span>
      <button type="button" className={styles.nextClose} aria-label={t('Cerrar qué sigue')} onClick={close}>
        <IconClose />
      </button>
    </nav>
  );
}

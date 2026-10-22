import { useEffect, useState } from 'react';
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
function read(id: string): Seen {
  try {
    const v = JSON.parse(localStorage.getItem(key(id)) ?? 'null') as Partial<Seen> | null;
    return { visited: Array.isArray(v?.visited) ? v.visited : [], closed: v?.closed === true };
  } catch {
    return { visited: [], closed: false };
  }
}
function write(id: string, seen: Seen) {
  try {
    localStorage.setItem(key(id), JSON.stringify(seen));
  } catch {
    // Sin almacenamiento: la barra vuelve la próxima vez.
  }
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
 * Barra de "qué sigue" en el modelo: los pasos que vienen después de dibujar el mueble, con los ya vistos
 * tachados. En el celular se ve solo el que sigue, y se esconde mientras se usa una herramienta: ahí hace falta
 * todo el lugar para la pieza. Se cierra con la X, o sola cuando se pasó por todos.
 */
export function NextSteps({ projectId, busy = false }: { projectId: string; busy?: boolean }) {
  const [seen, setSeen] = useState(() => read(projectId));
  const next = STEPS.find(([s]) => !seen.visited.includes(s));
  if (seen.closed || !next) return null;
  const close = () => {
    const closed = { ...seen, closed: true };
    setSeen(closed);
    write(projectId, closed);
  };
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

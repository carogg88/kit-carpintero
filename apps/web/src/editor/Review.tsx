import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { partNotes, reviewDesign, t, type Project, type ReviewNote } from '@kitc/core';
import { useEditor } from './store';
import { IconCheck, IconWarn } from './icons';
import styles from './Editor.module.css';

/**
 * Revisión del diseño: lo que un carpintero con oficio diría antes de cortar. Se recalcula con cada cambio,
 * vive en el panel del proyecto (todos los avisos) y en el de cada pieza (los suyos), y en la vista 3D
 * un cartel dice cuántos hay.
 */

/** Pide abrir la revisión en el panel del proyecto, desde el cartel de la vista 3D. */
/** Pide abrir la revisión del diseño en el panel: la dispara la píldora de avisos del modelo. */
export const OPEN_EVENT = 'kitc:revision';

export function useReview(project: Project): ReviewNote[] {
  return useMemo(() => reviewDesign(project), [project]);
}

const countText = (n: number) => (n === 1 ? t('1 aviso') : t('{n} avisos', { n }));

/** En la vista 3D: cuántos avisos hay. Lleva a la lista del panel. */
export function ReviewPill({ project }: { project: Project }) {
  const notes = useReview(project);
  const select = useEditor((s) => s.select);
  if (!notes.length) return null;
  return (
    <button
      type="button"
      className={styles.reviewPill}
      onClick={() => {
        select(null);
        // El panel del proyecto se arma después de soltar la pieza: se pide abrir la revisión en el próximo cuadro.
        requestAnimationFrame(() => window.dispatchEvent(new Event(OPEN_EVENT)));
      }}
    >
      <IconWarn />
      <span>
        {t('Revisión')} · {countText(notes.length)}
      </span>
    </button>
  );
}

function NoteBody({ note }: { note: ReviewNote }) {
  return (
    <>
      <p>{note.text}</p>
      <p>
        <strong>{t('Qué hacer:')}</strong> {note.fix}
      </p>
    </>
  );
}

/** En el panel del proyecto: todos los avisos, plegados, con un botón para ir a la pieza. */
/** Cuántos avisos hay, o que no hay nada: para el resumen de la sección plegada. */
export function reviewSummary(n: number): string {
  return n === 0 ? t('Nada para corregir') : countText(n);
}

/** La revisión. Sin `heading`, va adentro de una sección que ya dice el título. */
export function ReviewCard({ project, heading = true }: { project: Project; heading?: boolean }) {
  const notes = useReview(project);
  const select = useEditor((s) => s.select);
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const show = () => {
      setOpen((o) => o ?? notes[0]?.id ?? null);
      ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, [notes]);
  if (!project.parts.length) return null;
  return (
    <section ref={ref} className={styles.review} aria-labelledby={heading ? titleId : undefined} aria-label={heading ? undefined : t('Revisión del diseño')}>
      {heading && (
        <div className={styles.reviewHead}>
          <span id={titleId} className={styles.legend}>
            {t('Revisión del diseño')}
          </span>
          {notes.length > 0 && <span className={styles.reviewCount}>{countText(notes.length)}</span>}
        </div>
      )}
      {notes.length === 0 ? (
        <p className={styles.reviewOk}>
          <IconCheck />
          {t('No veo nada para corregir antes de cortar.')}
        </p>
      ) : (
        <ul className={styles.reviewList}>
          {notes.map((n) => (
            <li key={n.id}>
              <button type="button" className={styles.reviewItem} aria-expanded={open === n.id} onClick={() => setOpen(open === n.id ? null : n.id)}>
                <IconWarn />
                <span>{n.title}</span>
              </button>
              {open === n.id && (
                <div className={styles.reviewBody}>
                  <NoteBody note={n} />
                  {n.parts[0] && (
                    <button type="button" className={styles.link} onClick={() => select(n.parts[0]!)}>
                      {n.parts.length > 1 && n.kind === 'estante' ? t('Ver el primero ({id})', { id: n.parts[0] }) : t('Ver la pieza ({id})', { id: n.parts[0] })}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** En el panel de una pieza: sus avisos, abiertos. */
export function PartNotes({ project, partId }: { project: Project; partId: string }) {
  const notes = partNotes(useReview(project), partId);
  if (!notes.length) return null;
  return (
    <div className={styles.partNotes}>
      {notes.map((n) => (
        <div key={n.id} className={styles.partNote} role="note">
          <strong>
            <IconWarn />
            {n.title}
          </strong>
          <NoteBody note={n} />
        </div>
      ))}
    </div>
  );
}

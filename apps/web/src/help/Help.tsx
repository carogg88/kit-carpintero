import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { t, type JointType } from '@kitc/core';
import { JOINT_ABOUT, JOINT_DRAWING, TERMS, type TermId } from './terms';
import styles from './Help.module.css';

/** Ancho de la tarjeta y margen con el borde de la pantalla, en píxeles. */
const CARD = 280;
const EDGE = 12;

/**
 * Botón "?" junto a una palabra de taller: abre una tarjeta con una frase y un dibujo. Se cierra con
 * Escape, tocando afuera o con el mismo botón. La tarjeta se ubica debajo del botón sin salirse de la
 * pantalla, también en el teléfono.
 */
export function HelpTip({ term }: { term: TermId }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const info = TERMS[term];

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const place = () => {
      const r = button.current!.getBoundingClientRect();
      const left = Math.min(Math.max(EDGE, r.left + r.width / 2 - CARD / 2), window.innerWidth - CARD - EDGE);
      const h = card.current?.offsetHeight ?? 0;
      // Abajo si entra; si no, arriba del botón.
      const below = r.bottom + 6;
      const top = below + h > window.innerHeight - EDGE && r.top - 6 - h > EDGE ? r.top - 6 - h : below;
      setAt({ left: Math.max(EDGE, left), top });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!card.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.tip}
        aria-label={t('Qué es: {term}', { term: t(info.title) })}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && (
        <div
          ref={card}
          id={id}
          role="dialog"
          aria-label={t(info.title)}
          className={styles.card}
          style={at ? { left: at.left, top: at.top, width: CARD } : { visibility: 'hidden', width: CARD }}
        >
          {info.drawing}
          <strong>{t(info.title)}</strong>
          <p>{t(info.text)}</p>
        </div>
      )}
    </>
  );
}

/** Dibujo y explicación del encastre elegido, siempre a la vista: para elegir sin saber los nombres. */
export function JointExplainer({ type }: { type: JointType }) {
  const about = JOINT_ABOUT[type];
  if (!about) return null;
  return (
    <div className={styles.explainer} aria-live="polite">
      {JOINT_DRAWING[type]}
      <p>{t(about)}</p>
    </div>
  );
}

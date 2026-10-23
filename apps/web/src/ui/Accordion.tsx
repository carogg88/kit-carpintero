import { useId, useState, type ReactNode } from 'react';
import { t } from '@kitc/core';
import styles from './Accordion.module.css';

/**
 * Sección que se pliega: el título y un resumen siempre a la vista, el contenido al tocar. Sirve para que una
 * pantalla larga entre entera y se abra solo lo que se está usando. `done` le pone el tilde de sección completa; sin `done`, no hay círculo.
 */
export function Accordion({
  title,
  summary,
  meta,
  done,
  open: controlled,
  defaultOpen = false,
  onToggle,
  variant = 'card',
  level = 3,
  children,
}: {
  title: ReactNode;
  summary?: ReactNode;
  /** A la derecha del título, antes de la flecha: "1 de 2", una cuenta. */
  meta?: ReactNode;
  done?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** `card`: cada sección en su recuadro; `line`: separadas por una línea, para dentro de un panel. */
  variant?: 'card' | 'line';
  level?: 2 | 3;
  children: ReactNode;
}) {
  const id = useId();
  const [own, setOwn] = useState(defaultOpen);
  const open = controlled ?? own;
  const toggle = () => {
    if (controlled === undefined) setOwn(!open);
    onToggle?.(!open);
  };
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section className={styles.accordion} data-variant={variant} data-open={open || undefined}>
      <Heading className={styles.head}>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={toggle}>
          <span className={styles.mark} data-done={done || undefined} data-none={done === undefined || undefined} aria-hidden="true">
            {done && (
              <svg viewBox="0 0 16 16">
                <path d="m3.5 8.5 3 3 6-6.5" />
              </svg>
            )}
          </span>
          <span className={styles.title}>
            {title}
            {done && <span className={styles.srOnly}> · {t('completa')}</span>}
          </span>
          {summary !== undefined && <span className={styles.summary}>{summary}</span>}
          {meta !== undefined && <span className={styles.meta}>{meta}</span>}
          <svg className={styles.chevron} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </Heading>
      <div id={id} className={styles.body} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

import { useEffect, useRef } from 'react';
import { t } from '@kitc/core';
import { ghostDiff } from './ghost';
import { useEditor } from './store';
import styles from './Editor.module.css';

/**
 * Vista previa de un cambio grande (medidas del mueble, duplicar, del otro lado, borrar): el modelo muestra en
 * fantasma cómo queda y nada cambia hasta tocar Aplicar. Escape cancela.
 */
export function PreviewBar() {
  const pending = useEditor((s) => s.pending);
  const project = useEditor((s) => s.project);
  const ghost = useEditor((s) => s.ghost);
  const { applyPending, cancelPending } = useEditor.getState();
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pending) return;
    // Escape cancela desde el atajo del editor; Enter, con el foco acá, aplica.
    okRef.current?.focus({ preventScroll: true });
  }, [pending]);
  if (!pending || !project) return null;
  const ids = new Set(project.parts.map((p) => p.id));
  const added = ghost ? ghost.parts.filter((p) => !ids.has(p.id)).length : 0;
  const { changed, removed } = ghostDiff(project, ghost);
  const moved = changed.length - added;
  const summary = [
    added && (added === 1 ? t('1 pieza nueva') : t('{n} piezas nuevas', { n: added })),
    moved > 0 && (moved === 1 ? t('1 pieza cambia') : t('{n} piezas cambian', { n: moved })),
    removed.length && (removed.length === 1 ? t('1 pieza se borra') : t('{n} piezas se borran', { n: removed.length })),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className={styles.previewBar} role="dialog" aria-label={t('Vista previa')} aria-describedby="vista-previa-texto">
      <div className={styles.previewText} id="vista-previa-texto">
        <span className={styles.previewEyebrow}>{t('Vista previa')}</span>
        <strong>{pending.title}</strong>
        {summary && <span className={styles.previewSummary}>{summary}</span>}
      </div>
      <div className={styles.previewActions}>
        <button type="button" className={styles.previewCancel} onClick={cancelPending}>
          {t('Cancelar')}
        </button>
        <button ref={okRef} type="button" className={removed.length && !changed.length ? styles.previewDanger : styles.previewOk} onClick={applyPending}>
          {removed.length && !changed.length ? t('Borrar') : t('Aplicar')}
        </button>
      </div>
    </div>
  );
}

import { t } from '@kitc/core';
import { IconEye, IconEyeOff, IconSolo } from './icons';
import { useEditor } from './store';
import styles from './Editor.module.css';

/**
 * Ocultar piezas en la vista 3D, para trabajar una sola sin que las demás tapen. Es solo de la vista: el proyecto,
 * los cortes y el plano siguen con todas.
 */

/** Vuelve a encuadrar con lo que quedó a la vista. */
const reframe = () => {
  const s = useEditor.getState();
  s.setView(s.view);
};

export function hidePart(id: string) {
  const s = useEditor.getState();
  s.setHidden([...s.hidden, id]);
}

export function showPart(id: string) {
  const s = useEditor.getState();
  s.setHidden(s.hidden.filter((h) => h !== id));
}

/** Deja a la vista solo esta pieza; si ya estaba sola, vuelve a mostrar todo. */
export function soloPart(id: string) {
  const s = useEditor.getState();
  const others = s.project?.parts.filter((p) => p.id !== id).map((p) => p.id) ?? [];
  if (isSolo(s.hidden, others.length, id)) s.setHidden([]);
  else {
    s.setHidden(others);
    s.select(id);
  }
  reframe();
}

export function showAll() {
  useEditor.getState().setHidden([]);
  reframe();
}

const isSolo = (hidden: readonly string[], others: number, id: string) => others > 0 && hidden.length === others && !hidden.includes(id);

/** Ocultar y Ver sola, junto al nombre de la pieza elegida. */
export function PartViewButtons({ id }: { id: string }) {
  const hidden = useEditor((s) => s.hidden);
  const count = useEditor((s) => s.project?.parts.length ?? 0);
  const solo = isSolo(hidden, count - 1, id);
  return (
    <span className={styles.viewBtns} data-tour="part-view">
      <button type="button" aria-label={t('Ocultar {id} (H)', { id })} title={t('Ocultar {id} (H)', { id })} onClick={() => hidePart(id)}>
        <IconEyeOff />
      </button>
      {count > 1 && (
        <button type="button" aria-pressed={solo} aria-label={t('Ver {id} sola (S)', { id })} title={solo ? t('Mostrar todo (S)') : t('Ver {id} sola (S)', { id })} onClick={() => soloPart(id)}>
          <IconSolo />
        </button>
      )}
    </span>
  );
}

/** Ojo de cada pieza en la lista del mueble. */
export function EyeToggle({ id }: { id: string }) {
  const off = useEditor((s) => s.hidden.includes(id));
  const label = off ? t('Mostrar {id}', { id }) : t('Ocultar {id}', { id });
  return (
    <button type="button" className={styles.eye} aria-pressed={off} aria-label={label} title={label} onClick={() => (off ? showPart(id) : hidePart(id))}>
      {off ? <IconEyeOff /> : <IconEye />}
    </button>
  );
}

/** Aviso en la vista cuando hay piezas ocultas, con Mostrar todo. */
export function HiddenPill() {
  const hidden = useEditor((s) => s.hidden);
  const parts = useEditor((s) => s.project?.parts);
  const shown = parts?.filter((p) => !hidden.includes(p.id)) ?? [];
  const count = parts?.filter((p) => hidden.includes(p.id)).length ?? 0;
  if (!count) return null;
  const text =
    shown.length === 1 ? t('Viendo {id} sola', { id: shown[0]!.id }) : count === 1 ? t('1 pieza oculta') : t('{n} piezas ocultas', { n: count });
  return (
    <span className={styles.hiddenPill} role="status">
      <IconEyeOff />
      <span>{text}</span>
      <button type="button" onClick={showAll}>
        {t('Mostrar todo')}
      </button>
    </span>
  );
}

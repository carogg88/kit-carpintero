import { t } from '@kitc/core';
import { IconEye, IconEyeOff, IconGroup, IconSolo } from './icons';
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

export function hidePart(id: string | string[]) {
  const s = useEditor.getState();
  s.setHidden([...s.hidden, ...[id].flat()]);
}

/** Deja a la vista solo estas piezas; si ya estaban solas, vuelve a mostrar todo. */
export function soloPart(id: string | string[]) {
  const s = useEditor.getState();
  const ids = [id].flat();
  const others = s.project?.parts.filter((p) => !ids.includes(p.id)).map((p) => p.id) ?? [];
  if (isSolo(s.hidden, others.length, ids)) s.setHidden([]);
  else {
    s.setHidden(others);
    s.pick(ids);
  }
  reframe();
}

export function showAll() {
  useEditor.getState().setHidden([]);
  reframe();
}

const isSolo = (hidden: readonly string[], others: number, ids: readonly string[]) => others > 0 && hidden.length === others && !ids.some((id) => hidden.includes(id));

/** Ocultar y Ver sola, junto al nombre de la pieza elegida. Con varias (un grupo), las oculta o las deja solas a todas. */
export function PartViewButtons({ id, name }: { id: string | string[]; name?: string }) {
  const hidden = useEditor((s) => s.hidden);
  const count = useEditor((s) => s.project?.parts.length ?? 0);
  const ids = [id].flat();
  const solo = isSolo(hidden, count - ids.length, ids);
  const many = ids.length > 1;
  const who = name ?? ids.join(', ');
  const hide = t('Ocultar {id} (H)', { id: who });
  const alone = many ? t('Ver {id} solas (S)', { id: who }) : t('Ver {id} sola (S)', { id: who });
  return (
    <span className={styles.viewBtns} data-tour="part-view">
      <button type="button" aria-label={hide} title={hide} onClick={() => hidePart(ids)}>
        <IconEyeOff />
      </button>
      {count > ids.length && (
        <button type="button" aria-pressed={solo} aria-label={alone} title={solo ? t('Mostrar todo (S)') : alone} onClick={() => soloPart(ids)}>
          <IconSolo />
        </button>
      )}
    </span>
  );
}

/** Ojo de cada pieza (o de cada grupo, con `ids`) en la lista del mueble. */
export function EyeToggle({ id, ids = [id], name = id }: { id: string; ids?: string[]; name?: string }) {
  const off = useEditor((s) => ids.every((x) => s.hidden.includes(x)));
  const label = off ? t('Mostrar {id}', { id: name }) : t('Ocultar {id}', { id: name });
  return (
    <button
      type="button"
      className={styles.eye}
      aria-pressed={off}
      aria-label={label}
      title={label}
      onClick={() => {
        if (!off) return hidePart(ids);
        const s = useEditor.getState();
        s.setHidden(s.hidden.filter((h) => !ids.includes(h)));
      }}
    >
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

/**
 * Elegir varias: cada toque en el modelo suma o saca una pieza, como Shift + clic en la compu. En el celular es
 * la única forma de juntar piezas para agruparlas.
 */
export function PickPill() {
  const on = useEditor((s) => s.addMode);
  const some = useEditor((s) => !!s.selectedId || s.picked.length > 0);
  const setAddMode = useEditor((s) => s.setAddMode);
  if (on)
    return (
      <span className={styles.hiddenPill} role="status">
        <IconGroup />
        <span>{t('Tocá piezas para sumar')}</span>
        <button type="button" onClick={() => setAddMode(false)}>
          {t('Listo')}
        </button>
      </span>
    );
  if (!some) return null;
  return (
    <button type="button" className={styles.pickPill} title={t('También con Shift + clic')} onClick={() => setAddMode(true)}>
      <IconGroup />
      {t('Elegir varias')}
    </button>
  );
}

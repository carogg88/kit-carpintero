import { useState } from 'react';
import { formatLength, newBevel, parseLength, partAxesBySize, t, tk, type Part } from '@kitc/core';
import { IconClose } from './icons';
import { useEditor } from './store';
import styles from './Editor.module.css';

const DIM_LABELS = [tk('Largo'), tk('Ancho'), tk('Espesor')] as const;

/**
 * Burbuja junto a la pieza, donde se soltó el arrastre: muestra la medida que quedó y deja escribir la exacta.
 * Sirve para Estirar (el largo, ancho o espesor de esa cara) y para Biselar (el bisel o el radio).
 * `docked`: en el celular va dentro de la tarjeta de pasos, donde no tapa la pieza ni el dedo.
 */
export function MeasureBubble({ docked = false }: { docked?: boolean }) {
  const bubble = useEditor((s) => s.bubble);
  const project = useEditor((s) => s.project);
  const { commit, setBubble } = useEditor.getState();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState(bubble);
  // Una burbuja nueva arranca vacía.
  if (shownFor !== bubble) {
    setShownFor(bubble);
    setText('');
    setError(null);
  }
  if (!bubble || !project) return null;
  const { target } = bubble;
  const part = project.parts.find((p) => p.id === target.id);
  if (!part || part.base.kind !== 'box') return null;
  const units = project.units;
  const bevel = target.kind === 'bevel' ? part.bevels.find((b) => b.id === target.bevelId) : undefined;
  if (target.kind === 'bevel' && !bevel) return null;
  const current = target.kind === 'push' ? part.base.size[target.axis] : bevel!.da;
  const label = target.kind === 'push' ? t(DIM_LABELS[partAxesBySize(part).indexOf(target.axis)]!) : bevel!.round ? t('Radio') : t('Bisel');

  const apply = () => {
    const v = parseLength(text, units);
    if (v === null || v < (target.kind === 'push' ? 3 : 1)) return setError(t('Medida no válida'));
    if (target.kind === 'push') {
      const dim = t(DIM_LABELS[partAxesBySize(part).indexOf(target.axis)]!).toLowerCase();
      commit((d) => {
        const q = d.parts.find((p) => p.id === target.id);
        if (!q || q.base.kind !== 'box') return;
        const max = q.position[target.axis] + q.base.size[target.axis];
        if (target.sign < 0) q.position[target.axis] = max - v;
        q.base.size[target.axis] = v;
      }, t('{id} ahora mide {size} de {dim}', { id: part.id, size: formatLength(v, units), dim }));
    } else {
      commit((d) => {
        const q = d.parts.find((p) => p.id === target.id);
        const i = q?.bevels.findIndex((b) => b.id === target.bevelId) ?? -1;
        if (!q || i < 0) return;
        const old = q.bevels[i]!;
        q.bevels[i] = { ...newBevel(q as Part, old.a, old.b, v, old.round), id: old.id };
      });
    }
    setBubble(null);
  };

  const id = docked ? 'medida-celu' : 'medida';
  return (
    <form
      className={docked ? styles.bubbleDocked : styles.bubble}
      style={docked ? undefined : { left: `clamp(8px, ${bubble.x - 110}px, calc(100% - 228px))`, top: `clamp(56px, ${bubble.y - 76}px, calc(100% - 136px))` }}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onKeyDown={(e) => e.key === 'Escape' && setBubble(null)}
    >
      <label htmlFor={id}>
        {label} <span className={styles.bubbleId}>{part.id}</span>
      </label>
      <div className={styles.bubbleRow}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={formatLength(current, units)}
          value={text}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className={styles.bubbleOk} disabled={!text.trim()}>
          {t('Aplicar')}
        </button>
        <button type="button" className={styles.bubbleClose} aria-label={t('Cerrar')} onClick={() => setBubble(null)}>
          <IconClose />
        </button>
      </div>
      {error && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </span>
      )}
    </form>
  );
}

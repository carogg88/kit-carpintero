import { useState } from 'react';
import { depthUnder, formatLength, formatNumber, newBevel, parseLength, partAxesBySize, t, tk, type Part } from '@kitc/core';
import { IconClose } from './icons';
import { useEditor } from './store';
import styles from './Editor.module.css';

const DIM_LABELS = [tk('Largo'), tk('Ancho'), tk('Espesor')] as const;

/**
 * Burbuja junto a la pieza, donde se soltó el arrastre: muestra la medida que quedó y deja escribir la exacta.
 * Sirve para Estirar (el largo, ancho o espesor de esa cara), para Biselar (el bisel o el radio) y para Dibujar:
 * ahí se elige si lo dibujado es un vaciado o un calado y qué tan hondo baja.
 * `docked`: en el celular va dentro de la tarjeta de pasos, donde no tapa la pieza ni el dedo.
 */
export function MeasureBubble({ docked = false }: { docked?: boolean }) {
  const bubble = useEditor((s) => s.bubble);
  const project = useEditor((s) => s.project);
  const { commit, setBubble } = useEditor.getState();
  // null: sin tocar, el campo muestra la medida que quedó.
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState(bubble);
  if (shownFor !== bubble) {
    setShownFor(bubble);
    setText(null);
    setError(null);
  }
  if (!bubble || !project) return null;
  const { target } = bubble;
  const part = project.parts.find((p) => p.id === target.id);
  if (!part || part.base.kind !== 'box') return null;
  const units = project.units;
  const bevel = target.kind === 'bevel' ? part.bevels.find((b) => b.id === target.bevelId) : undefined;
  const pocket = target.kind === 'pocket' ? part.pockets.find((p) => p.id === target.pocketId) : undefined;
  if ((target.kind === 'bevel' && !bevel) || (target.kind === 'pocket' && !pocket)) return null;
  const thick = pocket ? depthUnder(part, pocket.axis) : 0;
  const current = target.kind === 'push' ? part.base.size[target.axis] : bevel ? bevel.da : pocket!.depth;
  const label =
    target.kind === 'push' ? t(DIM_LABELS[partAxesBySize(part).indexOf(target.axis)]!) : bevel ? (bevel.round ? t('Radio') : t('Bisel')) : t('Profundidad');

  const setThrough = (through: boolean) =>
    commit((d) => {
      const q = d.parts.find((p) => p.id === target.id)?.pockets.find((p) => target.kind === 'pocket' && p.id === target.pocketId);
      if (q) q.through = through;
    });

  const apply = () => {
    // Sin cambios, el botón dice Listo y solo cierra.
    if (text === null || text.trim() === formatNumber(current, units)) return setBubble(null);
    const v = parseLength(text, units);
    const min = target.kind === 'push' ? 3 : target.kind === 'bevel' ? 1 : 0.5;
    if (v === null || v < min) return setError(t('Medida no válida'));
    if (target.kind === 'push') {
      const dim = t(DIM_LABELS[partAxesBySize(part).indexOf(target.axis)]!).toLowerCase();
      commit((d) => {
        const q = d.parts.find((p) => p.id === target.id);
        if (!q || q.base.kind !== 'box') return;
        const max = q.position[target.axis] + q.base.size[target.axis];
        if (target.sign < 0) q.position[target.axis] = max - v;
        q.base.size[target.axis] = v;
      }, t('{id} ahora mide {size} de {dim}', { id: part.id, size: formatLength(v, units), dim }));
    } else if (target.kind === 'bevel') {
      commit((d) => {
        const q = d.parts.find((p) => p.id === target.id);
        const i = q?.bevels.findIndex((b) => b.id === target.bevelId) ?? -1;
        if (!q || i < 0) return;
        const old = q.bevels[i]!;
        q.bevels[i] = { ...newBevel(q as Part, old.a, old.b, v, old.round), id: old.id };
      });
    } else {
      if (v >= thick) return setError(t('Tiene que ser menos que el espesor ({size})', { size: formatLength(thick, units) }));
      commit((d) => {
        const q = d.parts.find((p) => p.id === target.id)?.pockets.find((p) => p.id === target.pocketId);
        if (q) q.depth = v;
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
      {pocket && (
        <div className={styles.bubbleHead}>
          <div className={styles.segmented} role="group" aria-label={t('Qué se saca')}>
            <button type="button" aria-pressed={!pocket.through} onClick={() => setThrough(false)}>
              {t('Vaciado')}
            </button>
            <button type="button" aria-pressed={pocket.through} onClick={() => setThrough(true)}>
              {t('Calado')}
            </button>
          </div>
          <span className={styles.bubbleId}>{pocket.id}</span>
          {pocket.through && (
            <button type="button" className={styles.bubbleClose} aria-label={t('Cerrar')} onClick={() => setBubble(null)}>
              <IconClose />
            </button>
          )}
        </div>
      )}
      {pocket?.through ? (
        <span className={styles.bubbleHint}>
          {t('Atraviesa los {size} de la pieza', { size: formatLength(thick, units) })}
        </span>
      ) : (
        <>
          <label htmlFor={id}>
            {label} {!pocket && <span className={styles.bubbleId}>{part.id}</span>}{' '}
            <span className={styles.bubbleId}>{units === 'cm' ? 'cm' : t('pulg.')}</span>
          </label>
          <div className={styles.bubbleRow}>
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              value={text ?? formatNumber(current, units)}
              onFocus={(e) => e.currentTarget.select()}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
            />
            <button type="submit" className={styles.bubbleOk}>
              {text === null || text.trim() === formatNumber(current, units) ? t('Listo') : t('Aplicar')}
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
        </>
      )}
    </form>
  );
}

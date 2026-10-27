import { useState } from 'react';
import { depthUnder, formatNumber, parseLength, t, type Pocket } from '@kitc/core';
import { throughByShape } from './drawCut';
import { useEditor } from './store';
import styles from './Editor.module.css';

/** La figura recién dibujada, si es la que muestra la burbuja: lo que se elige acá le llega también a ella. */
function useJustDrawn(): { partId: string; pocket: Pocket } | null {
  const bubble = useEditor((s) => s.bubble);
  const project = useEditor((s) => s.project);
  if (bubble?.target.kind !== 'pocket' || !project) return null;
  const { id, pocketId } = bubble.target;
  const pocket = project.parts.find((p) => p.id === id)?.pockets.find((p) => p.id === pocketId);
  return pocket ? { partId: id, pocket } : null;
}

/**
 * Dibujar: qué se saca, elegido antes de dibujar. Calado o vaciado y, si es vaciado, qué tan hondo. Si se acaba de
 * dibujar una figura, el cambio le llega a ella; la próxima sale igual.
 */
export function CutPick() {
  const drawShape = useEditor((s) => s.drawShape);
  const chosen = useEditor((s) => s.drawThrough);
  const depth = useEditor((s) => s.drawDepth);
  const drawFace = useEditor((s) => s.drawFace);
  const project = useEditor((s) => s.project);
  const pathPoints = useEditor((s) => s.pathPoints);
  const drawn = useJustDrawn();
  // Sólo si sigue con la misma figura y no empezó otra: si no, el cambio es para la próxima.
  const just = drawn && drawn.pocket.shape.kind === drawShape && !pathPoints.length ? drawn : null;
  const { setDrawCut, commit } = useEditor.getState();
  const [text, setText] = useState<string | null>(null);
  const units = project?.units ?? 'cm';
  const part = project?.parts.find((p) => p.id === (just?.partId ?? drawFace?.partId));
  const axis = just?.pocket.axis ?? drawFace?.axis;
  const thick = part && axis !== undefined && part.base.kind === 'box' ? depthUnder(part, axis) : null;
  const through = just ? just.pocket.through : (chosen ?? throughByShape(drawShape));
  // El hondo que va a tener: el elegido, el de la figura recién hecha, o la mitad del espesor.
  const shownDepth = just && !just.pocket.through ? just.pocket.depth : (depth ?? (thick ? Math.round(thick) / 2 : null));

  const toJust = (recipe: (p: Pocket) => void, label: string) =>
    just &&
    commit((d) => {
      const q = d.parts.find((p) => p.id === just.partId)?.pockets.find((p) => p.id === just.pocket.id);
      if (q) recipe(q as Pocket);
    }, label);
  const pick = (on: boolean) => {
    setDrawCut(on);
    toJust((p) => void (p.through = on), on ? t('{id} ahora es un calado', { id: just?.pocket.id ?? '' }) : t('{id} ahora es un vaciado', { id: just?.pocket.id ?? '' }));
  };
  const commitDepth = () => {
    if (text === null) return;
    const mm = parseLength(text, units);
    setText(null);
    if (mm === null || mm < 0.5) return;
    const v = thick ? Math.min(mm, thick - 0.5) : mm;
    setDrawCut(false, v);
    toJust((p) => void (p.depth = v), t('{id} ahora baja {size}', { id: just?.pocket.id ?? '', size: formatNumber(v, units) + (units === 'cm' ? ' cm' : '″') }));
  };

  return (
    <>
      <div className={`${styles.shapes} ${styles.cutPick}`} role="group" aria-label={t('Qué se saca')}>
        <button type="button" aria-pressed={through} title={t('Calado: atraviesa la pieza')} onClick={() => pick(true)}>
          {t('Calado')}
        </button>
        <button type="button" aria-pressed={!through} title={t('Vaciado: baja hasta un hondo')} onClick={() => pick(false)}>
          {t('Vaciado')}
        </button>
      </div>
      {!through && (
        <label className={styles.cutDepth}>
          {t('Hondo')}
          <input
            inputMode="decimal"
            autoComplete="off"
            value={text ?? (shownDepth !== null ? formatNumber(shownDepth, units) : '')}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitDepth}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
          <span aria-hidden="true">{units === 'cm' ? 'cm' : '″'}</span>
        </label>
      )}
    </>
  );
}

/** Perfil a mano abierto: cuál de los dos lados se saca. Mientras se marca, o recién terminado. */
export function FlipSide() {
  const pathPoints = useEditor((s) => s.pathPoints);
  const flip = useEditor((s) => s.pathFlip);
  const draft = useEditor((s) => s.draft);
  const just = useJustDrawn();
  const { setPathFlip, setDraft, commit } = useEditor.getState();
  const drawing = pathPoints.length > 0;
  const placed = !drawing && just?.pocket.shape.kind === 'path' && !just.pocket.shape.closed ? just : null;
  if (!drawing && !placed) return null;
  const on = placed ? placed.pocket.shape.kind === 'path' && placed.pocket.shape.flip : flip;
  const toggle = () => {
    if (placed) {
      return commit((d) => {
        const q = d.parts.find((p) => p.id === placed.partId)?.pockets.find((p) => p.id === placed.pocket.id);
        if (q?.shape.kind === 'path') q.shape.flip = !q.shape.flip;
      }, t('Cambiaste el lado que saca {id}', { id: placed.pocket.id }));
    }
    setPathFlip(!flip);
    if (draft?.shape.kind === 'path') setDraft({ ...draft, shape: { ...draft.shape, flip: !flip } });
  };
  return (
    <button type="button" className={styles.guideToggle} aria-pressed={on} title={t('Sacar el otro lado del perfil')} onClick={toggle}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" />
      </svg>
      {t('Otro lado')}
    </button>
  );
}

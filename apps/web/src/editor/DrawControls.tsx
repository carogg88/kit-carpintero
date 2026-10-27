import { useRef, useState } from 'react';
import { CORNER_KINDS, depthUnder, formatNumber, parseLength, partSizeName, otherAxes, t, tk, type CornerKind, type Pocket } from '@kitc/core';
import { faceSize, placeCorner, savedKind, showCorner, throughByShape } from './drawCut';
import { IconCornerChamfer, IconCornerCove, IconCornerOgee, IconCornerRound, IconCornerStep, IconImage } from './icons';
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
  const just = drawn && drawn.pocket.shape.kind === savedKind(drawShape) && !pathPoints.length ? drawn : null;
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

const CORNER_LOOK: Record<CornerKind, { label: string; icon: () => React.ReactNode }> = {
  redondeo: { label: tk('Redondeo'), icon: IconCornerRound },
  chaflan: { label: tk('Chaflán'), icon: IconCornerChamfer },
  escalon: { label: tk('Escalón'), icon: IconCornerStep },
  concavo: { label: tk('Cóncavo'), icon: IconCornerCove },
  gola: { label: tk('Gola'), icon: IconCornerOgee },
};

const SIZE_LABEL = { largo: tk('Largo'), ancho: tk('Ancho'), espesor: tk('Espesor') } as const;

/** Una medida de la esquina: se escribe y se ve al salir del campo (o con Enter). */
function CornerSize({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (mm: number) => void }) {
  const units = useEditor((s) => s.project?.units ?? 'cm');
  const [text, setText] = useState<string | null>(null);
  const done = () => {
    if (text === null) return;
    const mm = parseLength(text, units);
    setText(null);
    if (mm !== null && mm >= 1) onChange(Math.min(mm, max));
  };
  return (
    <label className={styles.cutDepth}>
      {label}
      <input
        inputMode="decimal"
        autoComplete="off"
        value={text ?? formatNumber(value, units)}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setText(e.target.value)}
        onBlur={done}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span aria-hidden="true">{units === 'cm' ? 'cm' : '″'}</span>
    </label>
  );
}

/**
 * Forma de esquina, después de tocar la esquina: la forma y cuánto toma por cada borde. Lo que se elige se ve ya en
 * la cara y en "Así queda"; el corte se hace con el botón.
 */
export function CornerRow() {
  const pick = useEditor((s) => s.cornerPick);
  const face = useEditor((s) => s.drawFace);
  const part = useEditor((s) => s.project?.parts.find((p) => p.id === s.cornerPick?.partId));
  if (!pick || !face || !part || face.partId !== pick.partId || face.axis !== pick.axis || face.side !== pick.side) return null;
  const [w, h] = faceSize(part, pick);
  const [ua, va] = otherAxes(pick.axis);
  const set = (patch: Partial<typeof pick>) => showCorner({ ...pick, ...patch });
  return (
    <div className={styles.cornerRow}>
      <div className={styles.shapes} role="group" aria-label={t('Forma de la esquina')}>
        {CORNER_KINDS.map((k) => {
          const Icon = CORNER_LOOK[k].icon;
          return (
            <button key={k} type="button" aria-pressed={pick.kind === k} title={t(CORNER_LOOK[k].label)} onClick={() => set({ kind: k })}>
              <Icon />
              <span>{t(CORNER_LOOK[k].label)}</span>
            </button>
          );
        })}
      </div>
      <CornerSize label={t(SIZE_LABEL[partSizeName(part, ua)])} value={pick.a} max={w} onChange={(a) => set({ a })} />
      <CornerSize label={t(SIZE_LABEL[partSizeName(part, va)])} value={pick.b} max={h} onChange={(b) => set({ b })} />
      <button type="button" className={styles.cornerGo} onClick={placeCorner}>
        {t('Cortar la esquina')}
      </button>
    </div>
  );
}

/**
 * Calcar: una foto o un dibujo puesto sobre la cara, medio transparente, para seguirlo con el perfil. Ocupa toda la
 * cara (conviene recortar la foto al contorno de la pieza). Queda mientras se usa la app; no va al archivo.
 */
export function TraceButton() {
  const face = useEditor((s) => s.drawFace);
  const img = useEditor((s) => s.traceImage);
  const input = useRef<HTMLInputElement>(null);
  if (!face) return null;
  const here = !!img && img.partId === face.partId && img.axis === face.axis && img.side === face.side;
  const { setTraceImage, warn } = useEditor.getState();
  const load = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return warn(t('Eso no es una imagen: elegí una foto o un dibujo'));
    setTraceImage(null);
    setTraceImage({ ...face, url: URL.createObjectURL(file), name: file.name });
  };
  return (
    <>
      <button
        type="button"
        className={styles.guideToggle}
        aria-pressed={here}
        title={here ? t('Sacar la foto de la cara') : t('Poner una foto o un dibujo sobre la cara para calcarlo')}
        onClick={() => (here ? setTraceImage(null) : input.current?.click())}
      >
        <IconImage />
        {here ? t('Sacar foto') : t('Calcar foto')}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          load(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );
}

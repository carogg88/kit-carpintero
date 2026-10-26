import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { t, tk } from '@kitc/core';
import { useEditor } from '../editor/store';
import styles from './Tour.module.css';

/**
 * Un paso del recorrido: qué se ilumina (`target`, el valor de un `data-tour`), qué se dice y, si hace falta, qué
 * se prepara antes (elegir una pieza para que se vea su panel). Sin `target`, o si no está en la pantalla (en el
 * celular algunas cosas van en otro lado), la tarjeta va en el medio.
 */
export interface TourStep {
  target?: string;
  title: string;
  text: string;
  before?: () => void;
}

interface TourState {
  steps: TourStep[] | null;
  index: number;
  /** Lo que arranca cuando se abra el editor: el recorrido pedido desde el inicio, o un "Mostrame dónde está" de la ayuda. */
  queued: TourStep[] | null;
  start: (steps: TourStep[]) => void;
  go: (index: number) => void;
  end: () => void;
  queue: (steps: TourStep[]) => void;
}

export const useTour = create<TourState>()((set) => ({
  steps: null,
  index: 0,
  queued: null,
  start: (steps) => set({ steps, index: 0, queued: null }),
  go: (index) => set({ index }),
  end: () => set({ steps: null, index: 0 }),
  queue: (queued) => set({ queued }),
}));

const firstPart = () => useEditor.getState().project?.parts[0]?.id ?? null;
const selectFirst = () => {
  const id = firstPart();
  if (id) useEditor.getState().select(id);
};
const selectNone = () => useEditor.getState().select(null);

/** El recorrido completo del editor, pensado para el taburete pero sirve con cualquier mueble. */
export const EDITOR_TOUR: TourStep[] = [
  {
    title: tk('Tu taburete, listo para ajustar'),
    text: tk('Se armó con la plantilla, con todos sus encastres. En unos pasos te muestro dónde está cada cosa. Podés salir cuando quieras.'),
    before: selectNone,
  },
  {
    target: 'tools',
    title: tk('Herramientas'),
    text: tk('Elegir toca una pieza. Estirar le cambia una medida arrastrando una cara. Mover la corre: en Frente o Costado también sube y baja. Dibujar hace agujeros y calados.'),
  },
  {
    target: 'views',
    title: tk('Vistas'),
    text: tk('Mirá el mueble en 3D, de frente, de costado o desde arriba. El último botón encuadra todo el mueble si te perdiste.'),
  },
  {
    target: 'panel',
    title: tk('El panel del mueble'),
    text: tk('Con ninguna pieza elegida, el panel muestra las medidas de todo el mueble, la revisión del diseño y la lista de piezas.'),
    before: selectNone,
  },
  {
    target: 'part-pick',
    title: tk('La pieza elegida'),
    text: tk('Al tocar una pieza, el panel pasa a ser de esa pieza. Desde esta lista cambiás de pieza sin buscarla en el modelo.'),
    before: selectFirst,
  },
  {
    target: 'part-dims',
    title: tk('Medidas y posición'),
    text: tk('Escribí el número y apretá Enter. Mientras escribís, el modelo muestra en fantasma cómo va a quedar.'),
    before: selectFirst,
  },
  {
    target: 'part-actions',
    title: tk('Copiar y borrar'),
    text: tk('Duplicar, Del otro lado (la gemela reflejada) y Borrar muestran una vista previa: nada cambia hasta que tocás Aplicar.'),
    before: selectFirst,
  },
  {
    target: 'sections',
    title: tk('Uniones, Cortes, Plano y Armado'),
    text: tk('Uniones tiene cada encastre con sus medidas. Cortes, la lista de piezas, qué tablas comprar y el presupuesto. Plano, para imprimir. Armado, el paso a paso.'),
    before: selectNone,
  },
  {
    target: 'undo',
    title: tk('Deshacer'),
    text: tk('Cualquier cambio vuelve atrás con esta flecha o con Ctrl+Z. El proyecto se guarda solo en este dispositivo.'),
  },
  {
    target: 'help',
    title: tk('Centro de ayuda'),
    text: tk('Acá encontrás cómo funciona cada herramienta, paso a paso, y recetas cortas: unir dos piezas, hacer la pata gemela, agregar un cajón. Desde ahí también volvés a este recorrido.'),
  },
];

const PAD = 6;
const CARD_W = 320;
const EDGE = 12;

/** Ilumina un lugar de la pantalla con una tarjeta al lado: Anterior, Siguiente y Salir. Escape sale. */
export function TourOverlay() {
  const steps = useTour((s) => s.steps);
  const index = useTour((s) => s.index);
  const { go, end } = useTour.getState();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [card, setCard] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps?.[index];

  // Antes de iluminar, se prepara la pantalla (una pieza elegida, por ejemplo).
  useEffect(() => {
    step?.before?.();
    nextRef.current?.focus({ preventScroll: true });
  }, [step]);

  // El lugar se busca unos cuadros seguidos: el panel tarda en cambiar después de elegir una pieza.
  useLayoutEffect(() => {
    if (!step) return;
    let frame = 0;
    let n = 0;
    const find = () => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      // Un envoltorio con display: contents no tiene caja: se ilumina lo que tiene adentro.
      const box = el && el.getBoundingClientRect().width === 0 ? (el.firstElementChild as HTMLElement | null) : el;
      const r = box?.getBoundingClientRect();
      setRect(r && r.width > 0 && r.height > 0 ? r : null);
      if (n++ < 20) frame = requestAnimationFrame(find);
    };
    find();
    const onResize = () => {
      n = 0;
      find();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [step]);

  // La tarjeta va al costado con más lugar; si no entra, abajo o arriba; sin lugar iluminado, en el medio.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const w = Math.min(CARD_W, window.innerWidth - 2 * EDGE);
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) return setCard({ left: (vw - w) / 2, top: Math.max(EDGE, (vh - h) / 2) });
    const clampTop = (y: number) => Math.min(Math.max(EDGE, y), vh - h - EDGE);
    const clampLeft = (x: number) => Math.min(Math.max(EDGE, x), vw - w - EDGE);
    if (vw - rect.right - PAD >= w + 2 * EDGE) return setCard({ left: rect.right + PAD + EDGE, top: clampTop(rect.top) });
    if (rect.left - PAD >= w + 2 * EDGE) return setCard({ left: rect.left - PAD - EDGE - w, top: clampTop(rect.top) });
    if (vh - rect.bottom - PAD >= h + 2 * EDGE) return setCard({ left: clampLeft(rect.left), top: rect.bottom + PAD + EDGE });
    if (rect.top - PAD >= h + 2 * EDGE) return setCard({ left: clampLeft(rect.left), top: rect.top - PAD - EDGE - h });
    setCard({ left: clampLeft(rect.left), top: vh - h - EDGE });
  }, [rect, step]);

  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        end();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [steps, end]);

  if (!steps || !step) return null;
  const last = index === steps.length - 1;
  const hole = rect && { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD };
  return (
    <div className={styles.layer}>
      {/* El velo oscurece todo menos el lugar iluminado; tocarlo no hace nada, para no salir sin querer. */}
      {hole ? <div className={styles.hole} style={hole} /> : <div className={styles.veil} />}
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recorrido-titulo"
        aria-describedby="recorrido-texto"
        style={card ? { left: card.left, top: card.top, width: Math.min(CARD_W, window.innerWidth - 2 * EDGE) } : { visibility: 'hidden', width: CARD_W }}
      >
        <span className={styles.count}>{steps.length > 1 ? t('Paso {n} de {total}', { n: index + 1, total: steps.length }) : t('Mirá acá')}</span>
        <strong id="recorrido-titulo" className={styles.title}>
          {t(step.title)}
        </strong>
        <p id="recorrido-texto" className={styles.text}>
          {t(step.text)}
        </p>
        {steps.length > 1 && (
          <div className={styles.dots} aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} data-on={i === index || undefined} />
            ))}
          </div>
        )}
        <div className={styles.actions}>
          {steps.length > 1 ? (
            <button type="button" className={styles.skip} onClick={end}>
              {last ? t('Cerrar') : t('Salir')}
            </button>
          ) : (
            <span />
          )}
          <span className={styles.nav}>
            {index > 0 && (
              <button type="button" className={styles.back} onClick={() => go(index - 1)}>
                {t('Anterior')}
              </button>
            )}
            <button ref={nextRef} type="button" className={styles.next} onClick={() => (last ? end() : go(index + 1))}>
              {last ? t('Listo') : t('Siguiente')}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

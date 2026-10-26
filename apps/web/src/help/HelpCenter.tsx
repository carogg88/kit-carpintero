import { useEffect, useRef, useState } from 'react';
import { t, tk } from '@kitc/core';
import { Accordion } from '../ui/Accordion';
import { useEditor } from '../editor/store';
import { sectionHref } from '../routes';
import { EDITOR_TOUR, useTour, type TourStep } from './Tour';
import styles from './HelpCenter.module.css';

interface Recipe {
  id: string;
  title: string;
  steps: string[];
  /** Dónde está lo que se usa: "Mostrame dónde" lo ilumina. */
  show?: TourStep;
}

const pickFirst = () => {
  const s = useEditor.getState();
  const id = s.selectedId ?? s.project?.parts[0]?.id;
  if (id) s.select(id);
};

/** Recetas cortas para lo que más se busca, en el orden en que suele aparecer al armar un mueble. */
const RECIPES: Recipe[] = [
  {
    id: 'unir',
    title: tk('Unir dos piezas'),
    steps: [
      tk('Elegí la herramienta Mover.'),
      tk('Arrastrá la pieza hasta que toque la otra: se pega sola al borde y aparece la unión.'),
      tk('Para subirla o bajarla, poné la vista Frente o Costado y arrastrá.'),
      tk('Para dejarla justa, escribí la distancia en la burbuja que aparece al soltar.'),
    ],
    show: { target: 'tools', title: tk('Mover está acá'), text: tk('Es la tercera herramienta. También se elige con la tecla M.') },
  },
  {
    id: 'medir',
    title: tk('Medir entre piezas y centrar'),
    steps: [
      tk('Elegí Medir (tecla C; en el celular está en Más).'),
      tk('Tocá una pieza: ves cuánto le queda a cada lado dentro del mueble.'),
      tk('Tocá otra: ves cuánto las separa a lo ancho, a lo alto y de fondo. Si tocaste dos caras enfrentadas, también la distancia entre ellas.'),
      tk('Si una quedó corrida, Centrar la deja al medio.'),
    ],
    show: { target: 'tools', title: tk('Medir está acá'), text: tk('Es la última herramienta. También se elige con la tecla C.') },
  },
  {
    id: 'flechas',
    title: tk('Correr una pieza de a milímetro'),
    steps: [
      tk('Elegí la pieza.'),
      tk('Usá las flechas del teclado: cada toque la corre 1 mm, y con Shift, 10 mm.'),
      tk('Las flechas siguen la vista: en Frente corren a lo ancho y a lo alto; en Arriba, a lo ancho y hacia atrás o adelante.'),
      tk('Cuando apoya en otra pieza, la cara que se toca se ilumina.'),
    ],
  },
  {
    id: 'sola',
    title: tk('Trabajar una pieza sola'),
    steps: [
      tk('Elegí la pieza.'),
      tk('Arriba en el panel, tocá Ver sola (o la tecla S). Ocultar (o la tecla H) esconde solo esa.'),
      tk('En la lista de Piezas, el ojo de cada una la oculta o la muestra.'),
      tk('Para ver todo de nuevo, tocá Mostrar todo en la vista. Los cortes y el plano siempre llevan todas las piezas.'),
    ],
    show: { target: 'part-view', title: tk('Ver sola está acá'), text: tk('Al lado de la pieza elegida, arriba en el panel.'), before: pickFirst },
  },
  {
    id: 'gemela',
    title: tk('Hacer la pata gemela del otro lado'),
    steps: [tk('Elegí la pieza que ya está bien.'), tk('Tocá Del otro lado.'), tk('Mirá la vista previa y tocá Aplicar. La copia cambia de nombre sola: de izquierda a derecha, de delantera a trasera.')],
    show: { target: 'part-actions', title: tk('Del otro lado está acá'), text: tk('Al lado de Duplicar, en el panel de la pieza.'), before: pickFirst },
  },
  {
    id: 'altura',
    title: tk('Subir o bajar una pieza exacto'),
    steps: [tk('Elegí la pieza.'), tk('En Posición, escribí cuánto queda Del piso y apretá Enter.'), tk('Mientras escribís, el fantasma muestra dónde va a quedar.')],
    show: { target: 'part-dims', title: tk('Posición está acá'), text: tk('Debajo de las medidas de la pieza.'), before: pickFirst },
  },
  {
    id: 'calado',
    title: tk('Hacer un agujero o un calado'),
    steps: [
      tk('Elegí Dibujar y tocá la cara de la pieza.'),
      tk('Elegí círculo o rectángulo y arrastrá sobre la cara.'),
      tk('En la burbuja: Calado si atraviesa, Vaciado si no. Ahí escribís el diámetro (o el ancho y el alto) y la distancia a los bordes, o tocás Centrar.'),
    ],
    show: { target: 'tools', title: tk('Dibujar está acá'), text: tk('Es la cuarta herramienta. También se elige con la tecla D.') },
  },
  {
    id: 'medidas',
    title: tk('Cambiar el tamaño de todo el mueble'),
    steps: [tk('Tocá Ver el mueble para soltar la pieza elegida.'), tk('Abrí Medidas del mueble y escribí el ancho, el alto o el fondo.'), tk('Las piezas largas se estiran y las demás se corren. Mirá la vista previa y tocá Aplicar.')],
    show: { target: 'panel', title: tk('Medidas del mueble está acá'), text: tk('Arriba en el panel, con ninguna pieza elegida.'), before: () => useEditor.getState().select(null) },
  },
  {
    id: 'uniones',
    title: tk('Cambiar todas las espigas de un grupo'),
    steps: [tk('Andá a Uniones y elegí una unión del grupo.'), tk('Dejá tildado Aplicar a las uniones del grupo.'), tk('Cambiá el largo, el espesor o el hombro: vas a ver qué cambia en los cortes. Tocá Aplicar.')],
    show: { target: 'sections', title: tk('Uniones está acá'), text: tk('En las pestañas de arriba, al lado de Modelo.') },
  },
  {
    id: 'cajon',
    title: tk('Agregar un cajón, una puerta o estantes'),
    steps: [tk('Con ninguna pieza elegida, tocá Agregar pieza.'), tk('Elegí Cajón, Puerta o Estantes.'), tk('Tocá el hueco donde va y revisá las opciones. Se arma con sus uniones.')],
    show: { target: 'add', title: tk('Agregar pieza está acá'), text: tk('Abajo en el panel del mueble.'), before: () => useEditor.getState().select(null) },
  },
  {
    id: 'comprar',
    title: tk('Llevar la lista a la maderera'),
    steps: [tk('Andá a Cortes.'), tk('Arriba a la derecha dice cuántos pies de madera comprar y qué tablas.'), tk('Exportá la planilla o abrí el Modo taller en el celular para ir pieza por pieza.')],
    show: { target: 'sections', title: tk('Cortes está acá'), text: tk('En las pestañas de arriba.') },
  },
  {
    id: 'nombre',
    title: tk('Cambiar el nombre del proyecto'),
    steps: [tk('Tocá el nombre arriba, al lado del logo, y escribí el nuevo.'), tk('Apretá Enter para guardarlo, o Esc para dejarlo como estaba.'), tk('En el inicio, el menú ⋮ de cada proyecto también tiene Cambiar nombre.')],
  },
  {
    id: 'deshacer',
    title: tk('Deshacer un error'),
    steps: [tk('Tocá la flecha de Deshacer arriba a la derecha, o Ctrl+Z.'), tk('Rehacer vuelve a aplicar lo que deshiciste.')],
    show: { target: 'undo', title: tk('Deshacer está acá'), text: tk('Arriba a la derecha.') },
  },
];

/** Botón de Ayuda del editor: el recorrido guiado y las recetas. */
export function HelpButton({ className, iconClass }: { className?: string; iconClass?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const start = (steps: TourStep[]) => {
    setOpen(false);
    // Lo que se ilumina está en la pestaña Modelo: desde Uniones o Cortes, se vuelve ahí.
    const id = useEditor.getState().project?.id;
    if (id && location.hash !== sectionHref(id, 'modelo')) location.hash = sectionHref(id, 'modelo');
    setTimeout(() => useTour.getState().start(steps), 250);
  };
  return (
    <>
      <button type="button" className={className} data-tour="help" aria-label={t('Ayuda')} title={t('Ayuda: recorrido y recetas')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <svg className={iconClass} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17.2v.1" />
        </svg>
      </button>
      <dialog
        ref={ref}
        className={styles.dialog}
        aria-labelledby="ayuda-titulo"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        {open && (
          <div className={styles.body}>
            <div className={styles.head}>
              <h2 id="ayuda-titulo" className={styles.h2}>
                {t('Ayuda')}
              </h2>
              <button type="button" className={styles.close} aria-label={t('Cerrar')} onClick={() => setOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <button type="button" className={styles.tour} onClick={() => start(EDITOR_TOUR)}>
              <span className={styles.tourIcon} aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.5v13l10-6.5z" />
                </svg>
              </span>
              <span className={styles.tourText}>
                <strong>{t('Recorrido guiado')}</strong>
                <span>{t('{n} pasos por el editor: dónde está cada cosa y para qué sirve', { n: EDITOR_TOUR.length })}</span>
              </span>
            </button>
            <h3 className={styles.eyebrow}>{t('Recetas')}</h3>
            <div className={styles.recipes}>
              {RECIPES.map((r) => (
                <Accordion key={r.id} variant="line" title={t(r.title)}>
                  <ol className={styles.steps}>
                    {r.steps.map((s) => (
                      <li key={s}>{t(s)}</li>
                    ))}
                  </ol>
                  {r.show && (
                    <button type="button" className={styles.show} onClick={() => start([r.show!])}>
                      {t('Mostrame dónde')}
                    </button>
                  )}
                </Accordion>
              ))}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

import { tk } from '@kitc/core';
import { useEditor } from '../editor/store';
import type { TourStep } from './Tour';

/** Una receta corta del Centro de ayuda (tema "Cómo hacer…"): pasos y, si sirve, dónde está lo que se usa. */
export interface Recipe {
  id: string;
  title: string;
  steps: string[];
  /** Dónde está lo que se usa: "Mostrame dónde está" lo ilumina en el editor. */
  show?: TourStep;
}

const pickFirst = () => {
  const s = useEditor.getState();
  const id = s.selectedId ?? s.project?.parts[0]?.id;
  if (id) s.select(id);
};

/** Recetas cortas para lo que más se busca, en el orden en que suele aparecer al armar un mueble. */
export const RECIPES: Recipe[] = [
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
    id: 'medir-centrar',
    title: tk('Medir entre piezas y centrar'),
    steps: [
      tk('Elegí Medir (tecla C; en el celular está en Más).'),
      tk('Tocá una pieza: ves cuánto le queda a cada lado dentro del mueble.'),
      tk('Tocá otra: ves cuánto las separa a lo ancho, a lo alto y de fondo. Si tocaste dos caras enfrentadas, también la distancia entre ellas.'),
      tk('Si una quedó corrida, Centrar la deja al medio.'),
    ],
    show: { target: 'tools', title: tk('Medir está acá'), text: tk('Es la octava herramienta; en el celular, dentro de Más. También se elige con la tecla C.') },
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
    id: 'grupo',
    title: tk('Agrupar piezas para moverlas juntas'),
    steps: [
      tk('Tocá una pieza y después las otras con Shift + clic. En el celular, tocá Elegir varias y después cada pieza.'),
      tk('En el panel, tocá Agrupar (o la tecla G).'),
      tk('Desde ahí, un toque elige el grupo entero: se mueve, se corre con las flechas, se duplica, se oculta y se borra junto.'),
      tk('Con el grupo elegido, escribí el ancho, el alto o el fondo: las piezas largas se estiran, las demás se corren y el resto del mueble no se mueve.'),
      tk('Para editar una pieza sola, tocala otra vez. Desagrupar las deja sueltas donde están.'),
    ],
  },
  {
    id: 'gemela',
    title: tk('Hacer la pata gemela del otro lado'),
    steps: [tk('Elegí la pieza que ya está bien.'), tk('Tocá Del otro lado.'), tk('Mirá la vista previa y tocá Aplicar. La copia cambia de nombre sola: de izquierda a derecha, de delantera a trasera.')],
    show: { target: 'part-actions', title: tk('Del otro lado está acá'), text: tk('Al lado de Duplicar, en el panel de la pieza.'), before: pickFirst },
  },
  {
    id: 'girada',
    title: tk('Biselar las patas por afuera'),
    steps: [
      tk('Las patas iguales son un componente: lo que le hacés a una les llega a todas.'),
      tk('Para que el bisel quede afuera en cada una, girá la copia que corresponda con Girar 90°: gira solo esa.'),
      tk('Del otro lado ya hace la gemela reflejada. Desde ahí, un bisel nuevo en cualquier pata llega a cada una en su arista de afuera.'),
    ],
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
    id: 'cerca',
    title: tk('Ver un encastre de cerca'),
    steps: [
      tk('Elegí una pieza y abrí Uniones en su panel. La lupa de cada unión la abre de cerca.'),
      tk('Separar piezas saca la espiga de la caja para ver las dos.'),
      tk('Mientras escribís el largo o el espesor, el detalle ya muestra cómo queda.'),
    ],
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

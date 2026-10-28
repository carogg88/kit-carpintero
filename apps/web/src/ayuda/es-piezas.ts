import { img, key, list, note, p, steps, table, tip, type Article } from './types';

/** Tema "Piezas y mueble": el panel de la derecha y lo que se hace con piezas enteras. Su par en inglés es en-piezas.ts. */
export const ES_PARTS: Article[] = [
  {
    id: 'panel-pieza',
    topic: 'piezas',
    title: 'El panel de la pieza',
    summary: 'Medidas, posición, giro, espejo, madera, forma y uniones de la pieza elegida.',
    intro: [
      p('Cuando elegís una pieza, el panel de la derecha muestra todo lo de esa pieza, de arriba hacia abajo: cuál es, cuánto mide, dónde está, de qué madera es, su forma y con qué otras piezas se une. En el celular, el panel está debajo del modelo.'),
      img('panel-pieza', 'El panel de una pata elegida, marcado'),
    ],
    sections: [
      {
        id: 'arriba',
        title: 'Arriba: qué pieza es',
        blocks: [
          list(
            'La lista de arriba cambia de pieza sin tocar el modelo: sirve para piezas chicas o tapadas.',
            'Los dos botones de al lado ocultan la pieza o la dejan sola en la vista. Más información: [Ocultar y Ver sola](ocultar).',
            '**Ver el mueble** suelta la pieza y vuelve al panel del mueble.',
            'El nombre se cambia tocándolo. Si el nombre nuevo empieza con otra palabra, el código cambia con él: una pieza que pasa a llamarse "Listón…" queda con L.',
          ),
          note('Si la revisión del diseño encontró algo en esta pieza, el aviso aparece acá arriba, con qué hacer. Más información: [Revisión del diseño](revision).'),
        ],
      },
      {
        id: 'medidas',
        title: 'Medidas y posición',
        blocks: [
          steps(
            'En **Medidas terminadas**, escribí el ancho, el alto o el fondo. Mientras escribís, el modelo muestra en fantasma cómo queda.',
            'Apretá `Enter` o tocá afuera del campo para aplicarla.',
            'En **Posición**, escribí cuánto queda la pieza **Del piso**, **De la izquierda** y **De atrás**. Así se sube o se corre una pieza a la medida justa.',
          ),
          tip('Se escribe en la unidad del proyecto. En pulgadas se pueden escribir fracciones, como 2 7/8. Más información: [Unidades e idioma](unidades).'),
          note('Las medidas terminadas son las de la pieza armada. Las espigas, colas y lengüetas se suman solas al largo de corte, en la lista de cortes.'),
        ],
      },
      {
        id: 'girar',
        title: 'Girar 90°',
        blocks: [
          table(
            ['Botón', 'Qué hace'],
            ['**En el piso**', 'Gira la pieza un cuarto de vuelta apoyada como está: lo que iba a lo ancho pasa a ir de adelante hacia atrás.'],
            ['**Adelante**', 'La vuelca hacia adelante: lo de arriba pasa al frente.'],
            ['**Al costado**', 'La vuelca de costado: lo de arriba pasa a un lado.'],
          ),
          p('Al girar, los vaciados, biseles, tramos y el torneado giran con la pieza.'),
        ],
      },
      {
        id: 'espejar',
        title: 'Espejar',
        blocks: [
          p('**Espejar** da vuelta la pieza como vista en un espejo, sin moverla de su lugar. Lo dibujado pasa al otro lado: un calado cerca de la punta izquierda queda cerca de la derecha.'),
          table(
            ['Botón', 'Qué hace'],
            ['**↔ Horizontal**', 'Lo de la izquierda pasa a la derecha. Mirando de **Costado**, espeja de adelante hacia atrás.'],
            ['**↕ Vertical**', 'Lo de arriba pasa abajo.'],
          ),
          list(
            'Antes de aplicar, la vista previa muestra cómo queda, con **Aplicar** y **Cancelar**.',
            'Pasan con la pieza los vaciados, calados, perfiles a mano, biseles, tramos y el torneado. Una pata inclinada se abre hacia el otro lado.',
            'En una copia de un componente se espeja solo esa copia, igual que al girar.',
            'Con varias piezas o un grupo elegidos, se espejan todas juntas sobre el centro de lo que ocupan: cada una se da vuelta y pasa al lugar reflejado.',
          ),
          tip('Para hacer una pata con curva y tener las cuatro, dibujá la curva en una, usá **Del otro lado** para la gemela y espejá las que hagan falta.'),
        ],
      },
      {
        id: 'inclinar',
        title: 'Inclinar la pata',
        blocks: [
          p('Las patas y los parantes (las piezas paradas) tienen además **Inclinar la pata**: los grados **De frente** y **De costado** para abrirla, como en un taburete o una silla. Más información: [Patas inclinadas](patas-inclinadas).'),
        ],
      },
      {
        id: 'madera',
        title: 'Madera',
        blocks: [
          p('En **Madera** elegís una madera maciza o una placa (MDF, melamina, terciado o multilaminado). Si elegís una placa, la pieza pasa al espesor de placa más cercano, porque las placas vienen en espesores fijos. Más información: [Placas](placas).'),
          p('Abajo, **Veta** dice para dónde corre la fibra. Sale sola por lo más largo de la pieza, que es como se corta la tabla. En un tablero o un panel la podés girar al otro lado: la lista de cortes pide la tabla con el largo a lo largo de la veta. En el MDF y la melamina no aparece, porque no tienen veta.'),
          tip('Si girás la veta en una pieza larga y angosta, como un listón o una pata, la revisión avisa **Veta corta**: así la pieza se parte con poco esfuerzo.'),
          p('Más abajo, **Se abre** dice si la pieza se mueve: como **Cajón** (corre hacia adelante), **Puerta** (gira sobre la bisagra) o **Tapa abatible** (se levanta por atrás). Los cajones y puertas armados con el botón ya salen solos; una pieza o un grupo hechos a mano se marcan acá, y el cajón o la puerta entera cambia junta. En una puerta elegís de qué lado va la **Bisagra**: en un par, cada hoja abre hacia su lado. Una puerta marcada suma bisagras en los herrajes.'),
        ],
      },
      {
        id: 'forma',
        title: 'Forma y uniones',
        blocks: [
          list(
            '**Forma** tiene los cantos (rectos, redondeados o con chaflán, y su medida) y la lista de vaciados, biseles, tramos y torneado de la pieza, cada uno con sus medidas para corregir.',
            '**Más forma con las herramientas** lleva directo a Dibujar, Biselar, Tramo o Tornear.',
            '**Uniones** lista cada pieza con la que se toca. Ahí cambiás el encastre, y la lupa lo abre de cerca en Uniones.',
          ),
          p('Las dos secciones se pliegan para que el panel entre en la pantalla; el renglón de abajo del título resume lo que tienen.'),
        ],
      },
      {
        id: 'abajo',
        title: 'Abajo: acciones',
        blocks: [
          p('Al pie del panel están **Duplicar**, **Del otro lado**, **Hacer componente** (o **Hacer única**) y el tacho para eliminar la pieza. Más información: [Duplicar, Del otro lado y componentes](duplicar).'),
        ],
      },
    ],
    faq: [
      { q: 'Escribo una medida y no cambia nada', a: 'Se aplica al apretar `Enter` o al salir del campo. Si el número no es válido, debajo del campo dice por qué.' },
      { q: '¿Por qué el ancho, el alto y el fondo no cambian de lugar al girar la pieza?', a: 'Siempre van en ese orden y con el nombre de la dirección: después de girar, el ancho sigue siendo lo que mide de izquierda a derecha.' },
    ],
    related: ['elegir', 'altura', 'medidas-mueble'],
  },
  {
    id: 'agregar-pieza',
    topic: 'piezas',
    title: 'Agregar piezas',
    summary: 'Sumar una tabla, un listón o un tablero, y llevarlos a su lugar.',
    intro: [
      p('Una pieza nueva aparece apoyada en el piso, a la derecha del mueble, con la misma madera que la primera pieza del proyecto. Queda elegida, lista para estirarla a la medida y llevarla a su lugar.'),
      img('agregar-pieza', 'El menú Agregar pieza abierto'),
    ],
    sections: [
      {
        id: 'agregar',
        title: 'Agregar una pieza',
        blocks: [
          steps(
            'Con ninguna pieza elegida, tocá **Agregar pieza**, abajo en el panel. En el celular, tocá **+ Pieza** sobre el modelo.',
            'Elegí **Tabla**, **Listón** o **Tablero**.',
            'Estirala a la medida con [Estirar](estirar) o escribiendo en el panel.',
            'Llevala a su lugar con [Mover](mover). Cuando toca otra pieza, se propone la unión.',
          ),
        ],
      },
      {
        id: 'cual',
        title: 'Cuál elegir',
        blocks: [
          table(
            ['Pieza', 'Medida al agregarla', 'Para qué'],
            ['Tabla', '60 × 14,6 × 2,2 cm', 'Tapas, laterales, estantes y faldones'],
            ['Listón', '60 × 4,5 × 4,5 cm', 'Patas, travesaños y marcos'],
            ['Tablero', '60 × 40 × 1,8 cm', 'Fondos, cajones y tapas grandes'],
          ),
          tip('Si el mueble ya tiene piezas, el mismo menú ofrece **Cajón**, **Puerta** y **Estantes**, que se arman solos en un hueco. Más información: [Cajones, puertas y estantes](cajones-puertas).'),
        ],
      },
      {
        id: 'blanco',
        title: 'En un proyecto en blanco',
        blocks: [p('Un proyecto en blanco muestra en el medio de la vista las tres piezas para elegir la primera. Desde ahí también se puede volver a las plantillas.')],
      },
    ],
    faq: [
      { q: '¿Dónde quedó la pieza nueva?', a: 'A la derecha del mueble. Si no la ves, tocá el botón de encuadrar, al lado de las vistas.' },
      { q: '¿Puedo copiar una pieza que ya está en vez de agregar una nueva?', a: 'Sí: elegila y tocá **Duplicar**, o usá **Dejar copia** con Mover.' },
    ],
    related: ['crear-proyecto', 'estirar', 'mover'],
  },
  {
    id: 'cajones-puertas',
    topic: 'piezas',
    title: 'Cajones, puertas y estantes',
    summary: 'Armar cajones, puertas o estantes repartidos en un hueco del mueble, con sus uniones.',
    intro: [
      p('Un cajón, una puerta o una tanda de estantes no son una pieza sino varias. La app las arma en un hueco del mueble, con sus medidas, sus uniones y los herrajes que llevan.'),
      img('cajon', 'El panel Agregar cajón, con los huecos del mueble numerados'),
    ],
    sections: [
      {
        id: 'hueco',
        title: 'Elegir el hueco',
        blocks: [
          steps(
            'Con ninguna pieza elegida, tocá **Agregar pieza** y elegí **Cajón**, **Puerta** o **Estantes**.',
            'En **Elegí el hueco** se ve el frente del mueble con los huecos numerados. Tocá el que va. Debajo dice cuánto mide.',
            'Mientras elegís, el modelo muestra el hueco marcado y cómo quedan las piezas.',
          ),
          note('Un hueco es un espacio cerrado al frente, entre dos laterales y dos estantes (o el piso y la tapa). Si el mueble no tiene ninguno, escribís la medida del hueco y el cajón o la puerta se arma al costado, para llevarlo después a su lugar. Los estantes sí necesitan un hueco.'),
        ],
      },
      {
        id: 'opciones',
        title: 'Las opciones',
        blocks: [
          table(
            ['Opción', 'Qué elegís'],
            ['**Cantidad**', 'Cuántos cajones o estantes (hasta 8), o una o dos puertas. Un hueco de más de 60 cm arranca con dos puertas.'],
            ['**Frente**', '**Embutido**: el frente queda adentro del hueco, al ras, con 2 mm de luz. **Superpuesto**: tapa los cantos del mueble y es más fácil de ajustar.'],
            ['**Correderas**', '**De madera**: el cajón corre sobre el estante, sin comprar nada. **Metálicas**: telescópicas, piden 12,5 mm por costado.'],
            ['**Alto de los cajones**', '**Iguales**, o **Graduados**: cada uno un poco más bajo que el de abajo, en proporción áurea.'],
            ['**Tipo** de puerta', '**Tabla entera**, la más simple, o **Marco y tablero**, con un tablero que flota en un canal y no se tuerce.'],
            ['**Tipo** de estantes', '**Fijos**, encastrados en un canal, o **Regulables**, sobre soportes de 5 mm.'],
          ),
        ],
      },
      {
        id: 'agregar',
        title: 'Agregarlos',
        blocks: [
          steps(
            'Abajo de las opciones dice cuántas piezas y uniones suma y cuánto mide cada frente, hoja o estante.',
            'Tocá **Agregar cajón** (o el botón que corresponda). Las piezas quedan en el hueco y se elige la primera.',
          ),
          p('Las piezas de los cajones llevan la letra K y las de las puertas, D. Las correderas, bisagras, tiradores y soportes pasan solos a la lista de compras. Más información: [Herrajes](herrajes).'),
          p('Si algo no entra (un hueco muy bajo para tantos cajones, por ejemplo), el aviso dice por qué y el botón queda apagado.'),
        ],
      },
    ],
    faq: [
      { q: '¿Puedo cambiar un cajón después de agregarlo?', a: 'Sus piezas son piezas comunes: se editan una por una. Para cambiar de opciones, borralas y volvé a agregarlo.' },
      { q: '¿Por qué no aparece Cajón en el menú?', a: 'Aparece cuando el mueble ya tiene alguna pieza. En un proyecto en blanco, agregá antes el cuerpo del mueble.' },
    ],
    related: ['cajon', 'aurea', 'herrajes'],
  },
  {
    id: 'duplicar',
    topic: 'piezas',
    title: 'Duplicar, Del otro lado y componentes',
    summary: 'Copiar piezas, hacer la gemela del otro lado y vincular copias para que cambien juntas.',
    intro: [p('Un mueble tiene muchas piezas iguales: cuatro patas, dos laterales, dos faldones. En vez de hacer cada una, se hace una y se copia. Si las copias son un componente, lo que le cambies a una le llega a todas.')],
    sections: [
      {
        id: 'duplicar',
        title: 'Duplicar',
        blocks: [
          steps(
            'Elegí la pieza y tocá **Duplicar**, abajo en el panel.',
            'La vista previa muestra la copia a la derecha del mueble. Tocá **Aplicar**.',
            'Llevá la copia a su lugar con [Mover](mover).',
          ),
          tip('Para copiar y dejar la copia directo en su lugar, usá **Dejar copia** con Mover.'),
          img('duplicar', 'La vista previa de Duplicar, con la copia en fantasma'),
        ],
      },
      {
        id: 'otro-lado',
        title: 'Del otro lado',
        blocks: [
          steps(
            'Elegí la pieza que ya está bien: una pata, un faldón, un lateral.',
            'Tocá **Del otro lado**. La vista previa muestra la gemela del otro lado del mueble, a la misma distancia del borde.',
            'Tocá **Aplicar**.',
          ),
          p('La gemela va reflejada, y cambia de nombre sola: de izquierda a derecha, de delantera a trasera. Si la pieza está en el medio del mueble, o del otro lado ya hay una igual, un aviso lo dice.'),
        ],
      },
      {
        id: 'componente',
        title: 'Componentes',
        blocks: [
          steps(
            'Elegí la pieza y tocá **Hacer componente**.',
            'Duplicala, usá Del otro lado o dejá copias con Mover: todas las copias quedan vinculadas.',
            'Cambiá las medidas, la madera, los cantos o la forma de cualquiera: les llega a todas.',
          ),
          p('El panel de una copia dice de qué componente es y cuántas copias tiene. La posición no se comparte: cada copia sigue en su lugar.'),
          p('**Hacer única** desvincula esa copia: queda igual, pero lo que cambies ya no les llega a las demás.'),
          note('En las plantillas, las piezas iguales (las patas de una mesa, por ejemplo) ya vienen como componente.'),
        ],
      },
    ],
    faq: [
      { q: 'Biselé una pata y el bisel quedó adentro en las demás', a: 'Girá la copia que corresponde con Girar 90°: gira solo esa, y desde ahí cada una recibe el bisel en su lugar. Más información: [Copias giradas](copias-giradas).' },
      { q: '¿Cómo copio varias piezas juntas?', a: 'Elegilas juntas (o elegí un grupo) y tocá **Duplicar**. Si eran un grupo entero, la copia es un grupo nuevo.' },
    ],
    related: ['gemela', 'copias-giradas', 'grupos'],
  },
  {
    id: 'copias-giradas',
    topic: 'piezas',
    title: 'Copias giradas',
    summary: 'Copias de un componente que van giradas o reflejadas, y reciben cada cambio en su lugar.',
    intro: [p('Las cuatro patas de una mesa son la misma pieza, pero no miran todas para el mismo lado: el bisel de afuera de la pata izquierda está del otro lado que el de la derecha. Las copias giradas resuelven eso: cada copia sabe cómo está girada y recibe los cambios en su lugar.')],
    sections: [
      {
        id: 'girar',
        title: 'Girar una copia',
        blocks: [
          steps(
            'Elegí una copia del componente.',
            'Usá **Girar 90°** en el panel. Gira solo esa copia: las demás quedan como están.',
            'El panel lo dice: **Esta copia va girada o espejada**.',
          ),
        ],
      },
      {
        id: 'cambios',
        title: 'Cambiar la forma en cualquier copia',
        blocks: [
          p('Desde ahí, un bisel, un vaciado o un tramo nuevo en cualquier copia les llega a las demás en la arista o la cara que les corresponde, no en la misma posición del espacio.'),
          tip('**Del otro lado** ya hace la gemela reflejada: no hace falta girarla a mano.'),
        ],
      },
      {
        id: 'ejemplo',
        title: 'Ejemplo: biselar las patas por afuera',
        blocks: [
          steps(
            'Hacé la pata delantera izquierda como la querés y convertila en componente.',
            'Hacé las demás con **Del otro lado** (izquierda a derecha, y después adelante a atrás).',
            'Con **Biselar**, cortá la arista de afuera de cualquier pata: cada una recibe el bisel en su arista de afuera.',
          ),
        ],
      },
    ],
    faq: [
      { q: '¿Girar 90° gira todas las copias?', a: 'No: gira solo la copia elegida. Las medidas, la madera y la forma se siguen compartiendo.' },
      { q: '¿Puedo dejar de compartir cambios con una copia girada?', a: 'Sí: **Hacer única** la desvincula y la deja como está.' },
    ],
    related: ['girada', 'duplicar', 'biselar'],
  },
  {
    id: 'grupos',
    topic: 'piezas',
    title: 'Grupos',
    summary: 'Juntar piezas para elegirlas, moverlas, copiarlas y medirlas de una vez.',
    intro: [
      p('Un grupo junta piezas que van juntas, como el asiento de un banco o el marco de una puerta. Con un toque se elige el grupo entero, y se mueve, se copia, se oculta y se borra junto.'),
      img('grupo', 'Un grupo elegido, con su nombre y sus medidas en el panel'),
    ],
    sections: [
      {
        id: 'armar',
        title: 'Armar un grupo',
        blocks: [
          steps(
            'Tocá una pieza y después las otras con `Shift` apretado. En el celular, tocá **Elegir varias** y después cada pieza.',
            'En el panel, tocá **Agrupar**.',
            'Tocá el nombre del grupo para cambiarlo.',
          ),
          key('Con varias piezas elegidas, `G` las agrupa.'),
        ],
      },
      {
        id: 'usar',
        title: 'Usar el grupo',
        blocks: [
          list(
            'Un toque en cualquier pieza del grupo elige el grupo entero.',
            'Con el grupo elegido, Mover y las flechas mueven todas sus piezas juntas.',
            'En **Medidas del grupo** cambiás el ancho, el alto o el fondo de todo el grupo. Más información: [Medidas del mueble y del grupo](medidas-mueble).',
            '**Duplicar** hace un grupo nuevo con las copias.',
            '**Espejar** da vuelta el grupo entero como visto en un espejo, sin moverlo de su lugar. Más información: [El panel de la pieza](panel-pieza).',
            'Los grupos aparecen primero en la lista de **Piezas** del mueble, con su ojo para ocultarlos.',
          ),
        ],
      },
      {
        id: 'una',
        title: 'Editar una pieza del grupo',
        blocks: [
          steps('Con el grupo elegido, tocá otra vez la pieza: queda elegida sola.', 'Su panel dice **Parte de** y el nombre del grupo, con **Elegir el grupo** para volver.'),
          p('**Desagrupar** deja las piezas sueltas, donde están.'),
        ],
      },
    ],
    faq: [
      { q: '¿Una pieza puede estar en dos grupos?', a: 'No. Si la sumás a un grupo nuevo, sale del anterior.' },
      { q: '¿Un grupo cambia los cortes o el plano?', a: 'No: es solo para trabajar más cómodo en el modelo.' },
    ],
    related: ['grupo', 'elegir', 'medidas-mueble'],
  },
  {
    id: 'ocultar',
    topic: 'piezas',
    title: 'Ocultar y Ver sola',
    summary: 'Esconder piezas que tapan, o dejar una sola en la vista para trabajarla.',
    intro: [
      p('Para trabajar una pieza que queda adentro del mueble, como un travesaño o el fondo de un cajón, se ocultan las que tapan o se deja esa sola en la vista. Ocultar no borra nada.'),
      img('ocultar', 'Una pata sola en la vista, con el aviso para mostrar todo'),
    ],
    sections: [
      {
        id: 'pieza',
        title: 'Desde la pieza elegida',
        blocks: [
          steps(
            'Elegí la pieza.',
            'Arriba en el panel, al lado del nombre, tocá el ojo tachado para **Ocultar** o el recuadro para **Ver sola**.',
          ),
          key('`H` oculta la pieza elegida y `S` la deja sola. Valen también con varias piezas o un grupo elegido.'),
        ],
      },
      {
        id: 'lista',
        title: 'Desde la lista',
        blocks: [p('Con ninguna pieza elegida, en **Piezas**, el ojo de cada pieza o grupo lo oculta o lo muestra.')],
      },
      {
        id: 'volver',
        title: 'Ver todo de nuevo',
        blocks: [p('Mientras hay piezas ocultas, la vista muestra un aviso con cuántas son. Tocá **Mostrar todo** en ese aviso.')],
      },
    ],
    faq: [
      { q: '¿Las piezas ocultas salen en los cortes y el plano?', a: 'Sí. Ocultar es solo para el modelo: los cortes, el plano y el armado siempre llevan todas las piezas.' },
      { q: 'Abrí el proyecto y aparecieron las piezas que había ocultado', a: 'Es así: al abrir un proyecto se ven todas.' },
    ],
    related: ['sola', 'rayos-x', 'grupos'],
  },
  {
    id: 'medidas-mueble',
    topic: 'piezas',
    title: 'Medidas del mueble y del grupo',
    summary: 'Cambiar el ancho, el alto o el fondo de todo el mueble, o de un grupo, sin rehacer las piezas.',
    intro: [
      p('Con **Medidas del mueble** cambiás el tamaño de todo: una mesa de 160 cm pasa a 180 cm escribiendo un número. Las piezas largas sobre esa medida se estiran, las demás se corren o se reparten, y los espesores no cambian.'),
      img('medidas-mueble', 'Medidas del mueble en el panel, con ninguna pieza elegida'),
    ],
    sections: [
      {
        id: 'mueble',
        title: 'Todo el mueble',
        blocks: [
          steps(
            'Tocá **Ver el mueble** para soltar la pieza elegida.',
            'Abrí **Medidas del mueble** y escribí el ancho, el alto o el fondo. Mientras escribís, el modelo muestra en fantasma cómo queda.',
            'Apretá `Enter`. La vista previa dice cuántas piezas se estiran y cuántas se corren.',
            'Tocá **Aplicar**, o **Cancelar** si no era lo que querías.',
          ),
        ],
      },
      {
        id: 'grupo',
        title: 'Un grupo',
        blocks: [
          steps(
            'Elegí el grupo, o varias piezas juntas.',
            'En **Medidas del grupo**, escribí la medida nueva.',
            'Mirá la vista previa y tocá **Aplicar**. Las piezas del grupo se estiran o se corren como un mueble aparte; las demás no se mueven.',
          ),
        ],
      },
      {
        id: 'que',
        title: 'Qué se estira y qué se corre',
        blocks: [
          list(
            'Se estiran las piezas largas en esa dirección: la tapa y los faldones al cambiar el ancho, las patas y los laterales al cambiar el alto.',
            'Las piezas que se tocan se corren juntas, como un bloque: la tapa con sus faldones.',
            'El lugar libre entre bloques se estira parejo, así los estantes quedan repartidos igual.',
            'El vuelo de la tapa más allá de las patas no cambia.',
          ),
          note('Si al achicar no queda lugar entre las piezas, no se cambia nada y un aviso lo dice. Achicá antes la pieza que no entra.'),
        ],
      },
    ],
    faq: [
      { q: '¿Las uniones se rehacen?', a: 'Sí: las espigas y los demás encastres siguen a las piezas.' },
      { q: '¿Por qué no aparece Medidas del mueble?', a: 'Aparece con ninguna pieza elegida y cuando el mueble tiene dos piezas o más.' },
    ],
    related: ['medidas', 'vista-previa', 'aurea'],
  },
  {
    id: 'vista-previa',
    topic: 'piezas',
    title: 'Vista previa, Aplicar y Deshacer',
    summary: 'Ver un cambio grande antes de hacerlo, y volver atrás cualquier cambio.',
    intro: [
      p('Los cambios grandes se ven antes de hacerse: el modelo muestra en fantasma cómo queda y nada cambia hasta que tocás **Aplicar**. Los cambios chicos se aplican al momento, y cualquier cambio se puede deshacer.'),
      img('vista-previa', 'La barra de vista previa, con Cancelar y Aplicar'),
    ],
    sections: [
      {
        id: 'cuales',
        title: 'Qué cambios tienen vista previa',
        blocks: [
          table(
            ['Cambio', 'Cómo se ve'],
            ['Medidas del mueble o del grupo, Duplicar, Del otro lado y Eliminar', 'Vista previa con **Aplicar** y **Cancelar**'],
            ['Aplicar medidas a todas las uniones de un grupo, en Uniones', 'Vista previa en el mismo panel, con lo que cambia en los cortes'],
            ['Medidas y posición de una pieza', 'Fantasma mientras escribís; se aplica con `Enter`'],
            ['Mover, Estirar y las demás herramientas', 'Se ve mientras arrastrás; se aplica al soltar'],
          ),
        ],
      },
      {
        id: 'barra',
        title: 'La barra de vista previa',
        blocks: [
          steps(
            'Abajo del modelo aparece la barra: qué va a pasar y cuántas piezas son nuevas, cambian o se borran.',
            'Tocá **Aplicar** (o **Borrar**, si es para eliminar) para hacerlo.',
            'Tocá **Cancelar** para dejar todo como estaba.',
          ),
          key('`Enter` aplica y `Esc` cancela.'),
        ],
      },
      {
        id: 'deshacer',
        title: 'Deshacer y rehacer',
        blocks: [
          list(
            'La flecha de **Deshacer**, arriba a la derecha, vuelve atrás el último cambio. Se puede tocar varias veces.',
            '**Rehacer**, al lado, vuelve a aplicar lo que deshiciste.',
            'Después de un cambio, abajo aparece un aviso de lo que hiciste, con **Deshacer** a mano.',
          ),
          key('`Ctrl` + `Z` deshace; `Ctrl` + `Y` o `Ctrl` + `Shift` + `Z` rehace. En Mac, con `Cmd`.'),
        ],
      },
    ],
    faq: [
      { q: '¿Hasta dónde puedo deshacer?', a: 'Todo lo que hiciste desde que abriste el proyecto. Al cerrarlo y volver a abrirlo, empieza de nuevo.' },
      { q: '¿Deshacer funciona en Uniones o en Cortes?', a: 'Sí, en todas las secciones del proyecto.' },
    ],
    related: ['deshacer', 'medidas-mueble', 'duplicar'],
  },
  {
    id: 'revision',
    topic: 'piezas',
    title: 'Revisión del diseño',
    summary: 'Los avisos de lo que un carpintero con oficio miraría antes de cortar.',
    intro: [
      p('La app revisa el mueble con cada cambio y avisa lo que conviene corregir antes de cortar: dónde está el problema, por qué pasa y qué hacer. No impide nada: es un consejo.'),
      img('revision', 'Revisión del diseño abierta en el panel del mueble'),
    ],
    sections: [
      {
        id: 'ver',
        title: 'Ver los avisos',
        blocks: [
          steps(
            'Con ninguna pieza elegida, abrí **Revisión del diseño**. Si no hay nada, dice **Nada para corregir**.',
            'Tocá un aviso para leerlo: qué pasa y **Qué hacer**.',
            'Tocá **Ver la pieza** para ir a la pieza.',
          ),
          p('Algunos avisos traen el arreglo en un botón, por ejemplo **Usar espiga de 5,5 mm** o **Engrosar** la pata: se ve en vista previa y lo confirmás con **Aplicar**. **Ver en la unión** te lleva a Uniones con la medida a cambiar marcada.'),
          p('Si cambiás el espesor de una pieza, las espigas que tenían un tercio del espesor se ajustan solas al espesor nuevo, y un aviso abajo lo dice con **Deshacer**.'),
          p('Si hay avisos, la vista del modelo muestra **Revisión** con cuántos son: un toque abre la lista. Y cada pieza muestra los suyos arriba en su panel.'),
        ],
      },
      {
        id: 'que',
        title: 'Qué revisa',
        blocks: [
          table(
            ['Aviso', 'Qué quiere decir'],
            ['Se meten una en otra', 'Dos piezas ocupan el mismo lugar sin una unión que lo resuelva: así no se pueden armar.'],
            ['Se puede volcar', 'El mueble es alto y de poco fondo. Se agregan escuadras antivuelco a la lista de compras.'],
            ['La tapa no se puede mover', 'Una tapa maciza ancha apoyada sin una sujeción que la deje correr: se raja. **Sujetar con botones de madera** lo arregla en todos los faldones.'],
            ['El panel no tiene juego', 'Un panel macizo ancho llega justo al fondo de la canal: al hincharse abre el marco. **Dejar … mm de juego** hace la canal más honda.'],
            ['Veta cruzada', 'Una pieza ancha encolada a otra que no la deja moverse con la humedad: se raja.'],
            ['Mortaja al borde o espiga gruesa', 'Queda poca madera alrededor de la mortaja, o la espiga pasa del tercio del espesor.'],
            ['Espiga ancha', 'La espiga pasa de 9 cm de ancho: se mueve con la humedad y debilita la pata. **Hacer espiga doble** la parte en dos.'],
            ['Veta corta', 'Una pieza larga y angosta con la veta girada a lo ancho: se parte. **Poner la veta a lo largo** la vuelve a su lugar.'],
            ['Estantes que se comban', 'Con libros encima, el estante baja en el medio. Dice qué largo o qué espesor lo evita.'],
            ['Terminación', 'Una tapa de mesa con cera o lustre, que se marcan con agua y calor (**Laca satinada en la tapa** lo arregla); pintura sobre una madera linda; o melamina con terminación (**Dejarla como viene**).'],
          ),
        ],
      },
    ],
    faq: [
      { q: '¿Tengo que corregir todos los avisos?', a: 'No. Son consejos de taller: si sabés por qué lo hacés así, dejalo.' },
      { q: 'Corregí la pieza y el aviso sigue', a: 'La revisión se rehace con cada cambio. Si sigue, mirá **Qué hacer**: a veces hace falta mover otra pieza.' },
    ],
    related: ['rayos-x', 'tipos-union', 'aurea'],
  },
  {
    id: 'aurea',
    topic: 'piezas',
    title: 'Proporción áurea',
    summary: 'Una guía para medidas equilibradas, con un toque para llevar el mueble a ellas.',
    intro: [
      p('La proporción áurea (φ ≈ 1,618) es una relación entre dos medidas que el ojo encuentra equilibrada. Muchos ebanistas la usan para el ancho y el alto de un mueble, la tapa de una mesa o los cajones de una cómoda. Es una guía, no una regla.'),
      img('aurea', 'Proporción áurea abierta en el panel del mueble'),
    ],
    sections: [
      {
        id: 'ver',
        title: 'Ver las proporciones',
        blocks: [
          steps(
            'Con ninguna pieza elegida, abrí **Proporción áurea**. Al lado del título dice cuántas ya son áureas.',
            'Cada renglón compara dos medidas: **De frente** (ancho y alto), **De arriba** (ancho y fondo) y, si hay, los **Cajones**.',
            'El dibujo muestra el rectángulo como está y, punteado, el áureo más cercano.',
          ),
          table(['Marca', 'Quiere decir'], ['**Áurea**', 'Ya sigue la proporción.'], ['**Cerca**', 'Con un retoque chico queda.'], ['**No sigue**', 'Está lejos. Puede estar bien así.']),
        ],
      },
      {
        id: 'llevar',
        title: 'Llevar el mueble a la proporción',
        blocks: [
          steps('Tocá el botón con la medida propuesta, por ejemplo **Ancho a 162 cm**.', 'El mueble cambia como en Medidas del mueble: las piezas largas se estiran y las demás se corren.'),
          note('En mesas, taburetes, bancos y mesas de luz no se propone cambiar el alto: ahí lo pone el cuerpo.'),
          tip('**Graduarlos en proporción áurea** deja cada cajón un poco más bajo que el de abajo. También se elige al agregar los cajones.'),
        ],
      },
    ],
    faq: [
      { q: 'Me quedó en Cerca, ¿está mal?', a: 'No. La proporción es una guía de diseño; las medidas que necesitás mandan.' },
      { q: '¿Se puede deshacer?', a: 'Sí, como cualquier cambio: con la flecha de Deshacer o `Ctrl` + `Z`.' },
    ],
    related: ['medidas-mueble', 'cajones-puertas', 'revision'],
  },
  {
    id: 'terminacion',
    topic: 'piezas',
    title: 'Terminación: aceite, laca, tinte o pintura',
    summary: 'Elegir con qué se termina el mueble, verlo en 3D y saber qué comprar y cómo aplicarla.',
    intro: [
      p('La terminación es lo que se le pasa a la madera al final: aceite, cera, lustre, laca, tinte con laca o pintura. Se elige una para todo el mueble y, si hace falta, otra para alguna pieza, por ejemplo la tapa laqueada y las patas con aceite. El modelo y la foto la muestran, y la lista de compras y el armado dicen qué comprar y cómo aplicarla.'),
      img('terminacion', 'Terminación abierta en el panel del mueble, con tinte nogal'),
    ],
    sections: [
      {
        id: 'mueble',
        title: 'La del mueble',
        blocks: [
          steps(
            'Con ninguna pieza elegida, abrí **Terminación** en el panel del mueble.',
            'Elegí una en **Terminación del mueble**. Abajo dice para qué sirve.',
            'Si elegiste **Pintura**, tocá un color o el círculo de colores para elegir otro.',
          ),
          table(
            ['Terminación', 'Para qué'],
            ['**Aceite** y **cera**', 'Al tacto y fáciles de reparar. Protegen poco del agua.'],
            ['**Lustre a muñeca**', 'El brillo de los muebles antiguos. Se marca con agua y calor.'],
            ['**Laca** mate, satinada o brillante', 'Protegen bien: las de tapas y frentes.'],
            ['**Tinte y laca**', 'Cambian el color de la madera y dejan ver la veta.'],
            ['**Pintura**', 'Del color que quieras; tapa la veta. Para MDF y pino.'],
          ),
          note('Los colores son orientativos: dependen de la madera y de la marca. Probá antes en un retazo.'),
        ],
      },
      {
        id: 'pieza',
        title: 'Otra en una pieza',
        blocks: [
          steps('Elegí la pieza.', 'En su panel, en **Terminación**, elegí otra. **Como el mueble** la vuelve a la del mueble.'),
          p('La melamina ya viene terminada: no lleva ninguna.'),
        ],
      },
      {
        id: 'comparar',
        title: 'Comparar',
        blocks: [
          steps(
            'En **Terminación**, tocá **Comparar terminaciones**.',
            'Se dibuja el mueble con cuatro terminaciones lado a lado, con la luz de la foto. Tarda unos segundos.',
            'Tocá la que te guste para ponérsela a todo el mueble.',
          ),
        ],
      },
      {
        id: 'despues',
        title: 'Qué cambia en Cortes, Armado y la revisión',
        blocks: [
          list(
            'En **Cortes**, Herrajes y otros: cuántos litros de cada producto, por la superficie a terminar, y con qué se aplica (pincel, rodillo, trapo o muñeca).',
            'En **Armado** y en el **Modo taller**, el último paso dice cuántas manos, cuánto secar entre una y otra y con qué lijar entre manos.',
            'La [revisión](revision) avisa si una tapa de mesa queda con una terminación que no aguanta agua, si se pinta una madera linda o si la melamina tiene una terminación.',
          ),
        ],
      },
    ],
    faq: [
      { q: '¿Y si no elijo ninguna?', a: 'La lista de compras pone "Aceite, cera o lustre" como antes, y el armado dice que se lije y se termine a gusto.' },
      { q: 'La laca brillante casi no brilla en el modelo', a: 'El modelo tiene una luz simple. En la [foto del mueble](foto-mueble) se ve el reflejo.' },
    ],
    related: ['foto-mueble', 'revision', 'lista-cortes'],
  },
  {
    id: 'patas-inclinadas',
    topic: 'piezas',
    title: 'Patas inclinadas: taburetes, bancos y sillas',
    summary: 'Abrir las patas o echar atrás un respaldo, con los ángulos para la falsa escuadra.',
    intro: [
      p('Una pata inclinada se abre hacia afuera, como en un taburete rústico o una silla: el mueble queda más firme y no se vuelca. La app inclina la pata, le corta las puntas horizontales para que apoye en el piso y en el asiento, y hace que los travesaños la sigan. En Cortes, en el Plano y en el Modo taller te da el ángulo para marcar con la falsa escuadra.'),
      img('patas-inclinadas', 'Una silla con la pata delantera elegida e Inclinar la pata en el panel'),
    ],
    sections: [
      {
        id: 'plantillas',
        title: 'Empezar con una plantilla',
        blocks: [
          p('Tres plantillas ya traen las patas inclinadas, con todas sus uniones:'),
          table(
            ['Plantilla', 'Qué elegís'],
            ['**Taburete de patas abiertas**', 'La apertura de las patas, de 4° a 12°, y si lleva travesaños'],
            ['**Banco rústico**', 'La apertura hacia los costados y a lo largo, por separado, y travesaños en las puntas o también a lo largo'],
            ['**Silla**', 'La apertura de las patas, cuánto se echa atrás el respaldo y si el respaldo lleva uno o dos travesaños'],
          ),
          img('plantilla-silla', 'El formulario de la plantilla Silla, con el respaldo echado hacia atrás y la apertura de las patas'),
          tip('Entre 6° y 8° de apertura es lo habitual: se nota a la vista y el mueble queda firme. Con más de 10°, las patas ocupan mucho lugar en el piso.'),
        ],
      },
      {
        id: 'inclinar',
        title: 'Inclinar una pata',
        blocks: [
          steps(
            'Elegí la pata. Tiene que ser una pieza parada (más alta que ancha y que profunda) y sin tornear.',
            'En el panel, debajo de **Girar 90°**, buscá **Inclinar la pata**.',
            'Escribí los grados **De frente** y **De costado**. Positivo: la punta de abajo va hacia la derecha (de frente) o hacia adelante (de costado).',
            'Apretá `Enter`. La pata gira sobre su punta de arriba, que queda donde estaba, y las dos puntas quedan cortadas horizontales.',
          ),
          tip('Para que las cuatro patas se abran hacia sus esquinas, la de la izquierda lleva el número en negativo y la de la derecha en positivo: -6 y 6. Con 0 y 0 la pata vuelve a quedar derecha.'),
          note('Las medidas de la pieza siguen siendo las de la pata derecha: el **Alto** es lo que mide de alto la pata ya inclinada. El largo para cortarla está en Cortes.'),
        ],
      },
      {
        id: 'travesanos',
        title: 'Travesaños y faldones',
        blocks: [
          p('Un travesaño o un faldón entre patas inclinadas se ve derecho en el panel, pero al cortarlo sigue a las patas: se corre con ellas, se estira hasta la cara de cada pata y sus hombros salen en ángulo. La espiga sale derecha, a lo largo del travesaño.'),
          list(
            'Siguen a la pata las uniones **Mortaja y espiga** y **A tope**. Con otro tipo, el detalle avisa que el encastre todavía no sigue la pata inclinada.',
            'Las mortajas del asiento se corren a donde cae de verdad la pata, y su nota dice que van inclinadas y a cuánto poner la falsa escuadra para guiar el formón.',
            'En Uniones, el detalle 3D muestra las piezas donde quedan, inclinadas, y al separarlas se abren a lo largo de la pata.',
          ),
        ],
      },
      {
        id: 'angulos',
        title: 'Los ángulos para marcar',
        blocks: [
          p('La **falsa escuadra** es una escuadra que se traba en cualquier ángulo: con ella se marcan las puntas y los hombros. La app te da siempre el ángulo para ponerla, medido entre el canto de la pieza y la punta.'),
          img('patas-cortes', 'La lista de cortes de la silla: las patas con las puntas cortadas paralelas y la falsa escuadra a 84°'),
          table(
            ['Dónde', 'Qué dice'],
            ['**Cortes**', 'En **Trabajo**, por ejemplo: "puntas cortadas paralelas, a 6°: falsa escuadra a 84° del canto". El largo de corte va de punta larga a punta larga.'],
            ['**Plano**', 'El despiece dibuja la pata derecha, a lo largo, con un arco y su ángulo en cada punta. Los travesaños muestran el de sus hombros.'],
            ['**Modo taller**', 'Cada pieza muestra los mismos ángulos, en letra grande.'],
          ),
          img('patas-plano', 'El despiece de la silla en el plano, con los ángulos en las puntas de las patas y los travesaños'),
          tip('Medí el largo de corte sobre el canto más largo de la pieza: la punta larga.'),
        ],
      },
    ],
    faq: [
      { q: '¿Puedo inclinar un listón acostado o una tabla?', a: 'No: solo se inclinan las piezas paradas, como patas y parantes. Si no ves **Inclinar la pata**, la pieza está acostada o torneada.' },
      { q: '¿Por qué el respaldo de la silla se va para atrás y no se abre?', a: 'Los parantes del respaldo están inclinados solo **De costado**, para que la espalda apoye cómoda. Lo cambiás en **Respaldo echado hacia atrás** al crear la silla, o en el panel de cada parante.' },
      { q: 'Cambié la inclinación, ¿tengo que alargar los travesaños?', a: 'No: al cortarse, el travesaño se estira o se acorta solo hasta las patas. La lista de cortes ya tiene el largo nuevo.' },
    ],
    related: ['panel-pieza', 'tipos-union', 'lista-cortes', 'plano'],
  },
];

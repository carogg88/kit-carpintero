import { img, key, list, note, p, steps, table, tip, type Article } from './types';

/** Tema "Herramientas del Modelo": un artículo paso a paso por herramienta. Su par en inglés es en-herramientas.ts. */
export const ES_TOOLS: Article[] = [
  {
    id: 'elegir',
    topic: 'herramientas',
    title: 'Elegir piezas',
    summary: 'Tocar una pieza para editarla, elegir varias juntas y soltarlas.',
    intro: [
      p('Con **Elegir** tocás una pieza y el panel de la derecha pasa a ser de esa pieza: sus medidas, su posición, la madera y sus uniones. Es la herramienta con la que se arranca y a la que se vuelve después de usar cualquier otra.'),
      img('elegir', 'Una pata elegida: se marca en el modelo y el panel muestra sus medidas'),
    ],
    sections: [
      {
        id: 'una',
        title: 'Elegir una pieza',
        blocks: [
          steps(
            'Tocá **Elegir**, la primera herramienta de la izquierda.',
            'Tocá la pieza en el modelo. Se marca con el color de acento y arriba a la izquierda aparece su código, su nombre y su medida.',
            'Para soltarla, tocá el fondo, apretá `Esc` o tocá **Ver el mueble** en el panel.',
          ),
          key('`V` elige esta herramienta.'),
          tip('Si la pieza es chica o está tapada, elegila desde la lista de arriba del panel o desde **Piezas**, con ninguna pieza elegida.'),
        ],
      },
      {
        id: 'varias',
        title: 'Elegir varias piezas',
        blocks: [
          steps(
            'Tocá la primera pieza.',
            'Con `Shift` apretado, tocá las otras. En el celular, tocá **Elegir varias** y después cada pieza.',
            'El panel muestra las piezas elegidas. Desde ahí las agrupás, les cambiás las medidas juntas, las ocultás o las borrás.',
          ),
          img('elegir-varias', 'Dos patas elegidas, con el panel de las piezas elegidas'),
          p('Para sacar una pieza de las elegidas, tocala de nuevo con `Shift`. Más información: [Agrupar piezas para moverlas juntas](grupo).'),
        ],
      },
      {
        id: 'grupos',
        title: 'Piezas en un grupo',
        blocks: [
          list(
            'Un toque en una pieza de un grupo elige el grupo entero.',
            'Un segundo toque entra a esa pieza sola, para editarla.',
            'En el panel, la pieza dice de qué grupo es y tiene **Elegir el grupo** para volver.',
          ),
        ],
      },
      {
        id: 'vista',
        title: 'Moverse por el modelo',
        blocks: [
          list(
            'Arrastrá el fondo para girar la vista.',
            'Usá la rueda del mouse, o dos dedos en el celular, para acercarte o alejarte.',
            'Si te perdiste, tocá el botón de encuadrar, al lado de Arriba.',
          ),
          p('Más información: [Vistas y encuadre](vistas).'),
        ],
      },
    ],
    faq: [
      { q: 'Toco una pieza y se elige otra, ¿qué pasa?', a: 'Se elige la que está más adelante. Girá la vista o elegila desde la lista de arriba del panel.' },
      { q: 'Toco una pata y se eligen las cuatro', a: 'Están en un grupo. Tocala otra vez para elegirla sola.' },
    ],
    related: ['pantalla-editor', 'grupo', 'sola'],
  },
  {
    id: 'estirar',
    topic: 'herramientas',
    title: 'Estirar una pieza',
    summary: 'Arrastrar una cara para alargar o acortar una pieza, y escribir la medida exacta.',
    intro: [
      p('**Estirar** cambia una medida de la pieza arrastrando una de sus caras: la cara que tocás se corre y la de enfrente queda en su lugar. Sirve para alargar una pata, ensanchar una tapa o hacer más alto un faldón.'),
      img('estirar', 'Estirar elegido, con la guía de pasos abajo'),
    ],
    sections: [
      {
        id: 'arrastrar',
        title: 'Arrastrar una cara',
        blocks: [
          steps(
            'Tocá **Estirar** en la barra de herramientas.',
            'Pasá el mouse por la pieza: la cara que se movería se ilumina, sale una flecha hacia afuera y un cartel dice qué medida cambia (**Largo**, **Ancho** o **Espesor** de la pieza, y entre paréntesis la dirección del mueble).',
            'Apoyá el puntero o el dedo en la cara que querés correr.',
            'Arrastrá hacia afuera para alargar o hacia adentro para acortar. Lo que se agrega se ve en color y al lado aparece la medida nueva.',
            'Soltá.',
          ),
          key('`P` elige esta herramienta.'),
        ],
      },
      {
        id: 'exacta',
        title: 'Escribir la medida exacta',
        blocks: [
          steps('Al soltar aparece una burbuja con la medida que quedó.', 'Escribí la medida que querés y apretá `Enter`.'),
          tip('Para cambiar una medida sin arrastrar, escribila en **Medidas terminadas**, en el panel de la pieza.'),
        ],
      },
      {
        id: 'mueble',
        title: 'Cambiar todo el mueble',
        blocks: [
          p('Estirar cambia una sola pieza. Para hacer más ancho o más alto todo el mueble, usá **Medidas del mueble**: las piezas largas se estiran y las demás se corren solas.'),
          note('Más información: [Cambiar el tamaño de todo el mueble](medidas).'),
        ],
      },
    ],
    faq: [
      { q: '¿Por qué no se mueve la cara que toco?', a: 'Puede que la pieza sea muy fina en esa dirección o que estés tocando otra pieza. Elegí antes la pieza con Elegir y probá desde otra vista.' },
      { q: '¿Se pueden estirar varias piezas a la vez?', a: 'Sí: elegí varias y escribí la medida en **Medidas del grupo**, en el panel.' },
    ],
    related: ['mover', 'medidas', 'elegir'],
  },
  {
    id: 'mover',
    topic: 'herramientas',
    title: 'Mover una pieza',
    summary: 'Llevar una pieza a otro lugar, subirla, dejar una copia y poner la distancia exacta.',
    intro: [
      p('**Mover** lleva una pieza a otro lugar del mueble. Al acercarla a otra se pega sola al borde o al centro, y si se tocan aparece la unión.'),
      img('mover', 'Una pata recién movida, con la burbuja para escribir la distancia'),
    ],
    sections: [
      {
        id: 'piso',
        title: 'Mover sobre el piso',
        blocks: [
          steps(
            'Tocá **Mover** en la barra de herramientas.',
            'En la vista 3D o Arriba, arrastrá la pieza. Se mueve a lo ancho y de fondo, sin despegarse del piso.',
            'Mientras la arrastrás, se ve a cuánto queda de las piezas vecinas.',
            'Soltala cerca de otra: se pega al borde o al centro y se ilumina la cara donde apoya.',
          ),
          key('`M` elige esta herramienta.'),
        ],
      },
      {
        id: 'subir',
        title: 'Subir y bajar',
        blocks: [
          steps('Pasá a la vista **Frente** o **Costado**.', 'Arrastrá la pieza hacia arriba o hacia abajo. No baja más allá del piso.'),
          tip('Para una altura exacta, escribila en **Posición › Del piso**, en el panel. Más información: [Subir o bajar una pieza exacto](altura).'),
        ],
      },
      {
        id: 'exacta',
        title: 'Poner la distancia exacta',
        blocks: [steps('Al soltar aparece una burbuja con lo que corriste la pieza.', 'Escribí la distancia y apretá `Enter`. Un toque sin arrastrar también abre la burbuja.')],
      },
      {
        id: 'copia',
        title: 'Dejar una copia',
        blocks: [
          steps('En la guía de abajo, tocá **Dejar copia**.', 'Arrastrá: la pieza original queda en su lugar y la copia va donde la sueltes.'),
          note('Si la pieza es un componente, la copia sigue vinculada: lo que le cambies a una le llega a las demás. Más información: [Hacer la pata gemela del otro lado](gemela).'),
        ],
      },
      {
        id: 'flechas',
        title: 'Correr de a milímetro',
        blocks: [
          steps('Con la pieza elegida, usá las flechas del teclado: cada toque la corre 1 mm, y con `Shift`, 10 mm.', 'Las flechas siguen la vista: en Frente corren a lo ancho y a lo alto; en Arriba, a lo ancho y de fondo.'),
        ],
      },
      {
        id: 'guia',
        title: 'Qué unión sale mientras movés',
        blocks: [
          p('Mientras arrastrás, el cartel al lado del dedo dice qué pasa con la pieza:'),
          list(
            'En verde, la unión que sale con la vecina que toca: por ejemplo **Toca P1: mortaja y espiga, tarugos y 4 más**.',
            'En rojo, si se mete en otra pieza. La parte que se cruza se pinta en el modelo. Una punta que se mete en una pata no da caja y espiga: dejala en la cara.',
            'En rojo también, si quedó a unos milímetros de otra: así no hay unión.',
          ),
          p('La punta de una pieza se pega a la cara que tiene enfrente desde más lejos que el resto, para que llegue justo a tocarla. Lo mismo pasa con **Estirar**.'),
          img('mover-guia', 'Un travesaño arrastrado hasta la pata, con la unión que sale en el cartel'),
          tip('Si al soltar quedó una luz chica, el aviso de abajo ofrece **Cerrar la luz**: estira la pieza hasta tocar la otra.'),
        ],
      },
      {
        id: 'quiero-union',
        title: 'Quiero esta unión',
        blocks: [
          steps(
            'Elegí las dos piezas que querés unir: tocá una y sumá la otra con `Shift` + clic (o **Elegir varias**).',
            'En el panel aparece **Unir P1 y T1**, con la unión que saldría.',
            'Tocá **Llevar T1 hasta P1** para correr la pieza más chica hasta la cara de la otra, o **Estirar** para alargarla hasta ahí.',
            'Mirá la vista previa en el modelo y tocá **Aplicar**.',
          ),
          img('mover-unir', 'Dos piezas elegidas, con Unir P3 y F1 en el panel'),
          note('Si las piezas no quedan enfrentadas, el panel te dice cuál correr primero. Si ya se tocan, **Ver la unión** te lleva a Uniones.'),
        ],
      },
    ],
    faq: [
      { q: '¿Por qué no sube?', a: 'En 3D y Arriba la pieza va pegada al piso. Cambiá a Frente o Costado.' },
      { q: 'Se soltó una unión al mover, ¿qué hago?', a: 'Si separás dos piezas que se tocaban, la unión se va. El aviso de abajo lo dice y tiene **Deshacer**.' },
      { q: '¿Se mueven las piezas de un grupo juntas?', a: 'Sí: al arrastrar una pieza de un grupo se mueve el grupo entero.' },
      { q: 'El cartel dice que se mete en otra pieza, ¿está mal?', a: 'No siempre: dos piezas que se cruzan dan media madera o apoyado en muesca. Para caja y espiga, tarugos o galletas, la punta tiene que llegar justo a la cara.' },
    ],
    related: ['unir', 'altura', 'flechas', 'medir'],
  },
  {
    id: 'dibujar',
    topic: 'herramientas',
    title: 'Dibujar agujeros, vaciados y calados',
    summary: 'Dibujar un rectángulo, un círculo, un arco o un perfil a mano en una cara y sacarlo de la pieza.',
    intro: [
      p('**Dibujar** saca material de una cara: un **vaciado** tiene una profundidad, como una muesca o un rebaje, y un **calado** atraviesa la pieza, como un agujero o una manija. Se dibuja con rectángulo, círculo, arco o perfil a mano.'),
      img('dibujar', 'Un rectángulo dibujado en el faldón, con la burbuja de vaciado o calado'),
    ],
    sections: [
      {
        id: 'cara',
        title: 'Elegir la cara',
        blocks: [
          steps(
            'Tocá **Dibujar** en la barra de herramientas.',
            'Tocá la cara de la pieza donde vas a dibujar. La vista se pone de frente a esa cara y la cara queda marcada.',
          ),
          key('`D` elige esta herramienta.'),
          tip('Con la cara elegida, lo que dibujes va a esa cara aunque otra pieza la tape.'),
        ],
      },
      {
        id: 'figura',
        title: 'Dibujar la figura',
        blocks: [
          p('En la guía de abajo elegí la figura:'),
          table(
            ['Figura', 'Cómo se dibuja'],
            ['Rectángulo', 'Arrastrá de una esquina a la opuesta'],
            ['Círculo', 'Arrastrá desde el centro hacia afuera'],
            ['Arco', 'Arrastrá de punta a punta y después tocá hasta dónde se curva. Sirve para el arco de un faldón'],
            ['Perfil a mano', 'Tocá punto por punto. Sirve para un borde con varias curvas, la silueta de una pata o un calado con forma'],
            ['Mano alzada', 'Dibujá de un tirón, sin soltar. Al soltar queda como perfil a mano, con pocos puntos que después podés mover'],
            ['Forma de esquina', 'Tocá cerca de una esquina y elegí la forma: redondeo, chaflán, escalón, cóncavo o gola'],
          ),
          p('Al lado de las figuras elegí **Calado** (atraviesa la pieza) o **Vaciado** (baja hasta el **Hondo** que escribas). Arriba del panel, **Así queda** muestra la pieza en diagonal con la figura ya sacada, mientras dibujás.'),
        ],
      },
      {
        id: 'perfil',
        title: 'Perfil a mano',
        blocks: [
          p('El perfil es una línea de puntos que vos marcás, con curvas suaves entre ellos. Según dónde empieza, hace dos cosas distintas:'),
          img('perfil', 'Un perfil a mano en el faldón: cuatro puntos y la línea que sigue al puntero hasta el otro borde'),
          table(
            ['Empezás', 'Qué saca'],
            ['En un borde de la cara', 'Terminás tocando otro borde (o el mismo) y saca el lado más chico: el borde curvo de un faldón, la silueta de una pata, la forma de un respaldo'],
            ['Adentro de la cara', 'Cerrás tocando el primer punto, que se ve más grande, y saca lo de adentro: un calado con forma, como una manija o un corazón'],
          ),
          steps(
            'En la guía elegí **Perfil a mano**.',
            'Arriba de la guía elegí si el próximo punto va en **Curva** o en **Esquina**. Podés cambiarlo entre punto y punto.',
            'Tocá la cara punto por punto. Con el mouse, la línea sigue al puntero para que veas cómo queda.',
            'Para corregir, tocá **Sacar punto** o apretá `Borrar`. `Esc` empieza de nuevo.',
          ),
          p('Si el perfil va de borde a borde y saca el lado que no era, tocá **Otro lado** en la guía.'),
          tip('Con pocos puntos sale una curva más pareja. Para la silueta de una pata de cabra, dibujá el perfil en el frente y otro igual en el costado.'),
          note('Si la línea se cruza consigo misma no se puede cortar: se ve en rojo y hay que marcarla de nuevo.'),
        ],
      },
      {
        id: 'mano-alzada',
        title: 'Mano alzada',
        blocks: [
          steps(
            'En la guía elegí **Mano alzada**.',
            'Apretá y dibujá la curva de un tirón, con el mouse o el dedo. Si empezás y terminás cerca de un borde, las puntas se pegan al borde.',
            'Soltá. El trazo queda como perfil a mano con pocos puntos suaves; donde doblaste fuerte queda una esquina.',
          ),
          p('Si el trazo terminó en el medio de la cara, sigue como **Perfil a mano**: tocá puntos hasta un borde, o el primero para cerrar.'),
        ],
      },
      {
        id: 'esquina',
        title: 'Formas de esquina',
        blocks: [
          p('Para el vértice comido de un faldón, una esquina redonda o un escalón, sin dibujar:'),
          steps(
            'En la guía elegí **Forma de esquina**.',
            'Tocá la cara cerca de la esquina que querés cambiar.',
            'Abajo elegí la forma: **Redondeo**, **Chaflán**, **Escalón**, **Cóncavo** o **Gola** (la curva en S).',
            'Escribí cuánto toma sobre cada borde. Se ve en la cara y en **Así queda**.',
            'Tocá **Cortar la esquina**.',
          ),
          tip('Con **Vaciado**, el escalón es un rebaje: la esquina baja hasta el hondo en vez de atravesar.'),
        ],
      },
      {
        id: 'calcar',
        title: 'Calcar una foto',
        blocks: [
          steps(
            'Con la cara elegida, tocá **Calcar foto** y elegí una imagen.',
            'La foto se pone sobre toda la cara, medio transparente. Seguila con **Perfil a mano** o **Mano alzada**.',
            'Para sacarla, tocá **Sacar foto**.',
          ),
          tip('Recortá la foto al contorno de la pieza antes de ponerla: así coincide con la cara.'),
          note('La foto queda mientras usás la app; no se guarda en el proyecto.'),
        ],
      },
      {
        id: 'burbuja',
        title: 'Las medidas de la figura',
        blocks: [
          steps(
            'Al terminar una figura, su tarjeta queda marcada en el panel (en el celular, en una burbuja abajo).',
            'Escribí el tamaño (o el **Diámetro** del círculo) y la distancia a los bordes, o tocá **Centrar**.',
            'Tocá **Listo** en la guía cuando termines con esa cara.',
          ),
          note('Si un calado se lleva toda la pieza, te avisa: achicalo o cambialo a vaciado.'),
        ],
      },
      {
        id: 'editar',
        title: 'Cambiarlo después',
        blocks: [
          p('En el panel de la pieza, abrí **Vaciados y calados**: cada uno tiene sus medidas y el botón para borrarlo.'),
          p('En un perfil a mano, cada punto tiene su medida desde los bordes y botones para pasarlo de curva a esquina, agregar otro después y borrarlo. **Sacar el otro lado del perfil** deja la parte chica y saca la grande.'),
          steps(
            'Para moverlos a ojo, tocá **Mover los puntos en el modelo**: se abre Dibujar en esa cara y cada punto se ve como un cuadradito.',
            'Arrastrá un punto hasta donde va. Las puntas de un perfil abierto corren por el borde.',
            'Con **Perfil a mano** elegido, tocá la línea entre dos puntos para agregar uno ahí, y arrastralo si querés.',
          ),
        ],
      },
    ],
    faq: [
      { q: '¿Cómo hago una muesca para que encastre otra pieza?', a: 'No hace falta: cuando dos piezas se cruzan, la unión ya hace el corte. Dibujá solo lo que no es una unión, como un agujero o una manija.' },
      { q: 'El rectángulo salió como una raya', a: 'Pasa cuando se arrastra siguiendo un solo borde. Arrastrá en diagonal, de esquina a esquina.' },
      { q: '¿Cómo imprimo el perfil para calcarlo en la madera?', a: 'En **Plano**, la pieza con el perfil tiene su plantilla 1:1. Tocá **Imprimir solo la plantilla 1:1** (si son varias hojas, el botón dice cuántas), pegá la hoja y calcala.' },
    ],
    related: ['calado', 'biselar', 'elegir'],
  },
  {
    id: 'biselar',
    topic: 'herramientas',
    title: 'Biselar y redondear',
    summary: 'Un bisel, un canto redondeado, una esquina redonda o un corte en ángulo en una arista.',
    intro: [
      p('**Biselar** corta una arista de la pieza: en recto (bisel) o en curva (redondeo). Si el corte llega al otro lado de la cara, es un corte en ángulo; cerca de una esquina, redondea la esquina, como en una tapa.'),
      img('biselar', 'Biselar elegido, con las dos formas de canto en la guía'),
    ],
    sections: [
      {
        id: 'forma',
        title: 'Elegir bisel o redondeo',
        blocks: [
          steps('Tocá **Biselar**. En el celular está en **Más**.', 'En la guía de abajo elegí **Bisel recto** o **Redondeo**.'),
          key('`B` elige esta herramienta.'),
        ],
      },
      {
        id: 'arrastrar',
        title: 'Marcar la arista',
        blocks: [
          steps(
            'Apoyá el puntero en una cara, cerca de la arista que querés cortar.',
            'Arrastrá hacia adentro de la cara. Al lado se ve cuánto entra el corte.',
            'Soltá y, si querés, escribí la medida exacta en la burbuja.',
          ),
          list(
            'Si llegás **al centro** o a **todo el ancho**, la medida se pega ahí. Todo el ancho hace un corte en ángulo.',
            'Cerca de una **esquina**, redondea o corta la esquina. Si otra esquina ya tiene una medida parecida, se iguala.',
          ),
        ],
      },
      {
        id: 'panel',
        title: 'Ajustarlo en el panel',
        blocks: [
          p('En el panel de la pieza, **Biseles, redondeos y cortes en ángulo** muestra cada uno. Un bisel tiene cuánto entra en cada cara y el ángulo; un redondeo, el radio.'),
        ],
      },
      {
        id: 'cantos',
        title: 'Cantos de toda la pieza',
        blocks: [
          p('Para suavizar todas las aristas de una pieza a la vez, no hace falta Biselar: en el panel, en **Forma › Cantos**, elegí **Redondeados** o **Chaflán** y la medida.'),
        ],
      },
    ],
    faq: [
      { q: 'Biselé una pata y les salió a todas', a: 'Las patas iguales son un componente. Para que el bisel quede afuera en cada una, mirá [Biselar las patas por afuera](girada).' },
      { q: '¿Cómo lo borro?', a: 'En el panel, en **Biseles, redondeos y cortes en ángulo**, cada uno tiene su botón de borrar. O tocá Deshacer apenas lo hiciste.' },
    ],
    related: ['girada', 'tramo', 'dibujar'],
  },
  {
    id: 'tramo',
    topic: 'herramientas',
    title: 'Tramo: una parte más gruesa o más fina',
    summary: 'Cambiar el grueso de una pata o listón en un tramo de su largo.',
    intro: [
      p('**Tramo** hace que una parte del largo de una pieza tenga otra sección: un pie más fino, una pata más gruesa arriba donde van las uniones, o un listón con un tramo rebajado.'),
      img('tramo', 'Un tramo marcado en una pata, con sus medidas en el panel'),
    ],
    sections: [
      {
        id: 'marcar',
        title: 'Marcar el tramo',
        blocks: [
          steps(
            'Tocá **Tramo**. En el celular está en **Más**.',
            'Apoyá el puntero en la pieza donde empieza el tramo.',
            'Arrastrá a lo largo de la pieza hasta donde termina. Al lado se ve de dónde a dónde va; en la punta se pega.',
            'Soltá. El tramo arranca un poco más grueso, para que se vea.',
          ),
          key('`T` elige esta herramienta.'),
        ],
      },
      {
        id: 'medidas',
        title: 'Ajustar las medidas',
        blocks: [
          steps(
            'En el panel de la pieza, abrí **Tramos**.',
            'Escribí **Desde** y **Hasta**: dónde empieza y dónde termina, medido desde una punta.',
            'Escribí las dos medidas de la sección: más chicas que la pieza para afinar, más grandes para engrosar.',
          ),
          tip('La sección del tramo queda centrada en la pieza.'),
        ],
      },
    ],
    faq: [{ q: '¿Cómo lo borro?', a: 'En **Tramos**, cada tramo tiene su botón de borrar.' }],
    related: ['tornear', 'biselar'],
  },
  {
    id: 'tornear',
    topic: 'herramientas',
    title: 'Tornear una pata o un barrote',
    summary: 'Convertir una pieza larga en una torneada, desde un modelo o con su perfil a medida.',
    intro: [
      p('**Tornear** convierte una pieza larga, como una pata, en una pieza torneada. Arranca como un cilindro y su perfil se arma en el panel: a cada distancia, un diámetro.'),
      img('tornear', 'Una pata torneada, con el perfil del torneado en el panel'),
    ],
    sections: [
      {
        id: 'empezar',
        title: 'Tornear una pieza',
        blocks: [
          steps('Tocá **Tornear**. En el celular está en **Más**.', 'Tocá una pieza larga. Pasa a ser un cilindro del grueso de su taco.'),
          key('`R` elige esta herramienta.'),
        ],
      },
      {
        id: 'modelo',
        title: 'Arrancar de un modelo',
        blocks: [p('En el panel, en **Perfil del torneado**, elegí un modelo en **Arrancar de un modelo**: Cilindro, Columna de pie, Pata de mesa o Barrote. Después lo ajustás.')],
      },
      {
        id: 'estaciones',
        title: 'Ajustar el perfil',
        blocks: [
          p('El perfil es una lista de **estaciones**. Cada una dice a qué distancia de la punta está y qué diámetro tiene.'),
          steps(
            'Cambiá la distancia o el diámetro de una estación.',
            'Elegí cómo llega desde la anterior: **Recto**, **Curva hacia afuera**, **Curva hacia adentro** o **Queda cuadrado**, para la parte donde van las uniones.',
            'Con **Agregar estación** sumás otra; cada una se puede borrar.',
          ),
          note('Ningún diámetro puede pasar el lado del taco.'),
        ],
      },
      {
        id: 'plantilla',
        title: 'Plantilla para el torno',
        blocks: [p('En el plano, cada pieza torneada sale con su plantilla 1:1 para marcar las estaciones en el taco.')],
      },
    ],
    faq: [{ q: '¿Cómo vuelvo a la pieza cuadrada?', a: 'En el panel, tocá **Sacar torneado**.' }],
    related: ['tramo', 'biselar'],
  },
  {
    id: 'medir',
    topic: 'herramientas',
    title: 'Medir entre piezas',
    summary: 'Ver cuánto le queda a una pieza a cada lado, la distancia entre dos y centrarla.',
    intro: [
      p('**Medir** te dice dónde está una pieza dentro del mueble y cuánto la separa de otra. Si quedó corrida, **Centrar** la deja al medio.'),
      img('medir', 'Dos patas medidas, con la tarjeta de medidas'),
    ],
    sections: [
      {
        id: 'una',
        title: 'Medir una pieza',
        blocks: [
          steps('Tocá **Medir**. En el celular está en **Más**.', 'Tocá una pieza: ves cuánto le queda a cada lado dentro del mueble.'),
          key('`C` elige esta herramienta.'),
        ],
      },
      {
        id: 'dos',
        title: 'Medir entre dos piezas',
        blocks: [
          steps('Con una pieza medida, tocá otra.', 'Ves cuánto las separa a lo ancho, a lo alto y de fondo, y si se tocan, están separadas o se cruzan.'),
          tip('Si tocaste dos caras enfrentadas, también ves la distancia entre esas caras.'),
        ],
      },
      {
        id: 'centrar',
        title: 'Centrar',
        blocks: [p('Si la pieza quedó corrida, tocá **Centrar** en la tarjeta de medidas: la deja al medio en esa dirección. **Borrar** empieza de nuevo.')],
      },
    ],
    faq: [{ q: '¿Medir cambia la pieza elegida?', a: 'No: medir no cambia lo que está en el panel.' }],
    related: ['medir-centrar', 'mover'],
  },
  {
    id: 'rayos-x',
    topic: 'herramientas',
    title: 'Rayos X',
    summary: 'Ver a través de las piezas los encastres que quedan adentro.',
    intro: [
      p('**Rayos X** hace las piezas transparentes para ver lo que queda adentro, como las espigas en sus cajas. No cambia nada del mueble.'),
      img('rayos-x', 'La mesa en rayos X: se ven las espigas adentro de las patas'),
    ],
    sections: [
      {
        id: 'usar',
        title: 'Prender y apagar',
        blocks: [
          steps('Tocá **Rayos X**, abajo de todo en la barra de herramientas. En el celular está en **Más**.', 'Tocá de nuevo para apagarlo.'),
          key('`X` prende y apaga Rayos X.'),
          tip('Con Rayos X prendido podés seguir usando las otras herramientas.'),
        ],
      },
    ],
    related: ['cerca', 'vistas'],
  },
  {
    id: 'probar',
    topic: 'herramientas',
    title: 'Probar el mueble',
    summary: 'Abrir y cerrar en el modelo lo que se mueve, y ver el mueble por adentro.',
    intro: [
      p('**Probar** abre y cierra en el 3D lo que se mueve del mueble: los cajones corren hacia adelante, las puertas giran sobre la bisagra y las tapas se levantan por atrás. Sirve para ver cómo funciona y cómo queda por adentro. No cambia nada del proyecto.'),
      img('probar', 'La alacena con una puerta abierta, y el panel de Probar'),
    ],
    sections: [
      {
        id: 'abrir',
        title: 'Abrir y cerrar',
        blocks: [
          steps(
            'Tocá **Probar**, al final de la barra de herramientas. En el celular está en **Más**.',
            'Tocá un cajón o una puerta en el modelo: se abre. Tocalo de nuevo y se cierra.',
            'Para abrir todo a la vez, usá la barra **Abrir todo** del panel. También podés abrir cada uno desde la lista.',
            'Cuando termines, tocá **Terminar de probar** (o **Probar** de nuevo, o Esc): todo se cierra.',
          ),
          key('`A` prende y apaga Probar.'),
          tip('Mientras probás no se puede editar: si elegís otra herramienta, la prueba termina y el mueble vuelve a estar cerrado.'),
        ],
      },
      {
        id: 'adentro',
        title: 'Ver por adentro',
        blocks: [
          p('Con **Mueble transparente**, el cuerpo del mueble se ve como vidrio y los cajones y puertas quedan firmes: se ve dónde caen los estantes, la trasera y los fondos.'),
          p('El **Corte** saca la parte del mueble que tenés más cerca: de **Frente**, de **Costado** o de **Arriba**. Corré la barra **Dónde corta** para ver otra parte. Lo cortado se pinta parejo, para que se lean los espesores.'),
          img('probar-corte', 'La cajonera cortada de costado: se ven los cajones por adentro'),
        ],
      },
      {
        id: 'que-se-abre',
        title: 'Qué se abre',
        blocks: [
          p('Los cajones y puertas armados con **Agregar pieza** se abren solos. Una pieza o un grupo hecho a mano se marca en **Se abre**, en el panel de la pieza; ahí también se cambia el lado de la bisagra. Más: [Panel de la pieza](panel-pieza).'),
          tip('La **Foto del mueble** sale como lo dejaste: si sacás la foto con una puerta abierta, sale abierta.'),
        ],
      },
      {
        id: 'separar',
        title: 'Separar piezas',
        blocks: [
          p('La barra **Separar piezas** abre el mueble en despiece: cada pieza se aleja de su lugar por el camino por donde entra al armarlo. Corrila hasta **Separado** para ver cómo encaja todo, y volvé a **Todo armado** para cerrarlo.'),
          img('probar-separar', 'La cajonera separada en piezas, con la barra Separar piezas'),
          tip('Si sacás la **Foto del mueble** con las piezas separadas, la foto sale en despiece.'),
        ],
      },
    ],
    faq: [
      { q: 'Toco una pieza y no se abre', a: 'Solo se abren los cajones, puertas y tapas. Si es una puerta hecha a mano, elegila y marcá **Se abre: Puerta** en su panel.' },
      { q: '¿Abrir un cajón cambia las medidas?', a: 'No: probar no cambia nada del proyecto, ni los planos ni la lista de cortes.' },
    ],
    related: ['rayos-x', 'panel-pieza', 'foto-mueble'],
  },
  {
    id: 'vistas',
    topic: 'herramientas',
    title: 'Vistas y encuadre',
    summary: 'Mirar el mueble en 3D, de frente, de costado o desde arriba, y encuadrarlo.',
    intro: [p('Arriba del modelo están las vistas. Cambian desde dónde mirás el mueble, y algunas herramientas trabajan distinto según la vista.'), img('editor-vistas', 'Los botones de vista, marcados')],
    sections: [
      {
        id: 'cuatro',
        title: 'Las cuatro vistas',
        blocks: [
          table(
            ['Vista', 'Para qué sirve'],
            ['3D', 'Ver el mueble entero en perspectiva'],
            ['Frente', 'Mover piezas a lo ancho y a lo alto'],
            ['Costado', 'Mover piezas de fondo y a lo alto'],
            ['Arriba', 'Acomodar piezas sobre el piso, como en una planta'],
          ),
        ],
      },
      {
        id: 'girar',
        title: 'Girar, acercar y encuadrar',
        blocks: [
          list(
            'Arrastrá el fondo para girar la vista.',
            'Usá la rueda del mouse, o dos dedos en el celular, para acercarte o alejarte.',
            'El botón con cuatro esquinas encuadra todo el mueble.',
          ),
        ],
      },
      {
        id: 'panel',
        title: 'Más lugar para el modelo',
        blocks: [p('El botón al lado de las vistas pliega el panel de la derecha. Tocalo de nuevo para volver a abrirlo.')],
      },
      {
        id: 'veta',
        title: 'Veta o colores lisos',
        blocks: [
          p('Cada pieza se ve con la veta de su madera, a lo largo de la pieza: en las caras se ven las rayas y en las puntas, los anillos. Así se nota enseguida si una pieza quedó con la veta para el lado equivocado.'),
          steps('Tocá el botón de las tres rayas onduladas, al lado de las vistas, para ver las piezas de un color liso.', 'Tocalo de nuevo para volver a la veta.'),
          tip('En un equipo lento, los colores lisos hacen que el modelo se mueva más suelto. La app se acuerda de lo que elegiste.'),
        ],
      },
    ],
    faq: [{ q: 'Las flechas del teclado corren la pieza para otro lado', a: 'Siguen la vista: en Frente corren a lo ancho y a lo alto; en Arriba, a lo ancho y de fondo.' }],
    related: ['mover', 'pantalla-editor'],
  },
];

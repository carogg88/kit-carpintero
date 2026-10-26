import { img, key, list, note, p, steps, table, tip, type HelpContent } from './types';

/** Centro de ayuda en español. Cada artículo tiene su par en en.ts, con las mismas secciones y los mismos pasos. */
export const ES: HelpContent = {
  topics: [
    { id: 'empezar', icon: 'start', title: 'Empezar', summary: 'Crear un proyecto, conocer la pantalla del editor y guardar tu trabajo.' },
    { id: 'como-hacer', icon: 'recipe', title: 'Cómo hacer…', summary: 'Recetas cortas para lo que más se busca al armar un mueble.' },
    { id: 'atajos', icon: 'keys', title: 'Atajos de teclado', summary: 'Todas las teclas del editor en una tabla.' },
  ],
  popular: ['crear-proyecto', 'pantalla-editor', 'unir', 'altura', 'guardar'],
  suggestions: ['Subir una pieza', 'Agregar un cajón', 'Guardar una copia', 'Pulgadas'],
  articles: [
    {
      id: 'que-es',
      topic: 'empezar',
      title: 'Qué es Calibre Studio',
      summary: 'Para qué sirve la app y cómo es el camino de un proyecto, del diseño al armado.',
      intro: [
        p('Calibre Studio es una app para diseñar muebles de madera pieza por pieza. Armás el mueble en 3D, elegís cómo se unen las piezas y la app te da la lista de cortes, el plano para imprimir y el paso a paso para armarlo.'),
        img('inicio', 'El inicio de Calibre Studio, con los proyectos y las plantillas'),
      ],
      sections: [
        {
          id: 'camino',
          title: 'El camino de un proyecto',
          blocks: [
            p('Cada proyecto tiene cinco partes, en las pestañas de arriba del editor. Se recorren en este orden:'),
            steps(
              '**Modelo**: el mueble en 3D. Acá agregás piezas, les cambiás las medidas y las ubicás.',
              '**Uniones**: cada encastre entre dos piezas, con sus medidas. Las uniones aparecen solas cuando dos piezas se tocan.',
              '**Cortes**: la lista de piezas a cortar, qué tablas o placas comprar y el presupuesto.',
              '**Plano**: las hojas para imprimir, con las medidas de cada pieza y las plantillas 1:1.',
              '**Armado**: el orden para encolar y armar el mueble, paso a paso.',
            ),
            tip('Arriba, al lado del nombre del proyecto, **¿Qué sigue?** te dice cuál es el próximo paso.'),
          ],
        },
        {
          id: 'gratis',
          title: 'Sin cuenta y en tu dispositivo',
          blocks: [
            list(
              'No hace falta crear una cuenta ni pagar nada.',
              'Los proyectos se guardan solo en este navegador. No se suben a ningún lado.',
              'Una vez abierta, la app funciona sin conexión. Si la instalás, se abre como cualquier otra app.',
            ),
            note('Como los proyectos viven en el navegador, guardá una copia en archivo de vez en cuando. Más información: [Guardar, abrir y hacer copia](guardar).'),
          ],
        },
      ],
      faq: [
        { q: '¿Necesito saber carpintería?', a: 'No hace falta ser experto: la app te propone uniones y medidas habituales, y cada palabra de taller tiene un botón ? que la explica con un dibujo.' },
        { q: '¿Sirve para cualquier mueble?', a: 'Sirve para muebles hechos con piezas rectas: mesas, bancos, estantes, cajoneras, cajas. Las patas pueden ir torneadas o con tramos más finos.' },
      ],
      related: ['crear-proyecto', 'pantalla-editor', 'guardar'],
    },
    {
      id: 'crear-proyecto',
      topic: 'empezar',
      title: 'Crear un proyecto',
      summary: 'Empezar desde una plantilla, desde una foto con medidas o en blanco.',
      intro: [p('Hay tres maneras de empezar un mueble. La más rápida es una plantilla: ya trae todas las piezas con sus uniones y solo cambiás las medidas.')],
      sections: [
        {
          id: 'plantilla',
          title: 'Desde una plantilla',
          blocks: [
            steps(
              'En el inicio, tocá **Desde una plantilla** o una de las **Plantillas rápidas**.',
              'Elegí el mueble: mesa, taburete, estante, cajonera, biblioteca, banco y más.',
              'Completá las **Medidas generales**. Al tocar una medida, el dibujo marca qué parte del mueble cambia.',
              'Si querés, abrí **Piezas** y **Madera y uniones** para ajustar espesores, la madera y el tipo de unión.',
              'Tocá **Crear** y el mueble se abre en el editor.',
            ),
            img('plantilla', 'El formulario de la plantilla Mesa, con el dibujo 3D a la izquierda'),
            tip('Arriba a la derecha del formulario elegís centímetros o pulgadas.'),
          ],
        },
        {
          id: 'foto',
          title: 'Desde una foto',
          blocks: [
            p('Sirve para copiar un mueble que viste: calcás las medidas sobre una foto. La foto queda en tu dispositivo.'),
            steps(
              'En el inicio, tocá **Desde una foto** y elegí qué mueble es.',
              'Elegí o sacá la foto. Sacala de frente, con el mueble entero.',
              'Tocá los dos extremos de algo que sepas cuánto mide y escribí la medida.',
              'Calcá el resto de las medidas tocando dos puntos para cada una.',
              'Tocá **Revisar medidas**: se abre la plantilla con lo que calcaste y completás lo que no se veía.',
            ),
            img('foto', 'El primer paso de Nuevo desde foto'),
          ],
        },
        {
          id: 'blanco',
          title: 'En blanco',
          blocks: [
            p('Abre el editor sin piezas. Agregás cada tabla o listón con **Agregar pieza**. Conviene cuando el mueble no se parece a ninguna plantilla.'),
          ],
        },
        {
          id: 'practica',
          title: 'Para aprender: el taburete de práctica',
          blocks: [
            p('**Aprender con un taburete**, arriba en el inicio, arma un taburete y te muestra el editor con un recorrido guiado de 10 pasos.'),
          ],
        },
      ],
      faq: [
        { q: '¿Puedo cambiar las medidas después de crear el mueble?', a: 'Sí. En el editor, con ninguna pieza elegida, abrí **Medidas del mueble**: las piezas largas se estiran y las demás se corren.' },
        { q: '¿Qué madera elijo?', a: 'La plantilla propone una. En el formulario, **Madera** muestra cada una con su dureza; la podés cambiar después pieza por pieza.' },
      ],
      related: ['pantalla-editor', 'medidas', 'que-es'],
    },
    {
      id: 'pantalla-editor',
      topic: 'empezar',
      title: 'La pantalla del editor',
      summary: 'Qué hay en cada parte del editor: la barra de arriba, las herramientas, las vistas y el panel.',
      intro: [
        p('El editor tiene cuatro partes: la barra de arriba, las herramientas a la izquierda, el modelo con sus vistas en el medio y el panel a la derecha. En el celular se acomodan distinto, como se ve al final.'),
        img('editor', 'El editor con una mesa: barra de arriba, herramientas, modelo y panel'),
      ],
      sections: [
        {
          id: 'barra',
          title: 'La barra de arriba',
          blocks: [
            img('editor-barra', 'La barra de arriba del editor, marcada'),
            p('De izquierda a derecha:'),
            list(
              '**Logo y flecha**: vuelven al inicio. El proyecto ya está guardado.',
              '**Nombre del proyecto**: tocalo para cambiarlo. Debajo dice si está guardado.',
              '**¿Qué sigue?**: el próximo paso del proyecto. La cruz lo cierra.',
              '**Pestañas**: Modelo, Uniones (con la cantidad de uniones), Cortes, Plano y Armado.',
              '**?**: abre este Centro de ayuda.',
              '**Compartir**: un enlace con el proyecto, o la lista de compras como texto.',
              '**Deshacer y Rehacer**: vuelven atrás o adelante el último cambio.',
              '**cm y pulgadas**: las unidades en que se ven y se escriben las medidas.',
            ),
          ],
        },
        {
          id: 'herramientas',
          title: 'Las herramientas',
          blocks: [
            img('editor-herramientas', 'La barra de herramientas, marcada'),
            p('A la izquierda, de arriba hacia abajo. Cada una tiene su tecla:'),
            table(
              ['Herramienta', 'Para qué sirve', 'Tecla'],
              ['Elegir', 'Tocar una pieza para verla en el panel', '`V`'],
              ['Estirar', 'Arrastrar una cara para alargar o acortar', '`P`'],
              ['Mover', 'Llevar la pieza a otro lugar; en Frente o Costado, subirla', '`M`'],
              ['Dibujar', 'Hacer agujeros, vaciados y calados en una cara', '`D`'],
              ['Biselar', 'Bisel o canto redondeado en una arista', '`B`'],
              ['Tramo', 'Una parte más gruesa o más fina, como en una pata', '`T`'],
              ['Tornear', 'Pata o barrote torneado, con modelos', '`R`'],
              ['Medir', 'Distancia entre piezas y si una quedó centrada', '`C`'],
              ['Rayos X', 'Ver a través de las piezas los encastres de adentro', '`X`'],
            ),
            tip('Al elegir una herramienta aparece abajo una guía con sus pasos.'),
          ],
        },
        {
          id: 'vistas',
          title: 'El modelo y las vistas',
          blocks: [
            img('editor-vistas', 'Los botones de vista, marcados'),
            list(
              '**3D, Frente, Costado y Arriba** cambian desde dónde mirás el mueble.',
              'El botón con cuatro esquinas **encuadra** todo el mueble si te perdiste.',
              'Arrastrá el fondo para girar la vista y usá la rueda del mouse (o dos dedos) para acercarte.',
              '**Elegir varias**, arriba a la izquierda, sirve para elegir varias piezas tocándolas.',
            ),
          ],
        },
        {
          id: 'panel',
          title: 'El panel',
          blocks: [
            img('editor-panel', 'El panel de la derecha, marcado'),
            p('El panel cambia según lo que esté elegido:'),
            list(
              '**Sin nada elegido**: las medidas de todo el mueble, la revisión del diseño, la proporción áurea, la lista de piezas y **Agregar pieza**.',
              '**Con una pieza elegida**: sus medidas, su posición, Girar 90°, la madera, los cantos y sus uniones. Abajo, Duplicar, Del otro lado y Borrar.',
            ),
            p('El botón al lado de las vistas pliega el panel para ver el modelo más grande.'),
          ],
        },
        {
          id: 'avisos',
          title: 'Avisos y vista previa',
          blocks: [
            list(
              'Después de cada cambio aparece abajo un aviso de qué cambió, con **Deshacer**.',
              'Los cambios grandes (medidas del mueble, duplicar, borrar, cajones) muestran primero una vista previa: nada cambia hasta que tocás **Aplicar**.',
            ),
          ],
        },
        {
          id: 'celular',
          title: 'En el celular',
          blocks: [
            img('editor-celular', 'El editor en el celular', true),
            list(
              'Las herramientas van en una barra abajo del modelo. Biselar, Tramo, Tornear, Medir y Rayos X están en **Más**.',
              'Las pestañas van en la barra de abajo de todo.',
              'El panel queda debajo del modelo: deslizá hacia arriba para verlo.',
              'El botón **+ Pieza** agrega una pieza.',
            ),
          ],
        },
      ],
      faq: [
        { q: '¿Cómo vuelvo a ver todo el mueble?', a: 'Tocá el botón de encuadrar, al lado de Arriba, o **Ver el mueble** en el panel para soltar la pieza elegida.' },
        { q: 'Desapareció una pieza, ¿qué pasó?', a: 'Puede estar oculta. Si hay piezas ocultas, la vista muestra **Mostrar todo**. Si la borraste, tocá Deshacer.' },
      ],
      related: ['atajos-teclado', 'crear-proyecto', 'deshacer'],
    },
    {
      id: 'guardar',
      topic: 'empezar',
      title: 'Guardar, abrir y hacer copia',
      summary: 'Dónde se guardan los proyectos, cómo guardar una copia en archivo y cómo abrirla.',
      intro: [p('Cada cambio se guarda solo, en este navegador. Para no perder un proyecto si se borran los datos del navegador, o para pasarlo a otra compu, guardá una copia en archivo.')],
      sections: [
        {
          id: 'solo',
          title: 'Se guarda solo',
          blocks: [p('Debajo del nombre del proyecto dice **Guardado en este dispositivo**. No hay botón de guardar: cada cambio queda guardado al momento.')],
        },
        {
          id: 'copia',
          title: 'Guardar una copia en archivo',
          blocks: [
            steps(
              'En el inicio, buscá el proyecto. Su etiqueta dice **Sin copia en archivo**, **Cambió desde la copia** o **Copia al día**.',
              'Tocá **Guardar copia**, o el menú ⋮ del proyecto y después **Exportar archivo**.',
              'Se descarga un archivo que termina en .kitc.json. Guardalo donde quieras.',
            ),
            img('guardar', 'El menú ⋮ de un proyecto, abierto'),
          ],
        },
        {
          id: 'abrir',
          title: 'Abrir un archivo',
          blocks: [steps('En el inicio, en Mis proyectos, tocá **Abrir archivo**.', 'Elegí el archivo .kitc.json. El proyecto se abre en el editor y queda guardado en este navegador.')],
        },
        {
          id: 'menu',
          title: 'Cambiar nombre y eliminar',
          blocks: [
            p('El menú ⋮ de cada proyecto también tiene **Cambiar nombre**, **Ir al plano** y **Eliminar**.'),
            note('Eliminar no se puede deshacer. Si tenés una copia en archivo, la podés volver a abrir.'),
          ],
        },
      ],
      faq: [
        { q: '¿Puedo seguir el proyecto en otra compu?', a: 'Sí: guardá la copia en archivo y abrila en la otra con **Abrir archivo**. También podés mandarte el enlace de **Compartir**.' },
        { q: '¿Se pierde algo si cierro el navegador?', a: 'No. Lo único que borra los proyectos es borrar los datos de navegación de este sitio.' },
      ],
      related: ['nombre', 'que-es'],
    },
    {
      id: 'unidades',
      topic: 'empezar',
      title: 'Unidades e idioma',
      summary: 'Trabajar en centímetros o en pulgadas, cómo escribir las medidas y cambiar el idioma.',
      intro: [p('Cada proyecto se puede ver en centímetros o en pulgadas, y la app está en español y en inglés.')],
      sections: [
        {
          id: 'cm-pulgadas',
          title: 'Centímetros o pulgadas',
          blocks: [
            steps('Arriba a la derecha del editor, tocá **cm** o **pulgadas**.', 'Todas las medidas, los cortes y el plano pasan a esa unidad. Las piezas no cambian de tamaño.'),
            img('unidades', 'El cambio de unidades en la barra de arriba, marcado'),
          ],
        },
        {
          id: 'escribir',
          title: 'Cómo escribir una medida',
          blocks: [
            list(
              'En centímetros, con coma o con punto: **72,5** o **72.5**.',
              'En pulgadas, con fracciones: **2 7/8**, **3/4** o **1.5**.',
              'Apretá `Enter` para confirmar. Mientras escribís, el modelo muestra en fantasma cómo va a quedar.',
            ),
            tip('En pulgadas, las medidas se redondean a 1/16″; en centímetros, al milímetro.'),
          ],
        },
        {
          id: 'idioma',
          title: 'Cambiar el idioma',
          blocks: [p('En el inicio, arriba a la derecha, tocá **ES** o **EN**. La app se vuelve a abrir en ese idioma.')],
        },
      ],
      faq: [{ q: 'Las maderas se venden en pulgadas, ¿qué conviene?', a: 'Podés diseñar en centímetros: la lista de cortes ya dice qué tabla comprar con sus medidas de corralón.' }],
      related: ['crear-proyecto', 'pantalla-editor'],
    },
    {
      id: 'instalar',
      topic: 'empezar',
      title: 'Instalar en el celular o la compu',
      summary: 'Tener Calibre Studio como una app más y usarla sin conexión.',
      intro: [p('Calibre Studio se puede instalar como una app. Se abre desde el escritorio o la pantalla de inicio, a pantalla completa y sin conexión.')],
      sections: [
        {
          id: 'compu',
          title: 'En la compu o en Android',
          blocks: [steps('Abrí Calibre Studio en Chrome o Edge.', 'En el inicio, tocá **Instalar la app**. Si no aparece, tu navegador no lo permite o ya está instalada.')],
        },
        {
          id: 'iphone',
          title: 'En iPhone o iPad',
          blocks: [steps('Abrí Calibre Studio en Safari.', 'Tocá Compartir y después **Agregar a inicio**.')],
        },
      ],
      faq: [{ q: '¿La app instalada tiene mis proyectos?', a: 'Sí, si la instalaste desde el mismo navegador donde los creaste.' }],
      related: ['guardar', 'que-es'],
    },
    {
      id: 'atajos-teclado',
      topic: 'atajos',
      title: 'Atajos de teclado',
      summary: 'Todas las teclas del editor: herramientas, piezas, flechas y deshacer.',
      intro: [p('En la compu, casi todo el editor se maneja también con el teclado. Las teclas no hacen nada mientras escribís en un campo.')],
      sections: [
        {
          id: 'herramientas',
          title: 'Herramientas',
          blocks: [
            table(
              ['Tecla', 'Qué hace'],
              ['`V`', 'Elegir'],
              ['`P`', 'Estirar'],
              ['`M`', 'Mover'],
              ['`D`', 'Dibujar'],
              ['`B`', 'Biselar'],
              ['`T`', 'Tramo'],
              ['`R`', 'Tornear'],
              ['`C`', 'Medir'],
              ['`X`', 'Rayos X (prende y apaga)'],
            ),
          ],
        },
        {
          id: 'piezas',
          title: 'Piezas',
          blocks: [
            table(
              ['Tecla', 'Qué hace'],
              ['`Shift` + clic', 'Sumar o sacar una pieza de las elegidas'],
              ['`G`', 'Agrupar las piezas elegidas'],
              ['`H`', 'Ocultar la pieza elegida'],
              ['`S`', 'Ver sola la pieza elegida'],
              ['`Supr` o `Borrar`', 'Borrar la pieza elegida, con vista previa'],
              ['`Esc`', 'Soltar la pieza, cancelar la vista previa o salir de lo que estás haciendo'],
            ),
          ],
        },
        {
          id: 'flechas',
          title: 'Correr con las flechas',
          blocks: [
            table(['Tecla', 'Qué hace'], ['Flechas', 'Correr la pieza o el grupo 1 mm'], ['`Shift` + flechas', 'Correr 10 mm']),
            p('Las flechas siguen la vista: en Frente corren a lo ancho y a lo alto; en Arriba, a lo ancho y de fondo.'),
          ],
        },
        {
          id: 'deshacer',
          title: 'Deshacer y medidas',
          blocks: [
            table(
              ['Tecla', 'Qué hace'],
              ['`Ctrl` + `Z`', 'Deshacer'],
              ['`Ctrl` + `Y` o `Ctrl` + `Shift` + `Z`', 'Rehacer'],
              ['`Enter`', 'Confirmar la medida que escribiste'],
            ),
            key('En Mac, usá `Cmd` en lugar de `Ctrl`.'),
          ],
        },
      ],
      related: ['pantalla-editor', 'flechas'],
    },
  ],
};

import { img, list, note, p, steps, table, tip, type Article } from './types';

/**
 * Temas de alto nivel: Uniones, Cortes y compras, Plano y armado, y Compartir y exportar. Qué es cada cosa, dónde
 * está y para qué sirve, en pocos pasos. Su par en inglés es en-resto.ts.
 */
export const ES_REST: Article[] = [
  {
    id: 'tipos-union',
    topic: 'encastres',
    title: 'Los tipos de unión',
    summary: 'Qué encastres ofrece la app, cuál conviene y con qué herramientas se hace cada uno.',
    intro: [
      p('Cuando dos piezas se tocan, la app propone un encastre y te ofrece solo los que se pueden hacer en ese lugar. En **Uniones** están todas, agrupadas por dónde van: patas con faldones, estantes con laterales, y así.'),
      img('uniones', 'La sección Uniones: la lista de grupos a la izquierda y el detalle a la derecha'),
    ],
    sections: [
      {
        id: 'elegir',
        title: 'Cambiar el tipo',
        blocks: [
          steps(
            'Andá a **Uniones**, en las pestañas de arriba, y elegí una unión de la lista.',
            'En **Tipo de encastre**, tocá **Cambiar**.',
            'Elegí uno. El que lleva **Recomendado** es el que conviene para esas piezas; cada uno dice su dificultad, y la (i) muestra un dibujo y cómo se hace.',
          ),
          tip('También se cambia desde el panel de la pieza, en **Uniones**, con la lista de cada renglón.'),
        ],
      },
      {
        id: 'tipos',
        title: 'Los encastres',
        blocks: [
          table(
            ['Encastre', 'Dificultad', 'Se hace con'],
            ['A tope', 'Fácil', 'Atornillador y prensas'],
            ['Tarugos', 'Fácil', 'Taladro y plantilla para tarugos'],
            ['Tornillo de bolsillo', 'Fácil', 'Taladro y plantilla de bolsillo'],
            ['Galleta', 'Fácil', 'Galletera'],
            ['Rebaje y canal', 'Fácil', 'Fresadora o sierra de mesa'],
            ['Media madera', 'Media', 'Serrucho y formón, o fresadora'],
            ['Machimbre', 'Media', 'Fresas de machimbre o sierra de mesa'],
            ['Brida', 'Media', 'Sierra de cinta o de mesa, y formón'],
            ['Mortaja y espiga', 'Media', 'Escoplo o fresadora, y serrucho para la espiga'],
            ['Ensamble de dedos', 'Media', 'Sierra de mesa con patrón de dedos'],
            ['Inglete', 'Media', 'Ingletadora o sierra de mesa inclinada'],
            ['Cola de milano', 'Difícil', 'Serrucho de costilla, formón y falsa escuadra'],
          ),
          note('A tope entre dos piezas que se cruzan se llama **Apoyado en muesca**: una apoya en una muesca de la otra.'),
        ],
      },
    ],
    faq: [
      { q: '¿Por qué no aparece la cola de milano en una unión?', a: 'Solo se ofrecen los encastres que se pueden hacer con esas piezas en esa posición.' },
      { q: 'Dos piezas se tocan y no tienen unión', a: 'Acercalas con Mover hasta que se toquen de verdad: la unión aparece cuando las caras se apoyan.' },
    ],
    related: ['medidas-union', 'encastre-cerca', 'unir'],
  },
  {
    id: 'medidas-union',
    topic: 'encastres',
    title: 'Medidas de una unión o de todo el grupo',
    summary: 'Cambiar el largo, el espesor o el hombro de un encastre, en una unión o en todas las del grupo.',
    intro: [
      p('Cada encastre trae medidas pensadas con las reglas de taller, como la del tercio para las espigas. Si querés otras, las cambiás en el detalle de la unión y ves al momento qué cambia en los cortes.'),
      img('uniones-medidas', 'Un largo de espiga nuevo, con la vista previa para aplicarlo a todo el grupo'),
    ],
    sections: [
      {
        id: 'una',
        title: 'Una unión',
        blocks: [
          steps(
            'En **Uniones**, elegí la unión.',
            'En las medidas del encastre, cambiá el largo, el espesor, el hombro o la cantidad. Mientras escribís, el detalle 3D muestra cómo queda.',
            'Debajo, **Qué cambia en los cortes** dice cuánto se suma al largo de corte de cada pieza.',
          ),
          p('La nota con la (i) recuerda la regla de ese encastre: la espiga de un tercio del espesor, el tarugo de la mitad, la pendiente 1:8 de las colas.'),
        ],
      },
      {
        id: 'grupo',
        title: 'Todas las del grupo',
        blocks: [
          steps(
            'Dejá tildado **Aplicar a las uniones** del grupo, abajo en el detalle.',
            'Cambiá la medida o el tipo. Aparece una vista previa con lo que cambia.',
            'Tocá **Aplicar a las…** con la cantidad, o **Cancelar**.',
          ),
          tip('Así las cuatro patas de una mesa quedan con las mismas espigas en un solo cambio.'),
        ],
      },
    ],
    faq: [
      { q: 'Aparece un aviso de espiga gruesa', a: 'La espiga pasa del tercio del espesor de la pieza: los hombros quedan finos. Bajala a la medida que dice el aviso.' },
      { q: '¿Cómo hago una espiga doble?', a: 'En una mortaja, en **Espigas** elegí **Doble**: salen dos espigas lado a lado, con madera en el medio, y en **Entre espigas** ponés cuánta. Conviene en piezas anchas, como un faldón alto: se mueven menos y la pata queda más fuerte. Si la espiga pasa de 9 cm de ancho, la revisión del diseño te lo propone.' },
      { q: '¿El cambio en el detalle se ve también en el modelo?', a: 'Sí: el modelo, la lista de cortes y el plano usan las mismas medidas.' },
    ],
    related: ['uniones', 'tipos-union', 'revision'],
  },
  {
    id: 'encastre-cerca',
    topic: 'encastres',
    title: 'Ver un encastre de cerca',
    summary: 'El detalle 3D de una unión, con las piezas juntas o separadas.',
    intro: [
      p('El detalle de cada unión muestra las dos piezas en 3D, con la que recibe en rayos X para ver el encastre adentro. **Separar piezas** saca la espiga de la caja para ver las dos partes.'),
      img('uniones-cerca', 'El detalle de una espiga con las piezas separadas'),
    ],
    sections: [
      {
        id: 'abrir',
        title: 'Abrir el detalle',
        blocks: [
          list(
            'En **Uniones**, elegí una unión de la lista.',
            'Desde el modelo: elegí una pieza, abrí **Uniones** en su panel y tocá la lupa de la unión.',
          ),
        ],
      },
      {
        id: 'mirar',
        title: 'Mirarlo',
        blocks: [
          list(
            'Arrastrá el detalle para girarlo.',
            'Tocá **Separar piezas** para verlas una al lado de la otra, y **Juntar** para volver.',
            'Separar queda elegido para las otras uniones mientras la app esté abierta.',
          ),
        ],
      },
    ],
    faq: [
      { q: 'El detalle dice que el encastre no se pudo cortar del todo', a: 'Alguna medida no entra en la pieza. Revisá el largo y el espesor del encastre.' },
      { q: '¿Puedo ver los encastres en el modelo entero?', a: 'Sí: prendé **Rayos X** con la tecla `X`.' },
    ],
    related: ['cerca', 'rayos-x', 'medidas-union'],
  },
  {
    id: 'lista-cortes',
    topic: 'compras',
    title: 'Lista de cortes y tablas',
    summary: 'Qué cortar, de qué tablas sale cada pieza y qué comprar en la maderera.',
    intro: [
      p('**Cortes** arma la lista de piezas con su medida de corte, ya con las espigas y lengüetas sumadas, y calcula qué tablas comprar y cómo cortar cada una. Las medidas son las comerciales de las madereras de Buenos Aires.'),
      img('cortes', 'La sección Cortes: la lista de piezas y el resumen de compra'),
    ],
    sections: [
      {
        id: 'piezas',
        title: 'La lista de piezas',
        blocks: [
          p('La pestaña **Piezas** tiene una fila por pieza (o por piezas iguales): código, cantidad, **Largo de corte**, **Ancho × espesor**, madera y el trabajo que lleva, como espigas o colas en las puntas.'),
          note('Si una pieza es más larga que las tablas de la maderera (3,66 m), un aviso lo dice: hay que empalmar o pedir un largo especial.'),
        ],
      },
      {
        id: 'tablas',
        title: 'Cómo cortar cada tabla',
        blocks: [
          steps(
            'Tocá la pestaña **Cómo cortar**.',
            'Cada tabla muestra qué piezas salen de ella y cuánto sobra. Cada corte ya suma el ancho de la sierra.',
          ),
        ],
      },
      {
        id: 'comprar',
        title: 'Qué comprar',
        blocks: [
          list(
            'A la derecha, **Para comprar en la maderera** dice cuántos pies de madera son, cuántas placas y el desperdicio.',
            'Debajo están las **Tablas**, las **Placas** y los **Herrajes y otros**, con la cantidad de cada uno.',
            'Al final, una nota sobre cada madera del proyecto y otras que sirven.',
          ),
          tip('El desperdicio siempre existe: las tablas vienen en largos fijos. Guardá los retazos para probar los encastres.'),
        ],
      },
    ],
    faq: [
      { q: '¿Qué es un pie de madera?', a: 'La unidad en que se vende la madera maciza: una tabla de 1 pie de largo, 1 pie de ancho y 1 pulgada de espesor. La (?) al lado lo explica.' },
      { q: '¿Las piezas ocultas en el modelo están en la lista?', a: 'Sí: la lista lleva siempre todas las piezas.' },
    ],
    related: ['comprar', 'placas', 'presupuesto'],
  },
  {
    id: 'placas',
    topic: 'compras',
    title: 'Placas: MDF, melamina, terciado',
    summary: 'Hacer piezas de placa y saber cuántas placas comprar y cómo cortarlas.',
    intro: [p('Además de madera maciza, una pieza puede ser de placa: **MDF**, **Melamina blanca**, **Terciado** o **Multilaminado**. Las placas vienen enteras, en espesores fijos, y la app arma el despiece para cortarlas.')],
    sections: [
      {
        id: 'elegir',
        title: 'Hacer una pieza de placa',
        blocks: [
          steps('Elegí la pieza.', 'En **Madera**, elegí una placa. La pieza pasa al espesor de placa más cercano.'),
          tip('Las traseras y los fondos de cajón que arma la app ya salen de terciado de 9 mm.'),
        ],
      },
      {
        id: 'cortar',
        title: 'Cuántas placas y cómo cortarlas',
        blocks: [
          list(
            'En **Cortes**, el resumen dice cuántas placas comprar.',
            'En **Cómo cortar**, cada placa muestra dónde va cada pieza, con el corte de la sierra y el recorte de cada borde ya contados.',
            'La lista de herrajes suma el tapacanto para los cantos a la vista.',
          ),
          note('Las casas de placas cortan a medida y pegan el tapacanto: llevá la planilla exportada, que trae el despiece.'),
        ],
      },
      {
        id: 'cual',
        title: 'Cuál usar',
        blocks: [
          table(
            ['Placa', 'Para qué'],
            ['MDF', 'Lisa y pareja, para pintar o laquear. No le gusta la humedad.'],
            ['Melamina blanca', 'Lista para usar, con tapacanto en los cantos. Se arma con tarugos o tornillos.'],
            ['Terciado', 'Liviano y firme: traseras y fondos de cajón.'],
            ['Multilaminado', 'Muy estable, con el canto prolijo para dejarlo a la vista.'],
          ),
        ],
      },
    ],
    faq: [
      { q: 'Un aviso dice que la pieza no sale de una placa', a: 'Es más grande que la placa entera, o más gruesa que las que se consiguen. Pasala a madera maciza o achicala.' },
      { q: '¿Puedo mezclar placas y madera maciza?', a: 'Sí: cada pieza tiene su material, y Cortes separa lo de la maderera de lo del corralón.' },
    ],
    related: ['lista-cortes', 'panel-pieza', 'presupuesto'],
  },
  {
    id: 'herrajes',
    topic: 'compras',
    title: 'Herrajes',
    summary: 'Tornillos, tarugos, bisagras, correderas y lo demás que lleva el mueble.',
    intro: [p('La app suma sola lo que hay que comprar además de la madera, según las uniones y lo que tiene el mueble: tarugos y galletas para los encastres, correderas y tiradores para los cajones, bisagras para las puertas, soportes para los estantes, lija y terminación.')],
    sections: [
      {
        id: 'ver',
        title: 'Dónde está la lista',
        blocks: [
          steps('Andá a **Cortes**.', 'Abrí **Herrajes y otros**, a la derecha (en el celular, abajo de la lista de compras).'),
          p('Cada renglón dice qué es y cuánto llevar.'),
        ],
      },
      {
        id: 'de-donde',
        title: 'De dónde sale cada cosa',
        blocks: [
          table(
            ['Lo que tiene el mueble', 'Lo que suma'],
            ['Uniones con tarugos, galletas o tornillos de bolsillo', 'Los tarugos, las galletas o los tornillos, con su medida'],
            ['Cajones', 'Tiradores y, si son metálicas, correderas del largo que corresponde'],
            ['Puertas', 'Bisagras de cazoleta y tiradores'],
            ['Estantes regulables', 'Soportes de 5 mm'],
            ['Un mueble alto que se puede volcar', 'Escuadras antivuelco'],
            ['Placas con cantos a la vista', 'Tapacanto'],
            ['Todo el mueble', 'Lija y la terminación que va con la madera'],
          ),
        ],
      },
    ],
    faq: [
      { q: '¿Puedo agregar un herraje a mano?', a: 'Todavía no. La lista sale del modelo: si cambiás una unión, la lista cambia con ella.' },
      { q: '¿Entran en el presupuesto?', a: 'Sí: en **Presupuesto** cargás el precio de cada uno.' },
    ],
    related: ['presupuesto', 'cajones-puertas', 'lista-cortes'],
  },
  {
    id: 'presupuesto',
    topic: 'compras',
    title: 'Presupuesto',
    summary: 'Cargar precios y ver cuánto sale el mueble, y cuánto saldría en otra madera.',
    intro: [
      p('Con los precios de tu maderera, el presupuesto calcula cuánto sale el mueble: la madera por pie, las placas y los herrajes. Los precios quedan guardados en este dispositivo para los próximos proyectos.'),
      img('presupuesto', 'La pestaña Presupuesto en Cortes'),
    ],
    sections: [
      {
        id: 'cargar',
        title: 'Cargar los precios',
        blocks: [
          steps(
            'En **Cortes**, tocá la pestaña **Presupuesto**, o **Cargar precios** en el resumen de la derecha.',
            'Escribí el precio por pie de cada madera, por placa de cada placa y el de cada herraje.',
            'El **Total aproximado** se actualiza con cada precio.',
          ),
        ],
      },
      {
        id: 'comparar',
        title: 'Comparar con otra madera',
        blocks: [
          steps(
            'Abrí **Comparar precios de maderas**. Es opcional.',
            'Cargá el precio por pie de otras maderas: ves cuánto saldría la madera maciza de este mueble en cada una.',
          ),
        ],
      },
    ],
    faq: [
      { q: '¿Los precios se comparten con alguien?', a: 'No. Quedan en este dispositivo; no hay servidor ni cuenta.' },
      { q: 'No aparece el total', a: 'Aparece cuando cargás al menos un precio. Mientras falte alguno, el resumen dice **Cargar precios**.' },
    ],
    related: ['lista-cortes', 'herrajes', 'comprar'],
  },
  {
    id: 'plano',
    topic: 'plano-armado',
    title: 'El plano y cómo imprimirlo',
    summary: 'Las hojas del plano, las capas y cómo guardarlo en PDF.',
    intro: [
      p('**Plano** dibuja el mueble en hojas A4 apaisadas, con cotas y escala, listo para imprimir o llevar en el celular. Cada pieza lleva su código, el mismo que en la lista de cortes y en Uniones.'),
      img('plano', 'La sección Plano: la lista de hojas, las capas y la hoja elegida'),
    ],
    sections: [
      {
        id: 'hojas',
        title: 'Las hojas',
        blocks: [
          table(
            ['Hoja', 'Qué tiene'],
            ['Vistas generales', 'Frente, costado y planta, con las medidas del mueble'],
            ['El mueble armado', 'El mueble en 3D, con el código de cada pieza'],
            ['Despiece', 'Cada pieza acotada'],
            ['Encastres', 'Cada tipo de encastre en detalle'],
            ['Plantillas 1:1', 'Las curvas y el torneado a tamaño real, si el mueble los tiene'],
          ),
          p('Tocá una hoja en la lista para verla. Con los botones de zoom, pellizcando o con dos toques, la agrandás.'),
        ],
      },
      {
        id: 'capas',
        title: 'Capas',
        blocks: [p('En **Capas** prendés o apagás los contornos, las cotas, las líneas ocultas, los encastres resaltados y las notas. Sirve para imprimir una hoja más limpia.')],
      },
      {
        id: 'pdf',
        title: 'Guardarlo en PDF',
        blocks: [
          steps('Tocá **Descargar PDF**.', 'Se abre la ventana de impresión: elegí **Guardar como PDF**.', 'Salen todas las hojas en A4 apaisado.'),
          tip('Desde el inicio, el menú ⋮ de cada proyecto tiene **Ir al plano**.'),
        ],
      },
    ],
    faq: [
      { q: '¿Qué quiere decir escala 1:10?', a: 'Que 1 cm en la hoja son 10 cm de verdad. No hace falta medir el papel: las cotas dicen la medida real.' },
      { q: '¿Las piezas ocultas salen en el plano?', a: 'Sí: el plano lleva siempre todas.' },
    ],
    related: ['plantillas', 'armado', 'exportar'],
  },
  {
    id: 'plantillas',
    topic: 'plano-armado',
    title: 'Plantillas 1:1',
    summary: 'Imprimir curvas, calados y torneados a tamaño real para calcarlos sobre la madera.',
    intro: [p('Si una pieza tiene curvas, calados o un torneado, el plano suma hojas a tamaño real: se imprimen, se recortan y se calcan sobre la madera, sin medir.')],
    sections: [
      {
        id: 'imprimir',
        title: 'Imprimirlas',
        blocks: [
          steps(
            'En **Plano**, tocá **Imprimir solo la plantilla 1:1** (si son varias hojas, el botón dice cuántas).',
            'Imprimí al 100 %, sin "ajustar a la página".',
            'Medí la barra de control de la hoja: tiene que medir 10 cm justos.',
          ),
          note('Si la barra no mide 10 cm, la impresora achicó la hoja. Buscá en las opciones de impresión el tamaño real o 100 %.'),
        ],
      },
      {
        id: 'usar',
        title: 'Usarlas',
        blocks: [
          list(
            'Lo rayado es lo que se saca: calcá la línea gruesa.',
            'Una pieza que no entra en una hoja sale en varias: recortá por la línea de puntos y pegá cada hoja sobre la anterior, haciendo coincidir las cruces.',
            'El torneado trae el perfil con cada estación: con el calibre llevás cada diámetro a su lugar.',
          ),
        ],
      },
    ],
    faq: [
      { q: 'No veo el botón de plantillas', a: 'Aparece cuando alguna pieza tiene curvas, calados o un torneado.' },
      { q: 'Una esquina dice que sirve para varias', a: 'Las esquinas iguales comparten la plantilla: girá la hoja para cada una.' },
    ],
    related: ['plano', 'dibujar', 'tornear'],
  },
  {
    id: 'armado',
    topic: 'plano-armado',
    title: 'Armado paso a paso',
    summary: 'El orden de trabajo del mueble, de la madera cortada al mueble terminado.',
    intro: [
      p('**Armado** te da el orden de trabajo para este mueble: cortar, marcar, hacer los encastres de a un tipo por vez, presentar en seco, lijar, encolar y terminar. Cada paso dice qué piezas toca.'),
      img('armado', 'La sección Armado, con la lista de pasos y el paso elegido'),
    ],
    sections: [
      {
        id: 'usar',
        title: 'Seguir los pasos',
        blocks: [
          steps(
            'Andá a **Armado**, en las pestañas de arriba.',
            'Leé el paso y tocá **Marcar como hecho** cuando lo termines.',
            'Pasá al siguiente con **Siguiente paso**, o elegí cualquiera en la lista.',
          ),
          p('Arriba dice cuántos pasos llevás hechos. Se recuerda en este dispositivo, así podés seguir otro día.'),
        ],
      },
      {
        id: 'pasos',
        title: 'Los pasos',
        blocks: [
          list(
            'Cortar las piezas y, si hace falta, encolar las tablas anchas.',
            'Marcar cada pieza con su código.',
            'Un paso por tipo de encastre, con las piezas que lo llevan.',
            'Los demás trabajos: vaciados, biseles, torneados.',
            'Presentar en seco, lijar antes de encolar, encolar por partes.',
            'Lijar todo y proteger la madera.',
          ),
        ],
      },
    ],
    faq: [
      { q: '¿Cambia si cambio el mueble?', a: 'Sí: los pasos salen del modelo, con sus uniones y piezas.' },
      { q: '¿Lo puedo seguir en el celular en el taller?', a: 'Sí, y para trabajar pieza por pieza está el [Modo taller](modo-taller).' },
    ],
    related: ['modo-taller', 'plano', 'tipos-union'],
  },
  {
    id: 'modo-taller',
    topic: 'plano-armado',
    title: 'Modo taller en el celular',
    summary: 'Una pieza por pantalla, en letra grande, para tener el celular en el banco.',
    intro: [
      p('El **Modo taller** muestra una pieza por pantalla: su medida de corte en letra grande, un dibujo con sus encastres y los pasos para hacerla, con una marca para cada uno. La pantalla no se apaga mientras trabajás.'),
      img('taller', 'El modo taller en el celular', true),
    ],
    sections: [
      {
        id: 'abrir',
        title: 'Abrirlo',
        blocks: [steps('Andá a **Cortes** o a **Armado**.', 'Tocá **Modo taller**.')],
      },
      {
        id: 'usar',
        title: 'Usarlo',
        blocks: [
          list(
            'Arriba dice qué pieza es y cuántas tenés listas. Las piezas iguales van juntas, en una sola pantalla.',
            'Marcá cada paso al terminarlo. Lo marcado queda guardado en el celular.',
            'Pasá con **Siguiente pieza** y la flecha de atrás, o tocá **ver todas**, arriba, para ir a una.',
            'Arriba a la derecha dice si la pantalla queda encendida (**Pantalla encendida**) o **Puede apagarse**. Tocalo para cambiarlo.',
            'Salí con la ✕ de arriba a la izquierda.',
          ),
          tip('Si son varias piezas iguales, el paso lo dice: hacé cada paso en todas, o en espejo donde haga falta.'),
        ],
      },
    ],
    faq: [
      { q: 'La pantalla se apaga igual', a: 'Algunos navegadores no dejan mantenerla encendida; en ese caso, al tocar el botón lo avisa.' },
      { q: '¿Hace falta internet en el taller?', a: 'No, si instalaste la app. Más información: [Instalar en el celular o la compu](instalar).' },
    ],
    related: ['armado', 'lista-cortes', 'instalar'],
  },
  {
    id: 'compartir-enlace',
    topic: 'compartir',
    title: 'Compartir por enlace',
    summary: 'Mandar el proyecto en un enlace, o la lista de compras como texto.',
    intro: [
      p('**Compartir** arma un enlace que lleva el mueble adentro: quien lo abre lo ve y puede guardar una copia para editarla. No hace falta cuenta y no se sube a ningún lado.'),
      img('compartir', 'La ventana Compartir, con el enlace y la lista de compras'),
    ],
    sections: [
      {
        id: 'enlace',
        title: 'Mandar el enlace',
        blocks: [
          steps(
            'En el editor, tocá el botón de compartir, arriba a la derecha.',
            'Tocá **Copiar enlace** (en el celular, **Compartir enlace**) y pegalo en el mensaje.',
          ),
          note('Si el mueble es grande, el enlace es largo. Si alguna app lo corta, mandá la copia en archivo. Más información: [Guardar, abrir y hacer copia](guardar).'),
        ],
      },
      {
        id: 'abrir',
        title: 'Abrir un enlace que te mandaron',
        blocks: [
          steps(
            'Abrí el enlace: se ve el mueble en 3D, con cuántas piezas y uniones tiene.',
            'Tocá **Guardar una copia y abrirla** para verlo entero y editarlo.',
          ),
          p('La copia queda en tu dispositivo. Los cambios que hagas no le llegan a quien te lo mandó.'),
        ],
      },
      {
        id: 'lista',
        title: 'Mandar la lista de compras',
        blocks: [p('En la misma ventana, **La lista de compras, como texto** trae las tablas, las placas con su despiece y los herrajes. Tocá **Copiar lista** y mandala a la maderera o al corralón.')],
      },
    ],
    faq: [
      { q: '¿Quien recibe el enlace ve mis otros proyectos?', a: 'No. El enlace lleva solo ese proyecto.' },
      { q: 'Cambié el mueble, ¿el enlace se actualiza?', a: 'No: lleva el mueble como estaba al copiarlo. Mandá un enlace nuevo.' },
    ],
    related: ['exportar', 'guardar', 'comprar'],
  },
  {
    id: 'exportar',
    topic: 'compartir',
    title: 'Exportar archivo, planilla y PDF',
    summary: 'Las formas de sacar el proyecto de la app: archivo, planilla de cortes y plano en PDF.',
    intro: [p('Todo queda guardado en el navegador, pero a veces hace falta llevarlo afuera: a otra compu, a la maderera o a la impresora.')],
    sections: [
      {
        id: 'que',
        title: 'Qué se puede exportar',
        blocks: [
          table(
            ['Qué', 'Dónde', 'Para qué'],
            ['Archivo .kitc.json', 'Inicio, menú ⋮ del proyecto, o **Compartir** en el editor: **Exportar archivo**', 'Copia de seguridad, o seguir en otra compu con **Abrir archivo**'],
            ['Planilla de cortes (.csv)', 'Cortes, **Exportar planilla**', 'Abrirla en Excel o Google Sheets, o llevarla a la casa de placas'],
            ['Plano en PDF', 'Plano, **Descargar PDF**', 'Imprimirlo o tenerlo en el celular'],
            ['Lista de compras como texto', 'Botón de compartir, **Copiar lista**', 'Mandarla por mensaje'],
          ),
        ],
      },
      {
        id: 'planilla',
        title: 'La planilla',
        blocks: [
          p('La planilla trae la lista de cortes (pieza, cantidad, largo, ancho, espesor, madera y trabajo), lo que hay que comprar, los herrajes y, si hay placas, el despiece de cada placa en milímetros.'),
        ],
      },
    ],
    faq: [
      { q: '¿Cómo abro el archivo .kitc.json?', a: 'En el inicio, en Mis proyectos, tocá **Abrir archivo**.' },
      { q: '¿La planilla se puede editar?', a: 'Sí, en cualquier planilla de cálculo. Los cambios ahí no vuelven a la app.' },
    ],
    related: ['guardar', 'plano', 'compartir-enlace'],
  },
];

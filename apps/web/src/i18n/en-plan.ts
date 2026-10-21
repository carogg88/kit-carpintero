/** Plano para imprimir: hojas, rótulo, capas y plantillas 1:1. */
export default {
  // Capas
  Contornos: 'Outlines',
  Cotas: 'Dimensions',
  'Líneas ocultas': 'Hidden lines',
  'Encastres resaltados': 'Highlighted joints',
  'Notas y nombres': 'Notes and names',

  // Rótulo
  Proyecto: 'Project',
  Hoja: 'Sheet',
  '{n} de {total}': '{n} of {total}',
  Escala: 'Scale',
  Indicada: 'As shown',
  Medidas: 'Units',
  pulgadas: 'inches',
  Madera: 'Wood',

  // Hojas
  'Hoja {n} de {total}: {title}': 'Sheet {n} of {total}: {title}',
  'Hoja {n} de {total}': 'Sheet {n} of {total}',
  'Hoja {k} de {total} (fila {row}, columna {col})': 'Sheet {k} of {total} (row {row}, column {col})',
  'Hoja {n}: {title}': 'Sheet {n}: {title}',
  'Una sola hoja': 'Single sheet',
  'Vistas generales': 'General views',
  'Frente, costado y planta': 'Front, side and top',
  Frente: 'Front',
  'Planta (desde arriba)': 'Top view',
  Despiece: 'Parts',
  'Despiece {n}': 'Parts {n}',
  'Cada pieza acotada': 'Every part, dimensioned',
  'espesor {n}': 'thickness {n}',
  Encastres: 'Joints',
  'Encastres {n}': 'Joints {n}',
  'Sin cortes': 'No cuts',
  'Este mueble no tiene encastres con cortes: todas las uniones son a tope.': 'This project has no cut joints: every joint is a butt joint.',
  '{joint} en detalle': '{joint} in detail',
  '{joint} y otros, en detalle': '{joint} and others, in detail',
  '1 unión': '1 joint',
  '{n} uniones': '{n} joints',

  // Plantillas 1:1
  'el frente': 'the front',
  'la {face}': 'the {face}',
  '{u} desde {fromU} y {v} desde {fromV}': '{u} from {fromU} and {v} from {fromV}',
  'Corte en arco R {r}': 'Arc cut R {r}',
  'Rebaje en arco R {r}': 'Arc recess R {r}',
  'Se saca lo de afuera del arco': 'Remove the waste outside the arc',
  'Se saca entre la cuerda y el arco': 'Remove the waste between the chord and the arc',
  'Plantilla {id} · {part}': 'Template {id} · {part}',
  'Arco R {r}, hoja {k} de {total}': 'Arc R {r}, sheet {k} of {total}',
  'Arco R {r} a tamaño real': 'Arc R {r}, full size',
  'Plantilla 1:1': 'Full-size template',
  '{what}, cuerda {chord}, flecha {sagitta}, en {face}: la cuerda va de {from} a {to}.':
    '{what}, chord {chord}, rise {sagitta}, on {face}: the chord runs from {from} to {to}.',
  Inicio: 'Start',
  Fin: 'End',
  'cuerda {n}': 'chord {n}',
  'flecha {n}': 'rise {n}',
  'Imprimí al 100 %, sin «ajustar a la página». La barra tiene que medir 10 cm justos.':
    'Print at 100%, without “fit to page”. The bar must measure exactly 10 cm.',
  'Recortá por la línea de puntos y pegá sobre la hoja anterior haciendo coincidir las cruces.':
    'Cut along the dotted line and glue it over the previous sheet, lining up the crosses.',

  // Panel
  'Todavía no hay piezas': 'No parts yet',
  'Agregá piezas en el modelo y acá aparece el plano.': 'Add parts in the model and the plan shows up here.',
  'Hojas y capas': 'Sheets and layers',
  'Hojas del plano': 'Plan sheets',
  Hojas: 'Sheets',
  Capas: 'Layers',
  'Capas del plano': 'Plan layers',
  'Descargar PDF': 'Download PDF',
  'Se abre la ventana de impresión: elegí «Guardar como PDF». Salen las {n} hojas en A4 apaisado.':
    'The print window opens: choose “Save as PDF”. All {n} sheets print on landscape A4.',
  // Plantilla del torneado
  'Torneado · {part}': 'Turning · {part}',
  'Perfil del torneado, hoja {k} de {total}': 'Turning profile, sheet {k} of {total}',
  'Perfil del torneado a tamaño real': 'Full-size turning profile',
  'Taco de {side} × {side} × {len}. Las distancias se miden desde {from}; con el calibre llevá cada diámetro a su estación.':
    'Blank {side} × {side} × {len}. Distances are measured from {from}; use calipers to take each diameter to its station.',
  'queda cuadrado': 'stays square',
} satisfies Record<string, string>;

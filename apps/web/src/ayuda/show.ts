import { tk } from '@kitc/core';
import { useEditor } from '../editor/store';
import { pickFirst } from '../help/recipes';
import type { TourStep } from '../help/Tour';

/** "Mostrame dónde está" de los artículos que no lo traen: ilumina en el editor la parte de la que hablan. */
const tool = (title: string, text: string): TourStep => ({ target: 'tools', title, text });
/** En el panel de la pieza: se elige una antes, para que el panel se vea. */
const part = (target: string, title: string, text: string): TourStep => ({ target, title, text, before: pickFirst });
/** En el panel del mueble: con ninguna pieza elegida. */
const furniture = (target: string, title: string, text: string): TourStep => ({ target, title, text, before: () => useEditor.getState().select(null) });
const section = (title: string): TourStep => ({ target: 'sections', title, text: tk('En las pestañas de las secciones: arriba en la compu, abajo en el celular.') });

export const SHOW: Record<string, TourStep> = {
  elegir: tool(tk('Elegir está acá'), tk('Es la primera herramienta. También se elige con la tecla V.')),
  estirar: tool(tk('Estirar está acá'), tk('Es la segunda herramienta. También se elige con la tecla P.')),
  mover: tool(tk('Mover está acá'), tk('Es la tercera herramienta. También se elige con la tecla M.')),
  dibujar: tool(tk('Dibujar está acá'), tk('Es la cuarta herramienta. También se elige con la tecla D.')),
  biselar: tool(tk('Biselar está acá'), tk('Es la quinta herramienta; en el celular, dentro de Más. También se elige con la tecla B.')),
  tramo: tool(tk('Tramo está acá'), tk('Es la sexta herramienta; en el celular, dentro de Más. También se elige con la tecla T.')),
  tornear: tool(tk('Tornear está acá'), tk('Es la séptima herramienta; en el celular, dentro de Más. También se elige con la tecla R.')),
  medir: tool(tk('Medir está acá'), tk('Es la octava herramienta; en el celular, dentro de Más. También se elige con la tecla C.')),
  'rayos-x': tool(tk('Rayos X está acá'), tk('Al final de la barra; en el celular, dentro de Más. También se prende con la tecla X.')),
  vistas: { target: 'views', title: tk('Las vistas están acá'), text: tk('Arriba a la derecha del modelo. El último botón encuadra todo el mueble.') },
  'panel-pieza': part('part-dims', tk('Las medidas de la pieza están acá'), tk('En el panel de la derecha; en el celular, debajo del modelo.')),
  'agregar-pieza': furniture('add', tk('Agregar pieza está acá'), tk('Abajo en el panel del mueble.')),
  'cajones-puertas': furniture('add', tk('Agregar pieza está acá'), tk('Abajo en el panel del mueble. Cajón, Puerta y Estantes están en el mismo menú.')),
  duplicar: part('part-actions', tk('Duplicar está acá'), tk('Abajo en el panel de la pieza, con Del otro lado y Hacer componente.')),
  ocultar: part('part-view', tk('Ver sola está acá'), tk('Al lado de la pieza elegida, arriba en el panel.')),
  'medidas-mueble': furniture('panel', tk('Medidas del mueble está acá'), tk('Arriba en el panel, con ninguna pieza elegida.')),
  'vista-previa': { target: 'undo', title: tk('Deshacer está acá'), text: tk('Arriba a la derecha.') },
  revision: furniture('panel', tk('La revisión está acá'), tk('En el panel, con ninguna pieza elegida: Revisión del diseño.')),
  aurea: furniture('panel', tk('La proporción áurea está acá'), tk('En el panel, con ninguna pieza elegida: Proporción áurea.')),
  'tipos-union': section(tk('Uniones está acá')),
  'medidas-union': section(tk('Uniones está acá')),
  'encastre-cerca': section(tk('Uniones está acá')),
  'lista-cortes': section(tk('Cortes está acá')),
  placas: section(tk('Cortes está acá')),
  herrajes: section(tk('Cortes está acá')),
  presupuesto: section(tk('Cortes está acá')),
  plano: section(tk('Plano está acá')),
  plantillas: section(tk('Plano está acá')),
  armado: section(tk('Armado está acá')),
  'modo-taller': section(tk('El modo taller está en Cortes y en Armado')),
  'compartir-enlace': { target: 'share', title: tk('Compartir está acá'), text: tk('Arriba a la derecha, al lado de Deshacer.') },
};

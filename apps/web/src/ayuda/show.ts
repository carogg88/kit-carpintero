import { tk } from '@kitc/core';
import type { TourStep } from '../help/Tour';

/** "Mostrame dónde está" de los artículos de herramientas: ilumina la barra o las vistas del editor. */
const tool = (title: string, text: string): TourStep => ({ target: 'tools', title, text });

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
};

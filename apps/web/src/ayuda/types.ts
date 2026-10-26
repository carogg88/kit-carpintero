import type { TourStep } from '../help/Tour';

/**
 * Contenido del Centro de ayuda. Los textos admiten tres marcas: **negrita**, `tecla` y [texto](artículo), que enlaza
 * a otro artículo por su id. Cada idioma tiene su archivo con los mismos temas, artículos y secciones; las capturas
 * son las mismas (en español) y solo cambia su texto alternativo.
 */
export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'note' | 'tip' | 'key'; text: string }
  | { kind: 'img'; src: string; alt: string; phone?: boolean }
  | { kind: 'table'; head: string[]; rows: string[][] };

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export type TopicIcon = 'start' | 'tools' | 'keys' | 'recipe';

export interface Topic {
  id: string;
  title: string;
  summary: string;
  icon: TopicIcon;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Article {
  id: string;
  topic: string;
  title: string;
  /** Una línea: se ve en las listas y en la búsqueda. */
  summary: string;
  intro: Block[];
  sections: Section[];
  faq?: Faq[];
  /** Ids de otros artículos. */
  related?: string[];
  /** "Mostrame dónde está": lo ilumina en el editor del proyecto abierto. */
  show?: TourStep;
}

export interface HelpContent {
  topics: Topic[];
  articles: Article[];
  /** Ids de artículos para "Lo más leído". */
  popular: string[];
  /** Búsquedas sugeridas debajo del buscador. */
  suggestions: string[];
}

export const p = (text: string): Block => ({ kind: 'p', text });
export const steps = (...items: string[]): Block => ({ kind: 'steps', items });
export const list = (...items: string[]): Block => ({ kind: 'list', items });
export const note = (text: string): Block => ({ kind: 'note', text });
export const tip = (text: string): Block => ({ kind: 'tip', text });
export const key = (text: string): Block => ({ kind: 'key', text });
export const img = (src: string, alt: string, phone?: boolean): Block => ({ kind: 'img', src, alt, ...(phone ? { phone } : {}) });
export const table = (head: string[], ...rows: string[][]): Block => ({ kind: 'table', head, rows });

/** Secciones de un proyecto. */
export type Section = 'modelo' | 'uniones' | 'cortes' | 'plano';

export const sectionHref = (id: string, section: Section) =>
  `#/proyecto/${encodeURIComponent(id)}${section === 'modelo' ? '' : `/${section}`}`;

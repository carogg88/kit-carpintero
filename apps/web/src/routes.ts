/** Secciones de un proyecto. Plano llega en la segunda parte del paso 5. */
export type Section = 'modelo' | 'uniones' | 'cortes';

export const sectionHref = (id: string, section: Section) =>
  `#/proyecto/${encodeURIComponent(id)}${section === 'modelo' ? '' : `/${section}`}`;

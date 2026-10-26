/** Secciones de un proyecto. */
export type Section = 'modelo' | 'uniones' | 'cortes' | 'plano' | 'armado' | 'taller';

export const sectionHref = (id: string, section: Section) =>
  `#/proyecto/${encodeURIComponent(id)}${section === 'modelo' ? '' : `/${section}`}`;

export const navigate = (hash: string) => {
  window.location.hash = hash;
};

/** Centro de ayuda: #/ayuda, #/ayuda/<tema> y #/ayuda/<tema>/<artículo>. */
export const HELP_ROUTE = '#/ayuda';
export const helpHref = (topic?: string, article?: string) => [HELP_ROUTE, topic, article].filter(Boolean).join('/');

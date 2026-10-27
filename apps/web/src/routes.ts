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

/** Inicio de la app (Mis proyectos). */
export const HOME_ROUTE = '#/';
/** Página de presentación: la que se ve al entrar sin ruta, y también en #/bienvenida. */
export const LANDING_ROUTE = '#/bienvenida';

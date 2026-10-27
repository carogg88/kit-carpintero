import { lazy, Suspense, useEffect, useState } from 'react';
import { Editor } from './editor/Editor';
import { useEditor } from './editor/store';
import { Home } from './home/Home';
import { PhotoTrace } from './nuevo/PhotoTrace';
import { Shared } from './nuevo/Shared';
import { TemplateForm } from './nuevo/TemplateForm';
import { SHARE_ROUTE, t, templateById } from '@kitc/core';
import { LANDING_ROUTE, sectionHref, type Section } from './routes';
import { readProject } from './storage/db';

// El Centro de ayuda se baja recién cuando se abre.
const Ayuda = lazy(() => import('./ayuda/Ayuda'));
// La presentación también se baja aparte: quien vuelve a sus proyectos no la necesita.
const Landing = lazy(() => import('./landing/Landing'));

/**
 * Rutas por hash, para que funcione en GitHub Pages: #/ inicio, #/proyecto/<id> modelo,
 * #/proyecto/<id>/uniones, /cortes, /plano y /armado; #/nuevo/<plantilla> y #/foto para empezar un mueble;
 * #/compartido/<datos> para un proyecto que llegó por enlace; #/ayuda, #/ayuda/<tema> y #/ayuda/<tema>/<artículo>.
 * Sin ruta (la dirección sola) o #/bienvenida: la página de presentación, que lleva al inicio.
 */
function route(): { projectId: string | null; section: Section; start: string | null; shared: string | null; help: { topic: string | null; article: string | null } | null; landing: boolean } {
  const m = location.hash.match(/^#\/proyecto\/([^/]+)(?:\/(uniones|cortes|plano|armado|taller))?$/);
  const n = location.hash.match(/^#\/(foto|nuevo\/[a-z-]+)$/);
  const s = location.hash.startsWith(SHARE_ROUTE) ? location.hash.slice(SHARE_ROUTE.length) : null;
  const h = location.hash.match(/^#\/ayuda(?:\/([a-z0-9-]+))?(?:\/([a-z0-9-]+))?\/?$/);
  return {
    projectId: m?.[1] ? decodeURIComponent(m[1]) : null,
    section: (m?.[2] as Section | undefined) ?? 'modelo',
    start: n?.[1] ?? null,
    shared: s,
    help: h ? { topic: h[1] ?? null, article: h[2] ?? null } : null,
    landing: location.hash === '' || location.hash === '#' || location.hash === LANDING_ROUTE,
  };
}

export function App() {
  const [{ projectId, section, start, shared, help, landing }, setRoute] = useState(route);
  const [missing, setMissing] = useState(false);
  const loaded = useEditor((s) => s.project?.id);

  useEffect(() => {
    const onHash = () => setRoute(route());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!projectId) {
      // En la ayuda el proyecto queda abierto, con su historial: Volver al proyecto sigue donde estaba.
      if (!help) useEditor.getState().close();
      return;
    }
    // Volviendo de la ayuda: ya está abierto.
    if (useEditor.getState().project?.id === projectId) return;
    let alive = true;
    readProject(projectId).then((p) => {
      if (!alive) return;
      if (p) useEditor.getState().open(p);
      setMissing(!p);
    });
    return () => {
      alive = false;
    };
  }, [projectId, help]);

  const go = (id: string | null) => {
    location.hash = id ? sectionHref(id, 'modelo') : '#/';
  };

  if (projectId && missing) {
    return (
      <main style={{ padding: 24 }}>
        <p>{t('No encontramos ese proyecto en este dispositivo.')}</p>
        <button type="button" onClick={() => go(null)}>
          {t('Volver al inicio')}
        </button>
      </main>
    );
  }
  if (projectId) return loaded === projectId ? <Editor section={section} onExit={() => go(null)} /> : null;
  if (help)
    return (
      <Suspense fallback={null}>
        <Ayuda topic={help.topic} article={help.article} />
      </Suspense>
    );
  if (landing)
    return (
      <Suspense fallback={null}>
        <Landing />
      </Suspense>
    );
  if (shared) return <Shared key={shared} data={shared} />;
  if (start === 'foto') return <PhotoTrace />;
  const def = start ? templateById(start.slice('nuevo/'.length)) : undefined;
  if (def) return <TemplateForm key={def.id} def={def} />;
  return <Home onOpen={go} />;
}

import { useEffect, useState } from 'react';
import { Editor } from './editor/Editor';
import { useEditor } from './editor/store';
import { Home } from './home/Home';
import { PhotoTrace } from './nuevo/PhotoTrace';
import { Shared } from './nuevo/Shared';
import { TemplateForm } from './nuevo/TemplateForm';
import { SHARE_ROUTE, t, templateById } from '@kitc/core';
import { sectionHref, type Section } from './routes';
import { readProject } from './storage/db';

/**
 * Rutas por hash, para que funcione en GitHub Pages: #/ inicio, #/proyecto/<id> modelo,
 * #/proyecto/<id>/uniones, /cortes, /plano y /armado; #/nuevo/<plantilla> y #/foto para empezar un mueble;
 * #/compartido/<datos> para un proyecto que llegó por enlace.
 */
function route(): { projectId: string | null; section: Section; start: string | null; shared: string | null } {
  const m = location.hash.match(/^#\/proyecto\/([^/]+)(?:\/(uniones|cortes|plano|armado|taller))?$/);
  const n = location.hash.match(/^#\/(foto|nuevo\/[a-z-]+)$/);
  const s = location.hash.startsWith(SHARE_ROUTE) ? location.hash.slice(SHARE_ROUTE.length) : null;
  return { projectId: m?.[1] ? decodeURIComponent(m[1]) : null, section: (m?.[2] as Section | undefined) ?? 'modelo', start: n?.[1] ?? null, shared: s };
}

export function App() {
  const [{ projectId, section, start, shared }, setRoute] = useState(route);
  const [missing, setMissing] = useState(false);
  const loaded = useEditor((s) => s.project?.id);

  useEffect(() => {
    const onHash = () => setRoute(route());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!projectId) {
      useEditor.getState().close();
      return;
    }
    let alive = true;
    readProject(projectId).then((p) => {
      if (!alive) return;
      if (p) useEditor.getState().open(p);
      setMissing(!p);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

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
  if (shared) return <Shared key={shared} data={shared} />;
  if (start === 'foto') return <PhotoTrace />;
  const def = start ? templateById(start.slice('nuevo/'.length)) : undefined;
  if (def) return <TemplateForm key={def.id} def={def} />;
  return <Home onOpen={go} />;
}

import { useEffect, useState } from 'react';
import { Editor } from './editor/Editor';
import { useEditor } from './editor/store';
import { Home } from './home/Home';
import { sectionHref, type Section } from './routes';
import { readProject } from './storage/db';

/**
 * Rutas por hash, para que funcione en GitHub Pages: #/ inicio, #/proyecto/<id> modelo,
 * #/proyecto/<id>/uniones, /cortes y /plano.
 */
function route(): { projectId: string | null; section: Section } {
  const m = location.hash.match(/^#\/proyecto\/([^/]+)(?:\/(uniones|cortes|plano))?$/);
  return { projectId: m?.[1] ? decodeURIComponent(m[1]) : null, section: (m?.[2] as Section | undefined) ?? 'modelo' };
}

export function App() {
  const [{ projectId, section }, setRoute] = useState(route);
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
        <p>No encontramos ese proyecto en este dispositivo.</p>
        <button type="button" onClick={() => go(null)}>
          Volver al inicio
        </button>
      </main>
    );
  }
  if (projectId) return loaded === projectId ? <Editor section={section} onExit={() => go(null)} /> : null;
  return <Home onOpen={go} />;
}

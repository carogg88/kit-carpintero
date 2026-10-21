import { useEffect, useState } from 'react';
import { Editor } from './editor/Editor';
import { useEditor } from './editor/store';
import { Home } from './home/Home';
import { readProject } from './storage/db';

/** Rutas por hash, para que funcione en GitHub Pages: #/ inicio, #/proyecto/<id> editor. */
function route(): { projectId: string | null } {
  const m = location.hash.match(/^#\/proyecto\/(.+)$/);
  return { projectId: m?.[1] ? decodeURIComponent(m[1]) : null };
}

export function App() {
  const [{ projectId }, setRoute] = useState(route);
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
    location.hash = id ? `#/proyecto/${encodeURIComponent(id)}` : '#/';
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
  if (projectId) return loaded === projectId ? <Editor onExit={() => go(null)} /> : null;
  return <Home onOpen={go} />;
}

/// <reference lib="webworker" />
import opencascade from 'replicad-opencascadejs';
import wasmUrl from 'replicad-opencascadejs/wasm?url';
import { setOC, type Shape3D } from 'replicad';
import { leanFrame, partKey, setLang, type Part, type Project } from '@kitc/core';
import { loadMessages } from '../i18n';
import type { FromWorker, PartMesh, ToWorker, ViewLines } from './protocol';
import { partShape, projectShapes } from './shapes';

declare const self: DedicatedWorkerGlobalScope;

const send = (msg: FromWorker, transfer: Transferable[] = []) => self.postMessage(msg, transfer);

// Piezas ya armadas, por su receta: el 3D y el plano comparten el trabajo. Se borran las más viejas.
const MAX_SHAPES = 300;
const shapes = new Map<string, { shape: Shape3D; warning?: string }>();

function exact(part: Part, project: Project) {
  const key = partKey(project, part.id);
  const hit = shapes.get(key);
  if (hit) {
    shapes.delete(key);
    shapes.set(key, hit);
    return hit;
  }
  const built = partShape(part, project);
  shapes.set(key, built);
  for (const [k, old] of shapes) {
    if (shapes.size <= MAX_SHAPES) break;
    old.shape.delete();
    shapes.delete(k);
  }
  return built;
}

function buildPart(part: Part, project: Project): PartMesh {
  const t0 = performance.now();
  const { shape, warning } = exact(part, project);
  const mesh = shape.mesh({ tolerance: 0.3, angularTolerance: 0.3 });
  const edges = shape.meshEdges({ tolerance: 0.3, angularTolerance: 0.3 });
  return {
    id: part.id,
    vertices: new Float32Array(mesh.vertices),
    normals: new Float32Array(mesh.normals),
    triangles: new Uint32Array(mesh.triangles),
    edges: new Float32Array(edges.lines),
    ms: performance.now() - t0,
    ...(warning ? { warning } : {}),
  };
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  try {
    if (e.data.type === 'init') {
      // Los avisos de piezas que no se pudieron cortar salen en el idioma de la app.
      loadMessages();
      setLang(e.data.lang);
      const t0 = performance.now();
      const oc = await opencascade({ locateFile: () => wasmUrl });
      setOC(oc);
      send({ type: 'ready', ms: performance.now() - t0 });
    } else if (e.data.type === 'build') {
      const { project, only, req } = e.data;
      const t0 = performance.now();
      const parts = project.parts.filter((p) => !only || only.includes(p.id)).map((p) => buildPart(p, project));
      const transfer = parts.flatMap((p) => [p.vertices.buffer, p.normals.buffer, p.triangles.buffer, p.edges.buffer]);
      send({ type: 'parts', parts, ms: performance.now() - t0, ...(req === undefined ? {} : { req }) }, transfer);
    } else {
      const { project, views, req } = e.data;
      const t0 = performance.now();
      const out: ViewLines[] = views.map(({ key, view }) => {
        const t = performance.now();
        const parts = view.parts.map((id) => project.parts.find((p) => p.id === id)).filter((p) => p !== undefined);
        // Una pata inclinada en el despiece se dibuja derecha: una copia desgirada, que se borra después.
        const copies: Shape3D[] = [];
        const shapesOf = parts.map((p) => {
          const shape = exact(p, project).shape;
          const f = view.local === p.id ? leanFrame(p) : null;
          if (!f) return shape;
          const copy = shape.clone().rotate(-f.angle, f.pivot, f.axis) as Shape3D;
          copies.push(copy);
          return copy;
        });
        const lines = projectShapes(shapesOf, view);
        copies.forEach((c) => c.delete());
        return { key, ...lines, ms: performance.now() - t };
      });
      send({ type: 'views', views: out, ms: performance.now() - t0, req }, out.flatMap((v) => [v.segments.buffer, v.hidden.buffer]));
    }
  } catch (err) {
    const req = e.data.type === 'init' ? undefined : e.data.req;
    send({ type: 'error', message: err instanceof Error ? err.message : String(err), ...(req === undefined ? {} : { req }) });
  }
};

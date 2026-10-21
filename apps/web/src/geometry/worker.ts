/// <reference lib="webworker" />
import opencascade from 'replicad-opencascadejs';
import wasmUrl from 'replicad-opencascadejs/wasm?url';
import { makeBox, setOC, type Shape3D } from 'replicad';
import { mortiseAndTenon, partBox, type Box, type Part, type Project } from '@kitc/core';
import type { FromWorker, PartMesh, ToWorker } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const send = (msg: FromWorker, transfer: Transferable[] = []) => self.postMessage(msg, transfer);
const solid = (b: Box) => makeBox(b.min, b.max) as Shape3D;

/** Arma una pieza exacta: forma base, redondeos, espigas sumadas y mortajas restadas. */
function buildPart(part: Part, project: Project): PartMesh {
  const t0 = performance.now();
  const box = partBox(part);
  let shape = solid(box);
  let warning: string | undefined;

  for (const op of part.ops) {
    try {
      shape = op.kind === 'round' ? shape.fillet(op.radius) : shape.chamfer(op.size);
    } catch {
      warning = `No se pudo ${op.kind === 'round' ? 'redondear' : 'chaflanar'} esta pieza`;
    }
  }

  for (const j of project.joints) {
    if (j.type !== 'mortaja' || (j.partA !== part.id && j.partB !== part.id)) continue;
    const a = project.parts.find((p) => p.id === j.partA);
    const b = project.parts.find((p) => p.id === j.partB);
    if (!a || !b) continue;
    const geo = mortiseAndTenon(partBox(a), partBox(b), {
      length: j.params.length ?? 40,
      thickness: j.params.thickness ?? 7,
      shoulder: j.params.shoulder ?? 10,
    });
    if (!geo) continue;
    shape = part.id === j.partA ? shape.cut(solid(geo.mortise)) : shape.fuse(solid(geo.tenon));
  }

  const mesh = shape.mesh({ tolerance: 0.3, angularTolerance: 0.3 });
  const edges = shape.meshEdges({ tolerance: 0.3, angularTolerance: 0.3 });
  shape.delete();
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
      const t0 = performance.now();
      const oc = await opencascade({ locateFile: () => wasmUrl });
      setOC(oc);
      send({ type: 'ready', ms: performance.now() - t0 });
    } else {
      const { project, only } = e.data;
      const t0 = performance.now();
      const parts = project.parts.filter((p) => !only || only.includes(p.id)).map((p) => buildPart(p, project));
      const transfer = parts.flatMap((p) => [p.vertices.buffer, p.normals.buffer, p.triangles.buffer, p.edges.buffer]);
      send({ type: 'parts', parts, ms: performance.now() - t0 }, transfer);
    }
  } catch (err) {
    send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};

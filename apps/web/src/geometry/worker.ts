/// <reference lib="webworker" />
import opencascade from 'replicad-opencascadejs';
import wasmUrl from 'replicad-opencascadejs/wasm?url';
import { makeBox, makeCylinder, setOC, type Shape3D } from 'replicad';
import { jointGeometry, partBox, type Box, type Part, type Project, type Solid } from '@kitc/core';
import type { FromWorker, PartMesh, ToWorker } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const send = (msg: FromWorker, transfer: Transferable[] = []) => self.postMessage(msg, transfer);
const solid = (b: Box) => makeBox(b.min, b.max) as Shape3D;

function toShape(s: Solid): Shape3D {
  if (s.kind === 'box') return solid(s.box);
  const direction: [number, number, number] = [0, 0, 0];
  direction[s.axis] = s.dir;
  return makeCylinder(s.radius, s.length, s.start, direction) as Shape3D;
}

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
    if (j.partA !== part.id && j.partB !== part.id) continue;
    const a = project.parts.find((p) => p.id === j.partA);
    const b = project.parts.find((p) => p.id === j.partB);
    if (!a || !b) continue;
    const geo = jointGeometry(j.type, partBox(a), partBox(b), j.params);
    if (!geo) continue;
    const isA = part.id === j.partA;
    try {
      for (const s of isA ? [] : geo.addB) shape = shape.fuse(toShape(s));
      for (const s of isA ? geo.cutA : geo.cutB) shape = shape.cut(toShape(s));
    } catch {
      warning = `No se pudo cortar el encastre con ${isA ? j.partB : j.partA}`;
    }
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
      const { project, only, req } = e.data;
      const t0 = performance.now();
      const parts = project.parts.filter((p) => !only || only.includes(p.id)).map((p) => buildPart(p, project));
      const transfer = parts.flatMap((p) => [p.vertices.buffer, p.normals.buffer, p.triangles.buffer, p.edges.buffer]);
      send({ type: 'parts', parts, ms: performance.now() - t0, ...(req === undefined ? {} : { req }) }, transfer);
    }
  } catch (err) {
    const req = e.data.type === 'build' ? e.data.req : undefined;
    send({ type: 'error', message: err instanceof Error ? err.message : String(err), ...(req === undefined ? {} : { req }) });
  }
};

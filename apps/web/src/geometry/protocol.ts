import type { Project } from '@kitc/core';

export type ToWorker = { type: 'init' } | { type: 'build'; project: Project; only?: string[] };

export interface PartMesh {
  id: string;
  vertices: Float32Array;
  normals: Float32Array;
  triangles: Uint32Array;
  edges: Float32Array;
  ms: number;
  warning?: string;
}

export type FromWorker =
  | { type: 'ready'; ms: number }
  | { type: 'parts'; parts: PartMesh[]; ms: number }
  | { type: 'error'; message: string };

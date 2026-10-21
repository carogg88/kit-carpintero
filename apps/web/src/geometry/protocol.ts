import type { Project } from '@kitc/core';

/** `req` identifica el pedido: la respuesta lo trae de vuelta para descartar resultados viejos. */
export type ToWorker = { type: 'init' } | { type: 'build'; project: Project; only?: string[]; req?: number };

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
  | { type: 'parts'; parts: PartMesh[]; ms: number; req?: number }
  | { type: 'error'; message: string; req?: number };

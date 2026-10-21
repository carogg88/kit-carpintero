import type { EngineView, Project } from '@kitc/core';

/** `req` identifica el pedido: la respuesta lo trae de vuelta para descartar resultados viejos. */
export type ToWorker =
  | { type: 'init' }
  | { type: 'build'; project: Project; only?: string[]; req?: number }
  | { type: 'views'; project: Project; views: { key: string; view: EngineView }[]; req: number };

export interface PartMesh {
  id: string;
  vertices: Float32Array;
  normals: Float32Array;
  triangles: Uint32Array;
  edges: Float32Array;
  ms: number;
  warning?: string;
}

/** Líneas de una vista del plano: cuatro números por tramo y si cada uno está oculto. */
export interface ViewLines {
  key: string;
  segments: Float32Array;
  hidden: Uint8Array;
  ms: number;
}

export type FromWorker =
  | { type: 'ready'; ms: number }
  | { type: 'parts'; parts: PartMesh[]; ms: number; req?: number }
  | { type: 'views'; views: ViewLines[]; ms: number; req: number }
  | { type: 'error'; message: string; req?: number };

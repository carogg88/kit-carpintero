import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { engineViewKey, getLang, partKey, withEngineLines, type Drawing, type EngineView, type Project } from '@kitc/core';
import type { FromWorker, PartMesh, ViewLines } from '../geometry/protocol';

export type EngineStatus = 'loading' | 'ready' | 'error';

/** Malla exacta de una pieza, calculada por el motor para una versión de la pieza (`key`). */
export interface ExactMesh {
  key: string;
  geometry: THREE.BufferGeometry;
  edges: THREE.BufferGeometry;
  warning?: string;
}

function toGeometry(m: PartMesh): Pick<ExactMesh, 'geometry' | 'edges'> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(m.vertices, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(m.triangles, 1));
  geometry.computeBoundingSphere();
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.BufferAttribute(m.edges, 3));
  return { geometry, edges };
}

// Un solo motor para toda la app: abrirlo cuesta un par de segundos y se hace una vez.
let worker: Worker | null = null;
let status: EngineStatus = 'loading';
const statusListeners = new Set<(s: EngineStatus) => void>();
const replyListeners = new Set<(m: FromWorker) => void>();

function engine(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../geometry/worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    if (e.data.type === 'ready' || (e.data.type === 'error' && e.data.req === undefined)) {
      status = e.data.type === 'ready' ? 'ready' : 'error';
      statusListeners.forEach((l) => l(status));
    }
    replyListeners.forEach((l) => l(e.data));
  };
  worker.postMessage({ type: 'init', lang: getLang() });
  return worker;
}

/** Empieza a abrir el motor antes de entrar al editor, por ejemplo desde el inicio. */
export const warmUpEngine = () => void engine();

let nextReq = 1;

/**
 * Mallas exactas de las piezas del proyecto. Mientras se arrastra, o mientras el motor calcula,
 * la vista usa la caja simple de cada pieza; al soltar se recalculan solo las piezas que cambiaron.
 */
export function useExactMeshes(project: Project | null, paused: boolean) {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(status);
  const [meshes, setMeshes] = useState<ReadonlyMap<string, ExactMesh>>(new Map());

  useEffect(() => {
    engine();
    statusListeners.add(setEngineStatus);
    return () => void statusListeners.delete(setEngineStatus);
  }, []);

  useEffect(() => {
    if (!project || paused || engineStatus !== 'ready') return;
    const keys = new Map(project.parts.map((p) => [p.id, partKey(project, p.id)]));
    const stale = project.parts.filter((p) => meshes.get(p.id)?.key !== keys.get(p.id)).map((p) => p.id);
    const gone = [...meshes.keys()].filter((id) => !keys.has(id));
    if (!stale.length && !gone.length) return;

    const req = nextReq++;
    const onReply = (m: FromWorker) => {
      if (m.type === 'ready' || m.req !== req) return;
      replyListeners.delete(onReply);
      if (m.type !== 'parts') return;
      setMeshes((prev) => {
        const next = new Map(prev);
        for (const id of gone) {
          next.get(id)?.geometry.dispose();
          next.get(id)?.edges.dispose();
          next.delete(id);
        }
        for (const pm of m.parts) {
          next.get(pm.id)?.geometry.dispose();
          next.get(pm.id)?.edges.dispose();
          next.set(pm.id, { key: keys.get(pm.id) ?? '', ...toGeometry(pm), ...(pm.warning ? { warning: pm.warning } : {}) });
        }
        return next;
      });
    };
    replyListeners.add(onReply);
    if (stale.length) engine().postMessage({ type: 'build', project, only: stale, req });
    else onReply({ type: 'parts', parts: [], ms: 0, req });
    return () => void replyListeners.delete(onReply);
  }, [project, paused, engineStatus, meshes]);

  return { engineStatus, meshes };
}

// Líneas del plano ya proyectadas, por pedido. Sobreviven a salir y volver a entrar al plano.
const MAX_VIEWS = 300;
let viewCache: ReadonlyMap<string, ViewLines> = new Map();

function remember(views: ViewLines[]) {
  const next = new Map(viewCache);
  for (const v of views) {
    next.delete(v.key);
    next.set(v.key, v);
  }
  for (const k of next.keys()) {
    if (next.size <= MAX_VIEWS) break;
    next.delete(k);
  }
  viewCache = next;
}

/**
 * Líneas exactas para los dibujos del plano. Devuelve una función que cambia las líneas de cajas de
 * un dibujo por las que proyectó el motor, si ya están; si no, deja el dibujo como está y las pide.
 */
export function useEngineLines(project: Project, views: EngineView[]): (d: Drawing) => Drawing {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(status);
  const [lines, setLines] = useState(viewCache);

  useEffect(() => {
    engine();
    statusListeners.add(setEngineStatus);
    return () => void statusListeners.delete(setEngineStatus);
  }, []);

  useEffect(() => {
    if (engineStatus !== 'ready') return;
    const wanted = new Map(views.map((view) => [engineViewKey(project, view), view]));
    const missing = [...wanted].filter(([key]) => !viewCache.has(key)).map(([key, view]) => ({ key, view }));
    if (!missing.length) return;
    const req = nextReq++;
    const onReply = (m: FromWorker) => {
      if (m.type === 'ready' || m.req !== req) return;
      replyListeners.delete(onReply);
      if (m.type !== 'views') return;
      remember(m.views);
      setLines(viewCache);
    };
    replyListeners.add(onReply);
    engine().postMessage({ type: 'views', project, views: missing, req });
    return () => void replyListeners.delete(onReply);
  }, [project, views, engineStatus]);

  return useCallback(
    (d: Drawing) => {
      const got = d.engine && lines.get(engineViewKey(project, d.engine));
      return got ? withEngineLines(d, got.segments, got.hidden) : d;
    },
    [project, lines],
  );
}

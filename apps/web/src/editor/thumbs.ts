import { useEffect, useState } from 'react';
import * as THREE from 'three';
import type { Project } from '@kitc/core';
import { buildStudio, DEFAULT_PHOTO, setupRenderer, takePhoto } from './photo';
import { engineMeshes } from './useGeometry';

/**
 * Miniaturas de los proyectos para el inicio: una foto chica del mueble, guardada en este navegador junto con la
 * fecha del cambio que muestra. Si el proyecto cambió después, se vuelve a sacar.
 */

const W = 360;
const H = 270;
const key = (id: string) => `kitc:foto:${id}`;

interface Thumb {
  at: string;
  url: string;
}

function read(id: string): Thumb | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(id)) ?? 'null') as Thumb | null;
    return v && typeof v.url === 'string' && typeof v.at === 'string' ? v : null;
  } catch {
    return null;
  }
}

const listeners = new Set<(id: string) => void>();

function write(project: Project, url: string) {
  try {
    localStorage.setItem(key(project.id), JSON.stringify({ at: project.updatedAt, url }));
  } catch {
    // Sin lugar: el inicio sigue con el logo.
  }
  listeners.forEach((l) => l(project.id));
}

/** Borra la miniatura de un proyecto que se borró. */
export function dropThumb(id: string): void {
  try {
    localStorage.removeItem(key(id));
  } catch {
    // Nada que hacer.
  }
}

/** Achica una foto grande a miniatura. */
async function shrink(blob: Blob): Promise<string> {
  const img = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  // Recortada al centro, para llenar la tarjeta.
  const k = Math.max(W / img.width, H / img.height);
  g.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
  img.close();
  return c.toDataURL('image/jpeg', 0.82);
}

/** Guarda como miniatura una foto que se sacó desde la foto del mueble. */
export async function saveThumb(project: Project, blob: Blob): Promise<void> {
  try {
    write(project, await shrink(blob));
  } catch {
    // Sin miniatura: no pasa nada.
  }
}

let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
let queue: Promise<void> = Promise.resolve();

async function shoot(project: Project): Promise<void> {
  if (failed) return;
  try {
    renderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    failed = true;
    return;
  }
  setupRenderer(renderer);
  renderer.setSize(W * 2, H * 2, false);
  const meshes = await engineMeshes(project).catch(() => []);
  const studio = buildStudio(renderer, project, meshes);
  try {
    studio.set({ ...DEFAULT_PHOTO, background: 'blanco' }, W / H);
    const blob = await takePhoto(renderer, studio, { width: W * 2, height: H * 2, type: 'image/jpeg' });
    write(project, await shrink(blob));
  } finally {
    studio.dispose();
  }
}

/** La miniatura del proyecto: la guardada si está al día; si no, se saca de a una, sin apurar al inicio. */
export function useThumb(project: Project): string | null {
  const [thumb, setThumb] = useState(() => read(project.id));
  useEffect(() => {
    const on = (id: string) => id === project.id && setThumb(read(project.id));
    listeners.add(on);
    const t = read(project.id);
    if (!t || t.at < project.updatedAt) queue = queue.then(() => shoot(project)).catch(() => undefined);
    return () => void listeners.delete(on);
  }, [project]);
  return thumb?.url ?? null;
}

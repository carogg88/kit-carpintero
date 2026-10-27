import { depthUnder, newPocket, type Part, type Pocket, type PocketShape } from '@kitc/core';
import type { DrawFace, DrawShape } from './store';

/** Lo que se saca si no se eligió nada: el rectángulo, vaciado hasta la mitad; lo demás (círculo, arco, perfil), calado. */
export const throughByShape = (shape: DrawShape | PocketShape['kind']) => shape !== 'rect';

/** El vaciado o calado de una figura recién dibujada, con lo que se eligió antes de dibujar (si se eligió). */
export function drawnPocket(part: Part, face: DrawFace, shape: PocketShape, through: boolean | null, depth: number | null): Pocket {
  const pocket = newPocket(part, face.axis, face.side, shape);
  if (through !== null) pocket.through = through;
  // El hondo elegido, sin pasar el espesor: un vaciado que atraviesa es un calado.
  if (!pocket.through && depth) pocket.depth = Math.max(0.5, Math.min(depth, depthUnder(part, face.axis) - 0.5));
  return pocket;
}

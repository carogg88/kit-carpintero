import type { Box } from '@kitc/core';

/**
 * Las caras donde una pieza apoya contra otras, para iluminarlas al encajar: cada una es una caja plana (mínimo y
 * máximo iguales sobre el eje de la cara) del tamaño de la parte que se tocan. Una pieza metida adentro de otra no
 * apoya: eso es un encastre, no una cara de contacto. Todo en mm.
 */
export function contactFaces(moving: Box, others: readonly Box[], tol = 0.5): Box[] {
  const faces: Box[] = [];
  for (const o of others) {
    for (const k of [0, 1, 2] as const) {
      const at = Math.abs(moving.max[k] - o.min[k]) <= tol ? moving.max[k] : Math.abs(moving.min[k] - o.max[k]) <= tol ? moving.min[k] : null;
      if (at === null) continue;
      const min = [0, 0, 0] as [number, number, number];
      const max = [0, 0, 0] as [number, number, number];
      let ok = true;
      for (const j of [0, 1, 2] as const) {
        if (j === k) {
          min[j] = max[j] = at;
          continue;
        }
        min[j] = Math.max(moving.min[j], o.min[j]);
        max[j] = Math.min(moving.max[j], o.max[j]);
        if (max[j] - min[j] <= tol) ok = false;
      }
      if (ok) faces.push({ min, max });
    }
  }
  return faces;
}

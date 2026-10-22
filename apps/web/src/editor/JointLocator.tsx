import { useMemo } from 'react';
import { partBox, t, type Joint, type Project } from '@kitc/core';
import { shoot } from './planShots';
import type { ExactMesh } from './useGeometry';
import { cssColor } from './Viewport';
import styles from './Sections.module.css';

const [W, H] = [176, 128];

/**
 * El mueble entero en chico, con las dos piezas de la unión pintadas: para ubicar "P1 ↔ F3" sin saber los
 * códigos. La pieza que entra va del mismo color que en el detalle; la que la recibe, en madera oscura.
 */
export function JointLocator({ project, joint, meshes }: { project: Project; joint: Joint; meshes: ReadonlyMap<string, ExactMesh> }) {
  const shot = useMemo(() => {
    const rest = cssColor('--locator-rest', '#e7e3d9');
    const colors = new Map(project.parts.map((p) => [p.id, rest]));
    colors.set(joint.partA, cssColor('--xray-edge', '#6b4a2b'));
    colors.set(joint.partB, cssColor('--signal', '#c98a4e'));
    // Lo demás del mueble, como un velo: las dos piezas se ven aunque queden detrás de la tapa.
    const ghosts = new Set(project.parts.map((p) => p.id).filter((id) => id !== joint.partA && id !== joint.partB));
    // Desde el costado donde está la unión, siempre de adelante: así "izquierda" y "derecha" se ven como se dicen.
    const b = project.parts.find((p) => p.id === joint.partB);
    const xs = project.parts.flatMap((p) => [partBox(p).min[0], partBox(p).max[0]]);
    const left = b && (partBox(b).min[0] + partBox(b).max[0]) / 2 < (Math.min(...xs) + Math.max(...xs)) / 2 - 1;
    return shoot({ project, meshes, colors, width: W * 2, height: H * 2, labels: true, ghosts, dir: [left ? -1 : 1, 0.72, 1.15] });
  }, [project, joint.partA, joint.partB, meshes]);
  if (!shot) return null;
  const tags = shot.labels.filter((l) => l.id === joint.partA || l.id === joint.partB).map((l) => ({ ...l }));
  // Dos códigos encimados se separan hacia arriba y hacia abajo.
  if (tags.length === 2) {
    const [p, q] = tags as [(typeof tags)[0], (typeof tags)[0]];
    const gap = 22 / H;
    if (Math.abs(p.x - q.x) * W < 40 && Math.abs(p.y - q.y) < gap) {
      const [up, down] = p.y <= q.y ? [p, q] : [q, p];
      const mid = (up.y + down.y) / 2;
      [up.y, down.y] = [Math.max(0.08, mid - gap / 2), Math.min(0.92, mid + gap / 2)];
    }
  }
  return (
    <div className={styles.locator}>
      <span className={styles.locatorTitle}>{t('Dónde está')}</span>
      <div className={styles.locatorImage}>
        <img src={shot.url} width={W} height={H} alt={t('El mueble entero con {a} y {b} marcadas', { a: joint.partA, b: joint.partB })} />
        {tags.map((l) => (
          <span key={l.id} className={styles.locatorTag} data-part={l.id === joint.partB ? 'b' : 'a'} style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%` }} aria-hidden="true">
            {l.id}
          </span>
        ))}
      </div>
    </div>
  );
}

import { partBox, type Box, type Project } from '@kitc/core';

/** Qué piezas cambian entre el modelo y el fantasma: las que se mueven o cambian de medida, las nuevas y las que se van. */
export function ghostDiff(project: Project, ghost: Project | null) {
  const changed: Box[] = [];
  const removed: Box[] = [];
  const faded = new Set<string>();
  if (!ghost) return { changed, removed, faded };
  const before = new Map(project.parts.map((p) => [p.id, partBox(p)]));
  const same = (a: Box, b: Box) => [0, 1, 2].every((k) => Math.abs(a.min[k]! - b.min[k]!) < 0.05 && Math.abs(a.max[k]! - b.max[k]!) < 0.05);
  for (const p of ghost.parts) {
    const now = partBox(p);
    const old = before.get(p.id);
    if (old && same(old, now)) continue;
    changed.push(now);
    if (old) faded.add(p.id);
  }
  const kept = new Set(ghost.parts.map((p) => p.id));
  for (const [id, b] of before) {
    if (kept.has(id)) continue;
    removed.push(b);
    faded.add(id);
  }
  return { changed, removed, faded };
}

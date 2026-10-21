import { endContact, overlapBox, partBox, type Axis } from './geometry';
import { jointGeometry, solidBox } from './joints';
import { partAxesBySize } from './edit';
import type { Joint, Part, Project } from './project';

/** Primera palabra del nombre de una pieza: "Pata delantera derecha" → "Pata". */
export const partWord = (p: Part | undefined): string => p?.name.trim().split(/\s+/)[0] ?? '?';

/** Uniones parecidas juntas, como en la lista de la pantalla de Uniones: "Pata con faldón · 8". */
export interface JointGroup {
  key: string;
  label: string;
  joints: Joint[];
}

const byId = (x: string, y: string) => x.localeCompare(y, 'es', { numeric: true });

/** Agrupa por las piezas que unen (pata con faldón, tapa con pata). Las que llevan cortes van primero. */
export function groupJoints(project: Project): JointGroup[] {
  const find = (id: string) => project.parts.find((p) => p.id === id);
  const groups = new Map<string, JointGroup>();
  for (const j of project.joints) {
    const a = partWord(find(j.partA));
    const b = partWord(find(j.partB));
    const key = `${a}|${b}`;
    const g = groups.get(key) ?? { key, label: `${a} con ${b.toLocaleLowerCase('es')}`, joints: [] };
    g.joints.push(j);
    groups.set(key, g);
  }
  const list = [...groups.values()];
  for (const g of list) g.joints.sort((x, y) => byId(x.partA, y.partA) || byId(x.partB, y.partB));
  const plain = (g: JointGroup) => (g.joints.every((j) => j.type === 'tope') ? 1 : 0);
  return list.sort((x, y) => plain(x) - plain(y));
}

/** Cómo se tocan las dos piezas, en palabras de taller. */
export function jointContact(a: Part, b: Part): string {
  const ba = partBox(a);
  const bb = partBox(b);
  if (overlapBox(ba, bb)) return 'se cruzan';
  if (endContact(ba, bb)) return 'punta contra cara';
  return 'cara contra cara';
}

/** Cuánto crece la pieza que entra por el encastre (espigas, lengüetas), por medida. */
export interface JointGrowth {
  partId: string;
  along: 'largo' | 'ancho' | 'espesor';
  mm: number;
}

const ALONG = ['largo', 'ancho', 'espesor'] as const;

export function jointGrowth(project: Project, joint: Joint): JointGrowth[] {
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  if (!a || !b || a.base.kind !== 'box' || b.base.kind !== 'box') return [];
  const box = partBox(b);
  const g = jointGeometry(joint.type, partBox(a), box, joint.params);
  if (!g) return [];
  const grown = [0, 0, 0];
  for (const s of g.addB) {
    const sb = solidBox(s);
    for (const k of [0, 1, 2] as Axis[]) {
      const out = Math.max(0, box.min[k] - sb.min[k]) + Math.max(0, sb.max[k] - box.max[k]);
      grown[k] = Math.max(grown[k] ?? 0, out);
    }
  }
  const order = partAxesBySize(b);
  return order
    .map((axis, rank) => ({ partId: b.id, along: ALONG[rank]!, mm: Math.round((grown[axis] ?? 0) * 10) / 10 }))
    .filter((x) => x.mm > 0);
}

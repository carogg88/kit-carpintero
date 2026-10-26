import { copyPart } from './components';
import { partBox, type Box } from './geometry';
import { t } from './i18n';
import type { Group, Part, Project } from './project';

/**
 * Grupos: piezas que se mueven, se copian, se ocultan y se borran juntas, como en SketchUp. Es una lista plana:
 * un grupo no tiene grupos adentro y cada pieza está a lo sumo en uno.
 */

/** El grupo de la pieza, si tiene. */
export function groupOf(project: Pick<Project, 'groups'>, partId: string): Group | undefined {
  return project.groups.find((g) => g.parts.includes(partId));
}

/** Las piezas son justo las de un grupo (en cualquier orden). */
export function isWholeGroup(group: Group | undefined, ids: readonly string[]): group is Group {
  return !!group && group.parts.length === ids.length && group.parts.every((id) => ids.includes(id));
}

/**
 * Después de un cambio: saca de los grupos las piezas borradas y las repetidas (queda en el primero), y deshace los
 * grupos que quedaron con menos de dos. Trabaja sobre `next` en el lugar (sirve con un borrador de Immer).
 */
export function syncGroups(next: Project): void {
  const ids = new Set(next.parts.map((p) => p.id));
  const seen = new Set<string>();
  const kept: Group[] = [];
  let changed = false;
  for (const g of next.groups) {
    const parts = g.parts.filter((id) => ids.has(id) && !seen.has(id));
    for (const id of parts) seen.add(id);
    if (parts.length !== g.parts.length) changed = true;
    if (parts.length < 2) {
      changed = true;
      continue;
    }
    if (parts.length !== g.parts.length) g.parts = parts;
    kept.push(g);
  }
  if (changed) next.groups = kept;
}

/** Primer id libre para un grupo: G1, G2… */
function nextGroupId(groups: Group[]): string {
  const used = new Set(groups.map((g) => g.id));
  let n = 1;
  while (used.has(`G${n}`)) n++;
  return `G${n}`;
}

/** Primer nombre libre: "Grupo 1", "Grupo 2"… o el que se pidió, con un número si ya está. */
function freeName(groups: Group[], base?: string): string {
  const taken = new Set(groups.map((g) => g.name));
  if (base && !taken.has(base)) return base;
  for (let n = base ? 2 : 1; ; n++) {
    const name = base ? `${base} ${n}` : t('Grupo {n}', { n });
    if (!taken.has(name)) return name;
  }
}

/** Agrupa estas piezas: salen de los grupos donde estaban. Devuelve el grupo nuevo, o null si son menos de dos. */
export function makeGroup(project: Project, ids: readonly string[], name?: string): Group | null {
  const parts = [...new Set(ids)].filter((id) => project.parts.some((p) => p.id === id));
  if (parts.length < 2) return null;
  for (const g of project.groups) g.parts = g.parts.filter((id) => !parts.includes(id));
  project.groups = project.groups.filter((g) => g.parts.length >= 2);
  const group = { id: nextGroupId(project.groups), name: freeName(project.groups, name), parts };
  project.groups.push(group);
  return group;
}

/** Deshace el grupo: las piezas quedan donde están, sueltas. */
export function ungroup(project: Project, groupId: string): void {
  project.groups = project.groups.filter((g) => g.id !== groupId);
}

/** La caja que encierra estas piezas. */
export function partsBox(parts: Part[], ids: readonly string[]): Box | null {
  const boxes = parts.filter((p) => ids.includes(p.id) && p.base.kind === 'box').map(partBox);
  if (!boxes.length) return null;
  return {
    min: [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b.min[k]!))) as Box['min'],
    max: [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k]!))) as Box['max'],
  };
}

/**
 * Copias de estas piezas, en el mismo lugar, con ids nuevos. Las copias de un componente siguen vinculadas;
 * las demás llevan "(copia)" en el nombre.
 */
export function copyParts(parts: Part[], ids: readonly string[]): Part[] {
  const all = [...parts];
  const copies: Part[] = [];
  for (const id of ids) {
    const part = parts.find((p) => p.id === id);
    if (!part) continue;
    const copy = copyPart(all, part);
    all.push(copy);
    copies.push(copy);
  }
  return copies;
}

/** Copias de estas piezas a la derecha del mueble, igual de separadas entre sí y a la misma altura. */
export function duplicateParts(parts: Part[], ids: readonly string[]): Part[] {
  const copies = copyParts(parts, ids);
  const box = partsBox(parts, ids);
  if (!box) return copies;
  const right = parts.reduce((x, p) => (p.base.kind === 'box' ? Math.max(x, partBox(p).max[0]) : x), box.max[0]);
  const dx = right + 150 - box.min[0];
  for (const c of copies) c.position[0] += dx;
  return copies;
}

/**
 * Suma las copias al proyecto y, si las originales eran un grupo entero, arma con ellas otro grupo
 * ("Banco (copia)"). Devuelve el grupo nuevo, si hubo.
 */
export function addCopies(project: Project, ids: readonly string[], copies: Part[]): Group | null {
  project.parts.push(...copies);
  const source = groupOf(project, ids[0] ?? '');
  if (!isWholeGroup(source, ids)) return null;
  return makeGroup(
    project,
    copies.map((c) => c.id),
    t('{name} (copia)', { name: source.name }),
  );
}

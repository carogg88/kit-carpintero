import { nextPartId } from './edit';
import { partWord } from './jointinfo';
import type { Component, Part, Project } from './project';

/**
 * Componentes: piezas iguales vinculadas, como en SketchUp. Cada copia guarda su propia forma
 * (así el resto de la app no cambia) y esta función la mantiene igual en todas.
 */

const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const shape = (p: Part) => ({ base: p.base, ops: p.ops, wood: p.wood });

/**
 * Después de un cambio, pasa la forma, las operaciones y la madera de la copia que cambió a las demás
 * copias de su componente. Si la copia creció hacia el lado negativo de un eje, las demás también:
 * se corren lo mismo sobre ese eje. Saca los componentes que se quedaron sin copias.
 * Trabaja sobre `next` en el lugar (sirve también con un borrador de Immer).
 */
export function syncComponents(prev: Project | null, next: Project): void {
  const before = new Map(prev?.parts.map((p) => [p.id, p]));
  const groups = new Map<string, Part[]>();
  for (const p of next.parts) if (p.component) groups.set(p.component, [...(groups.get(p.component) ?? []), p]);

  for (const copies of groups.values()) {
    const source = copies.find((p) => {
      const old = before.get(p.id);
      return old && old.component === p.component && !same(shape(old), shape(p));
    });
    if (!source) continue;
    const old = before.get(source.id)!;
    const shift = [0, 1, 2].map((k) => {
      const grew = old.base.kind === 'box' && source.base.kind === 'box' && old.base.size[k] !== source.base.size[k];
      return grew ? source.position[k]! - old.position[k]! : 0;
    });
    const s = json(shape(source));
    for (const p of copies) {
      if (p === source) continue;
      p.base = json(s.base);
      p.ops = json(s.ops);
      p.wood = s.wood;
      for (const k of [0, 1, 2]) p.position[k] = p.position[k]! + shift[k]!;
    }
  }
  if (next.components.some((c) => !groups.has(c.id))) next.components = next.components.filter((c) => groups.has(c.id));
}

/** Primer id libre para un componente: C1, C2… */
function nextComponentId(components: Component[]): string {
  const used = new Set(components.map((c) => c.id));
  let n = 1;
  while (used.has(`C${n}`)) n++;
  return `C${n}`;
}

/** Convierte la pieza en un componente nuevo, del que es la primera copia. Devuelve el componente. */
export function makeComponent(project: Project, partId: string, name?: string): Component | null {
  const part = project.parts.find((p) => p.id === partId);
  if (!part || part.component) return null;
  const base = name ?? partWord(part);
  const taken = new Set(project.components.map((c) => c.name));
  let label = base;
  for (let n = 2; taken.has(label); n++) label = `${base} ${n}`;
  const c = { id: nextComponentId(project.components), name: label };
  project.components.push(c);
  part.component = c.id;
  return c;
}

/** Desvincula la pieza: queda igual, pero los cambios ya no pasan a las otras copias. */
export function makeUnique(project: Project, partId: string): void {
  const part = project.parts.find((p) => p.id === partId);
  if (!part) return;
  delete part.component;
  syncComponents(null, project);
}

/** Copias vinculadas de la pieza, contándola a ella. */
export const componentCopies = (project: Project, part: Part): Part[] =>
  part.component ? project.parts.filter((p) => p.component === part.component) : [part];

/** Copia de la pieza en el mismo lugar, con id nuevo; si es un componente, queda vinculada. */
export function copyPart(parts: Part[], part: Part): Part {
  const prefix = part.id.replace(/\d+$/, '') || 'N';
  const copy = json(part);
  copy.id = nextPartId(parts, prefix);
  if (!part.component) copy.name = `${part.name} (copia)`;
  return copy;
}

/**
 * Agrupa en componentes las piezas que son iguales: misma palabra en el nombre (Pata, Faldón, Estante),
 * misma forma y misma madera. Sirve para que las plantillas ya vengan con las patas vinculadas.
 */
export function autoComponents(project: Project): void {
  const groups = new Map<string, Part[]>();
  for (const p of project.parts) {
    if (p.component) continue;
    const key = JSON.stringify([partWord(p), shape(p)]);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const copies of groups.values()) {
    if (copies.length < 2) continue;
    const c = makeComponent(project, copies[0]!.id);
    if (c) for (const p of copies) p.component = c.id;
  }
}

import { nextPartId } from './edit';
import { partWord } from './jointinfo';
import type { Component, Part, Project } from './project';
import { t } from './i18n';
import { invertOrient, isSameOrient, orientPart, SAME_ORIENT, type Orient } from './rotate';

/**
 * Componentes: piezas iguales vinculadas, como en SketchUp. Cada copia guarda su propia forma
 * (así el resto de la app no cambia) y esta función la mantiene igual en todas.
 */

const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const shapeOf = (p: Part) => ({ base: p.base, ops: p.ops, pockets: p.pockets, bevels: p.bevels, sections: p.sections, turning: p.turning, wood: p.wood });

/**
 * La forma común del componente vista desde esta copia: la forma de la pieza, desgirada. Dos copias giradas
 * distinto tienen la misma forma común aunque sus biseles estén en aristas distintas.
 */
function commonShape(p: Part) {
  if (isSameOrient(p.orient as Orient | undefined)) return shapeOf(p);
  const q = json(p);
  orientPart(q, invertOrient(p.orient as Orient));
  return shapeOf(q);
}

/**
 * Después de un cambio, pasa la forma, las operaciones y la madera de la copia que cambió a las demás
 * copias de su componente, cada una con su giro. Si la copia creció hacia el lado negativo de un eje, las demás
 * crecen hacia el lado que les corresponde. Girar o reflejar una copia no es un cambio de forma: las demás quedan.
 * Saca los componentes que se quedaron sin copias, y desvincula la última que queda cuando se borraron las demás:
 * un "componente de 1 copia" no le dice nada a nadie. Trabaja sobre `next` en el lugar (sirve con un borrador de Immer).
 */
export function syncComponents(prev: Project | null, next: Project): void {
  const before = new Map(prev?.parts.map((p) => [p.id, p]));
  const groups = new Map<string, Part[]>();
  for (const p of next.parts) if (p.component) groups.set(p.component, [...(groups.get(p.component) ?? []), p]);
  for (const [id, copies] of groups) {
    const had = prev?.parts.filter((p) => p.component === id).length ?? 0;
    if (copies.length === 1 && had > 1) {
      delete copies[0]!.component;
      delete copies[0]!.orient;
      groups.delete(id);
    }
  }

  for (const copies of groups.values()) {
    // Si todas las copias cambiaron igual (se estiró el mueble entero), ya están iguales: no hay nada que pasar.
    const commons = new Map(copies.map((p) => [p, commonShape(p)]));
    if (copies.every((p) => same(commons.get(p), commons.get(copies[0]!)))) continue;
    const source = copies.find((p) => {
      const old = before.get(p.id);
      return old && old.component === p.component && !same(commonShape(old), commons.get(p));
    });
    if (!source) continue;
    const old = before.get(source.id)!;
    const common = json(commons.get(source)!);
    // Cuánto creció la forma común hacia el lado negativo de cada eje (y cuánto en total).
    const srcMap = (source.orient as Orient | undefined) ?? SAME_ORIENT;
    const grewNeg = [0, 0, 0];
    const grew = [0, 0, 0];
    srcMap.forEach((v, c) => {
      const k = Math.abs(v) - 1;
      if (old.base.kind !== 'box' || source.base.kind !== 'box' || old.base.size[k] === source.base.size[k]) return;
      const total = source.base.size[k]! - old.base.size[k]!;
      const neg = old.position[k]! - source.position[k]!;
      grew[c] = total;
      grewNeg[c] = v < 0 ? total - neg : neg;
    });
    for (const p of copies) {
      if (p === source) continue;
      const o = (p.orient as Orient | undefined) ?? SAME_ORIENT;
      const shaped = { ...json(p), ...json(common) } as Part;
      // Solo se toma la forma girada: la pieza se queda donde está (salvo lo que creció, abajo).
      orientPart(shaped, o);
      p.base = shaped.base;
      p.ops = shaped.ops;
      p.pockets = shaped.pockets;
      p.bevels = shaped.bevels;
      p.sections = shaped.sections;
      if (shaped.turning) p.turning = shaped.turning;
      else delete p.turning;
      p.wood = shaped.wood;
      o.forEach((v, c) => {
        if (!grew[c]) return;
        const k = Math.abs(v) - 1;
        p.position[k] = p.position[k]! - (v < 0 ? grew[c]! - grewNeg[c]! : grewNeg[c]!);
      });
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
  delete part.orient;
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
  if (!part.component) copy.name = t('{name} (copia)', { name: part.name });
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
    const key = JSON.stringify([partWord(p), shapeOf(p)]);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const copies of groups.values()) {
    if (copies.length < 2) continue;
    const c = makeComponent(project, copies[0]!.id);
    if (c) for (const p of copies) p.component = c.id;
  }
}

import { boxSize, otherAxes, partBox, type Axis, type Box } from './geometry';
import { MEASURED_FROM } from './pockets';
import type { Part, Section } from './project';

/** Primer id libre para un tramo de la pieza: S1, S2… */
export function nextSectionId(part: Part): string {
  const used = new Set(part.sections.map((s) => s.id));
  let n = 1;
  while (used.has(`S${n}`)) n++;
  return `S${n}`;
}

/** Sección de la pieza sobre los dos ejes que cruzan a `axis`, en orden. */
export function crossSection(part: Part, axis: Axis): [number, number] {
  const s = boxSize(partBox(part));
  const [u, v] = otherAxes(axis);
  return [s[u], s[v]];
}

const grow = (mm: number) => Math.max(mm + 5, Math.round((mm * 1.25) / 5) * 5);

/** Tramo nuevo entre `from` y `to`: arranca un cuarto más grueso, para que se vea; la medida se ajusta en el panel. */
export function newSection(part: Part, axis: Axis, from: number, to: number): Section {
  const [u, v] = crossSection(part, axis);
  return { id: nextSectionId(part), axis, from: Math.min(from, to), to: Math.max(from, to), size: [grow(u), grow(v)] };
}

/** Lo que ocupa el tramo, en coordenadas del mueble: centrado en la pieza y recortado a su largo. */
export function sectionBox(part: Part, s: Section): Box {
  const box = partBox(part);
  const out: Box = { min: [...box.min], max: [...box.max] };
  out.min[s.axis] = box.min[s.axis] + Math.max(0, s.from);
  out.max[s.axis] = Math.min(box.max[s.axis], box.min[s.axis] + s.to);
  otherAxes(s.axis).forEach((k, i) => {
    const mid = (box.min[k] + box.max[k]) / 2;
    out.min[k] = mid - s.size[i]! / 2;
    out.max[k] = mid + s.size[i]! / 2;
  });
  return out;
}

/** Lo que hay que sacar antes de poner el tramo: la pieza entera a lo largo del tramo, con 1 mm de sobra. */
export function sectionCutBox(part: Part, s: Section): Box {
  const box = partBox(part);
  const t = sectionBox(part, s);
  const out: Box = { min: [box.min[0] - 1, box.min[1] - 1, box.min[2] - 1], max: [box.max[0] + 1, box.max[1] + 1, box.max[2] + 1] };
  out.min[s.axis] = t.min[s.axis];
  out.max[s.axis] = t.max[s.axis];
  return out;
}

/** En palabras de taller: "tramo de 9 × 9 cm, de 0 a 15 cm desde abajo". */
export function describeSection(s: Section, n: (mm: number) => string): string {
  return `tramo de ${n(s.size[0])} × ${n(s.size[1])}, de ${n(s.from)} a ${n(s.to)} desde ${MEASURED_FROM[s.axis]}`;
}

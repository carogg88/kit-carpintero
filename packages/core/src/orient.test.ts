import { describe, expect, it } from 'vitest';
import { syncComponents } from './components';
import { mirrorPart } from './edit';
import { partBox } from './geometry';
import type { Part, Project } from './project';
import { composeOrient, invertOrient, mirrorOrient, rotationOrient, SAME_ORIENT, turnPart } from './rotate';
import { buildTemplate, templateById } from './templates';

const mesa = () => buildTemplate(templateById('mesa')!, {}, 'guatambu', undefined, '2026-10-26T00:00:00Z');
const part = (p: Project, id: string) => p.parts.find((x) => x.id === id)!;
/** Cambia el proyecto como lo hace el editor: sobre una copia, y después iguala los componentes. */
const edit = (p: Project, recipe: (d: Project) => void) => {
  const next = structuredClone(p);
  recipe(next);
  syncComponents(p, next);
  return next;
};
const bevel = (q: Part) =>
  q.bevels.push({ id: 'V1', a: { axis: 0, side: 1 }, b: { axis: 2, side: 1 }, da: 10, db: 10, round: false });

describe('copias giradas de un componente', () => {
  it('las orientaciones se componen y se deshacen', () => {
    const r = rotationOrient(1);
    expect(composeOrient(invertOrient(r), r)).toEqual(SAME_ORIENT);
    expect(composeOrient(r, composeOrient(r, composeOrient(r, r)))).toEqual(SAME_ORIENT);
    expect(composeOrient(mirrorOrient(0), mirrorOrient(0))).toEqual(SAME_ORIENT);
  });

  it('girar una copia no gira las demás, y un bisel nuevo le llega en su arista girada', () => {
    let p = mesa();
    const legs = p.parts.filter((x) => x.name.startsWith('Pata'));
    const [a, b] = [legs[0]!.id, legs[1]!.id];
    p = edit(p, (d) => turnPart(part(d, b), 1));
    expect(part(p, b).orient).toEqual(rotationOrient(1));
    expect(part(p, a).orient).toBeUndefined();
    p = edit(p, (d) => bevel(part(d, a)));
    expect(part(p, a).bevels[0]).toMatchObject({ a: { axis: 0, side: 1 }, b: { axis: 2, side: 1 } });
    // Girada 90° sobre el alto: lo que estaba a la derecha (x+) pasa atrás (z−), y lo de adelante (z+) a la derecha.
    expect(part(p, b).bevels[0]).toMatchObject({ a: { axis: 2, side: -1 }, b: { axis: 0, side: 1 } });
    // Y al revés: un cambio en la copia girada vuelve derecho a las otras.
    p = edit(p, (d) => void (part(d, b).bevels[0]!.da = 15));
    expect(part(p, a).bevels[0]!.da).toBe(15);
  });

  it('al estirar una copia hacia un lado, la girada crece hacia el lado que le toca', () => {
    let p = mesa();
    const legs = p.parts.filter((x) => x.name.startsWith('Pata'));
    const [a, b] = [legs[0]!.id, legs[1]!.id];
    p = edit(p, (d) => turnPart(part(d, b), 1));
    const before = partBox(part(p, b));
    p = edit(p, (d) => {
      const q = part(d, a);
      if (q.base.kind !== 'box') return;
      q.base.size[0] += 10;
      q.position[0] -= 10;
    });
    const after = partBox(part(p, b));
    // El ancho de la forma común es el fondo de la girada, y su lado izquierdo quedó atrás… dado vuelta: crece adelante.
    expect(after.max[2] - after.min[2]).toBe(before.max[2] - before.min[2] + 10);
    expect(after.min[2]).toBe(before.min[2]);
    expect(after.min[0]).toBe(before.min[0]);
  });

  it('la gemela del otro lado sale reflejada', () => {
    const p = mesa();
    const leg = p.parts.find((x) => x.name.startsWith('Pata'))!;
    bevel(leg);
    // Sin las otras patas, del otro lado queda lugar para la gemela.
    const twin = mirrorPart(p.parts.filter((x) => x.id === leg.id || x.name === 'Tapa'), leg)!;
    const side = twin.axis === 0 ? { axis: 0, side: -1 } : { axis: 2, side: -1 };
    expect([twin.part.bevels[0]!.a, twin.part.bevels[0]!.b]).toContainEqual(side);
    if (leg.component) expect(twin.part.orient).toEqual(mirrorOrient(twin.axis));
  });
});

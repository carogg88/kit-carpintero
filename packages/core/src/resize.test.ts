import { describe, expect, it } from 'vitest';
import { furnitureBox, resizeFurniture } from './resize';
import { boxSize, partBox } from './geometry';
import { syncJoints } from './edit';
import { syncComponents } from './components';
import { buildTemplate, templateById } from './templates';
import type { Project } from './project';

const now = '2026-10-22T00:00:00Z';
const build = (id: string, v: Record<string, number> = {}) => buildTemplate(templateById(id)!, v, 'cedro', undefined, now);
const box = (p: Project, id: string) => partBox(p.parts.find((x) => x.id === id)!);

describe('medidas generales del mueble', () => {
  it('una mesa más alta: las patas se estiran y la tapa sube con los faldones', () => {
    const p = build('mesa');
    const joints = p.joints.length;
    const h = furnitureBox(p.parts)!.max[1];
    const r = resizeFurniture(p.parts, 1, h + 50)!;
    expect(furnitureBox(p.parts)!.max[1]).toBe(h + 50);
    expect(r.stretched).toEqual(expect.arrayContaining(['P1', 'P2', 'P3', 'P4']));
    expect(r.moved).toEqual(expect.arrayContaining(['T1', 'F1']));
    // Los faldones siguen pegados abajo de la tapa y las uniones siguen todas.
    expect(box(p, 'F1').max[1]).toBe(box(p, 'T1').min[1]);
    expect(syncJoints(p.parts, p.joints)).toHaveLength(joints);
  });

  it('una mesa más larga: la tapa y los faldones largos se estiran, las patas de un lado se corren', () => {
    const p = build('mesa');
    const w = boxSize(furnitureBox(p.parts)!)[0];
    const legBefore = box(p, 'P1');
    const rightBefore = box(p, 'P2');
    resizeFurniture(p.parts, 0, w + 200);
    expect(boxSize(box(p, 'T1'))[0]).toBe(w + 200);
    expect(box(p, 'P1')).toEqual(legBefore);
    expect(box(p, 'P2').max[0]).toBe(rightBefore.max[0] + 200);
    expect(boxSize(box(p, 'P2'))[0]).toBe(boxSize(legBefore)[0]);
  });

  it('un estante más alto: los estantes quedan repartidos igual y no cambian de espesor', () => {
    const p = build('estante', { height: 1800, shelves: 5 });
    resizeFurniture(p.parts, 1, 2000);
    const ys = ['E1', 'E2', 'E3', 'E4', 'E5'].map((id) => box(p, id).min[1]);
    const steps = ys.slice(1).map((y, i) => y - ys[i]!);
    for (const s of steps) expect(Math.abs(s - steps[0]!)).toBeLessThan(1.5);
    expect(boxSize(box(p, 'E3'))[1]).toBe(20);
    expect(box(p, 'E5').max[1]).toBe(2000);
    expect(box(p, 'Z1').min[1]).toBe(0);
  });

  it('las copias de un componente siguen iguales', () => {
    const p = build('mesa');
    const before = structuredClone(p);
    resizeFurniture(p.parts, 1, 900);
    syncComponents(before, p);
    const legs = p.parts.filter((x) => x.id.startsWith('P')).map((x) => x.base);
    expect(new Set(legs.map((b) => JSON.stringify(b))).size).toBe(1);
    expect(p.parts.find((x) => x.id === 'P2')!.position[1]).toBe(0);
  });

  it('no achica más de lo que hay libre', () => {
    const p = build('mesa');
    expect(resizeFurniture(p.parts, 1, 50)).toBeNull();
  });
});

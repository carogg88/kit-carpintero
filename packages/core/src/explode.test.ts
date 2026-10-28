import { describe, expect, it } from 'vitest';
import { explodedJointCenter, explodeJoint, explodeParts, jointCenter } from './explode';
import { placedBox } from './follow';
import { overlapBox, partBox, type Box, type Vec3 } from './geometry';
import { buildTemplate, templateById } from './templates';

const mesa = () => buildTemplate(templateById('mesa')!, {}, 'guatambu', undefined, '2026-10-26T00:00:00Z');

describe('separar una unión', () => {
  it('la espiga del faldón sale de la pata a lo largo del faldón, con lo que tenía metido más aire', () => {
    const p = mesa();
    const j = p.joints.find((x) => x.type === 'mortaja')!;
    const a = partBox(p.parts.find((x) => x.id === j.partA)!);
    const b = partBox(p.parts.find((x) => x.id === j.partB)!);
    const e = explodeJoint(a, b);
    // El faldón es largo sobre el eje en que sale: sobresale de la pata por ese lado.
    const len = b.max[e.axis] - b.min[e.axis];
    expect(len).toBeGreaterThan(a.max[e.axis] - a.min[e.axis]);
    const moved = { min: b.min.map((v, k) => v + e.offset[k]!), max: b.max.map((v, k) => v + e.offset[k]!) };
    // Separado, ya no se meten una en la otra sobre ese eje.
    const gap = e.sign > 0 ? moved.min[e.axis]! - a.max[e.axis] : a.min[e.axis] - moved.max[e.axis]!;
    expect(gap).toBeGreaterThanOrEqual(-0.01);
  });

  it('una unión a tope se separa solo el aire', () => {
    const a = { min: [0, 0, 0], max: [100, 20, 100] } as const;
    const b = { min: [0, 20, 0], max: [20, 200, 20] } as const;
    const e = explodeJoint(a as never, b as never);
    expect([e.axis, e.sign, e.distance]).toEqual([1, 1, 40]);
  });
});

describe('despiece de todo el mueble', () => {
  const moved = (b: Box, o: Vec3): Box => ({ min: b.min.map((v, k) => v + o[k]!) as Vec3, max: b.max.map((v, k) => v + o[k]!) as Vec3 });
  for (const id of ['mesa', 'alacena', 'cajonera', 'taburete']) {
    it(`${id}: las piezas unidas quedan separadas`, () => {
      const p = buildTemplate(templateById(id)!, {}, 'guatambu', undefined, '2026-10-28T00:00:00Z');
      const off = explodeParts(p);
      for (const j of p.joints) {
        const a = p.parts.find((x) => x.id === j.partA)!;
        const b = p.parts.find((x) => x.id === j.partB)!;
        expect(overlapBox(moved(placedBox(p, a), off.get(a.id)!), moved(placedBox(p, b), off.get(b.id)!)), `${a.id}-${b.id}`).toBeNull();
      }
    });
  }

  it('la tapa de la mesa sube y las patas se abren hacia las esquinas', () => {
    const p = mesa();
    const off = explodeParts(p);
    const top = p.parts.find((x) => /tapa/i.test(x.name))!;
    expect(off.get(top.id)![1]).toBeGreaterThan(0);
    const legs = p.parts.filter((x) => /pata/i.test(x.name));
    const mid = (b: Box) => (b.min[0] + b.max[0]) / 2;
    const center = mid(placedBox(p, top));
    for (const l of legs) expect(Math.sign(off.get(l.id)![0])).toBe(Math.sign(mid(placedBox(p, l)) - center));
  });

  it('el número de la unión cae entre las dos piezas separadas', () => {
    const p = mesa();
    const off = explodeParts(p);
    const j = p.joints.find((x) => x.type === 'mortaja')!;
    const c = jointCenter(p, j)!;
    const e = explodedJointCenter(p, j, off)!;
    const oa = off.get(j.partA)!;
    const ob = off.get(j.partB)!;
    for (const k of [0, 1, 2]) expect(e[k]).toBeCloseTo(c[k]! + (oa[k]! + ob[k]!) / 2);
  });
});

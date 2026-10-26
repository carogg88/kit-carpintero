import { describe, expect, it } from 'vitest';
import { explodeJoint } from './explode';
import { partBox } from './geometry';
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

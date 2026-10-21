import { describe, expect, it } from 'vitest';
import { drawItems, drawJointDetail, drawPart, drawView, VIEWS } from './drawing';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');

describe('dibujo técnico', () => {
  it('una caja tapada en parte por otra más cercana tiene líneas ocultas', () => {
    const d = drawItems(
      [
        { id: 'atras', box: { min: [0, 0, 0], max: [100, 100, 10] } },
        { id: 'adelante', box: { min: [50, 20, 20], max: [200, 80, 30] } },
      ],
      VIEWS.front,
    );
    const hidden = d.lines.filter((l) => l.hidden);
    expect(hidden).toEqual([{ a: [100, 20], b: [100, 80], hidden: true, joint: false }]);
    expect(d.labels.map((l) => l.id)).toEqual(['atras', 'adelante']);
  });

  it('las vistas de la mesa miden lo que la mesa', () => {
    const size = (v: 'front' | 'side' | 'top') => {
      const b = drawView(table, v).bounds;
      return [Math.round(b.u1 - b.u0), Math.round(b.v1 - b.v0)];
    };
    expect(size('front')).toEqual([1800, 750]);
    expect(size('side')).toEqual([900, 750]);
    expect(size('top')).toEqual([1800, 900]);
  });

  it('las espigas quedan ocultas dentro de las patas en el frente', () => {
    const d = drawView(table, 'front');
    expect(d.lines.some((l) => l.joint && l.hidden)).toBe(true);
  });

  it('el despiece del faldón muestra las dos espigas', () => {
    const f1 = table.parts.find((p) => p.id === 'F1')!;
    const d = drawPart(table, f1);
    expect(Math.round(d.bounds.u1 - d.bounds.u0)).toBe(1680);
    expect(d.joints.length).toBe(2);
  });

  it('el detalle de una mortaja tiene dos vistas con la espiga', () => {
    const j = table.joints.find((x) => x.type === 'mortaja')!;
    const d = drawJointDetail(table, j.id);
    expect(d?.views.length).toBe(2);
    expect(d?.views.every((v) => v.joints.length > 0)).toBe(true);
  });
});

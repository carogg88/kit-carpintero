import { describe, expect, it } from 'vitest';
import { cutList, cutPlan, dowelsNeeded, shoppingList } from './cutlist';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');

describe('lista de cortes de la mesa', () => {
  const rows = cutList(table);
  const row = (name: string) => rows.find((r) => r.name === name);

  it('agrupa piezas iguales', () => {
    expect(rows.map((r) => [r.name, r.ids.length])).toEqual([
      ['Tapa', 1],
      ['Pata', 4],
      ['Faldón largo', 2],
      ['Faldón corto', 2],
    ]);
  });

  it('los faldones largos se cortan con las dos espigas: 160 + 2 × 4 cm', () => {
    const f = rows.find((r) => r.ids.includes('F1'));
    expect(f?.cut).toEqual([1680, 95, 22]);
    expect(f?.extraLength).toBe(80);
    expect(f?.work).toContain('espiga en cada punta');
  });

  it('cada pata lleva dos mortajas y la tapa se encola', () => {
    expect(row('Pata')?.work[0]).toBe('2 mortajas');
    expect(row('Tapa')?.work[0]).toBe('encolar 7 tablas');
  });
});

describe('plan de corte', () => {
  const plan = cutPlan(table);

  it('la tapa sale de tablas de 1″ × 6″, dos largos por tabla de 3,66 m', () => {
    const top = plan.boards.filter((b) => b.widthIn === 6);
    expect(top.map((b) => [b.lengthM, b.slots.length])).toEqual([
      [3.66, 2],
      [3.66, 2],
      [3.66, 2],
      [1.83, 1],
    ]);
  });

  it('las 4 patas salen de un tirante de 3″ × 3″', () => {
    expect(plan.boards.filter((b) => b.widthIn === 3)).toMatchObject([{ kind: 'tirante', lengthM: 3.05, slots: { length: 4 } }]);
  });

  it('lista de compras, pies y desperdicio', () => {
    expect(shoppingList(plan).reduce((n, r) => n + r.count, 0)).toBe(plan.boards.length);
    expect(plan.feet.guatambu).toBeGreaterThan(20);
    expect(plan.waste).toBeGreaterThan(0);
    expect(plan.waste).toBeLessThan(0.4);
    expect(plan.tooLong).toEqual([]);
  });

  it('tarugos: cuántos y de qué medida', () => {
    const t = { ...table, joints: table.joints.map((j) => (j.type === 'mortaja' ? { ...j, type: 'clavija' as const, params: {} } : j)) };
    expect(dowelsNeeded(t)).toEqual([{ diameter: 8, length: 60, count: 16 }]);
  });
});

import { describe, expect, it } from 'vitest';
import { boardPieces, cutList, cutPlan, dowelsNeeded, shoppingList } from './cutlist';
import { buildTemplate, templateById } from './templates';
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
    expect(row('Tapa')?.work[0]).toBe('encolar 7 tiras');
  });

  it('si las piezas iguales no comparten nombre, la fila nombra los dos tipos', () => {
    const mixed = structuredClone(table);
    mixed.parts.find((p) => p.id === 'F2')!.name = 'Travesaño largo';
    expect(cutList(mixed).find((r) => r.ids.includes('F2'))?.name).toBe('Faldón y travesaño');
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

  it('en el taburete, los travesaños angostos salen a lo largo de la tabla de los faldones: una tabla menos', () => {
    const stool = buildTemplate(templateById('taburete')!, {}, 'guatambu', 'mortaja', '2026-10-22T00:00:00Z');
    const p = cutPlan(stool);
    expect(p.boards).toHaveLength(3);
    const ripped = p.boards.flatMap((b) => b.slots).filter((s) => s.beside?.length);
    expect(ripped.length).toBeGreaterThan(0);
    // Todas las piezas siguen en el plan (el asiento, en tiras para encolar).
    expect([...new Set(p.boards.flatMap(boardPieces).map((s) => s.id.split('·')[0]))].sort()).toEqual(stool.parts.map((x) => x.id).sort());
  });

  it('tarugos: cuántos y de qué medida', () => {
    const t = { ...table, joints: table.joints.map((j) => (j.type === 'mortaja' ? { ...j, type: 'clavija' as const, params: {} } : j)) };
    expect(dowelsNeeded(t)).toEqual([{ diameter: 8, length: 60, count: 16 }]);
  });
});

describe('piezas finas del sobrante de una tabla gruesa', () => {
  it('los listones del asiento salen del tirante de las patas, no de otro listón', async () => {
    const { buildTemplate, templateById } = await import('./templates');
    const p = buildTemplate(templateById('taburete')!, { width: 450, depth: 340, height: 450, leg: 45, seatType: 2, apronHeight: 80, rung: 100 }, 'guatambu', 'mortaja', '2026-10-23T00:00:00Z');
    const slat = (id: string, x: number) => ({ ...structuredClone(p.parts[0]!), id, name: 'Listón del asiento', base: { kind: 'box' as const, size: [25, 25, 340] as [number, number, number] }, position: [x, 437.5, 0] as [number, number, number], ops: [] });
    p.parts.push(slat('L1', 137.5), slat('L2', 287.5));
    const plan = cutPlan(p);
    const host = plan.boards.find((b) => b.slots.some((s) => s.id === 'L1'))!;
    expect(host.thicknessIn).toBe(2);
    expect(plan.boards.some((b) => b.thicknessIn === 1.5)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { groupJoints, jointContact, jointGrowth } from './jointinfo';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const part = (id: string) => table.parts.find((p) => p.id === id)!;

describe('uniones de la mesa', () => {
  it('agrupa las 16 uniones por las piezas que unen, con las de cortes primero', () => {
    const groups = groupJoints(table);
    expect(groups.map((g) => [g.label, g.joints.length])).toEqual([
      ['Pata con faldón', 8],
      // Los faldones llevan la ranura de los botones de la tapa: tienen cortes.
      ['Tapa con faldón', 4],
      ['Tapa con pata', 4],
    ]);
    expect(groups[0]?.joints[0]?.partA).toBe('P1');
  });

  it('la espiga suma 4 cm al largo del faldón', () => {
    const j = table.joints.find((x) => x.type === 'mortaja' && x.partB === 'F1')!;
    expect(jointGrowth(table, j)).toEqual([{ partId: 'F1', along: 'largo', mm: 40 }]);
    expect(jointContact(part(j.partA), part(j.partB))).toBe('punta contra cara');
  });

  it('una unión a tope no cambia los cortes', () => {
    const j = table.joints.find((x) => x.type === 'tope')!;
    expect(jointGrowth(table, j)).toEqual([]);
  });
});

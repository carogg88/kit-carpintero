import { describe, expect, it } from 'vitest';
import { chainLines, dropCovered, dxfBytes, piecesDxf } from './dxf';
import { drawPart } from './drawing';
import { cutList } from './cutlist';
import { createTable } from './templates/table';

const now = '2026-10-27T00:00:00Z';

describe('despiece en DXF', () => {
  it('junta los cuatro lados de un rectángulo en un contorno cerrado', () => {
    const sq: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 5],
      [0, 5],
    ];
    // Desordenados y con un lado al revés.
    const lines = [
      { a: sq[2]!, b: sq[3]! },
      { a: sq[0]!, b: sq[1]! },
      { a: sq[0]!, b: sq[3]! },
      { a: sq[1]!, b: sq[2]! },
    ];
    const chains = chainLines(lines);
    expect(chains).toHaveLength(1);
    expect(chains[0]!.closed).toBe(true);
    expect(chains[0]!.points).toHaveLength(4);
    expect(chainLines([{ a: [0, 0], b: [1, 0] }, { a: [1, 0], b: [2, 1] }])).toEqual([{ points: [[0, 0], [1, 0], [2, 1]], closed: false }]);
  });

  it('saca las ocultas que caen debajo del contorno, y deja las otras', () => {
    const line = (a: [number, number], b: [number, number], hidden: boolean) => ({ a, b, hidden, joint: false });
    const kept = dropCovered([line([0, 0], [10, 0], false), line([2, 0], [8, 0.05], true), line([2, 3], [8, 3], true), line([5, 0], [15, 0], true)]);
    expect(kept.map((l) => l.a)).toEqual([[0, 0], [2, 3], [5, 0]]);
  });

  it('cada pieza distinta va a 1:1, en mm, con su código y capas para cortar y oculto', () => {
    const p = createTable(undefined, 'guatambu', now);
    const rows = cutList(p);
    const pieces = rows.map((r) => ({ label: `${r.ids.join(', ')} · ${r.name} ñ ✓`, drawing: drawPart(p, p.parts.find((x) => x.id === r.ids[0])!) }));
    const dxf = piecesDxf(pieces, 'cm');
    expect(dxf).toMatch(/^ {2}0\r\nSECTION\r\n/);
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
    expect(dxf).toContain('$INSUNITS\r\n 70\r\n4');
    expect(dxf.match(/\r\nTEXT\r\n/g)).toHaveLength(rows.length);
    expect(dxf).toContain('ñ \\U+2713');
    expect(dxf).toContain('$DWGCODEPAGE\r\n  3\r\nANSI_1252');
    expect(dxf).toMatch(/\r\nCORTE\r\n/);
    expect(dxf).toMatch(/\r\nOCULTO\r\n/);
    // Un byte por carácter, en Latin-1.
    expect([...dxf].every((c) => c.charCodeAt(0) < 256)).toBe(true);
    expect(dxfBytes(dxf).length).toBe(dxf.length);
    // La tapa de la mesa sale con su largo real.
    const xs = [...dxf.matchAll(/\r\n 10\r\n(-?[\d.]+)/g)].map((m) => Number(m[1]));
    const top = p.parts.find((x) => x.name.toLowerCase().includes('tapa'))!;
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(Math.max(...(top.base.kind === 'box' ? top.base.size : [0])) - 0.01);
  });

  it('en pulgadas, los números van en pulgadas', () => {
    const p = createTable(undefined, 'guatambu', now);
    const part = p.parts[0]!;
    const mm = piecesDxf([{ label: 'A', drawing: drawPart(p, part) }], 'cm');
    const inch = piecesDxf([{ label: 'A', drawing: drawPart(p, part) }], 'in');
    const max = (s: string) => Math.max(...[...s.matchAll(/\r\n 10\r\n(-?[\d.]+)/g)].map((m) => Number(m[1])));
    expect(inch).toContain('$INSUNITS\r\n 70\r\n1');
    expect(max(inch)).toBeCloseTo(max(mm) / 25.4, 2);
  });
});

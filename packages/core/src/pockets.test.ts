import { describe, expect, it } from 'vitest';
import { cutPiece } from './cutlist';
import { describePocket, newPocket, pocketSolid, snapOnFace } from './pockets';
import { loadProject, SCHEMA_VERSION, type Part } from './project';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const top = table.parts.find((p) => p.id === 'T1')!;
const mm = (n: number) => `${n} mm`;

describe('vaciados', () => {
  it('un rectángulo en la cara de arriba baja desde arriba y sale 1 mm', () => {
    const p = newPocket(top, 1, 1, { kind: 'rect', u: 100, v: 50, w: 200, h: 80 });
    expect(p).toMatchObject({ id: 'V1', depth: 11, through: false });
    const s = pocketSolid(top, p);
    expect(s).toEqual({ kind: 'box', box: { min: [100, 739, 50], max: [300, 751, 130] } });
  });

  it('un círculo es un calado: atraviesa toda la pieza', () => {
    const p = newPocket(top, 1, 1, { kind: 'circle', u: 900, v: 450, d: 60 });
    expect(p.through).toBe(true);
    expect(pocketSolid(top, p)).toEqual({ kind: 'cylinder', start: [900, 751, 450], axis: 1, dir: -1, radius: 30, length: 24 });
    expect(describePocket(p, mm)).toBe('calado Ø 60 mm en la cara de arriba');
  });

  it('en la cara de abajo baja hacia arriba', () => {
    const p = { ...newPocket(top, 1, -1, { kind: 'rect', u: 0, v: 0, w: 10, h: 10 }), depth: 5 };
    expect(pocketSolid(top, p)).toMatchObject({ box: { min: [0, 727, 0], max: [10, 733, 10] } });
    expect(describePocket({ ...p, axis: 2, side: 1 }, mm)).toBe('vaciado 10 mm × 10 mm, 5 mm de hondo en el frente');
  });

  it('el lápiz se pega a los bordes y al centro, y si no a 5 mm', () => {
    expect(snapOnFace(4, 900, 6)).toEqual({ value: 0, to: 'borde' });
    expect(snapOnFace(447, 900, 6)).toEqual({ value: 450, to: 'centro' });
    expect(snapOnFace(123, 900, 6)).toEqual({ value: 125, to: null });
    expect(snapOnFace(950, 900, 6)).toEqual({ value: 900, to: 'borde' });
  });

  it('la lista de cortes cuenta calados y vaciados', () => {
    const part: Part = {
      ...top,
      pockets: [newPocket(top, 1, 1, { kind: 'circle', u: 10, v: 10, d: 30 }), newPocket(top, 1, 1, { kind: 'rect', u: 0, v: 0, w: 5, h: 5 })],
    };
    expect(cutPiece(part, { ...table, parts: [part] }).work).toEqual(expect.arrayContaining(['1 calado', '1 vaciado']));
  });

  it('un proyecto v2 abre con las piezas sin vaciados', () => {
    const raw = JSON.parse(JSON.stringify({ ...table, schemaVersion: 2, parts: table.parts.map((p) => ({ ...p, pockets: undefined })) }));
    const r = loadProject(raw);
    expect(r.ok && r.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && r.project.parts.every((p) => p.pockets.length === 0)).toBe(true);
  });
});

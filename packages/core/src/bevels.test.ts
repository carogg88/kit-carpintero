import { describe, expect, it } from 'vitest';
import { bevelAngle, bevelSolid, describeBevel, isAngleCut, edgeNear, newBevel } from './bevels';
import { cutPiece } from './cutlist';
import { solidBox } from './joints';
import { loadProject, SCHEMA_VERSION } from './project';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const top = table.parts.find((p) => p.id === 'T1')!;
const mm = (n: number) => `${n} mm`;
const up = { axis: 1, side: 1 } as const;
const front = { axis: 2, side: 1 } as const;

describe('biseles', () => {
  it('toca la cara de arriba cerca del frente: la arista es la del frente', () => {
    expect(edgeNear(top, up, [900, 750, 890])).toEqual({ b: front, distance: 10 });
    expect(edgeNear(top, up, [5, 750, 450]).b).toEqual({ axis: 0, side: -1 });
  });

  it('un bisel nuevo va a 45° si la otra cara da', () => {
    expect(newBevel(top, up, front, 12)).toEqual({ id: 'B1', a: up, b: front, da: 12, db: 12 });
    // La tapa tiene 22 de espesor: más no se puede bajar por el frente.
    expect(newBevel(top, up, front, 40).db).toBe(22);
  });

  it('la cuña cubre la arista y sale por los dos lados', () => {
    const bv = newBevel(top, up, front, 10);
    const s = bevelSolid(top, bv);
    expect(s).toMatchObject({ kind: 'prism', axis: 0, u: 1, v: 2, from: -1, to: 1801 });
    const b = solidBox(s);
    // Llega 10 mm adentro de cada cara y sobra por afuera.
    expect(b.min[1]).toBeLessThan(740 + 0.01);
    expect(b.min[1]).toBeGreaterThan(739);
    expect(b.min[2]).toBeLessThan(890 + 0.01);
    expect(b.max[1]).toBeGreaterThan(750);
    expect(b.max[2]).toBeGreaterThan(900);
  });

  it('nombra el ángulo y distingue bisel de corte en ángulo', () => {
    const bv = { ...newBevel(top, up, front, 12), db: 6 };
    expect(bevelAngle(bv)).toBeCloseTo(26.57, 1);
    expect(describeBevel(top, bv, mm)).toBe('bisel de 12 mm × 6 mm a 26,6° entre la cara de arriba y el frente');
    expect(isAngleCut(top, bv)).toBe(false);
    expect(isAngleCut(top, { ...bv, da: 900 })).toBe(true);
  });

  it('la lista de cortes los cuenta', () => {
    const part = { ...top, ops: [], bevels: [newBevel(top, up, front, 12), { ...newBevel(top, up, front, 900), id: 'B2' }] };
    const work = cutPiece(part, { ...table, parts: [part], joints: [] }).work;
    expect(work).toContain('1 corte en ángulo');
    expect(work).toContain('1 bisel');
  });

  it('un proyecto v3 abre sin biseles', () => {
    const raw = JSON.parse(JSON.stringify({ ...table, schemaVersion: 3, parts: table.parts.map((p) => ({ ...p, bevels: undefined })) }));
    const r = loadProject(raw);
    expect(r.ok && r.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && r.project.parts.every((p) => p.bevels.length === 0)).toBe(true);
  });
});

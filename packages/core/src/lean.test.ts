import { describe, expect, it } from 'vitest';
import { cutPiece } from './cutlist';
import { mirrorPart } from './edit';
import { isLeaning, leanedBox, leanFrame, leanPoint } from './lean';
import { leanTestStool } from './templates/leanTest';
import type { Part } from './project';

const leg = (lean?: [number, number]): Part => ({
  id: 'P1',
  name: 'Pata',
  wood: 'guatambu',
  base: { kind: 'box', size: [40, 400, 30] },
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  ops: [],
  pockets: [],
  bevels: [],
  sections: [],
  ...(lean ? { lean } : {}),
});
const rad = (d: number) => (d * Math.PI) / 180;

describe('patas inclinadas', () => {
  it('derecha o en cero no se inclina', () => {
    expect(leanFrame(leg())).toBeNull();
    expect(leanFrame(leg([0, 0]))).toBeNull();
    // Una pieza acostada (un travesaño) no se inclina en esta prueba.
    expect(isLeaning({ ...leg([8, 0]), base: { kind: 'box', size: [400, 40, 30] } })).toBe(false);
  });

  it('inclinada de frente: madera más larga y puntas al mismo ángulo', () => {
    const f = leanFrame(leg([10, 0]))!;
    expect(f.tilt).toBeCloseTo(10, 6);
    // De punta larga a punta larga: el alto sobre el coseno más el ancho por la tangente.
    expect(f.length).toBeCloseTo(400 / Math.cos(rad(10)) + 40 * Math.tan(rad(10)), 6);
    expect(f.cut[0]).toBeCloseTo(10, 6);
    expect(f.cut[1]).toBeCloseTo(0, 6);
    // La punta de abajo se va hacia la derecha: tan(10°) por el alto.
    const foot = leanPoint(f, [20, 400 - 400 / Math.cos(rad(10)), 15]);
    expect(foot[0] - 20).toBeCloseTo(400 * Math.tan(rad(10)), 6);
    expect(foot[1]).toBeCloseTo(0, 6);
    expect(foot[2]).toBeCloseTo(15, 6);
  });

  it('vista de frente y de costado se ven los dos ángulos pedidos', () => {
    const f = leanFrame(leg([8, -6]))!;
    expect(Math.atan(f.dir[0] / -f.dir[1]) * (180 / Math.PI)).toBeCloseTo(8, 6);
    expect(Math.atan(f.dir[2] / -f.dir[1]) * (180 / Math.PI)).toBeCloseTo(-6, 6);
    // Inclinada en dos sentidos se aparta más que cada ángulo por separado.
    expect(f.tilt).toBeGreaterThan(8);
  });

  it('la caja de la pata inclinada llega al piso corrida', () => {
    const b = leanedBox(leg([10, 0]));
    expect(b.min[1]).toBe(0);
    expect(b.max[1]).toBe(400);
    expect(b.max[0]).toBeCloseTo(20 + 400 * Math.tan(rad(10)) + 20 / Math.cos(rad(10)), 6);
    expect(b.min[0]).toBeCloseTo(20 - 20 / Math.cos(rad(10)), 6);
  });

  it('la lista de cortes pide el largo de punta a punta y el ángulo de las puntas', () => {
    const p = leg([10, 0]);
    const c = cutPiece(p, { parts: [p], joints: [] } as never);
    expect(c.cut[0]).toBeCloseTo(leanFrame(p)!.length, 6);
    expect(c.work).toContain('puntas cortadas paralelas, a 10°');
  });

  it('la gemela se abre hacia el otro lado', () => {
    const stool = leanTestStool('guatambu', '2026-10-26T00:00:00Z');
    const p1 = stool.parts.find((p) => p.id === 'P1')!;
    const others = stool.parts.filter((p) => p.id !== 'P2');
    const twin = mirrorPart(others, p1)!;
    expect(twin.part.lean).toEqual(stool.parts.find((p) => p.id === 'P2')!.lean);
  });

  it('el taburete de prueba: patas en el asiento con mortaja y espiga', () => {
    const stool = leanTestStool('guatambu', '2026-10-26T00:00:00Z');
    const legs = stool.parts.filter((p) => p.id.startsWith('P'));
    expect(legs).toHaveLength(4);
    expect(legs.every(isLeaning)).toBe(true);
    expect(stool.joints.filter((j) => j.type === 'mortaja' && j.partA === 'S1')).toHaveLength(4);
    // Cada pata se abre hacia su esquina.
    for (const p of legs) {
      const b = leanedBox(p);
      const cx = (b.min[0] + b.max[0]) / 2 - 180;
      const cz = (b.min[2] + b.max[2]) / 2 - 180;
      expect(Math.sign(cx)).toBe(Math.sign(p.lean![0]));
      expect(Math.sign(cz)).toBe(Math.sign(p.lean![1]));
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { Box } from '../geometry';
import { defaultJointParams, jointGeometry, jointOptions, solidBox, type Solid } from './index';

// Esquina de un cajón: el lateral A (18 mm) y el frente B, que apoya su punta en A al ras del canto.
const side: Box = { min: [0, 0, 0], max: [18, 150, 400] };
const front: Box = { min: [18, 0, 0], max: [500, 150, 18] };
// Pata y faldón de la mesa.
const leg: Box = { min: [30, 0, 30], max: [100, 728, 100] };
const apron: Box = { min: [100, 633, 42], max: [1700, 728, 64] };

const boxOf = (s: Solid | undefined) => {
  if (s?.kind !== 'box') throw new Error('se esperaba una caja');
  return s.box;
};

describe('encastres finos', () => {
  it('en la esquina del cajón se ofrecen inglete, cola de milano y dedos', () => {
    const options = jointOptions(side, front);
    expect(options).toEqual(expect.arrayContaining(['inglete', 'cola-milano', 'dedos']));
    expect(jointOptions(leg, apron)).not.toContain('inglete');
  });

  it('cola de milano: tres colas pasantes, pendiente 1:8, más anchas en la punta', () => {
    expect(defaultJointParams('cola-milano', side, front)).toEqual({ count: 3, slope: 8, depth: 18 });
    const g = jointGeometry('cola-milano', side, front)!;
    expect(g.addB).toHaveLength(3);
    expect(g.cutA).toEqual(g.addB);
    const tail = g.addB[0]!;
    if (tail.kind !== 'prism') throw new Error('se esperaba un prisma');
    expect(tail).toMatchObject({ axis: 2, from: 0, to: 18, u: 1, v: 0 });
    const [b0, b1, t1, t0] = tail.points;
    // Base sobre la cara de A (x = 18) y punta del otro lado (x = 0), 4,5 mm más ancha (2 × 18 / 8).
    expect(b0![1]).toBe(18);
    expect(t0![1]).toBe(0);
    expect(t1![0] - t0![0] - (b1![0] - b0![0])).toBeCloseTo(4.5);
  });

  it('dedos: del ancho del espesor, B lleva los de las puntas', () => {
    expect(defaultJointParams('dedos', side, front)).toEqual({ count: 5, depth: 18 });
    const g = jointGeometry('dedos', side, front)!;
    expect(g.addB).toHaveLength(5);
    expect(boxOf(g.addB[0]).min[1]).toBe(0);
    expect(boxOf(g.addB[4]).max[1]).toBeCloseTo(150);
    expect(boxOf(g.addB[0]).max[1]).toBeCloseTo(150 / 9);
  });

  it('inglete: B gana el triángulo de su lado y A lo pierde', () => {
    const g = jointGeometry('inglete', side, front)!;
    expect(g.addB).toEqual([{ kind: 'prism', axis: 1, from: 0, to: 150, u: 0, v: 2, points: [[0, 0], [18, 0], [18, 18]] }]);
    expect(g.cutA).toEqual(g.addB);
  });

  it('brida: la horquilla de B abraza el tercio del medio', () => {
    expect(defaultJointParams('brida', leg, apron)).toEqual({ thickness: 7.5, depth: 70 });
    const g = jointGeometry('brida', leg, apron)!;
    expect(g.addB.map((s) => [boxOf(s).min[2], boxOf(s).max[2]])).toEqual([
      [42, 49.25],
      [56.75, 64],
    ]);
    expect(boxOf(g.addB[0]).min[0]).toBe(30);
  });

  it('galleta: una del 20 en un faldón de 95 mm, ranura en las dos piezas', () => {
    expect(defaultJointParams('galleta', leg, apron)).toEqual({ size: 20, count: 1 });
    const g = jointGeometry('galleta', leg, apron)!;
    expect(boxOf(g.cutA[0])).toEqual({ min: [87.5, 649.5, 51], max: [100, 711.5, 55] });
    expect(boxOf(g.cutB[0])).toEqual({ min: [100, 649.5, 51], max: [112.5, 711.5, 55] });
  });

  it('machimbre: solo entre tablas de espesor parecido, canto con canto', () => {
    const a: Box = { min: [0, 0, 0], max: [100, 20, 1000] };
    const b: Box = { min: [100, 0, 0], max: [200, 20, 1000] };
    expect(jointOptions(leg, apron)).not.toContain('machiembrado');
    expect(defaultJointParams('machiembrado', a, b)).toEqual({ thickness: 6.5, depth: 10 });
    const g = jointGeometry('machiembrado', a, b)!;
    expect(boxOf(g.addB[0])).toEqual({ min: [90, 6.75, 0], max: [100, 13.25, 1000] });
    expect(boxOf(g.cutA[0])).toEqual({ min: [89, 6.75, 0], max: [100, 13.25, 1000] });
  });

  it('bolsillo: agujero inclinado 15° que sale al centro de la punta de B', () => {
    expect(defaultJointParams('bolsillo', leg, apron)).toEqual({ count: 1 });
    const g = jointGeometry('bolsillo', leg, apron)!;
    expect(g.cutA).toEqual([]);
    const [counterbore, pilot] = g.cutB;
    if (counterbore?.kind !== 'bore' || pilot?.kind !== 'bore') throw new Error('se esperaban agujeros');
    const end = pilot.start.map((v, k) => v + pilot.dir[k]! * pilot.length);
    expect(end[0]).toBeCloseTo(100);
    expect(end[2]).toBeCloseTo(53);
    // La pata está del lado de z mayor que el centro del faldón: el bolsillo entra por la cara de z = 64.
    expect(counterbore.start[2]).toBeGreaterThan(64);
    expect(Math.acos(Math.abs(pilot.dir[0])) * (180 / Math.PI)).toBeCloseTo(15);
    // La guía termina en la punta: el borde del agujero inclinado asoma menos de un milímetro.
    expect(solidBox(pilot).min[0]).toBeGreaterThan(99);
  });
});

import { describe, expect, it } from 'vitest';
import type { Box } from '../geometry';
import { createTable } from '../templates/table';
import { defaultJointParams, jointGeometry, jointOptions, suggestJoints, type Solid } from './index';

const leg: Box = { min: [30, 0, 30], max: [100, 728, 100] };
const apron: Box = { min: [100, 633, 42], max: [1700, 728, 64] };
const boxOf = (s: Solid | undefined) => {
  if (s?.kind !== 'box') throw new Error('se esperaba una caja');
  return s.box;
};

describe('encastres base', () => {
  it('entre pata y faldón (a 12 mm del canto) entran todos los de punta, menos rebaje, inglete y machimbre', () => {
    expect(jointOptions(leg, apron)).toEqual(['tope', 'mortaja', 'canal', 'clavija', 'cola-milano', 'dedos', 'brida', 'galleta', 'bolsillo']);
  });

  it('canal: el faldón entra entero un tercio de la pata, hasta 12 mm', () => {
    const g = jointGeometry('canal', leg, apron);
    expect(boxOf(g?.cutA[0])).toEqual({ min: [88, 633, 42], max: [100, 728, 64] });
    expect(g?.addB).toEqual(g?.cutA);
  });

  it('tarugos: dos de 8 mm en un faldón de 95 mm', () => {
    expect(defaultJointParams('clavija', leg, apron)).toEqual({ diameter: 8, count: 2, depthA: 30, depthB: 30 });
    const g = jointGeometry('clavija', leg, apron);
    expect(g?.cutA).toHaveLength(2);
    expect(g?.cutA[0]).toMatchObject({ kind: 'cylinder', axis: 0, dir: -1, radius: 4, length: 31 });
    expect(g?.cutB[0]).toMatchObject({ dir: 1, start: [100, 633 + 95 / 4, 53] });
  });

  it('rebaje: abierto hacia el canto más cercano de A', () => {
    const side: Box = { min: [0, 0, 0], max: [400, 300, 18] };
    const back: Box = { min: [4, 0, 18], max: [16, 300, 600] };
    const g = jointGeometry('rebaje', side, back, { depth: 9 });
    expect(boxOf(g?.cutA[0])).toEqual({ min: [0, 0, 9], max: [16, 300, 18] });
    expect(boxOf(g?.addB[0])).toEqual({ min: [4, 0, 9], max: [16, 300, 18] });
  });

  it('rebaje: no si la pieza queda lejos del canto (dejaría un escalón vacío)', () => {
    const side: Box = { min: [0, 0, 0], max: [20, 1800, 300] };
    const plinth: Box = { min: [20, 0, 260], max: [780, 70, 280] };
    expect(jointOptions(side, plinth)).not.toContain('rebaje');
    expect(jointOptions(side, plinth)).toContain('canal');
  });

  it('media madera: cada pieza pierde la mitad del cruce', () => {
    const a: Box = { min: [0, 0, 0], max: [500, 22, 70] };
    const b: Box = { min: [200, 0, -100], max: [270, 22, 400] };
    const g = jointGeometry('media-madera', a, b);
    expect(boxOf(g?.cutA[0])).toEqual({ min: [200, 11, 0], max: [270, 22, 70] });
    expect(boxOf(g?.cutB[0])).toEqual({ min: [200, 0, 0], max: [270, 11, 70] });
  });

  it('a tope no corta nada', () => {
    expect(jointGeometry('tope', leg, apron)).toEqual({ cutA: [], cutB: [], addB: [] });
  });

});

describe('suggestJoints', () => {
  it('en la mesa propone mortaja y espiga entre patas y faldones', () => {
    const t = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
    const joints = suggestJoints(t.parts.filter((p) => p.id !== 'T1'));
    expect(joints).toHaveLength(8);
    expect(joints.every((j) => j.type === 'mortaja' && j.partA.startsWith('P'))).toBe(true);
    expect(new Set(joints.map((j) => `${j.partA}-${j.partB}`))).toEqual(new Set(t.joints.filter((j) => j.type === 'mortaja').map((j) => j.id)));
  });

  it('en dos travesaños cruzados propone media madera', () => {
    const part = (id: string, position: [number, number, number], size: [number, number, number]) => ({
      id, name: id, wood: 'pino', base: { kind: 'box' as const, size }, position, rotation: [0, 0, 0] as [number, number, number], ops: [], pockets: [], bevels: [], sections: [],
    });
    const j = suggestJoints([part('A', [0, 0, 0], [500, 22, 70]), part('B', [200, 0, -100], [70, 22, 500])]);
    expect(j).toMatchObject([{ type: 'media-madera', params: { ratio: 0.5 } }]);
  });
});

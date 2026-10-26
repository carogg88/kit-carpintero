import { describe, expect, it } from 'vitest';
import { axisRelation, centerShift, dimensions, faceDistance, isCentered, neighbors } from './measure';
import type { Box } from './geometry';

const box = (min: Box['min'], max: Box['max']): Box => ({ min, max });

describe('medir entre piezas', () => {
  const legL = box([0, 0, 0], [50, 700, 50]);
  const legR = box([950, 0, 0], [1000, 700, 50]);
  const top = box([0, 700, 0], [1000, 720, 500]);

  it('separadas: el aire entre las dos, de cualquier lado', () => {
    expect(axisRelation(legL, legR, 0)).toEqual({ kind: 'gap', gap: 900, aFirst: true });
    expect(axisRelation(legR, legL, 0)).toEqual({ kind: 'gap', gap: 900, aFirst: false });
    expect(axisRelation(legL, top, 1)).toEqual({ kind: 'gap', gap: 0, aFirst: true });
  });

  it('adentro: lo que sobra a cada lado, si está centrada y cuánto correrla', () => {
    const shelf = box([60, 300, 0], [930, 318, 400]);
    const r = axisRelation(shelf, top, 0);
    expect(r).toEqual({ kind: 'inside', before: 60, after: 70 });
    expect(isCentered(r)).toBe(false);
    expect(centerShift(r)).toBe(5);
    const around = axisRelation(top, shelf, 0);
    expect(around).toEqual({ kind: 'around', before: 60, after: 70 });
    // Centrar la tapa respecto del estante la corre al revés.
    expect(centerShift(around)).toBe(-5);
    expect(isCentered(axisRelation(box([50, 0, 0], [950, 1, 1]), top, 0))).toBe(true);
  });

  it('cruzadas en parte: cuánto se meten', () => {
    expect(axisRelation(box([0, 0, 0], [100, 1, 1]), box([80, 0, 0], [200, 1, 1]), 0)).toEqual({ kind: 'cross', overlap: 20 });
  });

  it('distancia entre caras paralelas', () => {
    expect(faceDistance(legL, { axis: 0, side: 1 }, legR, { axis: 0, side: -1 })).toBe(900);
    expect(faceDistance(legL, { axis: 0, side: -1 }, legR, { axis: 0, side: 1 })).toBe(1000);
    expect(faceDistance(legL, { axis: 0, side: 1 }, legR, { axis: 1, side: 1 })).toBeNull();
  });

  it('cotas: el aire entre dos patas, por el medio de lo que comparten', () => {
    expect(dimensions(legL, legR)).toEqual([{ axis: 0, from: [50, 350, 25], to: [950, 350, 25] }]);
  });

  it('vecinas enfrentadas más cercanas de cada lado', () => {
    const rail = box([50, 600, 10], [950, 680, 40]);
    const others = [
      { id: 'P1', box: legL },
      { id: 'P2', box: legR },
      { id: 'T1', box: top },
    ];
    const moving = box([400, 300, 10], [450, 318, 40]);
    expect(neighbors(moving, others, 0)).toEqual({ before: { id: 'P1', gap: 350 }, after: { id: 'P2', gap: 500 } });
    expect(neighbors(moving, [...others, { id: 'F1', box: rail }], 1)).toEqual({ before: null, after: { id: 'F1', gap: 282 } });
  });
});

import { describe, expect, it } from 'vitest';
import type { Axis } from './geometry';
import type { Part } from './project';
import { rotatePart } from './rotate';

const slat = (): Part => ({
  id: 'L1',
  name: 'Listón',
  wood: 'guatambu',
  base: { kind: 'box', size: [340, 25, 40] },
  position: [100, 400, 0],
  rotation: [0, 0, 0],
  ops: [],
  pockets: [
    { id: 'V1', axis: 1, side: 1, shape: { kind: 'rect', u: 20, v: 5, w: 60, h: 10 }, depth: 5, through: false },
    { id: 'V2', axis: 2, side: -1, shape: { kind: 'circle', u: 300, v: 12, d: 8 }, depth: 4, through: false },
    { id: 'V3', axis: 2, side: 1, shape: { kind: 'arc', u: 0, v: 25, u2: 30, v2: 25, bulge: -10, outside: false }, depth: 40, through: true },
  ],
  bevels: [{ id: 'B1', a: { axis: 0, side: 1 }, b: { axis: 1, side: 1 }, da: 5, db: 5, round: true }],
  sections: [{ id: 'T1', axis: 0, from: 0, to: 60, size: [20, 30] }],
});

describe('girar 90°', () => {
  it('un listón acostado a lo ancho queda de adelante hacia atrás, sin moverse de su centro', () => {
    const p = slat();
    rotatePart(p, 1);
    expect(p.base).toEqual({ kind: 'box', size: [40, 25, 340] });
    expect(p.position).toEqual([250, 400, -150]);
  });

  it('el vaciado de arriba sigue arriba, y el tramo sigue a lo largo', () => {
    const p = slat();
    rotatePart(p, 1);
    const v1 = p.pockets[0]!;
    expect([v1.axis, v1.side]).toEqual([1, 1]);
    // Arriba, la cara mide 40 × 340: el rectángulo de 60 × 10 a 20 de la punta queda de 10 × 60.
    expect(v1.shape).toMatchObject({ kind: 'rect', w: 10, h: 60 });
    expect(p.sections[0]).toMatchObject({ axis: 2, size: [30, 20] });
  });

  it('cuatro vueltas sobre cualquier eje dejan la pieza como estaba', () => {
    for (const axis of [0, 1, 2] as Axis[]) {
      const p = slat();
      for (let i = 0; i < 4; i++) rotatePart(p, axis);
      expect(p).toEqual(slat());
    }
  });

  it('dos vueltas dan vuelta el torneado: el perfil se lee de la otra punta', () => {
    const p: Part = {
      ...slat(),
      pockets: [],
      bevels: [],
      sections: [],
      turning: {
        axis: 0,
        stations: [
          { at: 0, d: 40, to: 'straight', bulge: 0 },
          { at: 100, d: 30, to: 'curve', bulge: 3 },
          { at: 340, d: 20, to: 'straight', bulge: 0 },
        ],
      },
    };
    rotatePart(p, 1);
    rotatePart(p, 1);
    expect(p.turning).toEqual({
      axis: 0,
      stations: [
        { at: 0, d: 20, to: 'straight', bulge: 0 },
        { at: 240, d: 30, to: 'straight', bulge: 0 },
        { at: 340, d: 40, to: 'curve', bulge: 3 },
      ],
    });
  });
});

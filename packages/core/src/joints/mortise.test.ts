import { describe, expect, it } from 'vitest';
import type { Box } from '../geometry';
import { defaultMortiseParams, mortiseAndTenon, mortiseGeometry, tenonSpans, tenonWidth } from './mortise';
import { solidBox } from './common';

// Pata de 70 × 725 × 70 y faldón de 22 de espesor que llega a su cara derecha.
const leg: Box = { min: [30, 0, 30], max: [100, 725, 100] };
const apron: Box = { min: [100, 625, 42], max: [1700, 725, 64] };

describe('mortaja y espiga', () => {
  it('usa la regla del tercio y no pasa del 65 % de la pieza que recibe', () => {
    expect(defaultMortiseParams(leg, apron)).toEqual({ length: 40, thickness: 7.3, shoulder: 10, count: 1, gap: 26.5 });
  });

  it('la espiga sale de la punta del faldón hacia la pata', () => {
    const r = mortiseAndTenon(leg, apron, { length: 40, thickness: 7.3, shoulder: 10 });
    if (!r) throw new Error('sin contacto');
    expect(r.tenon.min[0]).toBe(60);
    expect(r?.tenon.max[0]).toBe(100);
    expect(r?.tenon.min[1]).toBe(635);
    expect(r?.tenon.max[1]).toBe(715);
    expect(r.tenon.max[2] - r.tenon.min[2]).toBeCloseTo(7.3);
    expect(r?.mortise.min[0]).toBe(58);
  });

  it('devuelve null si las piezas no se tocan de punta', () => {
    const far: Box = { min: [500, 625, 42], max: [900, 725, 64] };
    expect(mortiseAndTenon(leg, far, { length: 40, thickness: 7, shoulder: 10 })).toBeNull();
  });

  it('la espiga doble son dos espigas con madera en el medio, cada una con su mortaja', () => {
    const g = mortiseGeometry(leg, apron, { length: 40, thickness: 7, shoulder: 10, count: 2, gap: 20 })!;
    expect(g.addB).toHaveLength(2);
    expect(g.cutA).toHaveLength(2);
    const [lo, hi] = g.addB.map(solidBox);
    // 80 de ancho sin hombros: 30 + 20 + 30.
    expect([lo!.min[1], lo!.max[1], hi!.min[1], hi!.max[1]]).toEqual([635, 665, 685, 715]);
    expect(tenonWidth(100, { shoulder: 10, count: 2, gap: 20 })).toBe(30);
  });

  it('sin lugar para dos, queda una', () => {
    expect(tenonSpans(0, 8, 2, 4)).toEqual([[0, 8]]);
    expect(tenonSpans(0, 90, 1)).toEqual([[0, 90]]);
  });
});

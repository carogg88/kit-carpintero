import { describe, expect, it } from 'vitest';
import type { Box } from '../geometry';
import { defaultMortiseParams, mortiseAndTenon } from './mortise';

// Pata de 70 × 725 × 70 y faldón de 22 de espesor que llega a su cara derecha.
const leg: Box = { min: [30, 0, 30], max: [100, 725, 100] };
const apron: Box = { min: [100, 625, 42], max: [1700, 725, 64] };

describe('mortaja y espiga', () => {
  it('usa la regla del tercio y no pasa del 65 % de la pieza que recibe', () => {
    expect(defaultMortiseParams(leg, apron)).toEqual({ length: 40, thickness: 7.3, shoulder: 10 });
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
});

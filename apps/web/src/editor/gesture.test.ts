import { describe, expect, it } from 'vitest';
import { gentle, roundMeasure } from './gesture';

describe('arrastres suaves', () => {
  it('un toque no cambia nada', () => {
    expect(gentle(4, 14)).toBe(0);
  });
  it('con la vista lejos, 60 px avanzan 27 mm y no 20 cm', () => {
    // 3,4 mm por píxel: la mesa entera en pantalla.
    expect(gentle(60, 204)).toBeCloseTo(27);
  });
  it('con la vista cerca sigue al dedo', () => {
    expect(gentle(60, 12)).toBeCloseTo(10.8);
  });
  it('después de la zona lenta sigue al dedo, sin saltos y con su signo', () => {
    expect(gentle(96, -326.4)).toBeCloseTo(-45);
    expect(gentle(196, -666.4)).toBeCloseTo(-45 - 340);
  });
  it('redondea al mm y, desde 2 cm, cada 5 mm', () => {
    expect(roundMeasure(7.4)).toBe(7);
    expect(roundMeasure(23)).toBe(25);
    expect(roundMeasure(-22)).toBe(-20);
  });
});

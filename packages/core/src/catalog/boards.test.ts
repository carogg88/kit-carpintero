import { describe, expect, it } from 'vitest';
import { boardFeet, formatInches, planedMm, stockFor } from './boards';

describe('catálogo de madereras', () => {
  it('cepillado: 1″ da 22,5 mm y 3″ da 70 mm', () => {
    expect(planedMm(1)).toBe(22.5);
    expect(planedMm(3)).toBe(70);
  });

  it('pies madereros como en el corralón', () => {
    expect(boardFeet(1, 6, 3.66)).toBeCloseTo(6, 1);
    expect(boardFeet(3, 3, 3.05)).toBeCloseTo(7.5, 1);
  });

  it('pata de 7 × 7 cm: tirante de 3″ × 3″', () => {
    expect(stockFor([70, 695, 70])).toEqual({ kind: 'tirante', thicknessIn: 3, widthIn: 3, boards: 1, lengthM: 1.83 });
  });

  it('faldón de 22 × 95 mm: tabla de 1″ × 4″', () => {
    expect(stockFor([1600, 95, 22])).toMatchObject({ kind: 'tabla', thicknessIn: 1, widthIn: 4, boards: 1 });
  });

  it('tapa de 90 cm: tablas de 1″ × 6″ encoladas', () => {
    expect(stockFor([1800, 22, 900])).toMatchObject({ thicknessIn: 1, widthIn: 6, boards: 7, lengthM: 1.83 });
  });

  it('pieza más larga que cualquier tabla: sin largo comercial', () => {
    expect(stockFor([22, 95, 4000])?.lengthM).toBeNull();
  });

  it('escribe las pulgadas como en el taller', () => {
    expect(formatInches(0.75)).toBe('3/4″');
    expect(formatInches(1.5)).toBe('1 1/2″');
    expect(formatInches(3)).toBe('3″');
  });
});

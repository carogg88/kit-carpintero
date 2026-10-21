import { describe, expect, it } from 'vitest';
import { formatLength, formatNumber, parseLength, roundToUnit } from './units';

describe('formatNumber', () => {
  it('muestra cm con coma decimal', () => {
    expect(formatNumber(725, 'cm')).toBe('72,5');
    expect(formatNumber(1800, 'cm')).toBe('180');
  });
  it('muestra pulgadas en fracciones simplificadas de 1/16', () => {
    expect(formatNumber(25.4, 'in')).toBe('1');
    expect(formatNumber(19.05, 'in')).toBe('3/4');
    expect(formatNumber(73.025, 'in')).toBe('2 7/8');
    expect(formatNumber(25.39, 'in')).toBe('1');
  });
  it('agrega la unidad', () => {
    expect(formatLength(250, 'cm')).toBe('25 cm');
    expect(formatLength(50.8, 'in')).toBe('2″');
  });
});

describe('parseLength', () => {
  it('lee cm con coma o punto', () => {
    expect(parseLength('72,5', 'cm')).toBe(725);
    expect(parseLength('72.5 cm', 'cm')).toBe(725);
  });
  it('lee pulgadas enteras, decimales y fracciones', () => {
    expect(parseLength('2 7/8', 'in')).toBeCloseTo(73.025);
    expect(parseLength('3/4″', 'in')).toBeCloseTo(19.05);
    expect(parseLength('1.5', 'in')).toBeCloseTo(38.1);
  });
  it('devuelve null si no entiende', () => {
    expect(parseLength('', 'cm')).toBeNull();
    expect(parseLength('abc', 'in')).toBeNull();
    expect(parseLength('1/0', 'in')).toBeNull();
  });
});

describe('roundToUnit', () => {
  it('redondea a 1 mm o a 1/16″', () => {
    expect(roundToUnit(12.4, 'cm')).toBe(12);
    expect(roundToUnit(20, 'in')).toBeCloseTo(20.6375) // 13/16″;
  });
});

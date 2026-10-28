import { describe, expect, it } from 'vitest';
import { boxSize, type Box } from '../geometry';
import { solidBox } from './common';
import { isThrough, mortiseGeometry, TENON_STYLES, tenonLength, tenonStyle, type MortiseParams } from './mortise';

// Pata de 70 × 725 × 70 y faldón de 22 de espesor, al ras de la punta de arriba de la pata, que llega a su cara derecha.
const leg: Box = { min: [30, 0, 30], max: [100, 725, 100] };
const apron: Box = { min: [100, 625, 42], max: [1700, 725, 64] };
const base: MortiseParams = { length: 40, thickness: 7.5, shoulder: 10 };
const style = (s: (typeof TENON_STYLES)[number], more: Partial<MortiseParams> = {}) => mortiseGeometry(leg, apron, { ...base, style: TENON_STYLES.indexOf(s), ...more })!;

describe('formas de trabar la caja y espiga', () => {
  it('sin estilo es la ciega de siempre, sin nada más', () => {
    const g = mortiseGeometry(leg, apron, base)!;
    expect(tenonStyle(base)).toBe('ciega');
    expect(g.extra).toBeUndefined();
    expect(solidBox(g.addB[0]!).min[0]).toBe(60);
  });

  it('pasante: la espiga atraviesa la pata, con el largo que tenga el campo', () => {
    const g = style('pasante', { length: 20 });
    expect(isThrough('pasante')).toBe(true);
    expect(solidBox(g.addB[0]!).min[0]).toBe(30);
    expect(g.extra).toBeUndefined();
  });

  it('con llave: la espiga asoma y lleva el agujero de la llave, 2 mm adentro de la pata', () => {
    const g = style('llave');
    expect(tenonLength({ ...base, style: 5 }, 70)).toBe(110);
    expect(solidBox(g.addB[0]!).min[0]).toBe(-10);
    const key = solidBox(g.extra!.cutB[0]!);
    expect([key.min[0], key.max[0]]).toEqual([30 - 16, 32]);
    // Del ancho de la espiga y la mitad de su espesor.
    expect(boxSize(key)[2]).toBe(4);
    expect([key.min[1], key.max[1]]).toEqual([634, 716]);
  });

  it('con cuñas: dos cortes en la espiga y la mortaja abierta en la mitad de afuera', () => {
    const g = style('cunas');
    const cuts = g.extra!.cutB.map(solidBox);
    expect(cuts).toHaveLength(2);
    // A un quinto de cada canto de una espiga de 80: a 16 mm.
    expect(cuts.map((c) => (c.min[1] + c.max[1]) / 2)).toEqual([651, 699]);
    // Dos tercios del largo, desde la punta.
    expect(cuts[0]!.min[0]).toBeCloseTo(29.5, 6);
    expect(cuts[0]!.max[0]).toBeCloseTo(100 - 70 / 3, 6);
    const flare = solidBox(g.extra!.cutA[0]!);
    expect([flare.min[1], flare.max[1]]).toEqual([633, 717]);
    expect([flare.min[0], flare.max[0]]).toEqual([29, 65]);
  });

  it('ciega con cuñas: la mortaja se abre al fondo', () => {
    const g = style('ciega-cunas');
    const flare = solidBox(g.extra!.cutA[0]!);
    expect([flare.min[0], flare.max[0]]).toEqual([58, 80]);
    expect(g.extra!.cutB).toHaveLength(2);
  });

  it('tarugada: el tarugo cruza la pata, y en la espiga el agujero va corrido hacia el hombro', () => {
    const g = style('tarugada');
    const [a] = g.extra!.cutA;
    const [b] = g.extra!.cutB;
    if (a?.kind !== 'cylinder' || b?.kind !== 'cylinder') throw new Error('sin agujeros');
    // Espiga de 7,5: tarugo de 6.
    expect(a.radius).toBe(3);
    expect(a.axis).toBe(2);
    expect(a.length).toBe(72);
    // A un tercio del largo desde la cara, y 1,5 mm más cerca del hombro en la espiga.
    expect(a.start[0]).toBeCloseTo(100 - 40 / 3, 6);
    expect(b.start[0] - a.start[0]).toBeCloseTo(1.5, 6);
  });

  it('media caja: el diente llena el hombro del lado de la punta de la pata', () => {
    const g = style('ciega', { haunch: 12 });
    const [tooth] = g.extra!.addB.map(solidBox);
    expect([tooth!.min[1], tooth!.max[1]]).toEqual([715, 725]);
    expect([tooth!.min[0], tooth!.max[0]]).toEqual([88, 100]);
    expect(solidBox(g.extra!.cutA[0]!).min[0]).toBe(87);
  });

  it('con espiga doble, cada espiga lleva lo suyo', () => {
    const g = style('cunas', { count: 2, gap: 26 });
    expect(g.addB).toHaveLength(2);
    // Espigas de 27 mm: un corte al medio de cada una.
    expect(g.extra!.cutB).toHaveLength(2);
    expect(g.extra!.cutA).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import { joinPlan, jointList, moveGuide } from './moveguide';
import { snapMove, syncJoints } from './edit';
import { applyReviewFix } from './review';
import { partBox } from './geometry';
import { formatNumber } from './units';
import type { Part } from './project';

const n = (mm: number) => `${formatNumber(mm, 'cm')} cm`;
const part = (id: string, size: [number, number, number], position: [number, number, number]): Part => ({
  id,
  name: id === 'P1' ? 'Pata' : 'Travesaño',
  wood: 'guatambu',
  base: { kind: 'box', size },
  position,
  rotation: [0, 0, 0],
  ops: [],
  pockets: [],
  bevels: [],
  sections: [],
});
/** Una pata de 4 × 4 y un travesaño de 8 × 2 frente a su cara derecha, a `x` mm del piso de la pata. */
const model = (x: number, size: [number, number, number] = [400, 80, 20]) => {
  const parts = [part('P1', [40, 700, 40], [0, 0, 0]), part('T1', size, [x, 600, 10])];
  return { parts, joints: syncJoints(parts, []) };
};

describe('guía al mover', () => {
  it('tocando la cara dice qué unión sale, la recomendada primero', () => {
    const g = moveGuide(model(40), ['T1'], n);
    expect(g.joint).toMatch(/^Toca P1: mortaja y espiga, .+ y \d+ más$/);
    expect(g.warn).toBeUndefined();
    expect(g.clash).toEqual([]);
  });

  it('una luz chica no da unión', () => {
    const g = moveGuide(model(43), ['T1'], n);
    expect(g.joint).toBeUndefined();
    expect(g.warn).toBe('Queda a 0,3 cm de P1: así no hay unión');
  });

  it('metida en la pata: avisa cuánto y marca dónde', () => {
    const m = model(25, [415, 80, 20]);
    // Sin la media madera que le pondría syncJoints: es el momento del arrastre.
    const g = moveGuide({ parts: m.parts, joints: [] }, ['T1'], n);
    expect(g.warn).toBe('Se mete 1,5 cm en P1: dejala en la cara para una caja y espiga');
    expect(g.clash).toEqual([{ min: [25, 600, 10], max: [40, 680, 30] }]);
  });

  it('un cruce que ya tiene su media madera no es un choque', () => {
    const m = model(-50, [500, 80, 20]);
    expect(m.joints[0]!.type).toBe('media-madera');
    const g = moveGuide(m, ['T1'], n);
    expect(g.clash).toEqual([]);
    expect(g.joint).toBe('Cruza P1: media madera');
  });

  it('jointList corta la lista', () => {
    expect(jointList(['mortaja'])).toBe('mortaja y espiga');
    expect(jointList(['mortaja', 'clavija'])).toBe('mortaja y espiga o tarugos');
    expect(jointList(['mortaja', 'clavija', 'brida', 'galleta'])).toBe('mortaja y espiga, tarugos y 2 más');
  });
});

describe('imán de punta', () => {
  it('la punta del travesaño se pega a la cara de la pata desde más lejos', () => {
    const m = model(60);
    const start = partBox(m.parts[1]!);
    // A 20 mm: el imán común (14) no llega; el de punta sí.
    expect(snapMove(m.parts, start, 0, 0, 'T1')).toEqual({ value: -20, to: 'P1' });
  });

  it('a lo ancho no tira más fuerte', () => {
    const m = model(40);
    const start = partBox(m.parts[1]!);
    // Subir el travesaño 20 mm desde el tope de la pata: no se pega.
    const top = { ...start, min: [start.min[0], 720, start.min[2]] as [number, number, number], max: [start.max[0], 800, start.max[2]] as [number, number, number] };
    expect(snapMove(m.parts, top, 1, 0, 'T1').to).toBeNull();
  });
});

describe('quiero esta unión', () => {
  it('lleva el travesaño a la cara de la pata, o lo estira', () => {
    const m = model(100);
    const plan = joinPlan(m.parts[0]!, m.parts[1]!, n)!;
    expect(plan).toMatchObject({ a: 'P1', b: 'T1', touching: false });
    expect(plan.joints[0]).toBe('mortaja');
    expect(plan.fixes.map((f) => f.label)).toEqual(['Llevar T1 hasta P1', 'Estirar T1 6 cm hasta P1']);
    const moved = structuredClone(m);
    applyReviewFix(moved, plan.fixes[0]!);
    expect(moved.parts[1]!.position[0]).toBe(40);
    const stretched = structuredClone(m);
    applyReviewFix(stretched, plan.fixes[1]!);
    expect(stretched.parts[1]!.position[0]).toBe(40);
    expect(stretched.parts[1]!.base).toMatchObject({ size: [460, 80, 20] });
  });

  it('si ya se tocan dice qué sale; si no quedan enfrentadas, por qué', () => {
    const m = model(40);
    expect(joinPlan(m.parts[0]!, m.parts[1]!, n)).toMatchObject({ touching: true, fixes: [] });
    const far = [m.parts[0]!, part('T2', [400, 80, 20], [100, 600, 200])];
    expect(joinPlan(far[0]!, far[1]!, n)!.reason).toMatch(/No quedan enfrentadas/);
  });
});

describe('con quién manda', () => {
  it('la punta contra la pata gana a la tapa que apoya encima', () => {
    const m = model(40);
    const top = part('T0', [600, 20, 100], [0, 680, 0]);
    const g = moveGuide({ parts: [top, ...m.parts], joints: [] }, ['T1'], n);
    expect(g.joint).toMatch(/^Toca P1:/);
  });
});

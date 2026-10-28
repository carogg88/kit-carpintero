import { describe, expect, it } from 'vitest';
import { applyJointFix, canSwap, jointChoices, nearMisses, swapJoint } from './jointfix';
import { syncJoints } from './edit';
import { applyReviewFix } from './review';
import { endJoint, defaultJointParams } from './joints';
import { partBox } from './geometry';
import { formatNumber } from './units';
import type { Joint, Part } from './project';

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
/** Una pata de 4 × 4 y un travesaño de 8 × 2 que llega a su cara derecha, 1 cm adentro del frente. */
const model = (rail: Partial<{ size: [number, number, number]; position: [number, number, number] }> = {}) => {
  const parts = [part('P1', [40, 700, 40], [0, 0, 0]), part('T1', rail.size ?? [400, 80, 20], rail.position ?? [40, 600, 10])];
  return { parts, joints: syncJoints(parts, []) };
};
const choice = (m: ReturnType<typeof model>, type: Joint['type']) => {
  const j = m.joints[0]!;
  const a = m.parts.find((p) => p.id === j.partA)!;
  const b = m.parts.find((p) => p.id === j.partB)!;
  return jointChoices(a, b, n).find((c) => c.type === type)!;
};

describe('por qué no se puede un encastre', () => {
  it('todos los encastres aparecen, y los que no se pueden dicen qué les falta', () => {
    const m = model();
    expect(m.joints[0]).toMatchObject({ partA: 'P1', partB: 'T1', type: 'mortaja' });
    const all = jointChoices(m.parts[0]!, m.parts[1]!, n);
    expect(all.length).toBeGreaterThan(10);
    expect(all.find((c) => c.type === 'mortaja')).toEqual({ type: 'mortaja', ok: true });
    expect(choice(m, 'media-madera').reason).toMatch(/se cruzan/);
    // Brida: el travesaño tiene 2 cm y pide 1,2: sí; ensamble de dedos también.
    expect(choice(m, 'brida').ok).toBe(true);
  });

  it('un travesaño fino: la brida pide engrosarlo, y el arreglo la hace posible', () => {
    const m = model({ size: [400, 80, 10], position: [40, 600, 15] });
    const c = choice(m, 'brida');
    expect(c.ok).toBe(false);
    expect(c.reason).toContain('1 cm de espesor');
    expect(c.fix).toMatchObject({ part: 'T1', axis: 2, size: 12, min: 14 });
    applyJointFix(m, m.joints[0]!.id, 'brida', c.fix!);
    expect(m.joints[0]!.type).toBe('brida');
    expect(defaultJointParams('brida', partBox(m.parts[0]!), partBox(m.parts[1]!))).not.toBeNull();
  });

  it('inglete: el travesaño se lleva al ras del canto de la pata', () => {
    const m = model();
    const c = choice(m, 'inglete');
    expect(c.ok).toBe(false);
    expect(c.reason).toContain('1 cm adentro');
    applyJointFix(m, m.joints[0]!.id, 'inglete', c.fix!);
    expect(m.parts[1]!.position[2]).toBe(0);
    expect(m.joints[0]!.type).toBe('inglete');
  });

  it('se cruzan: el travesaño se recorta hasta la cara de la pata y pasa a caja y espiga', () => {
    // El travesaño se mete 15 mm adentro de la pata.
    const m = model({ size: [415, 80, 20], position: [25, 600, 10] });
    const id = m.joints[0]!.id;
    expect(m.joints[0]!.type).toBe('media-madera');
    const c = choice(m, 'mortaja');
    expect(c.reason).toContain('1,5 cm adentro de P1');
    expect(c.fix).toMatchObject({ part: 'T1', axis: 0, min: 40, size: 400 });
    applyJointFix(m, id, 'mortaja', c.fix!);
    expect(m.joints[0]).toMatchObject({ id, partA: 'P1', partB: 'T1', type: 'mortaja' });
    // La unión sigue valiendo para el resto de la app.
    const again = syncJoints(m.parts, m.joints);
    expect(again).toEqual([expect.objectContaining({ id, type: 'mortaja', partA: 'P1' })]);
  });

  it('se cruzan de lado a lado: no hay recorte', () => {
    const m = model({ size: [500, 80, 20], position: [-50, 600, 10] });
    const c = choice(m, 'mortaja');
    expect(c.reason).toMatch(/de lado a lado/);
    expect(c.fix).toBeUndefined();
  });
});

describe('quién recibe', () => {
  it('al revés, el travesaño recibe y la pata entra', () => {
    const m = model();
    expect(canSwap(m.parts[0]!, m.parts[1]!)).toBe(true);
    swapJoint(m, m.joints[0]!.id);
    expect(m.joints[0]).toMatchObject({ partA: 'T1', partB: 'P1' });
    expect(endJoint(partBox(m.parts[1]!), partBox(m.parts[0]!))).not.toBeNull();
    expect(syncJoints(m.parts, m.joints)[0]).toMatchObject({ partA: 'T1', partB: 'P1' });
  });
});

describe('casi se tocan', () => {
  it('un travesaño 3 mm corto: se estira hasta la pata y aparece la unión', () => {
    const m = model({ size: [397, 80, 20], position: [43, 600, 10] });
    expect(m.joints).toEqual([]);
    const [miss] = nearMisses(m, n);
    expect(miss).toMatchObject({ a: 'P1', b: 'T1', gap: 3 });
    expect(miss!.fix).toMatchObject({ part: 'T1', axis: 0, min: 40, size: 400 });
    applyReviewFix(m, miss!.fix);
    expect(syncJoints(m.parts, m.joints)).toHaveLength(1);
  });

  it('más de 5 mm es una separación buscada', () => {
    expect(nearMisses(model({ position: [50, 600, 10] }), n)).toEqual([]);
  });
});

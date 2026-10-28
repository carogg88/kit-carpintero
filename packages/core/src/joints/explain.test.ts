import { describe, expect, it } from 'vitest';
import { jointAnchor, drawJointDetail } from '../drawing';
import { createTable, TABLE_DEFAULTS } from '../templates/table';
import { buildTemplate, templateById } from '../templates';
import { jointCare, jointFullName, jointPurpose } from './explain';
import { HOLDS } from './hold';
import { TENON_STYLES } from './mortise';

const now = '2026-10-28T00:00:00Z';

describe('cada unión explicada', () => {
  it('el nombre completo dice la variante', () => {
    expect(jointFullName({ type: 'mortaja', params: {} })).toBe('Mortaja y espiga, ciega');
    expect(jointFullName({ type: 'mortaja', params: { count: 2, style: TENON_STYLES.indexOf('cunas'), haunch: 10 } })).toBe(
      'Mortaja y espiga, doble, pasante con cuñas, con media caja',
    );
    expect(jointFullName({ type: 'tope', params: { hold: HOLDS.indexOf('botones') } })).toBe('A tope, con botones de madera');
    expect(jointFullName({ type: 'tope', params: {} })).toBe('A tope');
    expect(jointFullName({ type: 'tope', params: {} }, true)).toBe('Apoyado en muesca');
    expect(jointFullName({ type: 'canal', params: { depth: 10, play: 3 } })).toBe('Canal, panel flotante con 3 mm de juego');
    expect(jointFullName({ type: 'machiembrado', params: { pegs: 3 } })).toBe('Machimbre, testero con 3 tarugos');
    expect(jointFullName({ type: 'cola-milano', params: { count: 1, slope: 6 } })).toBe('Cola de milano, 1 cola, 1:6');
  });

  it('para qué sirve y qué cuidar, según la variante', () => {
    expect(jointPurpose({ type: 'mortaja', params: { style: TENON_STYLES.indexOf('llave') } })).toMatch(/desarma/);
    expect(jointCare({ type: 'mortaja', params: { style: TENON_STYLES.indexOf('cunas') } })).toMatch(/cruzadas a la veta/);
    expect(jointCare({ type: 'canal', params: { play: 3 } })).toBe('Sin cola en el panel: flota con 3 mm de juego de cada lado.');
    expect(jointCare({ type: 'machiembrado', params: { pegs: 3 } })).toMatch(/tarugo del medio/);
    expect(jointCare({ type: 'tope', params: {} })).toBe('');
    expect(jointCare({ type: 'tope', params: { hold: HOLDS.indexOf('grampas') } })).toBe('Sin cola entre la tapa y el faldón.');
  });
});

describe('dónde va el círculo del detalle', () => {
  it('una pata con faldón se marca de frente, en la esquina de arriba', () => {
    const table = createTable(undefined, 'guatambu', now);
    const j = table.joints.find((x) => x.partA === 'P4' && x.partB === 'F1')!;
    const a = jointAnchor(table, j)!;
    expect(a.view).toBe('front');
    expect(a.at[1]).toBeGreaterThan(600);
    expect(a.at[0]).toBeLessThan(200);
  });

  it('un testero se marca desde arriba', () => {
    const table = createTable({ ...TABLE_DEFAULTS, breadboard: 1 }, 'guatambu', now);
    const j = table.joints.find((x) => x.id === 'C1-T1')!;
    expect(jointAnchor(table, j)?.view).toBe('top');
  });
});

describe('detalles de encastre', () => {
  it('la tapa con su faldón se dibuja parada: la tapa arriba', () => {
    const table = createTable(undefined, 'guatambu', now);
    const d = drawJointDetail(table, 'T1-F1')!;
    for (const p of d.projections) expect(p.v).toBe(1);
  });

  it('una canal que corre todo el costado se dibuja en una punta', () => {
    const p = buildTemplate(templateById('alacena')!, {}, 'cedro', undefined, now);
    const j = p.joints.find((x) => x.type === 'canal' && x.partB.startsWith('E'))!;
    const d = drawJointDetail(p, j.id)!;
    for (const v of d.views) expect(Math.max(v.bounds.u1 - v.bounds.u0, v.bounds.v1 - v.bounds.v0)).toBeLessThan(300);
  });
});

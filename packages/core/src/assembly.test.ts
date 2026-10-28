import { describe, expect, it } from 'vitest';
import { assemblySteps, listIds } from './assembly';
import { buildTemplate, TEMPLATES, templateDefaults } from './templates';
import { createTable } from './templates/table';
import { formatNumber } from './units';

const n = (cut: [number, number, number]) => `${cut.map((mm) => formatNumber(mm, 'cm')).join(' × ')} cm`;

describe('cómo armarlo', () => {
  it('la mesa sigue el orden del taller: cortar, marcar, mortajas, presentar en seco, encolar', () => {
    const steps = assemblySteps(createTable(undefined, 'guatambu', '2026-10-22T00:00:00Z'), n);
    expect(steps.map((s) => s.kind)).toEqual(['cortar', 'tiras', 'marcar', 'encastre', 'encastre', 'otros', 'seco', 'lijar', 'encolar', 'terminar']);
    const mortise = steps.find((s) => s.kind === 'encastre')!;
    expect(mortise.joint).toBe('mortaja');
    expect(mortise.text).toMatch(/^Primero las mortajas en P1 a P4; después las espigas en F1 a F4\./);
    expect(steps[0]!.text).toContain('9 piezas');
    expect(steps[0]!.items[0]).toBe('T1 · Tapa: 1 de 180 × 90 × 2,2 cm');
    // La ranura de los botones en los faldones, y la tapa al final, sin cola.
    const slot = steps.filter((s) => s.kind === 'encastre')[1]!;
    expect(slot.title).toBe('Botones de madera: tapa con faldón');
    expect(slot.text).toMatch(/^Hacé la ranura de los botones en la cara de adentro de F1 a F4/);
    expect(steps.find((s) => s.kind === 'encolar')!.items).toContain('Tapa con faldón: va a tope, sin cola; al final, sujetala con botones de madera');
  });

  it('con uniones a tope no hay más encastre que la ranura de los botones, ni presentación en seco', () => {
    const def = TEMPLATES.find((d) => d.id === 'mesa')!;
    const p = buildTemplate(def, templateDefaults(def), 'guatambu', 'tope', '2026-10-22T00:00:00Z');
    const steps = assemblySteps(p, n);
    const kinds = steps.map((s) => s.kind);
    expect(steps.filter((s) => s.kind === 'encastre').map((s) => s.joint)).toEqual(['tope']);
    expect(kinds).not.toContain('seco');
  });

  it('cada paso tiene una clave fija para recordar si ya se hizo', () => {
    const p = createTable(undefined, 'guatambu', '2026-10-22T00:00:00Z');
    const keys = assemblySteps(p, n).map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(assemblySteps(p, n).map((s) => s.key)).toEqual(keys);
  });

  it('los códigos se nombran como en el taller', () => {
    expect(listIds(['P3', 'P1', 'P2', 'P4'])).toBe('P1 a P4');
    expect(listIds(['F1', 'F3'])).toBe('F1 y F3');
    expect(listIds(['E1', 'E2', 'E5'])).toBe('E1, E2 y E5');
  });

  it('en el taburete avisa qué espigas son más cortas', () => {
    const def = TEMPLATES.find((d) => d.id === 'taburete')!;
    const p = buildTemplate(def, templateDefaults(def), 'guatambu', 'mortaja', '2026-10-22T00:00:00Z');
    const aprons = assemblySteps(p, n).find((s) => s.key.includes('Faldón') && s.joint === 'mortaja')!;
    expect(aprons.items).toEqual(['8 uniones', 'Ojo: las espigas de F1 y F2 que van en P1 a P4 son más cortas, para no chocar adentro con las otras.']);
  });
});


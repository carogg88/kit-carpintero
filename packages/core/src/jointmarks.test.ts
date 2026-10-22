import { describe, expect, it } from 'vitest';
import { describeJointMark, describePartJoints, partJointMarks } from './jointmarks';
import { buildTemplate, TEMPLATES, templateDefaults } from './templates';
import { createTable } from './templates/table';
import { formatNumber } from './units';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const n = (mm: number) => formatNumber(mm, 'cm');
const part = (id: string) => table.parts.find((p) => p.id === id)!;

describe('dónde marcar cada encastre', () => {
  it('la pata lleva dos mortajas en las caras de adentro, a la misma distancia de la punta de arriba', () => {
    const marks = partJointMarks(table, part('P1'));
    expect(marks).toHaveLength(2);
    for (const m of marks) {
      expect(m.role).toBe('cut');
      expect(m.face.out).toBe(false);
      expect(m.depth).toBeCloseTo(42);
    }
    expect(describeJointMark(part('P1'), marks[0]!, n)).toBe(
      'Mortaja para F2 en la cara de adentro: a 1 de la punta de arriba y a 1,9 del borde de afuera. Mide 7,5 × 0,7 y 4,2 de hondo.',
    );
  });

  it('las patas en espejo se describen igual: afuera y adentro no cambian', () => {
    const text = (id: string) => describePartJoints(table, part(id), n).map((s) => s.replace(/F\d( y F\d)?/, 'F'));
    expect(text('P3')).toEqual(text('P1'));
    expect(describePartJoints(table, part('P1'), n)).toEqual([
      '2 mortajas para F2 y F3 en la cara de adentro: a 1 de la punta de arriba y a 1,9 del borde de afuera. Mide 7,5 × 0,7 y 4,2 de hondo.',
    ]);
  });

  it('el faldón lleva una espiga centrada en cada punta', () => {
    expect(describeJointMark(part('F1'), partJointMarks(table, part('F1'))[0]!, n)).toBe(
      'Espiga para P4 en la punta izquierda: a la mitad del ancho y a la mitad del espesor. Mide 7,5 × 0,7 y sale 4.',
    );
    expect(describePartJoints(table, part('F1'), n)).toEqual([
      '2 espigas para P3 y P4 en cada punta: a la mitad del ancho y a la mitad del espesor. Mide 7,5 × 0,7 y sale 4.',
    ]);
  });

  it('los canales de un lateral van en una frase con la altura de cada uno', () => {
    const def = TEMPLATES.find((d) => d.id === 'estante')!;
    const p = buildTemplate(def, templateDefaults(def), 'guatambu', 'canal', '2026-10-21T00:00:00Z');
    const side = p.parts.find((x) => x.id === 'L1')!;
    expect(describePartJoints(p, side, n)[0]).toMatch(/^4 canales para E1, E2, E3 y E4 en la cara de adentro: a 7, 49,8, 92,5 y 135,3 de la punta de abajo/);
  });

  it('los agujeros de tarugos se marcan por el centro y dicen la separación', () => {
    const def = TEMPLATES.find((d) => d.id === 'mesa')!;
    const p = buildTemplate(def, templateDefaults(def), 'guatambu', 'clavija', '2026-10-21T00:00:00Z');
    const leg = p.parts.find((x) => x.id === 'P1')!;
    const [m] = partJointMarks(p, leg);
    expect(m!.count).toBe(2);
    expect(m!.diameter).toBeCloseTo(8);
    expect(describeJointMark(leg, m!, n)).toMatch(/^2 agujeros para tarugos para F\d en la cara de adentro: con el centro a 7,1 de la punta de arriba .* A 4,8 entre centros\.$/);
  });

  it('las colas de milano y los dedos remiten a la hoja de encastres', () => {
    const def = TEMPLATES.find((d) => d.id === 'caja')!;
    const p = buildTemplate(def, templateDefaults(def), 'guatambu', 'cola-milano', '2026-10-21T00:00:00Z');
    const side = p.parts.find((x) => x.id === 'C1')!;
    expect(describePartJoints(p, side, n)[0]).toMatch(/se marca con la hoja de encastres\.$/);
  });

  it('las uniones a tope no llevan marcas', () => {
    const def = TEMPLATES.find((d) => d.id === 'mesa')!;
    const p = buildTemplate(def, templateDefaults(def), 'guatambu', 'tope', '2026-10-21T00:00:00Z');
    expect(p.parts.flatMap((x) => partJointMarks(p, x))).toEqual([]);
  });

  it('el estante de arriba va en un rebaje y el zócalo en un canal, marcados desde la cara de adentro', () => {
    const def = TEMPLATES.find((d) => d.id === 'estante')!;
    const p = buildTemplate(def, templateDefaults(def), 'guatambu', 'canal', '2026-10-21T00:00:00Z');
    const text = describePartJoints(p, p.parts.find((x) => x.id === 'L1')!, n);
    expect(text).toContain('Rebaje para E5 en la cara de adentro: al ras de la punta de arriba y de borde a borde. Mide 2 × 30 y 0,7 de hondo.');
    expect(text).toContain('Canal para Z1 en la cara de adentro: al ras de la punta de abajo y a 2 del borde de adelante. Mide 7 × 2 y 0,7 de hondo.');
    expect(describePartJoints(p, p.parts.find((x) => x.id === 'E1')!, n)).toContain(
      'Canal para Z1 en la cara de abajo: de punta a punta y a 2 del borde de adelante. Mide 76 × 2 y 0,7 de hondo.',
    );
  });

  it('en la caja, los dos costados en espejo se describen igual y los rebajes dicen "cada punta"', () => {
    const def = TEMPLATES.find((d) => d.id === 'caja')!;
    const p = buildTemplate(def, templateDefaults(def), 'guatambu', 'rebaje', '2026-10-21T00:00:00Z');
    const text = (id: string) => describePartJoints(p, p.parts.find((x) => x.id === id)!, n);
    expect(text('C3').map((s) => s.replace(/C\d y C\d/, 'C'))).toEqual(text('C4').map((s) => s.replace(/C\d y C\d/, 'C')));
    expect(text('C1')[0]).toBe('2 rebajes para C3 y C4 en la cara de adentro: al ras de cada punta y de borde a borde. Mide 1 × 9 y 0,4 de hondo.');
    expect(text('C3')).toContain('2 lengüetas para C1 y C2 en cada punta: no se rebaja, la pieza entra entera 0,4 en la otra. La medida de corte ya lo incluye.');
  });
});

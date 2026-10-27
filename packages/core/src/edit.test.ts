import { describe, expect, it } from 'vitest';
import { duplicatePart, mirrorPart, otherSideName, namePrefix, newPart, nextPartId, partAxesBySize, partPlace, renamePart, setPlace, snapCoord, snapMove, syncJoints } from './edit';
import { partBox } from './geometry';
import type { Part } from './project';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const legs = table.parts.find((p) => p.id === 'P1')!;

describe('imán', () => {
  it('pega una cara a la cara cercana de otra pieza', () => {
    // La cara de abajo de la tapa está en 728 mm.
    expect(snapCoord(table.parts, 735, 1, 'P1')).toEqual({ value: 728, to: 'T1' });
  });

  it('pega al piso', () => {
    expect(snapCoord(table.parts, 6, 1, 'T1')).toEqual({ value: 0, to: 'piso' });
  });

  it('lejos de todo, redondea al milímetro', () => {
    expect(snapCoord(table.parts, 512.4, 1, 'T1')).toEqual({ value: 512, to: null });
  });

  it('al mover, cualquiera de las dos caras se pega', () => {
    const p1 = partBox(legs);
    // P1 va de x 30 a 100; P2 empieza en 1700. Corriendo 1595, su cara derecha queda en 1695.
    expect(snapMove(table.parts, p1, 0, 1595, 'P1')).toEqual({ value: 1600, to: 'P2' });
  });
});

describe('piezas nuevas', () => {
  it('ids libres', () => {
    expect(nextPartId(table.parts, 'P')).toBe('P5');
    expect(nextPartId(table.parts, 'N')).toBe('N1');
  });

  it('una tabla nueva queda en el piso, a la derecha de la mesa', () => {
    const n = newPart(table.parts, 'tabla', 'cedro');
    expect(n).toMatchObject({ id: 'N1', name: 'Tabla 1', wood: 'cedro', position: [1950, 0, 0] });
  });

  it('duplicar corre la copia a la derecha', () => {
    const right = Math.max(...table.parts.map((p) => partBox(p).max[0]));
    expect(duplicatePart(table.parts, legs)).toMatchObject({ id: 'P5', name: 'Pata trasera izquierda (copia)', position: [right + 150, 0, 30] });
  });

  it('largo, ancho y espesor de una pata son Y, X y Z', () => {
    expect(partAxesBySize(legs)).toEqual([1, 0, 2]);
  });
});

describe('syncJoints', () => {
  it('con la mesa intacta no cambia nada', () => {
    const synced = syncJoints(table.parts, table.joints);
    expect(new Set(synced.map((j) => `${j.id}:${j.type}`))).toEqual(new Set(table.joints.map((j) => `${j.id}:${j.type}`)));
  });

  it('si un faldón se corre lejos de las patas, se van sus dos mortajas', () => {
    const parts = table.parts.map((p) => (p.id === 'F1' ? { ...p, position: [p.position[0], p.position[1], p.position[2] + 300] as [number, number, number] } : p));
    const synced = syncJoints(parts, table.joints);
    expect(synced.some((j) => j.partB === 'F1')).toBe(false);
    expect(synced.filter((j) => j.type === 'mortaja')).toHaveLength(6);
  });

  it('una pieza nueva que toca otra recibe un encastre propuesto', () => {
    const shelf = { ...newPart(table.parts, 'liston', 'pino'), position: [100, 300, 42] as [number, number, number], base: { kind: 'box' as const, size: [1600, 45, 22] as [number, number, number] } };
    const synced = syncJoints([...table.parts, shelf], table.joints);
    expect(synced.filter((j) => j.partB === shelf.id)).toMatchObject([{ partA: 'P1', type: 'mortaja' }, { partA: 'P2', type: 'mortaja' }]);
  });

  it('la espiga del tercio sigue el espesor nuevo del faldón; una escrita a mano, no', () => {
    const f1 = table.parts.find((p) => p.id === 'F1')!;
    const thin = partAxesBySize(f1)[2];
    const stock = f1.base.kind === 'box' ? f1.base.size[thin] : 0;
    const thinner = table.parts.map((p) => {
      if (p.id !== 'F1' || p.base.kind !== 'box') return p;
      const size = [...p.base.size] as [number, number, number];
      size[thin] = 16;
      return { ...p, base: { ...p.base, size } };
    });
    const third = table.joints.map((j) => (j.partB === 'F1' ? { ...j, params: { ...j.params, thickness: Math.round((stock / 3) * 10) / 10 } } : j));
    const fitted = syncJoints(thinner, third, table.parts).filter((j) => j.partB === 'F1' && j.partA.startsWith('P'));
    expect(fitted.map((j) => j.params.thickness)).toEqual([5.3, 5.3]);
    const manual = table.joints.map((j) => (j.partB === 'F1' ? { ...j, params: { ...j.params, thickness: 10 } } : j));
    expect(syncJoints(thinner, manual, table.parts).filter((j) => j.partB === 'F1' && j.partA.startsWith('P')).map((j) => j.params.thickness)).toEqual([10, 10]);
  });

  it('respeta el tipo que eligió la persona', () => {
    const joints = table.joints.map((j) => (j.id === 'P4-F1' ? { ...j, type: 'clavija' as const, params: {} } : j));
    expect(syncJoints(table.parts, joints).find((j) => j.id === 'P4-F1')?.type).toBe('clavija');
  });
});

describe('renombrar una pieza', () => {
  it('reconoce el tipo por la primera palabra, con o sin acento', () => {
    expect(namePrefix('Travesaño de abajo')).toBe('R');
    expect(namePrefix('Listón')).toBe('L');
    expect(namePrefix('Slat 2')).toBe('L');
    expect(namePrefix('Patas')).toBeNull();
    expect(namePrefix('Cosa')).toBeNull();
  });

  it('el código sigue al nombre y las uniones siguen a la pieza', () => {
    const p = structuredClone(table);
    const before = p.joints.filter((j) => j.partA === 'F1' || j.partB === 'F1').length;
    expect(renamePart(p, 'F1', 'Travesaño largo')).toBe('R1');
    expect(p.parts.find((x) => x.id === 'R1')?.name).toBe('Travesaño largo');
    expect(p.joints.some((j) => j.partA === 'F1' || j.partB === 'F1')).toBe(false);
    expect(p.joints.filter((j) => j.partA === 'R1' || j.partB === 'R1')).toHaveLength(before);
    expect(p.joints.every((j) => j.id === `${j.partA}-${j.partB}` || !j.id.includes('F1'))).toBe(true);
  });

  it('si el tipo no cambia, el código se queda', () => {
    const p = structuredClone(table);
    expect(renamePart(p, 'F1', 'Faldón de adelante')).toBe('F1');
    expect(renamePart(p, 'F2', 'Cosa rara')).toBe('F2');
  });
});

describe('posición de una pieza', () => {
  it('se mide desde el piso y desde los bordes izquierdo y de atrás del resto del mueble', () => {
    const p = structuredClone(table);
    const leg = p.parts.find((x) => x.id === 'P1')!;
    expect(partPlace(p.parts, leg)[1]).toBe(leg.position[1]);
    setPlace(p.parts, 'P1', 1, 100);
    expect(leg.position[1]).toBe(100);
    setPlace(p.parts, 'P1', 0, 50);
    expect(partPlace(p.parts, leg)[0]).toBe(50);
    // Medida sin contar la pieza: correrla no cambia desde dónde se mide.
    setPlace(p.parts, 'P1', 0, 80);
    expect(partPlace(p.parts, leg)[0]).toBe(80);
  });
});

describe('imán en espejo', () => {
  it('el faldón derecho se pega con el mismo retiro que el izquierdo, no al ras de las patas', () => {
    // Los faldones de costado van unos mm adentro de la cara de afuera de las patas.
    const p = structuredClone(table);
    const right = p.parts.find((x) => x.id === 'F4')!;
    const goal = right.position[0];
    // Corrido al ras de las patas y arrastrado apenas: el imán lo lleva al reflejo de F3.
    const flush = Math.max(...p.parts.filter((x) => x.id.startsWith('P')).map((x) => partBox(x).max[0])) - 20;
    right.position[0] = flush;
    const s = snapMove(p.parts, partBox(right), 0, -2, 'F4');
    expect(s).toMatchObject({ to: 'F3', mirror: true });
    expect(flush + s.value).toBe(goal);
  });
});

describe('cruce apoyado en una muesca', () => {
  const box = (id: string, name: string, position: [number, number, number], size: [number, number, number]) =>
    ({ id, name, wood: 'guatambu', base: { kind: 'box', size }, position, rotation: [0, 0, 0], ops: [], pockets: [], bevels: [], sections: [] }) as Part;
  // Faldón de 36 × 8 × 2 y un listón de 2,5 que lo cruza de adelante hacia atrás, metido 12 mm en su canto.
  const apron = () => box('F1', 'Faldón', [0, 300, 0], [360, 80, 20]);
  const slat = box('L1', 'Listón', [100, 368, -50], [25, 25, 340]);

  it('sin muesca se propone media madera', () => {
    const joints = syncJoints([apron(), slat], []);
    expect(joints.map((j) => j.type)).toEqual(['media-madera']);
  });

  it('con la muesca dibujada, el listón apoya en ella y no se rebaja nada', () => {
    const a = apron();
    a.pockets.push({ id: 'V1', axis: 2, side: 1, shape: { kind: 'circle', u: 112.5, v: 80, d: 27 }, depth: 20, through: true });
    const before = syncJoints([apron(), slat], []);
    const joints = syncJoints([a, slat], before);
    expect(joints.map((j) => [j.type, j.params])).toEqual([['tope', {}]]);
  });
});

describe('espigas que se reajustan al achicar una pieza', () => {
  it('un faldón de 8 cm que pasa a 3 cm recupera hombros de taller', async () => {
    const { buildTemplate, templateById } = await import('./templates');
    const p = buildTemplate(templateById('taburete')!, { width: 450, depth: 340, height: 450, leg: 45, seatType: 2, apronHeight: 80 }, 'guatambu', 'mortaja', '2026-10-23T00:00:00Z');
    const f3 = p.parts.find((x) => x.id === 'F3')!;
    expect(p.joints.find((j) => j.id === 'P1-F3')!.params.shoulder).toBe(10);
    if (f3.base.kind === 'box') f3.base.size[1] = 30;
    const joints = syncJoints(p.parts, p.joints);
    const j = joints.find((x) => x.id === 'P1-F3')!;
    expect(j.params.shoulder).toBe(5);
    // El largo que tenía queda como estaba.
    expect(j.params.length).toBe(p.joints.find((x) => x.id === 'P1-F3')!.params.length);
  });
});

describe('componente al renombrar', () => {
  it('toma la palabra del nombre nuevo', () => {
    const parts = [{ id: 'F3', name: 'Faldón izquierdo', component: 'C2' }, { id: 'F4', name: 'Faldón derecho', component: 'C2' }] as Part[];
    const project = { parts, joints: [], components: [{ id: 'C1', name: 'Travesaño' }, { id: 'C2', name: 'Faldón 2' }] };
    renamePart(project, 'F3', 'Travesaño superior izquierdo');
    expect(project.components[1]!.name).toBe('Travesaño 2');
    renamePart(project, 'F4', 'Travesaño superior derecho');
    expect(project.components[1]!.name).toBe('Travesaño 2');
  });
});

describe('copia del otro lado', () => {
  it('el nombre cambia de lado', () => {
    expect(otherSideName('Travesaño medio izquierdo')).toBe('Travesaño medio derecho');
    expect(otherSideName('Faldón delantero')).toBe('Faldón trasero');
    expect(otherSideName('Pata Trasera derecha')).toBe('Pata Delantera izquierda');
  });

  it('un travesaño de la izquierda pasa a la derecha con el mismo retiro', async () => {
    const { buildTemplate, templateById } = await import('./templates');
    const p = buildTemplate(templateById('taburete')!, { width: 450, depth: 340, height: 450, leg: 45, seatType: 2, apronHeight: 80, rung: 100 }, 'guatambu', 'mortaja', '2026-10-23T00:00:00Z');
    const r4 = p.parts.find((x) => x.id === 'R4')!;
    const r3 = p.parts.find((x) => x.id === 'R3')!;
    // Del otro lado ya está R4: no se repite.
    expect(mirrorPart(p.parts, r3)).toBeNull();
    const parts = p.parts.filter((x) => x.id !== 'R4');
    const m = mirrorPart(parts, r3)!;
    expect(m.axis).toBe(0);
    expect(m.part.position).toEqual(r4.position);
    expect(m.part.name).toBe('Travesaño derecho');
  });

  it('una pieza en el medio no tiene otro lado', () => {
    const top = table.parts.find((p) => p.id === 'T1')!;
    expect(mirrorPart(table.parts, top)).toBeNull();
  });
});

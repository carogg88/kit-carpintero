import { describe, expect, it } from 'vitest';
import { duplicatePart, newPart, nextPartId, partAxesBySize, snapCoord, snapMove, syncJoints } from './edit';
import { partBox } from './geometry';
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
    expect(duplicatePart(table.parts, legs)).toMatchObject({ id: 'P5', name: 'Pata trasera izquierda (copia)', position: [200, 0, 30] });
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

  it('respeta el tipo que eligió la persona', () => {
    const joints = table.joints.map((j) => (j.id === 'P4-F1' ? { ...j, type: 'clavija' as const, params: {} } : j));
    expect(syncJoints(table.parts, joints).find((j) => j.id === 'P4-F1')?.type).toBe('clavija');
  });
});

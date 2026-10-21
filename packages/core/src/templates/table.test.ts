import { describe, expect, it } from 'vitest';
import { loadProject } from '../project';
import { createTable } from './table';

describe('createTable', () => {
  const t = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');

  it('arma 9 piezas, 8 mortajas y la tapa apoyada en 8 piezas', () => {
    expect(t.parts).toHaveLength(9);
    expect(t.joints.filter((j) => j.type === 'mortaja')).toHaveLength(8);
    expect(t.joints.filter((j) => j.type === 'tope' && j.partA === 'T1')).toHaveLength(8);
  });

  it('cada espiga usa la regla del tercio del faldón de 22 mm', () => {
    expect(t.joints[0]?.params).toEqual({ length: 40, thickness: 7.3, shoulder: 10 });
  });

  it('es un proyecto válido', () => {
    expect(loadProject(t).ok).toBe(true);
  });
});

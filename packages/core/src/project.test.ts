import { describe, expect, it } from 'vitest';
import { loadProject, SCHEMA_VERSION } from './project';

const minimal = {
  schemaVersion: SCHEMA_VERSION,
  id: 'p1',
  name: 'Mesa',
  units: 'cm',
  createdAt: '2026-10-21T00:00:00Z',
  updatedAt: '2026-10-21T00:00:00Z',
  parts: [
    { id: 'T1', name: 'Tapa', wood: 'guatambu', base: { kind: 'box', size: [1800, 25, 900] }, position: [0, 725, 0] },
  ],
  joints: [],
};

describe('loadProject', () => {
  it('acepta un proyecto válido y completa valores por defecto', () => {
    const r = loadProject(minimal);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.parts[0]?.rotation).toEqual([0, 0, 0]);
      expect(r.project.parts[0]?.ops).toEqual([]);
    }
  });
  it('rechaza proyectos de una versión futura', () => {
    const r = loadProject({ ...minimal, schemaVersion: SCHEMA_VERSION + 1 });
    expect(r).toEqual({ ok: false, error: 'El proyecto es de una versión más nueva de la app.' });
  });
  it('explica qué campo está mal', () => {
    const r = loadProject({ ...minimal, joints: [{ id: 'j', type: 'clavo', partA: 'a', partB: 'b' }] });
    expect(r.ok).toBe(false);
  });
});

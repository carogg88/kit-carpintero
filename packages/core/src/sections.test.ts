import { describe, expect, it } from 'vitest';
import { cutPiece } from './cutlist';
import { drawPart, partProjection, partSectionStops } from './drawing';
import { partBox } from './geometry';
import { loadProject, SCHEMA_VERSION } from './project';
import { describeSection, newSection, sectionBox, sectionCutBox } from './sections';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const leg = table.parts.find((p) => p.id === 'P1')!;
const mm = (n: number) => `${n} mm`;

describe('tramos', () => {
  it('un tramo nuevo arranca un cuarto más grueso y ordena las puntas', () => {
    const s = newSection(leg, 1, 150, 0);
    expect(s).toEqual({ id: 'S1', axis: 1, from: 0, to: 150, size: [90, 90] });
  });

  it('queda centrado en la pieza y recortado a su largo', () => {
    const s = { ...newSection(leg, 1, 0, 150), to: 5000 };
    const b = sectionBox(leg, s);
    const base = { x: leg.position[0], z: leg.position[2] };
    expect(b.min[1]).toBe(leg.position[1]);
    expect(b.max[1]).toBe(leg.position[1] + 728);
    expect(b.min[0]).toBe(base.x - 10);
    expect(b.max[2]).toBe(base.z + 80);
    // Lo que se saca antes cubre toda la pieza a lo largo del tramo, con sobra.
    const cut = sectionCutBox(leg, newSection(leg, 1, 0, 150));
    expect(cut.min[0]).toBe(base.x - 1);
    expect(cut.max[1]).toBe(leg.position[1] + 150);
  });

  it('se describe y agranda el corte de la pieza', () => {
    const s = newSection(leg, 1, 0, 150);
    expect(describeSection(s, mm)).toBe('tramo de 90 mm × 90 mm, de 0 mm a 150 mm desde abajo');
    const part = { ...leg, sections: [s] };
    const c = cutPiece(part, { ...table, parts: [part], joints: [] });
    expect(c.cut.slice(1)).toEqual([90, 90]);
    expect(c.work).toContain('tramo de 90 × 90 mm, de 0 mm a 150 mm desde abajo');
  });

  it('el despiece encuadra el tramo más grueso', () => {
    const part = { ...leg, sections: [newSection(leg, 1, 0, 150)] };
    const d = drawPart({ ...table, parts: [part], joints: [] }, part);
    expect(d.bounds.v1 - d.bounds.v0).toBeCloseTo(90);
    expect(d.joints).toHaveLength(0);
  });

  it('un proyecto v6 abre sin tramos', () => {
    const raw = JSON.parse(JSON.stringify({ ...table, schemaVersion: 6, parts: table.parts.map((p) => ({ ...p, sections: undefined })) }));
    const r = loadProject(raw);
    expect(r.ok && r.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && r.project.parts.every((p) => p.sections.length === 0)).toBe(true);
  });
});

describe('cotas de los tramos en el despiece', () => {
  it('marca dónde empieza y termina cada tramo a lo largo de la pieza', () => {
    const p = partProjection(leg);
    const foot = { ...leg, sections: [newSection(leg, p.u, 0, 150), newSection(leg, p.u, 300, 400)] };
    expect(partSectionStops(foot, p).u).toEqual([150, 300, 400].map((x) => x + partBox(leg).min[p.u]));
    expect(partSectionStops(foot, p).v).toEqual([]);
    expect(drawPart({ ...table, parts: [foot], joints: [] }, foot).stops!.u).toHaveLength(3);
  });
});

import { describe, expect, it } from 'vitest';
import { cutPiece } from './cutlist';
import { grainAxis, grainFrame, grainOptions, setGrain, shortGrain } from './grain';
import { applyReviewFix, reviewDesign } from './review';
import { rotatePart } from './rotate';
import { loadProject, SCHEMA_VERSION, type Part, type Project } from './project';

const board = (over: Partial<Part> = {}): Part => ({
  id: 'T1',
  name: 'Tapa',
  wood: 'paraiso',
  base: { kind: 'box', size: [900, 25, 500] },
  position: [0, 700, 0],
  rotation: [0, 0, 0],
  ops: [],
  pockets: [],
  bevels: [],
  sections: [],
  ...over,
});

const project = (parts: Part[]): Project => ({
  schemaVersion: SCHEMA_VERSION,
  id: 'p',
  name: 'Prueba',
  units: 'cm',
  createdAt: '2026-10-27T00:00:00.000Z',
  updatedAt: '2026-10-27T00:00:00.000Z',
  parts,
  joints: [],
  components: [],
  groups: [],
});

const len = (v: number[]) => Math.hypot(...v);

describe('veta', () => {
  it('va por lo más largo de la pieza, salvo que se gire a mano', () => {
    const p = board();
    expect(grainAxis(p)).toBe(0);
    expect(grainOptions(p)).toEqual([0, 2]);
    setGrain(p, 2);
    expect(p.grain).toBe(2);
    expect(grainAxis(p)).toBe(2);
    // Volver a lo largo saca la elección: queda como sale sola.
    setGrain(p, 0);
    expect(p.grain).toBeUndefined();
  });

  it('en el MDF y la melamina no se elige, y el torneado va por su eje', () => {
    expect(grainAxis(board({ wood: 'mdf', grain: 2 }))).toBe(0);
    const leg = board({ id: 'P1', base: { kind: 'box', size: [50, 450, 50] }, turning: { axis: 1, stations: [{ at: 0, d: 40, to: 'straight', bulge: 0 }, { at: 450, d: 30, to: 'straight', bulge: 0 }] } });
    expect(grainAxis(leg)).toBe(1);
    // La médula de un torneado está en el centro: se ven anillos redondos en la punta.
    expect(grainFrame(leg)?.origin).toEqual([25, 925, 25]);
  });

  it('una tabla tiene la médula por debajo de la cara ancha, y cada pieza en otro lugar del tronco', () => {
    const a = grainFrame(board())!;
    expect(a.along).toEqual([1, 0, 0]);
    expect(a.up).toEqual([0, 1, 0]);
    // Por debajo de la cara de abajo (y = 700).
    expect(a.origin[1]).toBeLessThan(700);
    expect(a.back).toBeCloseTo(700 + 12.5 - a.origin[1] - 12.5, 5);
    expect(a.thickness).toBe(25);
    const b = grainFrame(board({ id: 'T2' }))!;
    expect(b.seed).not.toBe(a.seed);
  });

  it('en una pata inclinada, la veta se inclina con ella', () => {
    const leg = board({ id: 'P1', base: { kind: 'box', size: [40, 450, 40] }, position: [0, 0, 0], lean: [10, 0] });
    const f = grainFrame(leg)!;
    expect(len(f.along)).toBeCloseTo(1, 6);
    expect(Math.abs(f.along[0])).toBeGreaterThan(0.1);
    expect(Math.abs(f.along[1])).toBeGreaterThan(0.9);
  });

  it('girar la pieza lleva la veta elegida con ella', () => {
    const p = board({ grain: 2 });
    rotatePart(p, 1);
    expect(p.base).toMatchObject({ size: [500, 25, 900] });
    expect(p.grain).toBe(0);
  });

  it('la lista de cortes pide el largo a lo largo de la veta', () => {
    expect(cutPiece(board(), project([board()])).cut).toEqual([900, 500, 25]);
    const turned = board({ grain: 2 });
    expect(cutPiece(turned, project([turned])).cut).toEqual([500, 900, 25]);
  });

  it('avisa la veta corta en un listón con la veta girada, y el arreglo la vuelve a lo largo', () => {
    const slat = board({ id: 'L1', name: 'Listón', base: { kind: 'box', size: [600, 30, 70] }, grain: 2 });
    expect(shortGrain(slat)).toBeGreaterThan(8);
    const pr = project([slat]);
    const note = reviewDesign(pr).find((n) => n.id === 'veta-corta|L1');
    expect(note?.action).toMatchObject({ kind: 'grain', part: 'L1', axis: 0 });
    applyReviewFix(pr, note!.action!);
    expect(pr.parts[0]!.grain).toBeUndefined();
    expect(reviewDesign(pr).some((n) => n.id.startsWith('veta-corta'))).toBe(false);
    // Un tablero ancho con la veta girada no es veta corta.
    expect(shortGrain(board({ grain: 2 }))).toBe(0);
  });

  it('un proyecto de la versión 12 abre igual, con la veta por lo más largo', () => {
    const r = loadProject({ ...project([board()]), schemaVersion: 12 });
    expect(r.ok && r.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && r.project.parts[0]!.grain).toBeUndefined();
  });
});

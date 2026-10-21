import { describe, expect, it } from 'vitest';
import { cutPiece } from './cutlist';
import { drawPart } from './drawing';
import { loadProject, SCHEMA_VERSION, type Part } from './project';
import { addStation, cleanTurning, describeTurning, presetTurning, turnDiameters, turnSegments, TURN_PRESETS, type TurnPreset } from './turning';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
// Taco de 60 × 60 × 600, parado.
const blank: Part = { id: 'C', name: 'Columna', wood: 'cedro', base: { kind: 'box', size: [60, 600, 60] }, position: [0, 0, 0], rotation: [0, 0, 0], ops: [], pockets: [], bevels: [], sections: [] };
const mm = (n: number) => `${Math.round(n)} mm`;

describe('torneado', () => {
  it.each(Object.keys(TURN_PRESETS) as TurnPreset[])('el modelo %s va de punta a punta y entra en el taco', (preset) => {
    const tu = presetTurning(blank, preset);
    expect(tu.axis).toBe(1);
    expect(tu.stations[0]!.at).toBe(0);
    expect(tu.stations.at(-1)!.at).toBe(600);
    expect(tu.stations.every((s) => s.d <= 60)).toBe(true);
    const segs = turnSegments(blank, tu);
    expect(segs.every((s) => !s.mid || (s.mid[1] > 0 && s.mid[1] <= 30))).toBe(true);
  });

  it('ordena las estaciones y no deja pasar el taco', () => {
    const tu = cleanTurning(blank, { axis: 1, stations: [{ at: 700, d: 90, to: 'straight', bulge: 0 }, { at: 20, d: 40, to: 'square', bulge: 3 }] });
    expect(tu.stations).toEqual([
      { at: 0, d: 40, to: 'straight', bulge: 0 },
      { at: 600, d: 60, to: 'straight', bulge: 0 },
    ]);
  });

  it('una estación nueva va en el medio del tramo torneado más largo', () => {
    const tu = addStation(blank, presetTurning(blank, 'cilindro'));
    expect(tu.stations.map((s) => s.at)).toEqual([0, 300, 600]);
    expect(tu.stations[1]!.d).toBe(60);
  });

  it('una curva hacia afuera pasa el radio de las puntas, y hacia adentro queda debajo', () => {
    const out = turnSegments(blank, { axis: 1, stations: [{ at: 0, d: 40, to: 'straight', bulge: 0 }, { at: 100, d: 40, to: 'curve', bulge: 6 }] })[0]!;
    expect(out.mid).toEqual([50, 26]);
    const cove = turnSegments(blank, { axis: 1, stations: [{ at: 0, d: 40, to: 'straight', bulge: 0 }, { at: 100, d: 40, to: 'curve', bulge: -6 }] })[0]!;
    expect(cove.mid).toEqual([50, 14]);
  });

  it('la lista de cortes pide el taco y anota el torneado', () => {
    const p: Part = { ...blank, turning: presetTurning(blank, 'columna') };
    const piece = cutPiece(p, { ...table, parts: [p], joints: [] });
    expect(piece.cut).toEqual([600, 60, 60]);
    const { min, max } = turnDiameters(p, p.turning!);
    expect(piece.work[0]).toBe(`torneado, Ø ${Math.round(min)} mm a ${Math.round(max)} mm, 2 partes cuadradas`);
    expect(describeTurning(blank, presetTurning(blank, 'cilindro'), mm)).toBe('torneado, Ø 60 mm');
  });

  it('el despiece marca cada estación con su distancia y su diámetro', () => {
    const p: Part = { ...blank, turning: presetTurning(blank, 'pata') };
    const d = drawPart({ ...table, parts: [p], joints: [] }, p);
    expect(d.turns!.map((m) => m.at)).toEqual(p.turning!.stations.map((s) => s.at));
    // La última estación está dentro de lo cuadrado: no lleva diámetro.
    expect(d.turns!.at(-1)!.square).toBe(true);
    expect(d.turns![0]!.square).toBe(false);
  });

  it('un proyecto de la versión 7 abre sin torneados', () => {
    const r = loadProject(JSON.parse(JSON.stringify({ ...table, schemaVersion: 7 })));
    expect(r.ok && r.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && r.project.parts.every((p) => p.turning === undefined)).toBe(true);
  });
});

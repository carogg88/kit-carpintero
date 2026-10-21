import { describe, expect, it } from 'vitest';
import { overlapBox, partBox } from '../geometry';
import { loadProject } from '../project';
import { buildTemplate, templateById, templateWarnings, TEMPLATES } from './index';

const now = '2026-10-21T00:00:00Z';

describe('plantillas', () => {
  for (const t of TEMPLATES) {
    it(`${t.name}: arma un proyecto válido, sin piezas encimadas y con uniones`, () => {
      const p = buildTemplate(t, {}, 'guatambu', t.joints?.default, now);
      expect(loadProject(p).ok).toBe(true);
      const boxes = p.parts.map((x) => [x.id, partBox(x)] as const);
      const clashes = boxes.flatMap(([i, a], k) => boxes.slice(k + 1).filter(([, b]) => overlapBox(a, b, 0.5)).map(([j]) => `${i}-${j}`));
      expect(clashes).toEqual([]);
      expect(p.joints.length).toBeGreaterThan(0);
      // Cada pieza toca al menos otra: nada queda flotando.
      for (const x of p.parts) expect(p.joints.some((j) => j.partA === x.id || j.partB === x.id)).toBe(true);
    });
  }

  it('la mesa sale igual que antes y acepta tarugos en vez de mortajas', () => {
    const t = templateById('mesa')!;
    expect(buildTemplate(t, {}, 'guatambu', 'mortaja', now).joints.filter((j) => j.type === 'mortaja')).toHaveLength(8);
    const dowels = buildTemplate(t, { width: 1600 }, 'guatambu', 'clavija', now);
    expect(dowels.joints.filter((j) => j.type === 'clavija')).toHaveLength(8);
    expect(dowels.parts.find((x) => x.id === 'T1')?.base).toEqual({ kind: 'box', size: [1600, 22, 900] });
  });

  it('el taburete lleva mortajas en faldones y travesaños, y el asiento apoyado', () => {
    const p = buildTemplate(templateById('taburete')!, {}, 'guatambu', 'mortaja', now);
    expect(p.joints.filter((j) => j.type === 'mortaja')).toHaveLength(16);
    expect(p.joints.filter((j) => j.partA === 'S1' || j.partB === 'S1').every((j) => j.type === 'tope')).toBe(true);
  });

  it('el estante encastra los estantes en canal y respeta la cantidad', () => {
    const p = buildTemplate(templateById('estante')!, { shelves: 4 }, 'pino', 'canal', now);
    expect(p.parts.filter((x) => x.id.startsWith('E'))).toHaveLength(4);
    expect(p.joints.filter((j) => j.type === 'canal').length).toBeGreaterThanOrEqual(8);
  });

  it('avisa si el alto de la mesa está fuera de lo habitual', () => {
    const t = templateById('mesa')!;
    expect(templateWarnings(t, { height: 680 })).toHaveLength(1);
    expect(templateWarnings(t, { height: 740 })).toHaveLength(0);
  });
});

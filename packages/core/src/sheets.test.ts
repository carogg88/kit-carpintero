import { describe, expect, it } from 'vitest';
import { cutList, cutPlan, sheetShopping } from './cutlist';
import { exposedEdges, packSheets, SHEET_TRIM_MM, sheetThicknessFor } from './sheets';
import { sheetById, thinPanelMaterial } from './woods';
import { buildTemplate, templateById } from './templates';
import { syncJoints } from './edit';

const now = '2026-10-22T00:00:00Z';
const build = (id: string, wood: string, v: Record<string, number> = {}) => buildTemplate(templateById(id)!, v, wood, undefined, now);
const mdf = sheetById('mdf')!;

describe('placas', () => {
  it('reparte piezas en placas sin pisarse ni salirse', () => {
    const pieces = Array.from({ length: 9 }, (_, i) => ({ id: `P${i + 1}`, length: 800, width: 500 }));
    const { boards, tooBig } = packSheets(mdf, 18, pieces);
    expect(tooBig).toEqual([]);
    // 9 piezas de 80 × 50 en placas de 260 × 183: entran 9 en una (3 × 3).
    expect(boards).toHaveLength(1);
    const ps = boards[0]!.placements;
    for (const p of ps) {
      expect(p.x).toBeGreaterThanOrEqual(SHEET_TRIM_MM);
      expect(p.x + p.length).toBeLessThanOrEqual(2600 - SHEET_TRIM_MM);
      expect(p.y + p.width).toBeLessThanOrEqual(1830 - SHEET_TRIM_MM);
    }
    for (const a of ps)
      for (const b of ps) {
        if (a === b) continue;
        const apart = a.x + a.length <= b.x || b.x + b.length <= a.x || a.y + a.width <= b.y || b.y + b.width <= a.y;
        expect(apart).toBe(true);
      }
  });

  it('con veta no gira las piezas; sin veta sí, si así entran', () => {
    const strips = Array.from({ length: 6 }, (_, i) => ({ id: `A${i + 1}`, length: 1100, width: 300 }));
    const ply = packSheets(sheetById('terciado')!, 18, strips).boards.flatMap((b) => b.placements);
    expect(ply.every((p) => !p.rotated && p.length === 1100)).toBe(true);
    // Sin veta, una tira larga y angosta se acuesta donde menos sobra.
    expect(packSheets(mdf, 18, [{ id: 'B', length: 1700, width: 300 }]).boards[0]!.placements[0]!.rotated).toBe(true);
    expect(packSheets(sheetById('terciado')!, 18, [{ id: 'C', length: 2500, width: 300 }]).tooBig).toEqual(['C']);
  });

  it('elige el espesor de placa que alcanza', () => {
    expect(sheetThicknessFor(mdf, 18)).toBe(18);
    expect(sheetThicknessFor(mdf, 20)).toBe(25);
    expect(sheetThicknessFor(mdf, 40)).toBeNull();
  });

  it('una cajonera de melamina: placas, tapacanto en los cantos a la vista y despiece', () => {
    const p = build('cajonera', 'melamina', { board: 18 });
    const plan = cutPlan(p);
    expect(plan.boards).toEqual([]);
    const shop = sheetShopping(plan);
    expect(shop.find((s) => s.material === 'melamina' && s.thickness === 18)?.count).toBeGreaterThan(0);
    // La trasera y los fondos de cajón son de terciado de 9 mm.
    expect(shop.find((s) => s.material === 'terciado' && s.thickness === 9)?.count).toBe(1);
    expect(plan.tooBig).toEqual([]);
    expect(plan.banding[0]).toMatchObject({ material: 'melamina', width: 22 });
    expect(plan.banding[0]!.meters).toBeGreaterThan(5);
    const lateral = cutList(p).find((r) => r.ids.includes('L1'))!;
    expect(lateral.band).toBeDefined();
    expect(lateral.work.some((w) => w.startsWith('tapacanto en'))).toBe(true);
  });

  it('la melamina se arma con tarugos y puertas de una placa, sin colas de milano ni marcos', () => {
    const p = build('alacena', 'melamina');
    expect(p.joints.some((j) => j.type === 'cola-milano' || j.type === 'mortaja')).toBe(false);
    expect(p.joints.filter((j) => j.type === 'clavija').length).toBeGreaterThan(3);
    expect(p.parts.filter((x) => x.name === 'Puerta')).toHaveLength(2);
    expect(syncJoints(p.parts, p.joints)).toHaveLength(p.joints.length);
    const d = build('cajonera', 'melamina');
    expect(d.joints.some((j) => j.type === 'cola-milano')).toBe(false);
    expect(syncJoints(d.parts, d.joints)).toHaveLength(d.joints.length);
  });

  it('el canto que apoya en otra pieza no lleva tapacanto', () => {
    const p = build('estante', 'melamina', { board: 18, shelves: 3 });
    const top = p.parts.find((x) => x.id === 'E3')!;
    // El estante de arriba apoya en los dos laterales por los cortos: solo los dos largos van a la vista.
    expect(exposedEdges(top, p.parts)).toEqual([2, 0]);
  });

  it('las traseras y los fondos finos van de terciado, salvo que la placa venga en ese espesor', () => {
    expect(thinPanelMaterial('cedro', 9)).toBe('terciado');
    expect(thinPanelMaterial('melamina', 9)).toBe('terciado');
    expect(thinPanelMaterial('mdf', 9)).toBe('mdf');
    const p = build('mesa-luz', 'guatambu');
    expect(p.parts.find((x) => x.id === 'B1')!.wood).toBe('terciado');
    expect(p.parts.find((x) => x.name === 'Fondo del cajón')!.wood).toBe('terciado');
  });

  it('una pieza que no es de un espesor de placa avisa de qué placa sale', () => {
    const p = build('estante', 'mdf', { board: 20 });
    expect(cutList(p).find((r) => r.ids.includes('L1'))!.work).toContain('sale de placa de 25 mm');
  });
});

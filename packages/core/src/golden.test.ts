import { describe, expect, it } from 'vitest';
import { boxSize, partBox } from './geometry';
import { drawerWeights, PHI } from './fittings';
import { goldenChecks, regradeDrawers } from './golden';
import { furnitureBox, resizeFurniture } from './resize';
import { buildTemplate, templateById } from './templates';

const now = '2026-10-22T00:00:00Z';
const build = (id: string, v: Record<string, number> = {}) => buildTemplate(templateById(id)!, v, 'guatambu', undefined, now);
const check = (id: string, v: Record<string, number>, which: string) => goldenChecks(build(id, v)).find((c) => c.id === which)!;
const fronts = (p: ReturnType<typeof build>) =>
  p.parts
    .filter((x) => /^K\d/.test(x.id) && x.name === 'Frente del cajón')
    .map((x) => boxSize(partBox(x))[1])
    .sort((a, b) => b - a);

describe('proporción áurea', () => {
  it('una mesa de 162 × 100 es áurea de arriba; una de 140 × 80, cerca, y propone el fondo o el largo', () => {
    expect(check('mesa', { width: 1620, depth: 1000 }, 'planta').status).toBe('aurea');
    const c = check('mesa', { width: 1400, depth: 800 }, 'planta');
    expect(c.status).toBe('cerca');
    expect(c.fixes.map((f) => f.fix)).toEqual([
      { kind: 'size', axis: 0, mm: 1290 },
      { kind: 'size', axis: 2, mm: 870 },
    ]);
  });

  it('en la mesa no propone cambiar el alto, que lo pone el cuerpo', () => {
    const c = check('mesa', { width: 1400, depth: 800 }, 'frente');
    expect(c.fixes.every((f) => f.fix.kind === 'size' && f.fix.axis !== 1)).toBe(true);
    // En una biblioteca sí.
    expect(check('biblioteca', { width: 900, height: 2000 }, 'frente').fixes.some((f) => f.fix.kind === 'size' && f.fix.axis === 1)).toBe(true);
  });

  it('dos rectángulos áureos encadenados (φ²) también cuentan', () => {
    expect(check('biblioteca', { width: 760, height: 2000 }, 'frente').status).toBe('aurea');
  });

  it('la medida propuesta, aplicada con medidas generales, deja el mueble áureo', () => {
    const p = build('cajonera', { width: 800, height: 900 });
    const fix = goldenChecks(p).find((c) => c.id === 'frente')!.fixes[0]!.fix;
    expect(fix.kind).toBe('size');
    if (fix.kind !== 'size') return;
    expect(resizeFurniture(p.parts, fix.axis, fix.mm)).not.toBeNull();
    expect(boxSize(furnitureBox(p.parts)!)[fix.axis]).toBeCloseTo(fix.mm, 0);
    expect(goldenChecks(p).find((c) => c.id === 'frente')!.status).toBe('aurea');
  });

  it('cajones graduados: escalera pareja con el de abajo φ veces el de arriba', () => {
    const w = drawerWeights(4, true);
    expect(w[0]! / w[3]!).toBeCloseTo(PHI, 6);
    const p = build('cajonera', { drawers: 4, graded: 1 });
    const h = fronts(p);
    expect(h).toHaveLength(4);
    expect(h[0]! / h[3]!).toBeCloseTo(PHI, 1);
    expect(check('cajonera', { drawers: 4, graded: 1 }, 'cajones').status).toBe('aurea');
    expect(check('cajonera', { drawers: 4 }, 'cajones').status).toBe('lejos');
  });

  it('gradúa los cajones de un mueble ya armado, en el mismo hueco', () => {
    const p = build('cajonera', { drawers: 5 });
    const before = p.parts.filter((x) => /^K\d/.test(x.id)).length;
    expect(regradeDrawers(p)).toBe(1);
    expect(p.parts.filter((x) => /^K\d/.test(x.id))).toHaveLength(before);
    expect(goldenChecks(p).find((c) => c.id === 'cajones')!.status).toBe('aurea');
    // Las uniones apuntan a piezas que existen.
    const ids = new Set(p.parts.map((x) => x.id));
    expect(p.joints.every((j) => ids.has(j.partA) && ids.has(j.partB))).toBe(true);
    expect(p.parts.every((x) => !x.component || p.components.some((c) => c.id === x.component))).toBe(true);
    // Y se pueden volver a emparejar.
    expect(regradeDrawers(p, false)).toBe(1);
    expect(new Set(fronts(p).map((h) => Math.round(h))).size).toBe(1);
  });
});

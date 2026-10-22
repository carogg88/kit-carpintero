import { describe, expect, it } from 'vitest';
import { cutPiece } from './cutlist';
import { drawPart } from './drawing';
import { arcInfo, arcTemplate, arcTouchesEdge, describePocket, newPocket, pocketRegion, pocketSolid, pocketTakesWholePart, snapOnFace } from './pockets';
import { loadProject, SCHEMA_VERSION, type Part } from './project';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const top = table.parts.find((p) => p.id === 'T1')!;
const mm = (n: number) => `${n} mm`;

describe('vaciados', () => {
  it('un rectángulo en la cara de arriba baja desde arriba y sale 1 mm', () => {
    const p = newPocket(top, 1, 1, { kind: 'rect', u: 100, v: 50, w: 200, h: 80 });
    expect(p).toMatchObject({ id: 'V1', depth: 11, through: false });
    const s = pocketSolid(top, p);
    expect(s).toEqual({ kind: 'box', box: { min: [100, 739, 50], max: [300, 751, 130] } });
  });

  it('un círculo es un calado: atraviesa toda la pieza', () => {
    const p = newPocket(top, 1, 1, { kind: 'circle', u: 900, v: 450, d: 60 });
    expect(p.through).toBe(true);
    expect(pocketSolid(top, p)).toEqual({ kind: 'cylinder', start: [900, 751, 450], axis: 1, dir: -1, radius: 30, length: 24 });
    expect(describePocket(p, mm)).toBe('calado Ø 60 mm en la cara de arriba');
  });

  it('en la cara de abajo baja hacia arriba', () => {
    const p = { ...newPocket(top, 1, -1, { kind: 'rect', u: 0, v: 0, w: 10, h: 10 }), depth: 5 };
    expect(pocketSolid(top, p)).toMatchObject({ box: { min: [0, 727, 0], max: [10, 733, 10] } });
    expect(describePocket({ ...p, axis: 2, side: 1 }, mm)).toBe('vaciado 10 mm × 10 mm, 5 mm de hondo en el frente');
  });

  it('el lápiz se pega a los bordes y al centro, y si no a 5 mm', () => {
    expect(snapOnFace(4, 900, 6)).toEqual({ value: 0, to: 'borde' });
    expect(snapOnFace(447, 900, 6)).toEqual({ value: 450, to: 'centro' });
    expect(snapOnFace(123, 900, 6)).toEqual({ value: 125, to: null });
    expect(snapOnFace(950, 900, 6)).toEqual({ value: 900, to: 'borde' });
  });

  it('la lista de cortes cuenta calados y vaciados', () => {
    const part: Part = {
      ...top,
      pockets: [newPocket(top, 1, 1, { kind: 'circle', u: 10, v: 10, d: 30 }), newPocket(top, 1, 1, { kind: 'rect', u: 0, v: 0, w: 5, h: 5 })],
    };
    expect(cutPiece(part, { ...table, parts: [part] }).work).toEqual(expect.arrayContaining(['1 calado', '1 vaciado']));
  });

  it('un proyecto v2 abre con las piezas sin vaciados', () => {
    const raw = JSON.parse(JSON.stringify({ ...table, schemaVersion: 2, parts: table.parts.map((p) => ({ ...p, pockets: undefined })) }));
    const r = loadProject(raw);
    expect(r.ok && r.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && r.project.parts.every((p) => p.pockets.length === 0)).toBe(true);
  });
});

describe('arcos', () => {
  const board: Part = { ...top, position: [0, 0, 0], base: { kind: 'box', size: [400, 20, 300] }, ops: [], pockets: [], bevels: [], sections: [] };
  const arch = { kind: 'arc', u: 100, v: 0, u2: 300, v2: 0, bulge: 50, outside: false } as const;
  const corner = { kind: 'arc', u: 300, v: 300, u2: 400, v2: 200, bulge: 100 - 100 * Math.SQRT1_2, outside: false } as const;

  it('mide el radio desde la cuerda y la flecha', () => {
    expect(arcInfo(arch)).toMatchObject({ chord: 200, radius: 125, mid: [200, 50] });
    expect(arcInfo(arch).center[1]).toBeCloseTo(-75);
    expect(arcInfo(corner).radius).toBeCloseTo(100);
  });

  const area = (pts: [number, number][]) => Math.abs(pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * p[1], 0)) / 2;

  it('muestra antes de soltar lo que se va a sacar', () => {
    // Faldón: el segmento circular de R 125 y cuerda 200.
    const th = 2 * Math.asin(100 / 125);
    expect(area(pocketRegion(board, 1, arch))).toBeCloseTo(((125 * 125) / 2) * (th - Math.sin(th)), -1);
    // Esquina redondeada R 100: el cuadrado de 100 menos el cuarto de círculo.
    expect(area(pocketRegion(board, 1, corner))).toBeCloseTo(100 * 100 - (Math.PI * 100 * 100) / 4, -1);
    // Un rectángulo que se sale de la cara se ve recortado.
    expect(area(pocketRegion(board, 1, { kind: 'rect', u: 350, v: 250, w: 100, h: 100 }))).toBeCloseTo(50 * 50);
  });

  it('un arco en el medio de la cara, que no toca ningún borde, no vale', () => {
    expect(arcTouchesEdge(board, 1, arch)).toBe(true);
    expect(arcTouchesEdge(board, 1, corner)).toBe(true);
    expect(arcTouchesEdge(board, 1, { ...arch, v: 150, v2: 150 })).toBe(false);
  });

  it('un faldón arqueado saca el segmento; una esquina, lo de afuera', () => {
    expect(newPocket(board, 1, 1, arch)).toMatchObject({ through: true, shape: { outside: false } });
    expect(newPocket(board, 1, 1, corner).shape).toMatchObject({ outside: true });
    // Curvado hacia adentro, más de medio círculo: se come la esquina, no media tabla.
    expect(newPocket(board, 1, 1, { ...corner, bulge: -100 - 100 * Math.SQRT1_2 }).shape).toMatchObject({ outside: false });
    // Menos de medio círculo hacia adentro, con el centro todavía en la cara: también se come solo la esquina.
    const bite = { kind: 'arc', u: 400, v: 240, u2: 340, v2: 300, bulge: 50 - Math.sqrt(50 * 50 - 1800), outside: false } as const;
    expect(arcInfo(bite).radius).toBeCloseTo(50);
    expect(newPocket(board, 1, 1, bite).shape).toMatchObject({ outside: false });
  });

  it('el sólido sigue el arco y, si es esquina, se cierra lejos del lado de la flecha', () => {
    const seg = pocketSolid(board, newPocket(board, 1, 1, arch));
    expect(seg).toMatchObject({ kind: 'arc', axis: 1, u: 0, v: 2, a: [100, 0], mid: [200, 50], b: [300, 0], rest: [] });
    const out = pocketSolid(board, newPocket(board, 1, 1, corner));
    if (out.kind !== 'arc') throw new Error('arco');
    expect(out.rest).toHaveLength(2);
    expect(out.rest[0]![0]).toBeGreaterThan(400);
    expect(out.rest[0]![1]).toBeGreaterThan(200);
  });

  it('se describe con el radio y la lista de cortes lo anota', () => {
    const p = newPocket(board, 2, 1, arch);
    expect(describePocket(p, mm)).toBe('corte en arco R 125 mm, flecha 50 mm en el frente');
    const part = { ...board, pockets: [p] };
    expect(cutPiece(part, { ...table, parts: [part], joints: [] }).work).toContain('corte en arco R 125 mm');
  });

  it('el despiece acota el radio del lado de la madera', () => {
    const part = { ...board, pockets: [newPocket(board, 1, 1, arch), { ...newPocket(board, 1, 1, corner), id: 'V2' }] };
    const arcs = drawPart({ ...table, parts: [part], joints: [] }, part).arcs!;
    expect(arcs).toHaveLength(2);
    expect(arcs[0]).toMatchObject({ id: 'V1', at: [200, 50], radius: 125 });
    // El segmento se saca hacia la cuerda: la madera queda arriba, lejos del centro.
    expect(arcs[0]!.toward[1]).toBeCloseTo(1);
    // En la esquina la madera queda hacia el centro, adentro de la pieza.
    expect(arcs[1]!.toward[0]).toBeLessThan(0);
    expect(arcs[1]!.toward[1]).toBeLessThan(0);
  });

  it('un arco en un canto no se ve de frente: no lleva cota en el despiece', () => {
    const part = { ...board, pockets: [newPocket(board, 2, 1, arch)] };
    expect(drawPart({ ...table, parts: [part], joints: [] }, part).arcs).toEqual([]);
  });

  it('la plantilla acuesta el arco sobre la cuerda', () => {
    const t = arcTemplate(corner);
    expect(t.chord).toBeCloseTo(100 * Math.SQRT2);
    expect(t.radius).toBeCloseTo(100);
    expect(t.points[0]![0]).toBeCloseTo(0);
    expect(t.points[0]![1]).toBeCloseTo(0);
    expect(t.points.at(-1)![0]).toBeCloseTo(t.chord);
    expect(t.points.at(-1)![1]).toBeCloseTo(0);
    expect(Math.max(...t.points.map((q) => q[1]))).toBeCloseTo(t.sagitta);
  });
});

describe('calados que se llevan toda la pieza', () => {
  const slat: Part = { ...top, id: 'L1', base: { kind: 'box', size: [25, 25, 340] }, position: [0, 0, 0], pockets: [] };
  it('un círculo más grande que la punta de un listón redondo lo atraviesa entero', () => {
    const round: Part = { ...slat, ops: [{ kind: 'round', edges: 'all', radius: 12 }] };
    const p = newPocket(round, 2, 1, { kind: 'circle', u: 12.5, v: 12.5, d: 27 });
    expect(pocketTakesWholePart(round, p)).toBe(true);
    // Con las esquinas vivas, al mismo círculo le quedan afuera las cuatro puntas.
    expect(pocketTakesWholePart(slat, p)).toBe(false);
    expect(pocketTakesWholePart(slat, { ...p, shape: { kind: 'circle', u: 12.5, v: 12.5, d: 36 } })).toBe(true);
    expect(pocketTakesWholePart(slat, { ...p, through: false })).toBe(false);
  });
  it('una muesca en el borde no se lleva la pieza', () => {
    const apron: Part = { ...slat, base: { kind: 'box', size: [360, 80, 20] } };
    expect(pocketTakesWholePart(apron, newPocket(apron, 2, 1, { kind: 'circle', u: 104.5, v: 80, d: 25 }))).toBe(false);
  });
});

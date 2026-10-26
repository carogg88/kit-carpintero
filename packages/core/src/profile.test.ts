import { describe, expect, it } from 'vitest';
import { cutPiece } from './cutlist';
import { facePattern, patternDetails } from './patterns';
import { describePocket, faceSize, newPocket, pocketRegion, pocketSolid, pointInPocket } from './pockets';
import { pathCrosses, pathCurve, pathReady, pathRegion, type PathShape } from './profile';
import { loadProject, SCHEMA_VERSION, type Part } from './project';
import { rotatePart } from './rotate';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const apron = table.parts.find((p) => p.id === 'F1')!;
const mm = (n: number) => `${n} mm`;
const path = (pts: [number, number, boolean?][], closed = false, flip = false): PathShape => ({
  kind: 'path',
  points: pts.map(([u, v, corner]) => ({ u, v, corner: corner ?? false })),
  closed,
  flip,
});

describe('perfil a mano', () => {
  it('la curva pasa por todos los puntos', () => {
    const s = path([[0, 20], [400, 50], [800, 20]]);
    const c = pathCurve(s.points, false);
    for (const p of s.points) expect(c.some(([u, v]) => Math.hypot(u - p.u, v - p.v) < 1e-9)).toBe(true);
    // Entre dos puntos suaves no va derecho: la curva pasa por arriba de la recta.
    expect(Math.max(...c.filter(([u]) => u > 100 && u < 300).map(([u, v]) => v - (20 + u * (30 / 400))))).toBeGreaterThan(0);
  });

  it('entre dos esquinas va una recta', () => {
    expect(pathCurve(path([[0, 0, true], [100, 50, true]]).points, false)).toEqual([[0, 0], [100, 50]]);
  });

  it('abierto de borde a borde saca el lado más chico, o el otro si se pide', () => {
    const s = path([[0, 20], [400, 50], [800, 20]]);
    const small = pathRegion(s, 800, 95);
    expect(small).toContainEqual([0, 0]);
    expect(small).toContainEqual([800, 0]);
    expect(small).not.toContainEqual([0, 95]);
    const big = pathRegion({ ...s, flip: true }, 800, 95);
    expect(big).toContainEqual([0, 95]);
    expect(big).not.toContainEqual([0, 0]);
  });

  it('abierto que no llega a dos bordes todavía no saca nada', () => {
    expect(pathRegion(path([[0, 20], [400, 50]]), 800, 95)).toEqual([]);
    expect(pathReady(path([[0, 20], [400, 50]]), 800, 95)).toBe(false);
  });

  it('cerrado saca lo de adentro y necesita tres puntos', () => {
    expect(pathReady(path([[100, 30], [200, 30]], true), 800, 95)).toBe(false);
    expect(pathReady(path([[100, 30], [200, 30], [150, 70]], true), 800, 95)).toBe(true);
  });

  it('una línea que se cruza no vale', () => {
    const bow = path([[100, 10, true], [200, 80, true], [200, 10, true], [100, 80, true]], true);
    expect(pathCrosses(bow)).toBe(true);
    expect(pathReady(bow, 800, 95)).toBe(false);
  });

  it('en un faldón: corta de lado a lado y la lista de cortes pide la plantilla', () => {
    const { size } = faceSize(apron, 2);
    const s = path([[0, 20], [size[0] / 2, 50], [size[0], 20]]);
    const pk = newPocket(apron, 2, 1, s);
    expect(pk.through).toBe(true);
    expect(describePocket(pk, mm)).toBe('corte con perfil a mano en el frente');
    const solid = pocketSolid(apron, pk);
    expect(solid.kind).toBe('prism');
    const part: Part = { ...apron, pockets: [pk] };
    // Abajo en el medio se saca; arriba queda.
    const box = { x: apron.position[0] + size[0] / 2, z: apron.position[2] + 5 };
    expect(pointInPocket(part, pk, [box.x, apron.position[1] + 5, box.z])).toBe(true);
    expect(pointInPocket(part, pk, [box.x, apron.position[1] + size[1] - 5, box.z])).toBe(false);
    expect(cutPiece(part, { ...table, parts: [part], joints: [] }).work).toContain('corte con perfil a mano (plantilla 1:1)');
    expect(pocketRegion(part, 2, s).length).toBeGreaterThan(10);
  });

  it('sale en la plantilla 1:1 con su propia hoja de detalle', () => {
    const { size } = faceSize(apron, 2);
    const pk = newPocket(apron, 2, 1, path([[0, 20], [size[0] / 2, 50], [size[0], 20]]));
    const pat = facePattern({ ...apron, pockets: [pk] }, mm);
    expect(pat?.shapes).toHaveLength(1);
    expect(pat?.shapes[0]).toMatchObject({ kind: 'cut', curve: true });
    expect(patternDetails(pat!)).toHaveLength(1);
  });

  it('al girar la pieza los puntos pasan a la cara girada', () => {
    const pk = newPocket(apron, 2, 1, path([[0, 20], [300, 50], [600, 20]]));
    const part: Part = structuredClone({ ...apron, pockets: [pk] });
    rotatePart(part, 2);
    const q = part.pockets[0]!;
    expect(q.shape.kind).toBe('path');
    if (q.shape.kind === 'path') expect(q.shape.points).toHaveLength(3);
  });

  it('se guarda y se abre', () => {
    const pk = newPocket(apron, 2, 1, path([[0, 20], [300, 50], [600, 20]]));
    const p = { ...table, parts: table.parts.map((x) => (x.id === apron.id ? { ...x, pockets: [pk] } : x)) };
    const r = loadProject(JSON.parse(JSON.stringify(p)));
    expect(r.ok && r.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && r.project.parts.find((x) => x.id === apron.id)?.pockets[0]?.shape.kind).toBe('path');
  });
});

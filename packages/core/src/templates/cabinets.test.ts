import { describe, expect, it } from 'vitest';
import { buildTemplate, templateById, TEMPLATES } from '.';
import { buildShelves, findOpenings, shelfProblem } from '../fittings';
import { syncJoints } from '../edit';
import { cutList } from '../cutlist';
import { partBox } from '../geometry';

const now = '2026-10-22T00:00:00Z';
const build = (id: string, v: Record<string, number> = {}) => buildTemplate(templateById(id)!, v, 'cedro', undefined, now);
const ids = (p: ReturnType<typeof build>, prefix: string) => p.parts.filter((x) => x.id.startsWith(prefix));

describe('plantillas nuevas', () => {
  it('hay once plantillas (con la de prueba de patas abiertas) y todas se arman con uniones y lista de cortes', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['mesa', 'taburete', 'estante', 'caja', 'mesa-luz', 'cajonera', 'biblioteca', 'alacena', 'mesa-ratona', 'banco', 'patas-abiertas', 'banco-rustico']);
    for (const t of TEMPLATES) {
      const p = build(t.id);
      expect(p.template).toBe(t.id);
      expect(p.joints.length).toBeGreaterThan(0);
      // Las uniones que trae son las mismas que vería el editor al abrirlo.
      expect(syncJoints(p.parts, p.joints)).toHaveLength(p.joints.length);
      expect(cutList(p).length).toBeGreaterThan(0);
    }
  });

  it('la mesa de luz trae un cajón arriba y un nicho abierto abajo', () => {
    const p = build('mesa-luz');
    expect(ids(p, 'K')).toHaveLength(5);
    expect(p.joints.filter((j) => j.type === 'cola-milano')).toHaveLength(4);
    // El nicho de abajo sigue libre para agregarle algo.
    expect(findOpenings(p.parts)).toHaveLength(1);
  });

  it('la cajonera trae los cajones pedidos, con correderas metálicas', () => {
    const p = build('cajonera', { drawers: 3 });
    expect(ids(p, 'K')).toHaveLength(15);
    const side = p.parts.find((x) => x.name === 'Costado del cajón')!;
    expect(partBox(side).min[0] - 18).toBe(12.5);
  });

  it('la biblioteca con puertas abajo y estantes abiertos arriba', () => {
    const p = build('biblioteca', { width: 900, shelves: 4, doors: 1 });
    expect(ids(p, 'D')).toHaveLength(10);
    const open = build('biblioteca', { doors: 0 });
    expect(ids(open, 'D')).toHaveLength(0);
    expect(ids(open, 'E').length).toBe(5);
  });

  it('la alacena tiene puertas que tapan el estante de adentro', () => {
    const p = build('alacena');
    expect(ids(p, 'D')).toHaveLength(10);
    expect(ids(p, 'Z')).toHaveLength(0);
  });

  it('el banco y la mesa ratona salen de sus plantillas de siempre', () => {
    expect(build('banco').parts.find((x) => x.id === 'S1')).toBeTruthy();
    const coffee = build('mesa-ratona');
    expect(Math.max(...coffee.parts.map((x) => partBox(x).max[1]))).toBe(420);
  });
});

describe('estantes repartidos', () => {
  it('fijos: parejos, de lateral a lateral y en canal', () => {
    const p = build('estante', { height: 1000, shelves: 2 });
    const o = findOpenings(p.parts)[0]!;
    const f = buildShelves(p, o, { count: 3, mode: 'fijo', wood: 'cedro' });
    expect(f.parts).toHaveLength(3);
    const ys = f.parts.map((x) => partBox(x).min[1]);
    expect(ys[1]! - ys[0]!).toBeCloseTo(ys[2]! - ys[1]!, 5);
    expect(f.joints.filter((j) => j.type === 'canal')).toHaveLength(6);
    expect(f.components).toHaveLength(1);
  });

  it('regulables: con juego y sin encastre', () => {
    const p = build('estante', { height: 1000, shelves: 2 });
    const o = findOpenings(p.parts)[0]!;
    const f = buildShelves(p, o, { count: 2, mode: 'regulable', wood: 'cedro' });
    expect(f.joints).toEqual([]);
    expect(partBox(f.parts[0]!).min[0]).toBe(o.box.min[0] + 1);
    p.parts.push(...f.parts);
    expect(syncJoints(p.parts, p.joints)).toHaveLength(p.joints.length);
    expect(shelfProblem(o, { count: 12 })).toMatch(/No entran 12 estantes/);
  });
});

import { describe, expect, it } from 'vitest';
import { buildDoors, buildDrawers, drawerProblem, findOpenings, looseOpening } from './fittings';
import { boxSize, partBox } from './geometry';
import { syncJoints, namePrefix } from './edit';
import { buildTemplate, templateById } from './templates';
import type { Project } from './project';

const now = '2026-10-22T00:00:00Z';
const shelf = () => buildTemplate(templateById('estante')!, { width: 800, height: 1000, depth: 400, shelves: 3 }, 'cedro', undefined, now);
const add = (p: Project, f: ReturnType<typeof buildDrawers>) => {
  p.parts.push(...f.parts);
  p.joints.push(...f.joints);
  p.components.push(...f.components);
  p.joints = syncJoints(p.parts, p.joints);
};

describe('huecos del mueble', () => {
  it('encuentra los huecos entre estantes y laterales', () => {
    const p = shelf();
    const openings = findOpenings(p.parts);
    expect(openings).toHaveLength(2);
    const [o] = openings;
    expect(o!.box.min[0]).toBe(20);
    expect(o!.box.max[0]).toBe(780);
    expect(o!.box.max[2]).toBe(400);
    expect(o!.sides.left).toEqual(['L1']);
    expect(o!.sides.below).toEqual(['E1']);
    expect(o!.edge.left).toBe(20);
  });

  it('una mesa no tiene huecos cerrados', () => {
    const p = buildTemplate(templateById('mesa')!, {}, 'cedro', undefined, now);
    expect(findOpenings(p.parts)).toEqual([]);
  });

  it('un hueco lleno con cajones ya no se ofrece', () => {
    const p = shelf();
    const o = findOpenings(p.parts)[0]!;
    add(p, buildDrawers(p, o, { count: 2, front: 'embutido', slides: 'madera', wood: 'cedro' }));
    expect(findOpenings(p.parts)).toHaveLength(1);
  });
});

describe('cajones', () => {
  it('arma frente, costados, trasera y fondo con colas de milano y canal', () => {
    const p = shelf();
    const o = findOpenings(p.parts)[0]!;
    const f = buildDrawers(p, o, { count: 1, front: 'embutido', slides: 'madera', wood: 'cedro' });
    expect(f.parts.map((x) => x.id)).toEqual(['K1', 'K2', 'K3', 'K4', 'K5']);
    expect(f.parts.map((x) => x.name)).toEqual(['Frente del cajón', 'Costado del cajón', 'Costado del cajón', 'Trasera del cajón', 'Fondo del cajón']);
    const types = f.joints.map((j) => `${j.partA}-${j.partB}:${j.type}`);
    expect(types).toContain('K1-K2:cola-milano');
    expect(types).toContain('K4-K3:cola-milano');
    expect(f.joints.filter((j) => j.type === 'canal')).toHaveLength(4);
    // El frente embutido deja 2 mm de luz y queda al ras del mueble.
    const front = partBox(f.parts[0]!);
    expect(front.min[0]).toBe(o.box.min[0] + 2);
    expect(front.max[2]).toBe(o.box.max[2]);
    // Los costados son iguales: quedan vinculados.
    expect(f.components).toHaveLength(1);
    expect(f.parts[1]!.component).toBe(f.parts[2]!.component);
  });

  it('no toca el mueble: las uniones son solo entre las piezas del cajón', () => {
    const p = shelf();
    const o = findOpenings(p.parts)[0]!;
    const before = p.joints.length;
    add(p, buildDrawers(p, o, { count: 3, front: 'superpuesto', slides: 'metalicas', wood: 'cedro' }));
    const drawer = p.joints.slice(before);
    expect(drawer.every((j) => j.partA.startsWith('K') && j.partB.startsWith('K'))).toBe(true);
    // Tres cajones de 5 piezas, cada uno con 4 esquinas y 4 canales.
    expect(drawer).toHaveLength(24);
  });

  it('con correderas metálicas deja 12,5 mm por costado y usa un largo que se consigue', () => {
    const p = shelf();
    const o = findOpenings(p.parts)[0]!;
    const f = buildDrawers(p, o, { count: 1, front: 'embutido', slides: 'metalicas', wood: 'cedro' });
    const side = partBox(f.parts[1]!);
    expect(side.min[0] - o.box.min[0]).toBe(12.5);
    const back = partBox(f.parts[3]!);
    expect(partBox(f.parts[0]!).min[2] - back.min[2]).toBe(350);
  });

  it('avisa si no entran', () => {
    const o = findOpenings(shelf().parts)[0]!;
    expect(drawerProblem(o, { count: 10, slides: 'madera', front: 'embutido' })).toMatch(/No entran 10 cajones/);
    expect(drawerProblem(o, { count: 2, slides: 'madera', front: 'embutido' })).toBeNull();
  });

  it('sin hueco, se arma al costado con la medida escrita', () => {
    const p = shelf();
    const o = looseOpening(p.parts, [500, 150, 450]);
    const f = buildDrawers(p, o, { count: 1, front: 'embutido', slides: 'madera', wood: 'cedro' });
    expect(partBox(f.parts[0]!).min[0]).toBe(800 + 150 + 2);
  });
});

describe('puertas', () => {
  it('de marco y tablero: largueros, peinazos con mortaja y el tablero en canal', () => {
    const p = shelf();
    const o = findOpenings(p.parts)[1]!;
    const f = buildDoors(p, o, { count: 2, front: 'embutido', style: 'marco', wood: 'cedro' });
    expect(f.parts).toHaveLength(10);
    expect(f.parts.every((x) => x.id.startsWith('D'))).toBe(true);
    expect(f.joints.filter((j) => j.type === 'mortaja')).toHaveLength(8);
    expect(f.joints.filter((j) => j.type === 'canal')).toHaveLength(8);
    const [a, b] = [partBox(f.parts[0]!), partBox(f.parts[5]!)];
    // Dos hojas con 3 mm entre ellas.
    expect(b.min[0] - partBox(f.parts[1]!).max[0]).toBe(3);
    expect(boxSize(a)[2]).toBe(20);
    add(p, f);
    expect(p.joints.filter((j) => j.partA.startsWith('D') !== j.partB.startsWith('D'))).toEqual([]);
  });

  it('de una tabla entera', () => {
    const p = shelf();
    const f = buildDoors(p, findOpenings(p.parts)[0]!, { count: 1, front: 'superpuesto', style: 'tablero', wood: 'cedro' });
    expect(f.parts.map((x) => x.name)).toEqual(['Puerta']);
    expect(f.joints).toEqual([]);
  });

  it('los nombres nuevos tienen su letra de código', () => {
    expect(namePrefix('Costado del cajón')).toBe('K');
    expect(namePrefix('Drawer side')).toBe('K');
    expect(namePrefix('Tablero de la puerta')).toBe('D');
    expect(namePrefix('Tablero')).toBe('B');
    expect(namePrefix('Costado izquierdo')).toBeNull();
  });
});

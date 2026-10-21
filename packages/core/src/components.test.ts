import { describe, expect, it } from 'vitest';
import { autoComponents, copyPart, makeComponent, makeUnique, syncComponents } from './components';
import { loadProject, SCHEMA_VERSION } from './project';
import { createTable } from './templates/table';
import { buildTemplate, templateById } from './templates';

const size = (p: { base: unknown }) => (p.base as { size: number[] }).size;

describe('componentes', () => {
  it('las plantillas vienen con las piezas iguales vinculadas', () => {
    const p = buildTemplate(templateById('mesa')!, {}, 'guatambu');
    const legs = p.parts.filter((x) => x.name.startsWith('Pata'));
    expect(new Set(legs.map((x) => x.component)).size).toBe(1);
    expect(legs[0]!.component).toBeDefined();
    expect(p.components.map((c) => c.name)).toEqual(['Pata', 'Faldón', 'Faldón 2']);
    expect(p.parts.find((x) => x.id === 'T1')!.component).toBeUndefined();
  });

  it('cambiar una copia cambia todas, también hacia el lado negativo', () => {
    const prev = createTable();
    makeComponent(prev, 'P1');
    prev.parts.find((x) => x.id === 'P3')!.component = prev.parts.find((x) => x.id === 'P1')!.component;
    const next = structuredClone(prev);
    const p1 = next.parts.find((x) => x.id === 'P1')!;
    const p3Before = [...next.parts.find((x) => x.id === 'P3')!.position];
    // Se empuja la cara de abajo de P1 10 mm hacia abajo.
    size(p1)[1] = size(p1)[1]! + 10;
    p1.position[1] -= 10;
    p1.wood = 'lapacho';
    syncComponents(prev, next);
    const p3 = next.parts.find((x) => x.id === 'P3')!;
    expect(size(p3)[1]).toBe(size(p1)[1]);
    expect(p3.position[1]).toBe(p3Before[1]! - 10);
    expect(p3.wood).toBe('lapacho');
    // P2 no es del componente: no cambia.
    expect(next.parts.find((x) => x.id === 'P2')!.wood).toBe('guatambu');
  });

  it('mover una copia no mueve las otras', () => {
    const prev = createTable();
    autoComponents(prev);
    const next = structuredClone(prev);
    next.parts.find((x) => x.id === 'P1')!.position[0] += 50;
    syncComponents(prev, next);
    expect(next.parts.find((x) => x.id === 'P2')!.position).toEqual(prev.parts.find((x) => x.id === 'P2')!.position);
  });

  it('una copia de un componente queda vinculada; hacerla única la separa', () => {
    const p = createTable();
    autoComponents(p);
    const leg = p.parts.find((x) => x.id === 'P1')!;
    const copy = copyPart(p.parts, leg);
    expect(copy.id).toBe('P5');
    expect(copy.component).toBe(leg.component);
    p.parts.push(copy);
    makeUnique(p, 'P5');
    expect(p.parts.find((x) => x.id === 'P5')!.component).toBeUndefined();
    expect(copyPart(p.parts, p.parts.find((x) => x.id === 'T1')!).name).toBe('Tapa (copia)');
  });

  it('saca el componente cuando no le quedan copias', () => {
    const p = createTable();
    makeComponent(p, 'T1');
    expect(p.components).toHaveLength(1);
    makeUnique(p, 'T1');
    expect(p.components).toHaveLength(0);
  });

  it('abre proyectos de la versión 1 sin componentes', () => {
    const v1 = { ...createTable(), schemaVersion: 1 } as Record<string, unknown>;
    delete v1.components;
    const r = loadProject(v1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.project.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

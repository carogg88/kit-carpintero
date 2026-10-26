import { describe, expect, it } from 'vitest';
import { addCopies, duplicateParts, groupOf, isWholeGroup, makeGroup, partsBox, syncGroups, ungroup } from './groups';
import { partBox } from './geometry';
import { loadProject, SCHEMA_VERSION } from './project';
import { decodeShare, encodeShare } from './share';
import { buildTemplate, templateById } from './templates';

const mesa = () => buildTemplate(templateById('mesa')!, {}, 'guatambu', undefined, '2026-10-26T00:00:00Z');

describe('grupos', () => {
  it('agrupar saca las piezas del grupo donde estaban y deshace el que queda con una sola', () => {
    const p = mesa();
    const a = makeGroup(p, ['P1', 'P2'])!;
    expect(a).toMatchObject({ id: 'G1', name: 'Grupo 1', parts: ['P1', 'P2'] });
    const b = makeGroup(p, ['P2', 'P3'])!;
    expect(b.name).toBe('Grupo 1');
    expect(p.groups).toEqual([b]);
    expect(groupOf(p, 'P2')).toBe(b);
    expect(groupOf(p, 'P1')).toBeUndefined();
    expect(makeGroup(p, ['P4'])).toBeNull();
  });

  it('borrar piezas las saca del grupo; con menos de dos, el grupo se deshace', () => {
    const p = mesa();
    makeGroup(p, ['P1', 'P2', 'P3']);
    p.parts = p.parts.filter((x) => x.id !== 'P1');
    syncGroups(p);
    expect(p.groups[0]!.parts).toEqual(['P2', 'P3']);
    p.parts = p.parts.filter((x) => x.id !== 'P2');
    syncGroups(p);
    expect(p.groups).toEqual([]);
  });

  it('desagrupar deja las piezas donde estaban', () => {
    const p = mesa();
    const before = structuredClone(p.parts);
    const g = makeGroup(p, ['P1', 'P2'])!;
    ungroup(p, g.id);
    expect(p.groups).toEqual([]);
    expect(p.parts).toEqual(before);
  });

  it('duplicar un grupo hace otro grupo al costado, con las piezas igual de separadas', () => {
    const p = mesa();
    makeGroup(p, ['P1', 'P2'], 'Patas');
    const copies = duplicateParts(p.parts, ['P1', 'P2']);
    const right = Math.max(...p.parts.map((x) => partBox(x).max[0]));
    const g = addCopies(p, ['P1', 'P2'], copies)!;
    expect(g.name).toBe('Patas (copia)');
    expect(g.parts).toEqual(copies.map((c) => c.id));
    const box = partsBox(p.parts, g.parts)!;
    expect(box.min[0]).toBe(right + 150);
    const [a, b] = copies;
    const [p1, p2] = ['P1', 'P2'].map((id) => p.parts.find((x) => x.id === id)!);
    expect(b!.position[0] - a!.position[0]).toBe(p2!.position[0] - p1!.position[0]);
    expect(a!.position[1]).toBe(p1!.position[1]);
    // Copias sueltas (no un grupo entero): no arman grupo.
    expect(addCopies(p, ['P1'], duplicateParts(p.parts, ['P1']))).toBeNull();
    expect(isWholeGroup(p.groups[0], ['P2', 'P1'])).toBe(true);
  });

  it('se guarda, se abre y se comparte', async () => {
    const p = mesa();
    makeGroup(p, ['P1', 'P2']);
    const old = loadProject({ ...JSON.parse(JSON.stringify(mesa())), schemaVersion: 8, groups: undefined });
    expect(old.ok && old.project.groups).toEqual([]);
    expect(old.ok && old.project.schemaVersion).toBe(SCHEMA_VERSION);
    const r = await decodeShare(await encodeShare(p));
    expect(r.ok && r.project.groups).toEqual(p.groups);
    const none = await decodeShare(await encodeShare(mesa()));
    expect(none.ok && none.project).toEqual(mesa());
  });
});

import { describe, expect, it } from 'vitest';
import { buildTemplate, TEMPLATES, templateDefaults } from '@kitc/core';
import { changeNotice, useEditor } from './store';

const mesa = () => {
  const def = TEMPLATES.find((t) => t.id === 'mesa')!;
  return buildTemplate(def, templateDefaults(def), 'guatambu', undefined, '2026-10-21T00:00:00Z');
};

describe('aviso de cambios', () => {
  it('dice qué se hizo y qué unión se soltó al alejar una pata', () => {
    useEditor.getState().open(mesa());
    const before = useEditor.getState().project!;
    const leg = before.parts.find((p) => p.name.startsWith('Pata'))!;
    useEditor.getState().commit((d) => void (d.parts.find((p) => p.id === leg.id)!.position[0] -= 500), `Moviste ${leg.id}`);
    const { notice, project } = useEditor.getState();
    expect(project!.joints.length).toBeLessThan(before.joints.length);
    expect(notice?.text).toMatch(new RegExp(`^Moviste ${leg.id} · se (soltó la unión de|soltaron)`));
  });

  it('un cambio sin nombre y sin uniones sueltas no avisa; deshacer borra el aviso', () => {
    const p = mesa();
    expect(changeNotice(p, p)).toBeNull();
    expect(changeNotice(p, p, 'Hiciste un bisel en T1')).toBe('Hiciste un bisel en T1');
    useEditor.getState().open(p);
    useEditor.getState().commit((d) => void (d.name = 'Otra'), 'Algo');
    expect(useEditor.getState().notice).not.toBeNull();
    useEditor.getState().undo();
    expect(useEditor.getState().notice).toBeNull();
  });

  it('borrar una pieza no cuenta sus uniones como sueltas', () => {
    const p = mesa();
    const leg = p.parts.find((x) => x.name.startsWith('Pata'))!;
    const after = { ...p, parts: p.parts.filter((x) => x.id !== leg.id), joints: p.joints.filter((j) => j.partA !== leg.id && j.partB !== leg.id) };
    expect(changeNotice(p, after, `Borraste ${leg.id}`)).toBe(`Borraste ${leg.id}`);
  });
});

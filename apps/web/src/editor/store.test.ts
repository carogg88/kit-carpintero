import { describe, expect, it } from 'vitest';
import { buildTemplate, makeGroup, TEMPLATES, templateDefaults } from '@kitc/core';
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

describe('vista previa', () => {
  it('un cambio propuesto no toca el proyecto hasta aplicarlo, y se puede deshacer en un paso', () => {
    useEditor.getState().open(mesa());
    const before = useEditor.getState().project!;
    const leg = before.parts.find((x) => x.name.startsWith('Pata'))!;
    useEditor.getState().propose((d) => void (d.parts = d.parts.filter((x) => x.id !== leg.id)), `Borraste ${leg.id}`);
    let s = useEditor.getState();
    expect(s.project).toBe(before);
    expect(s.ghost!.parts.some((x) => x.id === leg.id)).toBe(false);
    s.applyPending();
    s = useEditor.getState();
    expect(s.project!.parts.some((x) => x.id === leg.id)).toBe(false);
    expect([s.pending, s.ghost]).toEqual([null, null]);
    s.undo();
    expect(useEditor.getState().project).toBe(before);
  });

  it('cancelar deja todo como estaba', () => {
    useEditor.getState().open(mesa());
    const before = useEditor.getState().project!;
    useEditor.getState().propose((d) => void (d.parts[0]!.position[1] += 100), 'Moviste');
    useEditor.getState().cancelPending();
    const s = useEditor.getState();
    expect([s.project, s.pending, s.ghost, s.past.length]).toEqual([before, null, null, 0]);
  });
});

describe('flechas del teclado', () => {
  it('los toques seguidos sobre la misma pieza son un solo paso de deshacer', () => {
    useEditor.getState().open(mesa());
    const leg = useEditor.getState().project!.parts.find((p) => p.name.startsWith('Pata'))!;
    const x0 = leg.position[0];
    for (let i = 0; i < 3; i++) useEditor.getState().nudge([leg.id], 0, 1, '→');
    const s = useEditor.getState();
    expect(s.project!.parts.find((p) => p.id === leg.id)!.position[0]).toBe(x0 + 3);
    expect(s.past).toHaveLength(1);
    expect(s.notice?.text).toMatch(new RegExp(`^Corriste ${leg.id} 0,3 cm →`));
    s.undo();
    expect(useEditor.getState().project!.parts.find((p) => p.id === leg.id)!.position[0]).toBe(x0);
  });

  it('no baja de piso', () => {
    useEditor.getState().open(mesa());
    const leg = useEditor.getState().project!.parts.find((p) => p.position[1] === 0)!;
    useEditor.getState().nudge([leg.id], 1, -10, '↓');
    expect(useEditor.getState().project!.parts.find((p) => p.id === leg.id)!.position[1]).toBe(0);
    expect(useEditor.getState().past).toHaveLength(0);
  });
});

describe('piezas ocultas', () => {
  it('ocultar la pieza elegida la suelta; elegirla en la lista la vuelve a mostrar', () => {
    useEditor.getState().open(mesa());
    const id = useEditor.getState().project!.parts[0]!.id;
    useEditor.getState().select(id);
    useEditor.getState().setHidden([id]);
    expect(useEditor.getState().selectedId).toBeNull();
    useEditor.getState().select(id);
    expect(useEditor.getState().hidden).toEqual([]);
    expect(useEditor.getState().project!.parts).toHaveLength(mesa().parts.length);
  });

  it('abrir otro proyecto muestra todo', () => {
    useEditor.getState().open(mesa());
    useEditor.getState().setHidden([useEditor.getState().project!.parts[0]!.id]);
    useEditor.getState().open(mesa());
    expect(useEditor.getState().hidden).toEqual([]);
  });
});

describe('flechas: ida y vuelta', () => {
  it('volver al lugar de partida borra el aviso', () => {
    useEditor.getState().open(mesa());
    const top = useEditor.getState().project!.parts.find((p) => p.name === 'Tapa')!;
    useEditor.getState().nudge([top.id], 1, 10, '↑');
    expect(useEditor.getState().notice?.text).toMatch(/^Corriste/);
    useEditor.getState().nudge([top.id], 1, -10, '↓');
    expect(useEditor.getState().notice).toBeNull();
    expect(useEditor.getState().past).toHaveLength(1);
  });
});

describe('grupos', () => {
  const conGrupo = () => {
    const p = structuredClone(mesa());
    makeGroup(p, ['P1', 'P2'], 'Patas');
    useEditor.getState().open(p);
  };

  it('tocar una pieza del grupo elige el grupo; otro toque entra a la pieza', () => {
    conGrupo();
    const { tapPart } = useEditor.getState();
    tapPart('P2', false);
    expect([useEditor.getState().picked, useEditor.getState().selectedId]).toEqual([['P1', 'P2'], null]);
    tapPart('P2', false);
    expect([useEditor.getState().picked, useEditor.getState().selectedId]).toEqual([[], 'P2']);
    // Adentro del grupo, otra pieza del grupo se elige sola.
    tapPart('P1', false);
    expect(useEditor.getState().selectedId).toBe('P1');
    // Una pieza de afuera sale del grupo.
    tapPart('T1', false);
    tapPart('P1', false);
    expect(useEditor.getState().picked).toEqual(['P1', 'P2']);
  });

  it('Shift suma y saca piezas; con una sola deja de ser varias', () => {
    conGrupo();
    const { tapPart } = useEditor.getState();
    tapPart('T1', false);
    tapPart('P3', true);
    expect(useEditor.getState().picked).toEqual(['T1', 'P3']);
    tapPart('P1', true);
    expect(useEditor.getState().picked).toEqual(['T1', 'P3', 'P1', 'P2']);
    tapPart('P2', true);
    tapPart('P3', true);
    expect([useEditor.getState().picked, useEditor.getState().selectedId]).toEqual([[], 'T1']);
  });

  it('las flechas corren el grupo entero en un paso, sin meterlo bajo el piso', () => {
    conGrupo();
    const at = (id: string) => useEditor.getState().project!.parts.find((p) => p.id === id)!.position;
    const [x1, x2] = [at('P1')[0], at('P2')[0]];
    useEditor.getState().nudge(['P1', 'P2'], 0, 10, '→');
    expect([at('P1')[0], at('P2')[0]]).toEqual([x1 + 10, x2 + 10]);
    expect(useEditor.getState().notice?.text).toMatch(/^Corriste Patas 1 cm →/);
    useEditor.getState().nudge(['P1', 'P2'], 1, -10, '↓');
    expect(at('P1')[1]).toBe(0);
  });

  it('borrar las piezas elegidas deshace el grupo y suelta la selección; deshacer las trae', () => {
    conGrupo();
    useEditor.getState().pick(['P1', 'P2']);
    useEditor.getState().commit((d) => void (d.parts = d.parts.filter((p) => p.id !== 'P1' && p.id !== 'P2')));
    expect([useEditor.getState().project!.groups, useEditor.getState().picked]).toEqual([[], []]);
    useEditor.getState().undo();
    expect(useEditor.getState().project!.groups).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { hardwareList } from './hardware';
import { cutPlan } from './cutlist';
import { partBox } from './geometry';
import { reviewDesign, shelfSag } from './review';
import { buildTemplate, TEMPLATES, templateById, templateDefaults } from './templates';
import type { Project } from './project';

const now = '2026-10-22T00:00:00Z';
const build = (id: string, wood: string, v: Record<string, number> = {}) => buildTemplate(templateById(id)!, v, wood, undefined, now);
const kinds = (p: Project) => reviewDesign(p).map((n) => n.kind);

describe('revisión del diseño', () => {
  it('las plantillas de madera maciza salen sin avisos de uniones', () => {
    for (const id of ['mesa', 'taburete', 'caja', 'mesa-luz', 'alacena', 'mesa-ratona', 'banco']) expect(kinds(build(id, 'guatambu'))).toEqual([]);
  });

  it('la tapa maciza encolada a los faldones de los costados se raja; la del frente acompaña', () => {
    const p = build('mesa', 'guatambu');
    const top = [...p.parts].sort((a, b) => partBox(b).max[1] - partBox(a).max[1])[0]!;
    for (const j of p.joints) if (j.partA === top.id || j.partB === top.id) j.type = 'clavija';
    const notes = reviewDesign(p).filter((n) => n.kind === 'veta');
    expect(notes).toHaveLength(2);
    for (const n of notes) {
      expect(n.parts[0]).toBe(top.id);
      // Los faldones de los costados corren de adelante hacia atrás, a lo ancho de la tapa.
      const side = partBox(p.parts.find((x) => x.id === n.parts[1])!);
      expect(side.max[2] - side.min[2]).toBeGreaterThan(side.max[0] - side.min[0]);
    }
    // En placa no se mueve nada.
    for (const part of p.parts) part.wood = 'multilaminado';
    expect(kinds(p)).not.toContain('veta');
  });

  it('la espiga más gruesa que un tercio, y la mortaja al borde', () => {
    const p = build('mesa', 'guatambu');
    const j = p.joints.find((x) => x.type === 'mortaja')!;
    j.params = { ...j.params, thickness: 14 };
    expect(reviewDesign(p).find((n) => n.kind === 'espiga')?.title).toMatch(/^Espiga gruesa/);
    j.params = { ...j.params, thickness: 40 };
    expect(reviewDesign(p).find((n) => n.kind === 'espiga')?.title).toMatch(/^Mortaja al borde/);
  });

  it('los estantes de melamina de 76 cm se comban; los de madera maciza, no', () => {
    const notes = reviewDesign(build('estante', 'melamina')).filter((n) => n.kind === 'estante');
    // Los cinco estantes son iguales: un solo aviso.
    expect(notes).toHaveLength(1);
    expect(notes[0]!.parts).toHaveLength(5);
    expect(kinds(build('estante', 'guatambu'))).not.toContain('estante');
    // 80 cm de pino de 18 mm y 25 cm de fondo: alrededor de un milímetro y medio.
    expect(shelfSag(800, 250, 18, 'pino')).toBeGreaterThan(1);
    expect(shelfSag(800, 250, 18, 'pino')).toBeLessThan(2);
  });

  it('la biblioteca alta se puede volcar y suma escuadras; la mesa, no', () => {
    const b = build('biblioteca', 'guatambu');
    expect(kinds(b)).toContain('vuelco');
    expect(hardwareList(b, cutPlan(b)).find((r) => r.id === 'antivuelco')?.qty).toBe(2);
    expect(kinds(build('cajonera', 'guatambu'))).toContain('vuelco');
    const m = build('mesa', 'guatambu');
    expect(kinds(m)).not.toContain('vuelco');
    expect(hardwareList(m, cutPlan(m)).some((r) => r.id === 'antivuelco')).toBe(false);
  });

  it('ninguna plantilla trae piezas metidas una en otra sin unión', () => {
    for (const def of TEMPLATES) expect([def.id, kinds(buildTemplate(def, templateDefaults(def), 'guatambu', undefined, now)).filter((k) => k === 'cruce')]).toEqual([def.id, []]);
  });

  it('una tapa hundida en las patas sin unión avisa', () => {
    const p = build('mesa', 'guatambu');
    const top = [...p.parts].sort((a, b) => partBox(b).max[1] - partBox(a).max[1])[0]!;
    top.position[1] -= 30;
    p.joints = p.joints.filter((j) => j.partA !== top.id && j.partB !== top.id);
    const notes = reviewDesign(p).filter((n) => n.kind === 'cruce');
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]!.parts).toContain(top.id);
    expect(notes[0]!.text).toMatch(/^Ocupan el mismo lugar/);
  });
});

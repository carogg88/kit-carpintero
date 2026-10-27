import { describe, expect, it } from 'vitest';
import { hardwareList } from './hardware';
import { cutPlan } from './cutlist';
import { partBox } from './geometry';
import { applyReviewFix, reviewDesign, shelfSag } from './review';
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

  it('los avisos de espiga traen su arreglo, y aplicarlo los saca', () => {
    const p = build('mesa', 'guatambu');
    const j = p.joints.find((x) => x.type === 'mortaja')!;
    j.params = { ...j.params, thickness: 14 };
    const thick = reviewDesign(p).find((n) => n.id === `espiga|${j.id}`)!;
    expect(thick).toMatchObject({ joint: j.id, field: 'thickness', action: { kind: 'joint', joints: [j.id] } });
    applyReviewFix(p, thick.action!);
    expect(reviewDesign(p).some((n) => n.id === `espiga|${j.id}`)).toBe(false);

    // Mortaja al borde: se engrosa la pieza que recibe, a lo grueso, nunca a lo largo.
    j.params = { ...j.params, thickness: 40 };
    const edge = reviewDesign(p).find((n) => n.id === `espiga|${j.id}`)!;
    expect(edge.title).toMatch(/^Mortaja al borde/);
    const fix = edge.action!;
    expect(fix.kind).toBe('part');
    if (fix.kind !== 'part') return;
    const leg = p.parts.find((x) => x.id === fix.part)!;
    expect(fix.axis).not.toBe(1);
    const before = partBox(leg);
    applyReviewFix(p, fix);
    expect(partBox(leg).max[fix.axis] - partBox(leg).min[fix.axis]).toBeGreaterThan(before.max[fix.axis] - before.min[fix.axis]);
    expect(reviewDesign(p).find((n) => n.id === `espiga|${j.id}`)?.title ?? '').not.toMatch(/^Mortaja al borde/);
  });

  it('un faldón alto con espiga sola avisa y se arregla con espiga doble en sus dos puntas', () => {
    const p = build('mesa', 'guatambu');
    const j = p.joints.find((x) => x.type === 'mortaja')!;
    const apron = p.parts.find((x) => x.id === j.partB)!;
    if (apron.base.kind !== 'box') throw new Error('sin caja');
    apron.position[1] -= 60;
    apron.base.size[1] += 60;
    const wide = reviewDesign(p).find((n) => n.id === `espiga|${j.id}`)!;
    expect(wide.title).toMatch(/^Espiga ancha/);
    expect(wide).toMatchObject({ field: 'count', action: { kind: 'joint', params: { count: 2 } } });
    // Las dos puntas del faldón van juntas.
    expect(wide.action!.kind === 'joint' && wide.action!.joints.length).toBe(2);
    applyReviewFix(p, wide.action!);
    expect(reviewDesign(p).filter((n) => n.parts[0] === apron.id && n.kind === 'espiga')).toEqual([]);
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

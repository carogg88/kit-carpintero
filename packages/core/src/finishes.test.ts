import { describe, expect, it } from 'vitest';
import { assemblySteps } from './assembly';
import { cutPlan } from './cutlist';
import { FINISHES, finishLook, finishSteps, partFinish } from './finishes';
import { hardwareList } from './hardware';
import { loadProject, SCHEMA_VERSION, type Project } from './project';
import { applyReviewFix, reviewDesign } from './review';
import { buildTemplate, templateById } from './templates';

const build = (id: string, wood = 'guatambu'): Project => buildTemplate(templateById(id)!, {}, wood, undefined, '2026-10-28T00:00:00Z');
const rows = (p: Project) => hardwareList(p, cutPlan(p));
const top = (p: Project) => p.parts.find((x) => /tapa/i.test(x.name))!;

describe('terminaciones', () => {
  it('cada pieza lleva la suya o la del mueble; la melamina, ninguna', () => {
    const p = build('mesa');
    p.finish = { id: 'aceite' };
    top(p).finish = { id: 'laca-satinada' };
    expect(partFinish(p, top(p))?.id).toBe('laca-satinada');
    expect(partFinish(p, p.parts.find((x) => x !== top(p))!)?.id).toBe('aceite');
    expect(partFinish(p, { ...top(p), wood: 'melamina' })).toBeUndefined();
  });

  it('la pintura tapa la veta con su color; el tinte la deja ver', () => {
    expect(finishLook({ id: 'pintura', color: '#56707a' })).toMatchObject({ opaque: true, color: '#56707a' });
    const stain = finishLook({ id: 'tinte-nogal' });
    expect(stain.opaque).toBe(false);
    expect(stain.amount).toBeGreaterThan(0);
    expect(stain.amount).toBeLessThan(1);
    // Todas las lacas reflejan; el aceite no.
    for (const f of FINISHES.filter((x) => x.id.startsWith('laca'))) expect(f.look.clearcoat).toBeGreaterThan(0);
    expect(finishLook({ id: 'aceite' }).clearcoat).toBe(0);
  });

  it('sin elegir, la lista de compras dice lo de siempre', () => {
    const r = rows(build('mesa'));
    expect(r.some((x) => x.id === 'terminacion')).toBe(true);
  });

  it('con aceite en el mueble y laca en la tapa, compra las dos y no lo genérico', () => {
    const p = build('mesa');
    p.finish = { id: 'aceite' };
    top(p).finish = { id: 'laca-satinada' };
    const r = rows(p);
    expect(r.some((x) => x.id === 'terminacion')).toBe(false);
    expect(r.find((x) => x.id === 'aceite')!.qty).toBeGreaterThan(0);
    expect(r.find((x) => x.id === 'laca|satinada')!.unit).toBe('l');
    expect(r.some((x) => x.id === 'pincel')).toBe(true);
  });

  it('el tinte suma la laca satinada; la pintura sobre MDF, el sellador y el esmalte del color', () => {
    const p = build('alacena');
    p.finish = { id: 'tinte-nogal' };
    expect(rows(p).map((x) => x.id)).toEqual(expect.arrayContaining(['tinte|tinte-nogal', 'laca|satinada']));
    const m = build('alacena', 'mdf');
    m.finish = { id: 'pintura', color: '#56707a' };
    const r = rows(m);
    expect(r.map((x) => x.id)).toEqual(expect.arrayContaining(['sellador-mdf', 'esmalte|#56707a', 'rodillo']));
    expect(r.some((x) => x.id === 'pintura')).toBe(false);
  });

  it('el último paso del armado dice cuántas manos y con qué pulir entre manos', () => {
    const p = build('mesa');
    p.finish = { id: 'aceite' };
    top(p).finish = { id: 'laca-satinada' };
    const step = assemblySteps(p, () => '').find((s) => s.kind === 'terminar')!;
    expect(step.items).toHaveLength(2);
    expect(step.items.join(' ')).toContain(finishSteps({ id: 'aceite' }));
    expect(step.items.find((x) => x.startsWith(top(p).id))).toContain('Laca satinada');
  });

  it('lustre en la tapa de una mesa: avisa y el arreglo la pasa a laca satinada', () => {
    const p = build('mesa');
    p.finish = { id: 'lustre' };
    const note = reviewDesign(p).find((n) => n.id === `terminacion-tapa|${top(p).id}`)!;
    expect(note).toBeDefined();
    applyReviewFix(p, note.action!);
    expect(top(p).finish).toEqual({ id: 'laca-satinada' });
    expect(reviewDesign(p).some((n) => n.kind === 'terminacion')).toBe(false);
  });

  it('avisa la terminación sobre melamina y la pintura sobre una madera de veta', () => {
    const p = build('alacena', 'melamina');
    p.parts[0]!.finish = { id: 'aceite' };
    expect(reviewDesign(p).some((n) => n.id === `terminacion-melamina|${p.parts[0]!.id}`)).toBe(true);
    const l = build('mesa', 'lapacho');
    l.finish = { id: 'pintura' };
    expect(reviewDesign(l).filter((n) => n.id === 'terminacion-pintura|lapacho')).toHaveLength(1);
    const pino = build('mesa', 'pino');
    pino.finish = { id: 'pintura' };
    expect(reviewDesign(pino).some((n) => n.kind === 'terminacion')).toBe(false);
  });

  it('los proyectos de la versión 14 se abren sin terminación', () => {
    const { finish, ...old } = build('mesa');
    void finish;
    const r = loadProject({ ...old, schemaVersion: 14 });
    expect(r.ok && r.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && r.project.finish).toBeUndefined();
  });
});

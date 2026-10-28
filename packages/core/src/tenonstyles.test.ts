import { describe, expect, it } from 'vitest';
import { assemblySteps } from './assembly';
import { cutList, cutPlan } from './cutlist';
import { followExtras, leanFollow } from './follow';
import { hardwareList } from './hardware';
import { jointNotes } from './jointfit';
import { TENON_STYLES } from './joints';
import type { Project } from './project';
import { buildTemplate, templateById, templateDefaults } from './templates';

const build = (id: string) => {
  const def = templateById(id)!;
  return buildTemplate(def, templateDefaults(def), 'guatambu', undefined, '2026-10-28T00:00:00Z');
};
/** Todas las cajas y espigas del proyecto con ese estilo. */
const withStyle = (p: Project, style: (typeof TENON_STYLES)[number], more: Record<string, number> = {}) => {
  for (const j of p.joints) if (j.type === 'mortaja') j.params = { ...j.params, style: TENON_STYLES.indexOf(style), ...more };
  return p;
};
const mortises = (p: Project) => p.joints.filter((j) => j.type === 'mortaja').length;

describe('las formas de trabar en el resto de la app', () => {
  it('con cuñas: las cuñas van a herrajes y los cortes a la lista de cortes y al armado', () => {
    const p = withStyle(build('mesa'), 'cunas');
    const cuñas = hardwareList(p, cutPlan(p)).find((r) => r.id === 'cuna');
    // Faldones de 9,5 cm de alto: espigas de 7,5, con dos cortes cada una.
    expect(cuñas?.qty).toBe(2 * mortises(p));
    const leg = cutList(p).find((r) => r.ids.includes('P1'))!;
    expect(leg.work).toContain('2 mortajas pasantes');
    expect(leg.work).toContain('2 mortajas abiertas para las cuñas');
    const apron = cutList(p).find((r) => r.ids.includes('F1'))!;
    expect(apron.work).toContain('4 cortes de sierra para cuñas');
    const step = assemblySteps(p, () => '').find((s) => s.joint === 'mortaja')!;
    expect(step.items.some((x) => x.startsWith('Con cuñas:'))).toBe(true);
  });

  it('dos espigas pasantes que se cruzan adentro de la pata: aviso, sin acortar', () => {
    const p = withStyle(build('mesa'), 'pasante');
    const notes = p.joints.filter((j) => j.type === 'mortaja').flatMap((j) => jointNotes(p, j, String));
    expect(notes.some((n) => n.level === 'warn' && n.text.includes('pasante choca'))).toBe(true);
  });

  it('tarugada y con llave: un tarugo y una llave por espiga, de madera dura', () => {
    const t = withStyle(build('mesa'), 'tarugada');
    expect(hardwareList(t, cutPlan(t)).find((r) => r.id.startsWith('tarugo-pasante|'))?.qty).toBe(mortises(t));
    const k = withStyle(build('mesa'), 'llave');
    const keys = hardwareList(k, cutPlan(k)).filter((r) => r.id.startsWith('llave|'));
    expect(keys.reduce((n, r) => n + r.qty, 0)).toBe(mortises(k));
    // La espiga asoma: el faldón se corta más largo que con la ciega.
    const blind = build('mesa');
    const len = (p: Project) => cutList(p).find((r) => r.ids.includes('F1'))!.cut[0];
    expect(len(k) - len(blind)).toBeGreaterThan(2 * 40);
  });

  it('media caja: se cuenta en la pieza y se explica en el armado', () => {
    const p = withStyle(build('mesa'), 'ciega', { haunch: 12 });
    expect(cutList(p).find((r) => r.ids.includes('F1'))!.work).toContain('2 medias cajas');
    expect(assemblySteps(p, () => '').find((s) => s.joint === 'mortaja')!.items.some((x) => x.startsWith('Media caja:'))).toBe(true);
  });

  it('en la silla, la tarugada sigue a las patas inclinadas', () => {
    const p = withStyle(build('silla'), 'tarugada');
    const rail = p.parts.find((x) => leanFollow(p, x)?.ends.length)!;
    const f = leanFollow(p, rail)!;
    const x = followExtras(f, f.ends[0]!, rail);
    expect(x?.cutA[0]?.kind).toBe('cylinder');
    expect(x?.cutB[0]?.kind).toBe('cylinder');
  });
});

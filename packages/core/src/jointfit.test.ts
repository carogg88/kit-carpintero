import { describe, expect, it } from 'vitest';
import { jointGeometry, solidBox } from './joints';
import { fitJointDepths, jointNotes, jointRoom } from './jointfit';
import { overlapBox, partBox } from './geometry';
import { buildTemplate, TEMPLATES, templateDefaults } from './templates';
import { formatNumber } from './units';
import type { Project } from './project';

const n = (mm: number) => formatNumber(mm, 'cm');
const build = (id: string, joint?: Parameters<typeof buildTemplate>[3]) => {
  const def = TEMPLATES.find((d) => d.id === id)!;
  return buildTemplate(def, templateDefaults(def), 'guatambu', joint, '2026-10-22T00:00:00Z');
};

/** Pares de cortes de distintas uniones que se pisan adentro de una misma pieza. */
function clashes(p: Project): string[] {
  const cuts = new Map<string, { joint: string; box: ReturnType<typeof solidBox> }[]>();
  for (const j of p.joints) {
    const a = p.parts.find((x) => x.id === j.partA)!;
    const b = p.parts.find((x) => x.id === j.partB)!;
    const g = jointGeometry(j.type, partBox(a), partBox(b), j.params);
    for (const s of g?.cutA ?? []) cuts.set(a.id, [...(cuts.get(a.id) ?? []), { joint: j.id, box: solidBox(s) }]);
  }
  const out: string[] = [];
  for (const [id, cs] of cuts)
    for (let i = 0; i < cs.length; i++)
      for (let k = i + 1; k < cs.length; k++) if (cs[i]!.joint !== cs[k]!.joint && overlapBox(cs[i]!.box, cs[k]!.box)) out.push(`${id}: ${cs[i]!.joint} × ${cs[k]!.joint}`);
  return out;
}

describe('cortes que se cruzan adentro de una pieza', () => {
  it('ninguna plantilla sale con espigas o tarugos que se pisan', () => {
    for (const def of TEMPLATES)
      for (const joint of def.joints?.options ?? [undefined]) expect(clashes(build(def.id, joint)), `${def.id} ${joint}`).toEqual([]);
  });

  it('en el taburete se acorta la espiga de un faldón y la otra queda entera', () => {
    const p = build('taburete', 'mortaja');
    const front = p.joints.find((j) => j.id === 'P4-F1')!;
    const side = p.joints.find((j) => j.id === 'P4-F3')!;
    expect(front.params.length).toBe(17.5);
    expect(side.params.length).toBe(26);
    expect(jointRoom(p, front)).toMatchObject({ partId: 'P4', other: 'F3', current: 17.5, usual: 26 });
    expect(jointNotes(p, front, n)).toEqual([
      { level: 'info', text: 'Esta espiga es más corta que lo común: adentro de P4 se encuentra con la de F3. Si la querés más larga, cortales la punta a inglete a las dos.' },
    ]);
    expect(jointNotes(p, side, n)).toEqual([]);
  });

  it('avisa si alguien alarga una espiga que ya no entra', () => {
    const p = build('taburete', 'mortaja');
    const front = p.joints.find((j) => j.id === 'P4-F1')!;
    front.params.length = 26;
    expect(jointNotes(p, front, n)[0]).toEqual({
      level: 'warn',
      text: 'Adentro de P4, esta espiga choca con la de F3. Acortala a 1,7 o menos, o cortale la punta a inglete.',
    });
  });

  it('con ids, solo toca esas uniones', () => {
    const p = build('taburete', 'mortaja');
    for (const j of p.joints) if (j.type === 'mortaja') j.params.length = 26;
    fitJointDepths(p, new Set(['P1-F3']));
    expect(p.joints.find((j) => j.id === 'P1-F3')!.params.length).toBeLessThan(26);
    expect(p.joints.find((j) => j.id === 'P4-F1')!.params.length).toBe(26);
  });

  it('la mesa no se toca: sus espigas no llegan a cruzarse', () => {
    const p = build('mesa', 'mortaja');
    expect(p.joints.filter((j) => j.type === 'mortaja').map((j) => j.params.length)).toEqual(Array(8).fill(40));
  });
});

describe('espigas angostas', () => {
  it('el travesaño del taburete lleva una espiga de 2 cm, no de 1', () => {
    const p = build('taburete', 'mortaja');
    const rung = p.joints.find((j) => j.partB === 'R1')!;
    expect(rung.params.shoulder).toBe(5);
    expect(jointNotes(p, rung, n)).toEqual([]);
  });

  it('avisa si los hombros dejan la espiga muy angosta', () => {
    const p = build('taburete', 'mortaja');
    const rung = p.joints.find((j) => j.partB === 'R1')!;
    rung.params.shoulder = 10;
    expect(jointNotes(p, rung, n)).toContainEqual({ level: 'warn', text: 'La espiga queda de 1 de ancho: con menos de 1,5 se puede quebrar. Achicá los hombros.' });
  });
});

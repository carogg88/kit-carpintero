import { describe, expect, it } from 'vitest';
import { assemblySteps } from './assembly';
import { cutList, cutPlan } from './cutlist';
import { drawPart, drawView } from './drawing';
import { partBox, type Box } from './geometry';
import { hardwareList } from './hardware';
import { jointGeometry } from './joints';
import { BREADBOARD, isBreadboard } from './joints/fine';
import { applyReviewFix, panelPlay, reviewDesign, woodMovement } from './review';
import { buildTemplate, templateById } from './templates';
import { createTable, TABLE_DEFAULTS } from './templates/table';

const now = '2026-10-28T00:00:00Z';
const template = (id: string, wood = 'cedro', v: Record<string, number> = {}) => buildTemplate(templateById(id)!, v, wood, undefined, now);
const breadboardTable = () => createTable({ ...TABLE_DEFAULTS, breadboard: 1 }, 'guatambu', now);

describe('testero', () => {
  // Testero de 70 × 30 × 900 a la izquierda de una tapa de 1660 × 30 × 900.
  const cap: Box = { min: [0, 720, 0], max: [70, 750, 900] };
  const top: Box = { min: [70, 720, 0], max: [1730, 750, 900] };
  const p = { thickness: 10, depth: 25, pegs: 3 };

  it('los tarugos cruzan el testero de cara a cara, por el medio de la lengüeta', () => {
    const g = jointGeometry('machiembrado', cap, top, p)!;
    const pegs = g.extra!.cutA;
    expect(pegs).toHaveLength(3);
    for (const s of pegs) {
      if (s.kind !== 'cylinder') throw new Error('sin tarugo');
      expect(s.axis).toBe(1);
      expect(s.radius).toBe(BREADBOARD.peg / 2);
      expect(s.length).toBe(30);
      expect(s.start[0]).toBeCloseTo(70 - 12.5);
    }
    expect(pegs.map((s) => (s.kind === 'cylinder' ? s.start[2] : 0))).toEqual([50, 450, 850]);
  });

  it('en la lengüeta, el del medio redondo y los de las puntas alargados hacia afuera', () => {
    const holes = jointGeometry('machiembrado', cap, top, p)!.extra!.cutB.map((s) => (s.kind === 'cylinder' ? s.start[2] : NaN));
    expect(holes).toEqual([50, 47, 44, 450, 850, 853, 856]);
  });

  it('sin tarugos es un machimbre común', () => {
    expect(jointGeometry('machiembrado', cap, top, { thickness: 10, depth: 25 })!.extra).toBeUndefined();
    expect(isBreadboard({})).toBe(false);
    expect(isBreadboard(p)).toBe(true);
  });

  it('la mesa con testero: dos testeros con la veta cruzada, unidos a la tapa con lengüeta y tarugos', () => {
    const table = breadboardTable();
    const ids = table.parts.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['C1', 'C2']));
    expect(partBox(table.parts.find((x) => x.id === 'T1')!).min[0]).toBe(70);
    const tongues = table.joints.filter((j) => j.type === 'machiembrado');
    expect(tongues.map((j) => [j.partA, j.partB, j.params.pegs])).toEqual([
      ['C1', 'T1', 3],
      ['C2', 'T1', 3],
    ]);
    expect(reviewDesign(table).filter((n) => n.kind === 'veta' || n.kind === 'cruce')).toEqual([]);
  });

  it('en la lista de cortes, los tarugos y los agujeros ovalados; en herrajes, los tarugos', () => {
    const table = breadboardTable();
    const rows = cutList(table);
    const capRow = rows.find((r) => r.ids.includes('C1'))!;
    const topRow = rows.find((r) => r.ids.includes('T1'))!;
    expect(capRow.work.join(' ')).toMatch(/3 agujeros para tarugo/);
    expect(topRow.work.join(' ')).toMatch(/6 agujeros para tarugos, los de las puntas ovalados/);
    const pegs = hardwareList(table, cutPlan(table)).find((h) => h.id.startsWith('tarugo-testero'));
    expect(pegs?.qty).toBe(6);
  });

  it('el armado explica el testero', () => {
    const steps = assemblySteps(breadboardTable(), String);
    expect(steps.some((s) => /Presentá el testero/.test(s.text))).toBe(true);
  });
});

describe('panel flotante', () => {
  it('juego: la mitad de lo que se mueve el panel, y al menos 2 mm', () => {
    expect(panelPlay(100)).toBe(2);
    expect(panelPlay(400)).toBe(2);
    expect(panelPlay(700)).toBe(4);
  });

  it('las puertas de la alacena salen con juego y la canal más honda', () => {
    const p = template('alacena');
    const panels = p.joints.filter((j) => j.type === 'canal' && (j.params.play ?? 0) > 0);
    expect(panels.length).toBeGreaterThan(0);
    expect(reviewDesign(p).some((n) => n.id.startsWith('juego|'))).toBe(false);
    const j = panels[0]!;
    const a = partBox(p.parts.find((x) => x.id === j.partA)!);
    const b = partBox(p.parts.find((x) => x.id === j.partB)!);
    const deep = jointGeometry('canal', a, b, j.params)!;
    const shallow = jointGeometry('canal', a, b, { ...j.params, play: 0 })!;
    const size = (g: typeof deep) => {
      const s = g.cutA[0]!;
      if (s.kind !== 'box') throw new Error('sin canal');
      return s.box.max.map((v, k) => v - s.box.min[k]!);
    };
    const grew = size(deep).map((v, k) => v - size(shallow)[k]!);
    expect(Math.max(...grew)).toBeCloseTo(j.params.play!);
  });

  it('sin juego, la revisión avisa una vez por panel y el arreglo lo deja', () => {
    const p = template('alacena');
    for (const j of p.joints) delete j.params.play;
    const notes = reviewDesign(p).filter((n) => n.id.startsWith('juego|'));
    expect(notes.length).toBeGreaterThan(0);
    const note = notes[0]!;
    expect(note.title).toMatch(/^El panel no tiene juego: /);
    expect(note.action?.kind).toBe('joint');
    for (const n of notes) applyReviewFix(p, n.action!);
    expect(reviewDesign(p).some((n) => n.id.startsWith('juego|'))).toBe(false);
  });

  it('el armado dice que el panel va sin cola', () => {
    const steps = assemblySteps(template('alacena'), String);
    expect(steps.some((s) => s.items.some((i) => /El panel va sin cola/.test(i)))).toBe(true);
  });
});

describe('flechas de movimiento', () => {
  it('una tapa maciza ancha se mueve a lo ancho de la veta; una de placa o angosta no', () => {
    const table = createTable(undefined, 'guatambu', now);
    const t1 = table.parts.find((x) => x.id === 'T1')!;
    expect(woodMovement(t1)).toEqual({ axis: 2, width: 900, mm: 9 });
    expect(woodMovement({ ...t1, wood: 'mdf' })).toBeNull();
    expect(woodMovement(table.parts.find((x) => x.id === 'F1')!)).toBeNull();
  });

  it('en la planta, la flecha de la tapa va de adelante a atrás; en el frente, que la ve de canto, no hay', () => {
    const table = createTable(undefined, 'guatambu', now);
    const top = drawView(table, 'top');
    expect(top.moves).toEqual([expect.objectContaining({ id: 'T1', along: 'v', mm: 9 })]);
    expect(drawView(table, 'front').moves).toBeUndefined();
  });

  it('en el despiece, la tapa lleva su flecha a lo ancho', () => {
    const table = createTable(undefined, 'guatambu', now);
    const d = drawPart(table, table.parts.find((x) => x.id === 'T1')!);
    expect(d.moves).toEqual([expect.objectContaining({ along: 'v', mm: 9 })]);
  });
});

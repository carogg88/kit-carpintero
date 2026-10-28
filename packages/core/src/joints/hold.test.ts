import { describe, expect, it } from 'vitest';
import { partBox, type Box } from '../geometry';
import { applyReviewFix, holdTops, reviewDesign } from '../review';
import { createTable } from '../templates/table';
import { solidBox } from './common';
import { jointGeometry } from './index';
import { bestHold, buttonBlocks, FIGURE8, holdCount, holdFits, holdGeometry, HOLDS, holdOf, plainJoint } from './hold';

// Tapa de 1800 × 22 × 900 y faldón delantero de 1600 × 95 × 22, con la cara de adentro hacia atrás (z chico).
const top: Box = { min: [0, 728, 0], max: [1800, 750, 900] };
const apron: Box = { min: [100, 633, 816], max: [1700, 728, 838] };
const leg: Box = { min: [30, 0, 30], max: [100, 728, 100] };

describe('sujeción de la tapa', () => {
  it('botones: una ranura en la cara de adentro del faldón, a 12 mm de la tapa y 25 mm antes de cada punta', () => {
    const g = holdGeometry(top, apron, 'botones');
    expect(g.cutA).toEqual([]);
    expect(g.cutB).toHaveLength(1);
    const s = solidBox(g.cutB[0]!);
    expect(s.max[1]).toBe(728 - 12);
    expect(s.min[1]).toBe(728 - 18);
    expect([s.min[2], s.max[2]]).toEqual([816, 824]);
    expect([s.min[0], s.max[0]]).toEqual([125, 1675]);
    expect(holdCount(top, apron, 'botones')).toBe(6);
  });

  it('grampas en 8: un rebaje redondo en el canto de arriba, del lado de adentro', () => {
    const g = holdGeometry(top, apron, 'grampas');
    expect(g.cutB).toHaveLength(holdCount(top, apron, 'grampas'));
    const c = g.cutB[0]!;
    expect(c.kind).toBe('cylinder');
    if (c.kind !== 'cylinder') return;
    expect(c.radius).toBe(FIGURE8.radius);
    expect(c.start[1]).toBe(728);
    expect(c.dir).toBe(-1);
    // El ojo, 8 mm adentro de la cara de adentro: la mitad de la grampa asoma hacia la tapa.
    expect(c.start[2]).toBe(824);
  });

  it('tornillos en agujero ovalado: avellanado y la guía repetida, corrida hacia donde se mueve la tapa', () => {
    const g = holdGeometry(top, apron, 'ovalados');
    const n = holdCount(top, apron, 'ovalados');
    expect(g.cutB).toHaveLength(3 * n);
    const [, g1, g2] = g.cutB;
    if (g1?.kind !== 'bore' || g2?.kind !== 'bore') throw new Error('sin agujeros');
    // La tapa se mueve en z (su ancho): ahí se corre la guía.
    expect(g2.start[2] - g1.start[2]).toBeCloseTo(4);
    expect(g2.start[0]).toBeCloseTo(g1.start[0]);
  });

  it('en una pata no entran botones ni grampas', () => {
    expect(holdFits(top, leg, 'botones')).toBe(false);
    expect(holdFits(top, leg, 'grampas')).toBe(false);
    expect(bestHold(top, leg)).toBeNull();
    expect(bestHold(top, apron)).toBe('botones');
    expect(holdGeometry(top, leg, 'botones').cutB).toEqual([]);
  });

  it('a tope sin sujeción, encolada o con tornillos no lleva cortes', () => {
    for (const hold of ['libre', 'cola', 'tornillos'] as const) {
      const params = { hold: HOLDS.indexOf(hold) };
      expect(jointGeometry('tope', top, apron, params)?.cutB).toEqual([]);
      expect(plainJoint({ type: 'tope', params })).toBe(true);
    }
    expect(plainJoint({ type: 'tope', params: { hold: HOLDS.indexOf('botones') } })).toBe(false);
    expect(holdOf({})).toBe('libre');
  });
});

describe('la tapa en la revisión', () => {
  it('la mesa nueva lleva botones en los faldones y no tiene aviso de veta', () => {
    const table = createTable(undefined, 'guatambu', '2026-10-28T00:00:00Z');
    const holds = table.joints.filter((j) => j.type === 'tope').map((j) => [j.partB, holdOf(j.params)]);
    expect(holds.filter(([, h]) => h === 'botones').map(([id]) => id)).toEqual(['F1', 'F2', 'F3', 'F4']);
    expect(holds.filter(([id]) => id!.startsWith('P')).every(([, h]) => h === 'libre')).toBe(true);
    expect(reviewDesign(table).filter((n) => n.kind === 'veta')).toEqual([]);
  });

  it('una mesa de antes, con la tapa apoyada sin decir cómo, tiene un aviso con el arreglo para los cuatro faldones', () => {
    const table = createTable(undefined, 'guatambu', '2026-10-28T00:00:00Z');
    for (const j of table.joints) delete j.params.hold;
    const notes = reviewDesign(table).filter((n) => n.kind === 'veta');
    expect(notes).toHaveLength(1);
    const note = notes[0]!;
    expect(note.title).toBe('La tapa no se puede mover: Tapa');
    expect(note.action).toMatchObject({ kind: 'joint', params: { hold: HOLDS.indexOf('botones') }, label: 'Sujetar con botones de madera' });
    if (note.action?.kind !== 'joint') return;
    expect(note.action.joints.sort()).toEqual(['T1-F1', 'T1-F2', 'T1-F3', 'T1-F4']);
    applyReviewFix(table, note.action);
    expect(reviewDesign(table).filter((n) => n.kind === 'veta')).toEqual([]);
  });

  it('encolada a los faldones también avisa', () => {
    const table = createTable(undefined, 'guatambu', '2026-10-28T00:00:00Z');
    for (const j of table.joints) if (j.type === 'tope') j.params.hold = HOLDS.indexOf('cola');
    expect(reviewDesign(table).some((n) => n.id === 'veta-tapa|T1')).toBe(true);
  });

  it('holdTops no toca una sujeción elegida ni las tapas de placa', () => {
    const table = createTable(undefined, 'guatambu', '2026-10-28T00:00:00Z');
    const f1 = table.joints.find((j) => j.id === 'T1-F1')!;
    f1.params.hold = HOLDS.indexOf('grampas');
    holdTops(table);
    expect(holdOf(f1.params)).toBe('grampas');
    const mdf = createTable(undefined, 'guatambu', '2026-10-28T00:00:00Z');
    mdf.parts.find((p) => p.id === 'T1')!.wood = 'mdf';
    for (const j of mdf.joints) delete j.params.hold;
    holdTops(mdf);
    expect(mdf.joints.every((j) => holdOf(j.params) === 'libre')).toBe(true);
    expect(partBox(mdf.parts[0]!).max[1]).toBe(750);
  });
});

describe('los botones en el detalle', () => {
  it('cada botón: el cuerpo contra la tapa, del lado de adentro, y la lengüeta en la ranura sin llegar al fondo', () => {
    const blocks = buttonBlocks(top, apron);
    expect(blocks).toHaveLength(2 * holdCount(top, apron, 'botones'));
    const [body, tongue] = blocks as [Box, Box];
    expect(body.max[1]).toBe(728);
    expect(body.max[2]).toBe(814);
    expect(tongue.min[2]).toBe(814);
    expect(tongue.max[2]).toBe(822);
    expect(tongue.max[1]).toBeLessThan(716);
    expect(buttonBlocks(top, leg)).toEqual([]);
  });
});

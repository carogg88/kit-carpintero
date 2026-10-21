import { afterEach, describe, expect, it } from 'vitest';
import { describeBevel } from './bevels';
import { cutList, cutPiece } from './cutlist';
import { setLang, hasMessage } from './i18n';
import { describePocket } from './pockets';
import { describeSection } from './sections';
import { buildTemplate, templateById } from './templates';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const mm = (n: number) => `${Math.round(n * 10) / 10} mm`;

describe('textos del núcleo en inglés', () => {
  afterEach(() => setLang('es'));

  it('describe vaciados, biseles y tramos en inglés', () => {
    setLang('en');
    const top = table.parts.find((p) => p.id === 'T1')!;
    expect(describePocket({ id: 'V1', axis: 1, side: 1, shape: { kind: 'circle', u: 50, v: 50, d: 60 }, depth: 10, through: true }, mm)).toBe(
      'through hole Ø 60 mm in the top face',
    );
    expect(describeBevel(top, { id: 'B1', a: { axis: 1, side: 1 }, b: { axis: 2, side: 1 }, da: 12, db: 6, round: false }, mm)).toBe(
      'bevel 12 mm × 6 mm at 26.6° between the top face and the front',
    );
    expect(describeSection({ id: 'S1', axis: 1, from: 0, to: 150, size: [90, 90] }, mm)).toBe('section 90 mm × 90 mm, 0 mm to 150 mm from the bottom');
  });

  it('arma la lista de cortes y las plantillas en inglés', () => {
    setLang('en');
    const leg = table.parts.find((p) => p.id === 'P1')!;
    expect(cutPiece(leg, table).work).toEqual(['2 mortises', 'rounded edges 3 mm']);
    const rows = cutList(table);
    expect(rows.find((r) => r.ids.includes('T1'))?.work[0]).toBe('glue up 7 boards');
    const p = buildTemplate(templateById('mesa')!, {}, 'guatambu', 'mortaja', '2026-10-21T00:00:00Z');
    expect(p.name).toBe('Dining table');
    expect(p.parts.find((x) => x.id === 'P1')?.name).toBe('Leg (back left)');
    expect(p.joints.filter((j) => j.type === 'mortaja')).toHaveLength(8);
    expect(p.components.map((c) => c.name)).toEqual(['Leg', 'Apron', 'Apron 2']);
    expect(cutList(p).map((r) => r.name)).toContain('Leg');
  });

  it('en español no cambia nada', () => {
    const leg = table.parts.find((p) => p.id === 'P1')!;
    expect(cutPiece(leg, table).work).toEqual(['2 mortajas', 'cantos redondeados 3 mm']);
    expect(hasMessage('2 mortajas')).toBe(false);
  });
});

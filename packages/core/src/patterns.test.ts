import { describe, expect, it } from 'vitest';
import { newBevel } from './bevels';
import { facePattern, patternDetails, shapeBounds, shapePlace } from './patterns';
import { newPocket } from './pockets';
import type { Part } from './project';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');
const top = table.parts.find((p) => p.id === 'T1')!;
const mm = (n: number) => `${Math.round(n * 10) / 10} mm`;
const left = { axis: 0, side: -1 } as const;
const right = { axis: 0, side: 1 } as const;
const front = { axis: 2, side: 1 } as const;
const back = { axis: 2, side: -1 } as const;
const up = { axis: 1, side: 1 } as const;

const withBevels = (p: Part, ...b: Part['bevels']): Part => ({ ...p, bevels: b.map((x, i) => ({ ...x, id: `B${i + 1}` })) });

describe('plantillas de calco', () => {
  it('una tabla sin curvas ni calados no necesita plantilla', () => {
    expect(facePattern(top, mm)).toBeNull();
    // Un bisel de canto se hace con la fresa: tampoco.
    expect(facePattern(withBevels(top, newBevel(top, up, front, 10, true)), mm)).toBeNull();
  });

  it('la tapa se ve desde arriba, acostada, con el frente abajo', () => {
    const p = facePattern(withBevels(top, newBevel(top, left, front, 50, true)), mm)!;
    expect(p).toMatchObject({ axis: 1, side: 1, width: 1800, height: 900 });
    expect(p.edges.bottom).toEqual(front);
    expect(p.edges.top).toEqual(back);
    expect(p.edges.left).toEqual(left);
  });

  it('la esquina redondeada queda en su lugar: la de adelante a la izquierda abajo a la izquierda', () => {
    const p = facePattern(withBevels(top, newBevel(top, left, front, 50, true)), mm)!;
    const [sh] = p.shapes;
    expect(sh).toMatchObject({ source: 'bevel', kind: 'cut', curve: true, anchor: [0, 0] });
    const b = shapeBounds(sh!.points);
    expect(b.u0).toBeCloseTo(0);
    expect(b.v0).toBeCloseTo(0);
    expect(b.u1).toBeCloseTo(50);
    expect(b.v1).toBeCloseTo(50);
    // El arco pasa a r del centro de la curva.
    const arc = sh!.points.slice(0, -1);
    for (const [x, y] of arc) expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(50);
  });

  it('las cuatro esquinas iguales salen en una sola plantilla de detalle', () => {
    const p = facePattern(
      withBevels(
        top,
        newBevel(top, left, front, 50, true),
        newBevel(top, right, front, 50, true),
        newBevel(top, left, back, 50, true),
        newBevel(top, right, back, 50, true),
      ),
      mm,
    )!;
    const d = patternDetails(p);
    expect(d).toHaveLength(1);
    expect(d[0]!.shapes[0]!.count).toBe(4);
    // Con margen para ver los dos bordes que la ubican.
    expect(d[0]!.b.u1 - d[0]!.b.u0).toBeGreaterThan(60);
  });

  it('un calado cuenta, y se ubica desde los bordes más cercanos', () => {
    const part: Part = { ...top, pockets: [newPocket(top, 1, 1, { kind: 'circle', u: 1700, v: 800, d: 35 })] };
    const p = facePattern(part, mm)!;
    const [sh] = p.shapes;
    expect(sh).toMatchObject({ source: 'pocket', kind: 'cut', curve: true });
    // A 100 de la derecha y, con el frente abajo, a 100 del frente.
    expect(sh!.circle!.c[0]).toBeCloseTo(1700);
    expect(sh!.circle!.c[1]).toBeCloseTo(100);
    expect(shapePlace(p, sh!.circle!.c, mm)).toBe('a 100 mm de la cara derecha y a 100 mm del frente');
  });

  it('un vaciado del otro lado se mira desde ese lado', () => {
    const pk = { ...newPocket(top, 1, -1, { kind: 'circle', u: 300, v: 300, d: 60 }), through: false };
    const p = facePattern({ ...top, pockets: [pk] }, mm)!;
    expect(p.side).toBe(-1);
    expect(p.shapes[0]!.kind).toBe('pocket');
    // Desde abajo el frente queda arriba.
    expect(p.edges.top).toEqual(front);
  });

  it('una pieza parada se acuesta: el lado largo va a lo ancho', () => {
    const side: Part = { ...top, base: { kind: 'box', size: [18, 700, 400] } };
    const p = facePattern(withBevels(side, newBevel(side, up, front, 40, true)), mm)!;
    expect(p).toMatchObject({ axis: 0, width: 700, height: 400 });
    expect(p.edges.right.axis).toBe(1);
  });

  it('las que se pisan van juntas; los arcos sueltos tienen su propia plantilla', () => {
    const part: Part = {
      ...withBevels(top, newBevel(top, left, front, 50, true)),
      pockets: [
        newPocket(top, 1, 1, { kind: 'circle', u: 70, v: 830, d: 20 }),
        newPocket(top, 1, 1, { kind: 'arc', u: 600, v: 0, u2: 1200, v2: 0, bulge: 60, outside: false }),
      ],
    };
    const d = patternDetails(facePattern(part, mm)!);
    expect(d).toHaveLength(1);
    expect(d[0]!.shapes).toHaveLength(2);
  });
});

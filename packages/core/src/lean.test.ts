import { describe, expect, it } from 'vitest';
import { cutPiece } from './cutlist';
import { mirrorPart } from './edit';
import { isLeaning, leanedBox, leanFrame, leanPoint } from './lean';
import { createSplayedBench, createSplayedStool, leanTestStool } from './templates/leanTest';
import { leanFollow } from './follow';
import { drawPart, drawView } from './drawing';
import type { Part } from './project';

const leg = (lean?: [number, number]): Part => ({
  id: 'P1',
  name: 'Pata',
  wood: 'guatambu',
  base: { kind: 'box', size: [40, 400, 30] },
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  ops: [],
  pockets: [],
  bevels: [],
  sections: [],
  ...(lean ? { lean } : {}),
});
const rad = (d: number) => (d * Math.PI) / 180;

describe('patas inclinadas', () => {
  it('derecha o en cero no se inclina', () => {
    expect(leanFrame(leg())).toBeNull();
    expect(leanFrame(leg([0, 0]))).toBeNull();
    // Una pieza acostada (un travesaño) no se inclina en esta prueba.
    expect(isLeaning({ ...leg([8, 0]), base: { kind: 'box', size: [400, 40, 30] } })).toBe(false);
  });

  it('inclinada de frente: madera más larga y puntas al mismo ángulo', () => {
    const f = leanFrame(leg([10, 0]))!;
    expect(f.tilt).toBeCloseTo(10, 6);
    // De punta larga a punta larga: el alto sobre el coseno más el ancho por la tangente.
    expect(f.length).toBeCloseTo(400 / Math.cos(rad(10)) + 40 * Math.tan(rad(10)), 6);
    expect(f.cut[0]).toBeCloseTo(10, 6);
    expect(f.cut[1]).toBeCloseTo(0, 6);
    // La punta de abajo se va hacia la derecha: tan(10°) por el alto.
    const foot = leanPoint(f, [20, 400 - 400 / Math.cos(rad(10)), 15]);
    expect(foot[0] - 20).toBeCloseTo(400 * Math.tan(rad(10)), 6);
    expect(foot[1]).toBeCloseTo(0, 6);
    expect(foot[2]).toBeCloseTo(15, 6);
  });

  it('vista de frente y de costado se ven los dos ángulos pedidos', () => {
    const f = leanFrame(leg([8, -6]))!;
    expect(Math.atan(f.dir[0] / -f.dir[1]) * (180 / Math.PI)).toBeCloseTo(8, 6);
    expect(Math.atan(f.dir[2] / -f.dir[1]) * (180 / Math.PI)).toBeCloseTo(-6, 6);
    // Inclinada en dos sentidos se aparta más que cada ángulo por separado.
    expect(f.tilt).toBeGreaterThan(8);
  });

  it('la caja de la pata inclinada llega al piso corrida', () => {
    const b = leanedBox(leg([10, 0]));
    expect(b.min[1]).toBe(0);
    expect(b.max[1]).toBe(400);
    expect(b.max[0]).toBeCloseTo(20 + 400 * Math.tan(rad(10)) + 20 / Math.cos(rad(10)), 6);
    expect(b.min[0]).toBeCloseTo(20 - 20 / Math.cos(rad(10)), 6);
  });

  it('la lista de cortes pide el largo de punta a punta y el ángulo de las puntas', () => {
    const p = leg([10, 0]);
    const c = cutPiece(p, { parts: [p], joints: [] } as never);
    expect(c.cut[0]).toBeCloseTo(leanFrame(p)!.length, 6);
    expect(c.work).toContain('puntas cortadas paralelas, a 10°: falsa escuadra a 80° del canto');
  });

  it('la gemela se abre hacia el otro lado', () => {
    const stool = leanTestStool('guatambu', '2026-10-26T00:00:00Z');
    const p1 = stool.parts.find((p) => p.id === 'P1')!;
    const others = stool.parts.filter((p) => p.id !== 'P2');
    const twin = mirrorPart(others, p1)!;
    expect(twin.part.lean).toEqual(stool.parts.find((p) => p.id === 'P2')!.lean);
  });

  it('el taburete de patas abiertas: patas en el asiento con mortaja y espiga', () => {
    const stool = leanTestStool('guatambu', '2026-10-26T00:00:00Z');
    const legs = stool.parts.filter((p) => p.id.startsWith('P'));
    expect(legs).toHaveLength(4);
    expect(legs.every(isLeaning)).toBe(true);
    expect(stool.joints.filter((j) => j.type === 'mortaja' && j.partA === 'S1')).toHaveLength(4);
    // Cada pata se abre hacia su esquina.
    for (const p of legs) {
      const b = leanedBox(p);
      const cx = (b.min[0] + b.max[0]) / 2 - 180;
      const cz = (b.min[2] + b.max[2]) / 2 - 180;
      expect(Math.sign(cx)).toBe(Math.sign(p.lean![0]));
      expect(Math.sign(cz)).toBe(Math.sign(p.lean![1]));
    }
  });

  it('el banco rústico: patas metidas desde las puntas, más abiertas hacia los costados', () => {
    const bench = createSplayedBench({}, 'guatambu', '2026-10-27T00:00:00Z');
    const legs = bench.parts.filter((p) => p.id.startsWith('P'));
    expect(legs.every(isLeaning)).toBe(true);
    for (const p of legs) {
      expect(Math.abs(p.lean![1])).toBeGreaterThan(Math.abs(p.lean![0]));
      // A lo largo, la pata queda metida un octavo del largo desde la punta.
      const x = p.position[0] < 450 ? p.position[0] : 900 - p.position[0] - 45;
      expect(x).toBe(113);
    }
    // Con la opción de siempre, solo los travesaños de las puntas, de adelante hacia atrás.
    const rungs = bench.parts.filter((p) => p.id.startsWith('R'));
    expect(rungs.map((p) => p.id)).toEqual(['R3', 'R4']);
    expect(bench.joints.filter((j) => j.type === 'mortaja' && j.partA === 'S1')).toHaveLength(4);
    expect(bench.joints.filter((j) => j.partB.startsWith('R') || j.partA.startsWith('R'))).toHaveLength(4);
  });
});

describe('travesaños entre patas inclinadas', () => {
  const stool = createSplayedStool({ splay: 3 }, 'guatambu', '2026-10-26T00:00:00Z');

  it('el travesaño de adelante se corre hacia adelante y se estira hasta las patas', () => {
    const r1 = stool.parts.find((p) => p.id === 'R1')!;
    const f = leanFollow(stool, r1)!;
    expect(f.ends).toHaveLength(2);
    expect(f.axis).toBe(0);
    const a = rad(10);
    const legTop = 450 - 40;
    const y = 150 + 15;
    // A la altura del travesaño, cada pata se corrió (alto que falta hasta arriba) × tan(ángulo).
    const drop = legTop - y;
    expect(f.shift[2]).toBeCloseTo(drop * Math.tan(a), 6);
    expect(f.shift[0]).toBe(0);
    // Sobre el eje del travesaño la cara de la pata inclinada (en dos sentidos) queda un poco más afuera que la derecha.
    const straight = 360 - 2 * (60 + 40);
    const center = f.ends[0]!.face - f.ends[1]!.face;
    expect(Math.abs(center)).toBeGreaterThan(straight + 2 * drop * Math.tan(a) - 1);
    // De punta larga a punta larga suma el hombro en ángulo de cada lado.
    expect(f.length).toBeGreaterThan(Math.abs(center));
    for (const e of f.ends) {
      expect(e.shoulder[0]).toBeGreaterThan(9);
      expect(e.shoulder[0]).toBeLessThan(11);
      expect(e.shoulder[1]).toBeGreaterThan(0);
    }
  });

  it('la lista de cortes pide el largo nuevo, las espigas y los hombros en ángulo', () => {
    const r1 = stool.parts.find((p) => p.id === 'R1')!;
    const f = leanFollow(stool, r1)!;
    const c = cutPiece(r1, stool);
    expect(c.tongues).toBe(2);
    expect(c.cut[0]).toBeGreaterThan(f.length);
    expect(c.work.some((w) => w.startsWith('hombros en ángulo'))).toBe(true);
  });

  it('una pieza que no entra en patas inclinadas no se mueve', () => {
    const straight = createSplayedStool({ splay: 0 }, 'guatambu', '2026-10-26T00:00:00Z');
    const flat = { ...straight, parts: straight.parts.map((p) => ({ ...p, lean: undefined })) };
    expect(leanFollow(flat, flat.parts.find((p) => p.id === 'R1')!)).toBeNull();
    expect(leanFollow(stool, stool.parts.find((p) => p.id === 'S1')!)).toBeNull();
  });
});

describe('despiece de piezas inclinadas', () => {
  const stool = createSplayedStool({ splay: 3 }, 'guatambu', '2026-10-26T00:00:00Z');

  it('la pata se dibuja derecha, de punta larga a punta larga, con el ángulo de la falsa escuadra', () => {
    const leg = stool.parts.find((p) => p.id === 'P3')!;
    const f = leanFrame(leg)!;
    const d = drawPart(stool, leg);
    expect(d.engine?.local).toBe('P3');
    // El largo de la pata (sin la espiga, que sobresale arriba) va a lo ancho del dibujo.
    expect(d.rects[0]!.rect.u1 - d.rects[0]!.rect.u0).toBeCloseTo(f.length, 6);
    expect(d.angles).toHaveLength(2);
    for (const m of d.angles!) expect(m.deg).toBeCloseTo(90 - f.cut[0], 6);
  });

  it('el travesaño se dibuja con los hombros en ángulo', () => {
    const r1 = stool.parts.find((p) => p.id === 'R1')!;
    const fl = leanFollow(stool, r1)!;
    const d = drawPart(stool, r1);
    expect(d.engine?.local).toBeUndefined();
    expect(d.angles).toHaveLength(2);
    for (const m of d.angles!) expect(m.deg).toBeCloseTo(90 - fl.ends[0]!.shoulder[0], 6);
  });

  it('en las vistas generales la pata ocupa su lugar inclinado', () => {
    const d = drawView(stool, 'front');
    const p3 = d.rects.find((r) => r.id === 'P3')!.rect;
    expect(p3.u1).toBeCloseTo(leanedBox(stool.parts.find((p) => p.id === 'P3')!).max[0], 6);
  });
});

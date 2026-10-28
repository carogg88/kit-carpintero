import { describe, expect, it } from 'vitest';
import { assemblySteps } from './assembly';
import { buildOffsets, buildSteps } from './build';
import { placedBox } from './follow';
import type { Box, Vec3 } from './geometry';
import { buildTemplate, templateById } from './templates';

const make = (id: string) => buildTemplate(templateById(id)!, {}, 'guatambu', undefined, '2026-10-28T00:00:00Z');
const moved = (b: Box, o: Vec3): Box => ({ min: b.min.map((v, k) => v + o[k]!) as Vec3, max: b.max.map((v, k) => v + o[k]!) as Vec3 });
function shared(a: Box, b: Box): number {
  let v = 1;
  for (let k = 0; k < 3; k++) {
    const e = Math.min(a.max[k]!, b.max[k]!) - Math.max(a.min[k]!, b.min[k]!);
    if (e <= 0.01) return 0;
    v *= e;
  }
  return v;
}

describe('orden de armado', () => {
  for (const id of ['mesa', 'taburete', 'cajonera', 'alacena', 'silla', 'banco-rustico']) {
    describe(id, () => {
      const p = make(id);
      const steps = buildSteps(p);
      const boxes = new Map(p.parts.map((x) => [x.id, placedBox(p, x)]));

      it('cada pieza entra una vez, sin forzar ninguna', () => {
        const leaves = steps.filter((s) => s.parts.length === 1 || s.kind === 'base').flatMap((s) => s.parts);
        expect(leaves.sort()).toEqual(p.parts.map((x) => x.id).sort());
        expect(steps.filter((s) => s.forced)).toEqual([]);
      });

      it('ninguna pieza atraviesa a otra en su camino', () => {
        const done = new Map<string, Set<string>>();
        for (const s of steps) {
          const here = done.get(s.unit) ?? new Set<string>();
          const still = [...here].filter((x) => !s.parts.includes(x));
          for (let f = 0; f <= 1; f += 0.125) {
            const off = s.dir.map((v) => -v * s.distance * (1 - f)) as Vec3;
            for (const m of s.parts)
              for (const o of still) {
                const end = shared(boxes.get(m)!, boxes.get(o)!);
                expect(shared(moved(boxes.get(m)!, off), boxes.get(o)!), `${s.key}: ${m} contra ${o} al ${f}`).toBeLessThanOrEqual(end * 1.002 + 60);
              }
          }
          s.parts.forEach((x) => here.add(x));
          done.set(s.unit, here);
        }
      });

      it('separado, cada unión queda abierta; armado, todo en su lugar', () => {
        const apart = buildOffsets(steps, 0);
        for (const j of p.joints) {
          const a = moved(boxes.get(j.partA)!, apart.get(j.partA)!);
          const b = moved(boxes.get(j.partB)!, apart.get(j.partB)!);
          expect(shared(a, b), j.id).toBe(0);
        }
        for (const o of buildOffsets(steps, steps.length).values()) expect(o).toEqual([0, 0, 0]);
      });
    });
  }

  it('mesa: empieza por una pata y la tapa baja al final', () => {
    const steps = buildSteps(make('mesa'));
    expect(steps[0]!.kind).toBe('base');
    expect(steps[0]!.parts[0]).toMatch(/^P/);
    expect(steps.at(-1)).toMatchObject({ parts: ['T1'], dir: [0, -1, 0], rests: true });
    // Un pie entero se arma aparte y entra a lo largo de los faldones largos.
    const part = steps.find((s) => s.kind === 'parte')!;
    expect(part.parts).toHaveLength(3);
    expect(Math.abs(part.dir[0])).toBe(1);
  });

  it('cajonera: cada cajón se arma aparte y entra desde adelante', () => {
    const drawers = buildSteps(make('cajonera')).filter((s) => s.kind === 'cajon');
    expect(drawers).toHaveLength(4);
    for (const d of drawers) expect(d.dir).toEqual([0, 0, -1]);
  });

  it('silla: las patas abiertas entran juntas en el asiento, y el respaldo a lo largo de su inclinación', () => {
    const steps = buildSteps(make('silla'));
    const seat = steps.find((s) => s.parts.includes('S1'))!;
    expect(seat.forced).toBeUndefined();
    const back = steps.find((s) => s.parts.includes('B1') && s.unit === 'mueble')!;
    expect(back.dir[1]).toBeLessThan(-0.9);
    expect(Math.abs(back.dir[2])).toBeGreaterThan(0.1);
  });

  it('presentar en seco dice el orden, con la base primero', () => {
    const p = make('mesa');
    const dry = assemblySteps(p, () => '').find((s) => s.kind === 'seco')!;
    expect(dry.items).toHaveLength(buildSteps(p).filter((s) => s.unit === 'mueble').length);
    expect(dry.items[0]).toContain('es la base');
    expect(dry.items.at(-1)).toContain('apoya en lo ya armado');
  });
});

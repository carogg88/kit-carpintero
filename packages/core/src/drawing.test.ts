import { describe, expect, it } from 'vitest';
import { clipSegment, drawItems, drawJointDetail, drawPart, drawView, engineCamera, engineViewKey, VIEWS, withEngineLines } from './drawing';
import { createTable } from './templates/table';

const table = createTable(undefined, 'guatambu', '2026-10-21T00:00:00Z');

describe('dibujo técnico', () => {
  it('una caja tapada en parte por otra más cercana tiene líneas ocultas', () => {
    const d = drawItems(
      [
        { id: 'atras', box: { min: [0, 0, 0], max: [100, 100, 10] } },
        { id: 'adelante', box: { min: [50, 20, 20], max: [200, 80, 30] } },
      ],
      VIEWS.front,
    );
    const hidden = d.lines.filter((l) => l.hidden);
    expect(hidden).toEqual([{ a: [100, 20], b: [100, 80], hidden: true, joint: false }]);
    expect(d.labels.map((l) => l.id)).toEqual(['atras', 'adelante']);
  });

  it('las vistas de la mesa miden lo que la mesa', () => {
    const size = (v: 'front' | 'side' | 'top') => {
      const b = drawView(table, v).bounds;
      return [Math.round(b.u1 - b.u0), Math.round(b.v1 - b.v0)];
    };
    expect(size('front')).toEqual([1800, 750]);
    expect(size('side')).toEqual([900, 750]);
    expect(size('top')).toEqual([1800, 900]);
  });

  it('las espigas quedan ocultas dentro de las patas en el frente', () => {
    const d = drawView(table, 'front');
    expect(d.lines.some((l) => l.joint && l.hidden)).toBe(true);
  });

  it('el despiece del faldón muestra las dos espigas', () => {
    const f1 = table.parts.find((p) => p.id === 'F1')!;
    const d = drawPart(table, f1);
    expect(Math.round(d.bounds.u1 - d.bounds.u0)).toBe(1680);
    // Las dos espigas y la ranura de los botones de la tapa.
    expect(d.joints.length).toBe(3);
  });

  it('el detalle de una mortaja tiene dos vistas con la espiga', () => {
    const j = table.joints.find((x) => x.type === 'mortaja')!;
    const d = drawJointDetail(table, j.id);
    expect(d?.views.length).toBe(2);
    expect(d?.views.every((v) => v.joints.length > 0)).toBe(true);
  });

  it('la cámara del motor mira desde el lado de quien mira y da vuelta v solo si hace falta', () => {
    expect(engineCamera(VIEWS.front)).toEqual({ dir: [0, 0, 1], xAxis: [1, 0, 0], flipV: false });
    expect(engineCamera(VIEWS.side).flipV).toBe(false);
    expect(engineCamera(VIEWS.top).flipV).toBe(false);
    // Largo en X, ancho en Z, espesor en Y: mirando desde +Y con X a la derecha, "arriba" del motor es -Z.
    expect(engineCamera({ u: 0, uSign: 1, v: 2, vSign: 1, depth: 1, depthSign: 1 }).flipV).toBe(true);
  });

  it('recorta tramos oblicuos a la ventana', () => {
    const w = { u0: 0, v0: 0, u1: 10, v1: 10 };
    const l = { a: [-5, 5] as [number, number], b: [15, 5] as [number, number], hidden: false, joint: false };
    expect(clipSegment(l, w)).toEqual({ ...l, a: [0, 5], b: [10, 5] });
    expect(clipSegment({ ...l, a: [-5, -5], b: [5, 5] }, w)?.a).toEqual([0, 0]);
    expect(clipSegment({ ...l, a: [20, 0], b: [30, 10] }, w)).toBeNull();
  });

  it('las líneas del motor reemplazan a las de cajas y ajustan el borde del dibujo', () => {
    const d = drawView(table, 'front');
    expect(d.engine?.parts.length).toBe(table.parts.length);
    const e = withEngineLines(d, [0, 0, 100, 0, 0, 0, 0, 50], [0, 1]);
    expect(e.lines).toEqual([
      { a: [0, 0], b: [100, 0], hidden: false, joint: false },
      { a: [0, 0], b: [0, 50], hidden: true, joint: false },
    ]);
    expect(e.bounds).toEqual({ u0: 0, v0: 0, u1: 100, v1: 50 });
    expect(e.labels).toBe(d.labels);
  });

  it('el pedido al motor cambia solo si cambian sus piezas', () => {
    const d = drawPart(table, table.parts[0]!).engine!;
    const moved = { ...table, parts: table.parts.map((p, i) => (i === 0 ? { ...p, name: 'Otro nombre', wood: 'cedro' } : p)) };
    expect(engineViewKey(moved, d)).toBe(engineViewKey(table, d));
    const grown = { ...table, parts: table.parts.map((p, i) => (i === 0 && p.base.kind === 'box' ? { ...p, base: { ...p.base, size: [p.base.size[0] + 1, p.base.size[1], p.base.size[2]] as [number, number, number] } } : p)) };
    expect(engineViewKey(grown, d)).not.toBe(engineViewKey(table, d));
  });
});

describe('corte A-A de una unión oculta', () => {
  const mortise = table.joints.find((j) => j.type === 'mortaja')!;

  it('la mortaja ciega lleva corte: la pata rayada, la espiga adentro y el hueco del fondo', () => {
    const sec = drawJointDetail(table, mortise.id)!.section!;
    expect(sec).toBeDefined();
    expect(sec.areas.map((x) => x.kind)).toEqual(expect.arrayContaining(['a', 'void', 'b']));
    const hole = sec.areas.find((x) => x.kind === 'void')!.rect;
    const tenon = sec.areas.filter((x) => x.kind === 'b').map((x) => x.rect);
    // La mortaja es más honda que la espiga: queda un hueco que ninguna parte de la otra pieza llena.
    const along = (r: { u0: number; u1: number }) => r.u1 - r.u0;
    expect(Math.max(along(hole), hole.v1 - hole.v0)).toBeGreaterThan(Math.min(...tenon.map(along)));
    // Los códigos van en la madera de cada pieza, no sobre la espiga.
    const leg = sec.labels.find((l) => l.id === mortise.partA)!;
    const inside = (r: { u0: number; v0: number; u1: number; v1: number }) => leg.at[0] > r.u0 && leg.at[0] < r.u1 && leg.at[1] > r.v0 && leg.at[1] < r.v1;
    expect(tenon.some(inside) || inside(hole)).toBe(false);
  });

  it('la línea del corte se marca en la otra vista, dentro del dibujo', () => {
    const d = drawJointDetail(table, mortise.id)!;
    const { view, along, at } = d.section!.cut;
    const b = d.views[view]!.bounds;
    expect(view).toBe(1);
    const [lo, hi] = along === 'u' ? [b.v0, b.v1] : [b.u0, b.u1];
    expect(at).toBeGreaterThan(lo);
    expect(at).toBeLessThan(hi);
  });

  it('una mortaja pasante se ve de afuera: sin corte', () => {
    const p = { ...table, joints: table.joints.map((j) => (j.id === mortise.id ? { ...j, params: { ...j.params, style: 1 } } : j)) };
    expect(drawJointDetail(p, mortise.id)!.section).toBeUndefined();
  });

  it('una unión a tope sin cortes no lleva corte', () => {
    const p = { ...table, joints: table.joints.map((j) => (j.type === 'tope' ? { ...j, params: { hold: 0 } } : j)) };
    const tope = p.joints.find((j) => j.type === 'tope')!;
    expect(drawJointDetail(p, tope.id)!.section).toBeUndefined();
  });
});

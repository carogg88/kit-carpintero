import { beforeAll, describe, expect, it } from 'vitest';
import opencascade from 'replicad-opencascadejs';
import { measureVolume, setOC } from 'replicad';
import { buildTemplate, defaultJointParams, drawJointDetail, partBox, drawPart, drawView, TEMPLATES, templateDefaults, withEngineLines, type Drawing, type JointType, type Line2, type Part, type Project } from '@kitc/core';
import { partShape, projectShapes } from './shapes';

beforeAll(async () => {
  setOC(await opencascade());
}, 60_000);

const table = (() => {
  const def = TEMPLATES.find((t) => t.id === 'mesa')!;
  return buildTemplate(def, templateDefaults(def), 'guatambu', undefined, '2026-10-21T00:00:00Z');
})();

function engine(project: Project, d: Drawing): Drawing {
  const shapes = d.engine!.parts.map((id) => partShape(project.parts.find((p) => p.id === id)!, project).shape);
  const { segments, hidden } = projectShapes(shapes, d.engine!);
  shapes.forEach((s) => s.delete());
  return withEngineLines(d, segments, hidden);
}

/** Puntos a lo largo de las líneas, cada 5 mm. */
const samples = (lines: Line2[]) =>
  lines.flatMap((l) => {
    const n = Math.max(1, Math.ceil(Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) / 5));
    return Array.from({ length: n + 1 }, (_, i) => [l.a[0] + ((l.b[0] - l.a[0]) * i) / n, l.a[1] + ((l.b[1] - l.a[1]) * i) / n] as const);
  });
const near = (pt: readonly [number, number], lines: Line2[]) =>
  lines.some((l) => {
    const dx = l.b[0] - l.a[0];
    const dy = l.b[1] - l.a[1];
    const t = Math.max(0, Math.min(1, ((pt[0] - l.a[0]) * dx + (pt[1] - l.a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(l.a[0] + t * dx - pt[0], l.a[1] + t * dy - pt[1]) < 1.5;
  });
/**
 * Todo contorno de cajas está en el motor, y todo lo que el motor ve está en el dibujo de cajas (visible u oculto:
 * las cajas dibujan siempre ocultas las bocas de las mortajas, aunque queden de frente). La mesa trae cantos
 * redondeados de 3 mm, por eso la tolerancia.
 */
function sameContours(box: Drawing, exact: Drawing) {
  const b = exact.lines.filter((l) => !l.hidden);
  expect(samples(box.lines.filter((l) => !l.hidden)).filter((p) => !near(p, b))).toEqual([]);
  expect(samples(b).filter((p) => !near(p, box.lines))).toEqual([]);
}

describe('plano con el motor', () => {
  it('las tres vistas de la mesa coinciden con las de cajas', () => {
    for (const v of ['front', 'side', 'top'] as const) {
      const box = drawView(table, v);
      const exact = engine(table, box);
      sameContours(box, exact);
      for (const k of ['u0', 'v0', 'u1', 'v1'] as const) expect(exact.bounds[k]).toBeCloseTo(box.bounds[k], 3);
      expect(exact.lines.some((l) => l.hidden)).toBe(true);
    }
  });

  it('el despiece de cada pieza coincide con el de cajas', () => {
    for (const part of table.parts) {
      const box = drawPart(table, part);
      sameContours(box, engine(table, box));
    }
  });

  it('el detalle de un encastre queda dentro de su ventana', () => {
    const j = table.joints.find((x) => x.type !== 'tope')!;
    for (const box of drawJointDetail(table, j.id)!.views) {
      const exact = engine(table, box);
      const w = box.engine!.window!;
      expect(exact.lines.length).toBeGreaterThan(0);
      expect(exact.lines.every((l) => [l.a, l.b].every(([u, v]) => u >= w.u0 - 1e-6 && u <= w.u1 + 1e-6 && v >= w.v0 - 1e-6 && v <= w.v1 + 1e-6))).toBe(true);
      sameContours(box, exact);
    }
  });

  it('una tapa redondeada se dibuja con sus curvas', () => {
    const top = table.parts.find((p) => p.name.startsWith('Tapa'))!;
    const rounded: Project = { ...table, parts: table.parts.map((p) => (p.id === top.id ? { ...p, ops: [{ kind: 'round', edges: 'all', radius: 20 }] } : p)) };
    const exact = engine(rounded, drawPart(rounded, rounded.parts.find((p) => p.id === top.id)!));
    // En la planta de la tapa, las esquinas son arcos: hay tramos que no son ni horizontales ni verticales.
    expect(exact.lines.some((l) => Math.abs(l.a[0] - l.b[0]) > 1e-3 && Math.abs(l.a[1] - l.b[1]) > 1e-3)).toBe(true);
  });
});

describe('encastres finos en el motor', () => {
  const part = (id: string, position: [number, number, number], size: [number, number, number]): Part => ({
    id, name: id, wood: 'cedro', base: { kind: 'box', size }, position, rotation: [0, 0, 0], ops: [],
  });
  // Esquina de cajón, pata con faldón y dos tablas canto con canto.
  const corner = [part('A', [0, 0, 0], [18, 150, 400]), part('B', [18, 0, 0], [482, 150, 18])];
  const legApron = [part('A', [30, 0, 30], [70, 728, 70]), part('B', [100, 633, 42], [1600, 95, 22])];
  const boards = [part('A', [0, 0, 0], [100, 20, 1000]), part('B', [100, 0, 0], [100, 20, 1000])];
  const cases: [JointType, Part[]][] = [
    ['cola-milano', corner],
    ['dedos', corner],
    ['inglete', corner],
    ['brida', legApron],
    ['galleta', legApron],
    ['machiembrado', boards],
    ['bolsillo', legApron],
  ];
  const volume = (p: Part) => (p.base.kind === 'box' ? p.base.size[0] * p.base.size[1] * p.base.size[2] : 0);

  it.each(cases)('%s se arma sin avisos', (type, parts) => {
    const [a, b] = parts as [Part, Part];
    const project: Project = { ...table, parts, joints: [{ id: 'J', type, partA: 'A', partB: 'B', params: {} }], components: [] };
    expect(defaultJointParams(type, partBox(a), partBox(b))).not.toBeNull();
    const built = parts.map((p) => partShape(p, project));
    expect(built.map((x) => x.warning)).toEqual([undefined, undefined]);
    const before = volume(a) + volume(b);
    const after = built.reduce((sum, x) => sum + measureVolume(x.shape), 0);
    built.forEach((x) => x.shape.delete());
    // Lo que pierde A lo gana B; galletas, machimbre y bolsillos sacan madera.
    if (['cola-milano', 'dedos', 'inglete', 'brida'].includes(type)) expect(after).toBeCloseTo(before, -1);
    else expect(after).toBeLessThan(before);
  });
});


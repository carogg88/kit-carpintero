import { describe, expect, it } from 'vitest';
import { pathRegion } from './profile';
import { cornerPath, nearestCorner, strokeToPath, type CornerKind } from './sketch';

const area = (pts: [number, number][]) => Math.abs(pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length]![1] - pts[(i + 1) % pts.length]![0] * p[1], 0)) / 2;

/** Trazo de muestra: muchos puntos sobre una curva, como los que deja el mouse. */
const along = (f: (s: number) => [number, number], n = 120) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

describe('strokeToPath', () => {
  it('turns an edge-to-edge stroke into a few points with the ends on the edges', () => {
    // Faldón de 400 × 80: curva desde cerca del borde de arriba hasta cerca del derecho.
    const raw = along((s) => [300 + 97 * s, 78 - 40 * Math.sin((s * Math.PI) / 2)]);
    const r = strokeToPath(raw, 400, 80, 8)!;
    expect(r.kind).toBe('edges');
    const pts = r.shape.points;
    expect(pts.length).toBeLessThanOrEqual(14);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[0]!.v).toBe(80);
    expect(pts[pts.length - 1]!.u).toBe(400);
  });

  it('closes a loop that ends where it started', () => {
    const raw = along((s) => [200 + 25 * Math.cos(s * 2 * Math.PI * 0.98), 40 + 20 * Math.sin(s * 2 * Math.PI * 0.98)]);
    const r = strokeToPath(raw, 400, 80, 8)!;
    expect(r.kind).toBe('closed');
    expect(r.shape.closed).toBe(true);
    expect(r.shape.points.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps a sharp turn as a corner', () => {
    const raw = [...along((s) => [100 + 60 * s, 20], 30), ...along((s) => [160, 20 + 40 * s], 30)];
    const r = strokeToPath(raw, 400, 80, 8)!;
    expect(r.kind).toBe('loose');
    expect(r.shape.points.some((p) => p.corner)).toBe(true);
  });

  it('ignores a tiny scribble', () => {
    expect(strokeToPath([[10, 10], [11, 11], [12, 10]], 400, 80, 8)).toBeNull();
  });
});

describe('cornerPath', () => {
  const kinds: CornerKind[] = ['redondeo', 'chaflan', 'escalon', 'concavo', 'gola'];
  it.each(kinds)('%s takes away only the corner, at every corner', (kind) => {
    for (const c of [0, 1, 2, 3] as const) {
      const shape = cornerPath(kind, c, 60, 30, 400, 80);
      const region = pathRegion(shape, 400, 80);
      expect(region.length).toBeGreaterThanOrEqual(3);
      const a = area(region);
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThanOrEqual(60 * 30 + 1);
      expect(shape.flip).toBe(false);
    }
  });

  it('cuts the expected area for chamfer and step', () => {
    expect(area(pathRegion(cornerPath('chaflan', 0, 60, 30, 400, 80), 400, 80))).toBeCloseTo(900, 0);
    expect(area(pathRegion(cornerPath('escalon', 3, 60, 30, 400, 80), 400, 80))).toBeCloseTo(1800, 0);
  });

  it('still takes the corner when it is most of the face', () => {
    const shape = cornerPath('escalon', 0, 380, 70, 400, 80);
    expect(shape.flip).toBe(true);
    expect(area(pathRegion(shape, 400, 80))).toBeCloseTo(380 * 70, 0);
  });

  it('picks the nearest corner', () => {
    expect(nearestCorner(390, 75, 400, 80)).toBe(3);
    expect(nearestCorner(10, 75, 400, 80)).toBe(2);
    expect(nearestCorner(390, 5, 400, 80)).toBe(1);
  });
});

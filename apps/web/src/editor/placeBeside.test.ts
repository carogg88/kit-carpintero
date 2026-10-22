import { describe, expect, it } from 'vitest';
import { placeBeside } from './MeasureBubble';

const stage = { w: 900, h: 600 };
const size = { w: 268, h: 200 };

describe('burbuja al costado de lo dibujado', () => {
  it('va a la derecha de la figura si entra', () => {
    expect(placeBeside({ x0: 200, y0: 200, x1: 400, y1: 300 }, size, stage)).toEqual({ left: 416, top: 150 });
  });

  it('si no entra a la derecha va a la izquierda, y si no abajo', () => {
    expect(placeBeside({ x0: 500, y0: 200, x1: 700, y1: 300 }, size, stage).left).toBe(500 - 16 - 268);
    const below = placeBeside({ x0: 120, y0: 80, x1: 860, y1: 240 }, size, stage);
    expect(below.top).toBe(256);
  });

  it('nunca tapa la figura cuando hay lugar, ni se sale de la vista', () => {
    const box = { x0: 300, y0: 100, x1: 600, y1: 400 };
    const p = placeBeside(box, size, stage);
    const overlaps = p.left < box.x1 && p.left + size.w > box.x0 && p.top < box.y1 && p.top + size.h > box.y0;
    expect(overlaps).toBe(false);
    expect(p.left).toBeGreaterThanOrEqual(8);
    expect(p.left + size.w).toBeLessThanOrEqual(stage.w - 8);
  });
});

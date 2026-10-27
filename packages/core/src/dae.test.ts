import { describe, expect, it } from 'vitest';
import { piecesDae } from './dae';

describe('modelo 3D en DAE', () => {
  it('cada pieza es un objeto con su nombre, su malla y el color de su madera', () => {
    const tri = { vertices: [0, 0, 0, 10, 0, 0, 0, 10, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], triangles: [0, 1, 2] };
    const dae = piecesDae(
      [
        { name: 'P1 Pata <1>', color: '#D9BC8C', ...tri },
        { name: 'P2 Pata', color: '#d9bc8c', ...tri },
        { name: 'T Tapa & más', color: '#7C4D2C', ...tri },
      ],
      'Mesa',
      new Date('2026-10-27T00:00:00Z'),
    );
    expect(dae).toContain('<unit name="millimeter" meter="0.001"/>');
    expect(dae).toContain('<up_axis>Y_UP</up_axis>');
    expect(dae.match(/<geometry /g)).toHaveLength(3);
    expect(dae.match(/<node /g)).toHaveLength(3);
    // Dos maderas: dos materiales, aunque el color venga en minúscula.
    expect(dae.match(/<material /g)).toHaveLength(2);
    expect(dae).toContain('P1 Pata &lt;1&gt;');
    expect(dae).toContain('T Tapa &amp; más');
    expect(dae).toContain('<color>0.851 0.737 0.549 1</color>');
    expect(dae).toContain('<p>0 1 2</p>');
    expect(dae).toContain('count="9">0 0 0 10 0 0 0 10 0</float_array>');
  });
});

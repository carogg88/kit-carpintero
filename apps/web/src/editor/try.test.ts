import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTemplate, findMotions, TEMPLATES, templateDefaults } from '@kitc/core';
import { CUT_PLANE, placeCut } from './Motion3D';
import { useEditor } from './store';

const project = () => {
  const def = TEMPLATES.find((x) => x.id === 'cajonera')!;
  return buildTemplate(def, templateDefaults(def), 'melamina', undefined, '2026-10-27T00:00:00Z');
};

describe('probar el mueble', () => {
  it('tocar abre y cierra, Abrir todo los lleva juntos, y otra herramienta termina la prueba', () => {
    const p = project();
    useEditor.getState().open(p);
    const ids = findMotions(p).map((m) => m.id);
    const s = useEditor.getState;
    s().setTrying(true);
    s().toggleOpen(ids[0]!);
    expect(s().opened[ids[0]!]).toBe(1);
    s().toggleOpen(ids[0]!);
    expect(s().opened[ids[0]!]).toBe(0);
    s().openAll(ids, 0.6);
    expect(ids.every((id) => s().opened[id] === 0.6)).toBe(true);
    s().setCut({ axis: 2, at: 0.5 });
    s().setTool('move');
    expect(s()).toMatchObject({ trying: false, opened: {}, cut: null, tool: 'move' });
    // Probar vuelve a Elegir: con otra herramienta, un toque editaría.
    s().setTrying(true);
    expect(s().tool).toBe('select');
  });

  it('el corte saca la mitad que mira a la cámara: lo de adelante, la derecha o lo de arriba', () => {
    const p = project();
    const xs = p.parts.map((q) => q.position[0]);
    const mid = (Math.min(...xs) + Math.max(...p.parts.map((q) => q.position[0] + (q.base.kind === 'box' ? q.base.size[0] : 0)))) / 2;
    placeCut(p, { axis: 0, at: 0.5 });
    expect(CUT_PLANE.distanceToPoint(new THREE.Vector3(mid - 50, 0, 0))).toBeGreaterThan(0);
    expect(CUT_PLANE.distanceToPoint(new THREE.Vector3(mid + 50, 0, 0))).toBeLessThan(0);
    placeCut(p, { axis: 2, at: 0.5 });
    expect(CUT_PLANE.normal.z).toBe(-1);
    placeCut(p, { axis: 1, at: 0.5 });
    expect(CUT_PLANE.normal.y).toBe(-1);
  });
});

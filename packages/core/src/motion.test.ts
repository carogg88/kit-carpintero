import { describe, expect, it } from 'vitest';
import { cutPlan } from './cutlist';
import { mirrorPart } from './edit';
import { partBox, type Vec3 } from './geometry';
import { buildDoors, findOpenings } from './fittings';
import { hardwareList } from './hardware';
import { findMotions, motionMatrix, motionOf, opensTargets, setOpens, transformPoint, type Motion } from './motion';
import { loadProject, SCHEMA_VERSION, type Part, type Project } from './project';
import { flipPart } from './rotate';
import { buildTemplate, templateById } from './templates';

const now = '2026-10-27T00:00:00Z';
const template = (id: string, wood = 'cedro', v: Record<string, number> = {}) => buildTemplate(templateById(id)!, v, wood, undefined, now);
const center = (m: Motion): Vec3 => m.box.min.map((v, k) => (v + m.box.max[k]!) / 2) as Vec3;
const at = (m: Motion, open: number, p: Vec3 = center(m)) => transformPoint(motionMatrix(m, open), p);

describe('lo que se mueve', () => {
  it('la cajonera: cada cajón entero corre hacia adelante, sobre correderas del largo que entra', () => {
    const p = template('cajonera', 'melamina', { drawers: 4 });
    const drawers = findMotions(p).filter((m) => m.kind === 'cajon');
    expect(drawers).toHaveLength(4);
    // Frente, dos costados, trasera y fondo.
    for (const d of drawers) expect(d.parts).toHaveLength(5);
    // De abajo hacia arriba.
    expect(drawers[0]!.box.min[1]).toBeLessThan(drawers[1]!.box.min[1]);
    const d = drawers[0]!;
    expect(d.slide![0]).toBe(0);
    expect(d.slide![2]).toBeGreaterThanOrEqual(250);
    expect(d.slide![2] % 50).toBe(0);
    const c = center(d);
    expect(at(d, 1)).toEqual([c[0], c[1], c[2] + d.slide![2]]);
    expect(at(d, 0)).toEqual(c);
  });

  it('la alacena: un par de puertas, cada una con la bisagra de su lado, que abren hacia adelante', () => {
    const doors = findMotions(template('alacena')).filter((m) => m.kind === 'puerta');
    expect(doors).toHaveLength(2);
    const [left, right] = doors;
    expect(left!.hinge).toBe('izq');
    expect(right!.hinge).toBe('der');
    // Una puerta de marco gira entera: largueros, peinazos y tablero.
    expect(left!.parts.length).toBeGreaterThanOrEqual(5);
    for (const d of doors) {
      const c = center(d);
      const half = at(d, 0.5);
      expect(half[2]).toBeGreaterThan(c[2]);
      expect(half[1]).toBeCloseTo(c[1], 6);
      // El canto de la bisagra no se mueve.
      expect(at(d, 0.7, d.pivot!)).toEqual(d.pivot!.map((v) => expect.closeTo(v, 6)));
    }
    // Abiertas del todo, 110°: el canto libre queda detrás del de la bisagra en X... hacia afuera del mueble.
    const free: Vec3 = [left!.box.max[0], center(left!)[1], left!.box.max[2]];
    expect(at(left!, 1, free)[0]).toBeLessThan(left!.box.min[0]);
  });

  it('una puerta sola va a la izquierda, y se cambia de lado sin perder lo automático', () => {
    const p = template('mesa-luz');
    const fit = buildDoors(p, findOpenings(p.parts)[0]!, { count: 1, front: 'superpuesto', style: 'tablero', wood: 'cedro' });
    p.parts.push(...fit.parts);
    const door = findMotions(p).find((m) => m.kind === 'puerta')!;
    expect(door.hinge).toBe('izq');
    setOpens(p, door.parts, { kind: 'puerta', hinge: 'der' });
    const moved = motionOf(findMotions(p), door.id)!;
    expect(moved.hinge).toBe('der');
    expect(moved.pivot![0]).toBe(door.box.max[0]);
    // Volver a la izquierda deja la puerta como salió del botón.
    setOpens(p, door.parts, { kind: 'puerta', hinge: 'izq' });
    expect(p.parts.some((x) => x.opens)).toBe(false);
  });

  it('la caja de té: la tapa se levanta por atrás', () => {
    const p = template('caja');
    const lid = findMotions(p).find((m) => m.kind === 'tapa')!;
    expect(lid).toBeDefined();
    const c = center(lid);
    const open = at(lid, 1);
    expect(open[1]).toBeGreaterThan(c[1]);
    expect(open[2]).toBeLessThan(c[2]);
  });

  it('a mano: una pieza suelta se abre como puerta, y un grupo se mueve entero', () => {
    const p = template('estante');
    const part = p.parts[0]!;
    expect(motionOf(findMotions(p), part.id)).toBeUndefined();
    expect(opensTargets(p, part.id)).toEqual([part.id]);
    setOpens(p, [part.id], { kind: 'puerta', hinge: 'abajo' });
    const m = motionOf(findMotions(p), part.id)!;
    expect(m).toMatchObject({ kind: 'puerta', manual: true, hinge: 'abajo' });
    // Se rebate hacia adelante y queda acostada.
    expect(Math.abs(m.angle!)).toBeCloseTo(Math.PI / 2, 6);
    expect(at(m, 0.5)[2]).toBeGreaterThan(center(m)[2]);

    const q = template('cajonera', 'melamina', { drawers: 2 });
    const drawer = findMotions(q).find((x) => x.kind === 'cajon')!;
    const knob = q.parts.find((x) => !drawer.parts.includes(x.id))!;
    q.groups.push({ id: 'G1', name: 'Cajón con tirador', parts: [...drawer.parts, knob.id] });
    expect(motionOf(findMotions(q), knob.id)?.id).toBe(drawer.id);
    expect(opensTargets(q, knob.id)).toContain(knob.id);
  });

  it('“No se abre” saca un cajón de lo que se mueve, y de los herrajes', () => {
    const p = template('cajonera', 'melamina', { drawers: 3 });
    const before = findMotions(p).filter((m) => m.kind === 'cajon');
    setOpens(p, before[0]!.parts, { kind: 'no' });
    expect(findMotions(p).filter((m) => m.kind === 'cajon')).toHaveLength(2);
    const slides = hardwareList(p, cutPlan(p)).find((r) => r.id.startsWith('corredera|'));
    expect(slides?.qty).toBe(2);
    setOpens(p, before[0]!.parts, null);
    expect(findMotions(p).filter((m) => m.kind === 'cajon')).toHaveLength(3);
  });

  it('una puerta marcada a mano lleva bisagras en los herrajes', () => {
    const p = template('estante');
    const part = p.parts[0]!;
    const before = hardwareList(p, cutPlan(p));
    expect(before.some((r) => r.id.startsWith('bisagra|'))).toBe(false);
    setOpens(p, [part.id], { kind: 'puerta' });
    expect(hardwareList(p, cutPlan(p)).some((r) => r.id.startsWith('bisagra|'))).toBe(true);
  });

  it('espejar una puerta pasa la bisagra al otro lado', () => {
    const door: Part = {
      id: 'N1',
      name: 'Puerta',
      wood: 'cedro',
      base: { kind: 'box', size: [300, 600, 20] },
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      ops: [],
      pockets: [],
      bevels: [],
      sections: [],
      opens: { kind: 'puerta', hinge: 'izq' },
    };
    flipPart(door, 0);
    expect(door.opens?.hinge).toBe('der');
    flipPart(door, 1);
    expect(door.opens?.hinge).toBe('der');
    const side: Part = { ...structuredClone(door), id: 'N2', base: { kind: 'box', size: [20, 600, 20] }, position: [-400, 0, 0], opens: undefined };
    const twin = mirrorPart([door, side], door)!;
    expect(twin.part.opens?.hinge).toBe('izq');
    expect(partBox(twin.part).min[0]).toBeLessThan(0);
  });

  it('un proyecto de la versión 13 abre igual, y se abre solo', () => {
    const p: Project = template('alacena');
    const r = loadProject({ ...p, schemaVersion: 13 });
    expect(r.ok && r.project.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.ok && findMotions(r.project).filter((m) => m.kind === 'puerta')).toHaveLength(2);
  });
});

import { boxSize, partBox, type Axis, type Box } from './geometry';
import { buildDrawers, findOpenings, PHI, type FrontStyle, type Slides } from './fittings';
import { furnitureBox } from './resize';
import { formatLength } from './units';
import type { Component, Joint, Part, Project } from './project';
import { locale, t, tk } from './i18n';

/**
 * Proporción áurea: φ ≈ 1,618, la relación entre dos medidas en la que el ojo encuentra equilibrio. No es una regla:
 * es una guía que usan muchos ebanistas para el ancho y el alto de un mueble, la tapa de una mesa o los cajones de
 * una cómoda. Acá se mide el mueble como está, se dice si sigue la proporción y qué medida la haría seguir.
 */

/** Dos rectángulos áureos encadenados (un cuadrado más un rectángulo áureo) también se leen áureos: φ² ≈ 2,618. */
const TARGETS = [PHI, PHI * PHI];
/** Hasta acá de diferencia, la proporción ya se ve áurea. */
export const GOLDEN_TOL = 0.03;
/** Hasta acá está cerca: con un retoque chico queda. */
const NEAR_TOL = 0.12;

export type GoldenStatus = 'aurea' | 'cerca' | 'lejos';

export type GoldenFix = { kind: 'size'; axis: Axis; mm: number } | { kind: 'drawers' };

export interface GoldenCheck {
  id: 'frente' | 'planta' | 'cajones';
  title: string;
  /** Las medidas y la relación: "90 × 200 cm · 1 : 2,22". */
  detail: string;
  status: GoldenStatus;
  /** El rectángulo como está y el áureo más cercano, para dibujarlos: [lado largo, lado corto]. */
  shape?: { current: [number, number]; golden: [number, number] };
  fixes: { label: string; fix: GoldenFix }[];
}

/** Muebles en que el alto lo pone el cuerpo (sentarse, comer, llegar a la cama): ahí no se propone cambiarlo. */
const FIXED_HEIGHT = new Set(['mesa', 'taburete', 'banco', 'mesa-luz', 'mesa-ratona', 'silla']);

const AXIS_NAMES: Record<Axis, string> = { 0: tk('Ancho'), 1: tk('Alto'), 2: tk('Fondo') };

const ratioText = (r: number) => `1 : ${r.toLocaleString(locale(), { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

/** La proporción áurea más cercana a la relación `r` (siempre ≥ 1), y cuánto se aparta. */
function nearest(r: number): { target: number; off: number } {
  const best = TARGETS.map((target) => ({ target, off: Math.abs(r / target - 1) })).sort((a, b) => a.off - b.off)[0]!;
  return best;
}

const statusOf = (off: number): GoldenStatus => (off <= GOLDEN_TOL ? 'aurea' : off <= NEAR_TOL ? 'cerca' : 'lejos');

/** Medida limpia para proponer: al centímetro, o al medio pulgada. */
const clean = (mm: number, units: Project['units']) => (units === 'in' ? Math.round(mm / 12.7) * 12.7 : Math.round(mm / 10) * 10);

/** Revisa la relación entre dos medidas del mueble y propone llevar una o la otra a la proporción áurea. */
function pair(project: Project, box: Box, id: 'frente' | 'planta', a: Axis, b: Axis): GoldenCheck | null {
  const s = boxSize(box);
  const [x, y] = [s[a], s[b]];
  if (x < 50 || y < 50) return null;
  const long = Math.max(x, y);
  const short = Math.min(x, y);
  const r = long / short;
  const { target, off } = nearest(r);
  const status = statusOf(off);
  const units = project.units;
  const fixes: GoldenCheck['fixes'] = [];
  if (status !== 'aurea') {
    // Para cada eje, la medida que deja la relación en la proporción áurea sin cambiar cuál es el lado largo.
    for (const k of [a, b]) {
      if (k === 1 && project.template && FIXED_HEIGHT.has(project.template)) continue;
      const other = k === a ? y : x;
      const isLong = s[k] === long;
      const mm = clean(isLong ? other * target : other / target, units);
      if (Math.abs(mm - s[k]) < 5) continue;
      fixes.push({ label: t('{axis} a {len}', { axis: t(AXIS_NAMES[k]), len: formatLength(mm, units) }), fix: { kind: 'size', axis: k, mm } });
    }
  }
  const len = (v: number) => formatLength(v, units).replace(/ cm|″/, '');
  const unit = units === 'cm' ? ' cm' : '″';
  return {
    id,
    title: id === 'frente' ? t('De frente: ancho y alto') : t('De arriba: ancho y fondo'),
    detail: `${len(x)} × ${len(y)}${unit} · ${ratioText(r)}`,
    status,
    shape: { current: [long, short], golden: [short * target, short] },
    fixes,
  };
}

// ── Cajones ─────────────────────────────────────────────────────────────────

interface Stack {
  /** Frentes de abajo hacia arriba. */
  fronts: Part[];
  /** Todas las piezas de esos cajones. */
  parts: Part[];
}

const isDrawer = (p: Part) => /^K\d/.test(p.id) && p.base.kind === 'box';

/** Pilas de cajones: los frentes (las piezas de cajón más adelante, finas de adelante hacia atrás) que comparten el ancho. */
function drawerStacks(parts: Part[]): Stack[] {
  const drawers = parts.filter(isDrawer);
  if (!drawers.length) return [];
  const front = Math.max(...drawers.map((p) => partBox(p).max[2]));
  const fronts = drawers.filter((p) => {
    const s = boxSize(partBox(p));
    return partBox(p).max[2] >= front - 1 && s[2] < Math.min(s[0], s[1]);
  });
  const stacks: Stack[] = [];
  for (const f of fronts) {
    const b = partBox(f);
    const stack = stacks.find((st) => {
      const sb = partBox(st.fronts[0]!);
      return Math.min(sb.max[0], b.max[0]) - Math.max(sb.min[0], b.min[0]) > 0.5 * (b.max[0] - b.min[0]);
    });
    if (stack) stack.fronts.push(f);
    else stacks.push({ fronts: [f], parts: [] });
  }
  for (const st of stacks) {
    st.fronts.sort((p, q) => partBox(p).min[1] - partBox(q).min[1]);
    const lo = Math.min(...st.fronts.map((p) => partBox(p).min[0]));
    const hi = Math.max(...st.fronts.map((p) => partBox(p).max[0]));
    st.parts = drawers.filter((p) => {
      const b = partBox(p);
      return b.min[0] >= lo - 1 && b.max[0] <= hi + 1;
    });
  }
  return stacks.filter((st) => st.fronts.length >= 2);
}

const frontHeight = (p: Part) => boxSize(partBox(p))[1];

/** Si los cajones bajan en escalera pareja con el de abajo φ veces el de arriba. */
function graded(st: Stack): boolean {
  const h = st.fronts.map(frontHeight);
  const steps = h.slice(1).every((v, i) => v < h[i]!);
  return steps && Math.abs(h[0]! / h.at(-1)! / PHI - 1) <= GOLDEN_TOL;
}

function drawerCheck(project: Project): GoldenCheck | null {
  const stacks = drawerStacks(project.parts);
  if (!stacks.length) return null;
  const ok = stacks.every(graded);
  const h = stacks[0]!.fronts.map(frontHeight);
  const len = (v: number) => formatLength(v, project.units);
  const same = h.every((v) => Math.abs(v - h[0]!) < 1);
  return {
    id: 'cajones',
    title: t('Cajones'),
    detail: same
      ? t('{n} cajones iguales de {h}', { n: h.length, h: len(h[0]!) })
      : t('{n} cajones, de {a} abajo a {b} arriba · {r}', { n: h.length, a: len(h[0]!), b: len(h.at(-1)!), r: ratioText(h[0]! / h.at(-1)!) }),
    status: ok ? 'aurea' : 'lejos',
    fixes: ok ? [] : [{ label: t('Graduarlos en proporción áurea'), fix: { kind: 'drawers' } }],
  };
}

/** Las proporciones del mueble: de frente, de arriba y los cajones si los tiene. */
export function goldenChecks(project: Project): GoldenCheck[] {
  const box = furnitureBox(project.parts);
  if (!box || project.parts.length < 2) return [];
  return [pair(project, box, 'frente', 0, 1), pair(project, box, 'planta', 0, 2), drawerCheck(project)].filter((c): c is GoldenCheck => !!c);
}

/**
 * Vuelve a armar cada pila de cajones en el mismo hueco, con el mismo frente, correderas y madera, graduada en
 * proporción áurea (o pareja, con `graded` en false). Cambia el proyecto que recibe. Devuelve cuántas pilas rearmó.
 */
export function regradeDrawers(project: { parts: Part[]; joints: Joint[]; components: Component[] }, gradedOn = true): number {
  let done = 0;
  for (const st of drawerStacks(project.parts)) {
    const ids = new Set(st.parts.map((p) => p.id));
    const rest = project.parts.filter((p) => !ids.has(p.id));
    const fb = partBox(st.fronts[0]!);
    const cx = (fb.min[0] + fb.max[0]) / 2;
    const cy = (fb.min[1] + partBox(st.fronts.at(-1)!).max[1]) / 2;
    const o = findOpenings(rest).find((op) => op.box.min[0] <= cx && cx <= op.box.max[0] && op.box.min[1] <= cy && cy <= op.box.max[1]);
    if (!o) continue;
    const front: FrontStyle = fb.max[2] <= o.box.max[2] + 0.5 ? 'embutido' : 'superpuesto';
    const sides = st.parts.filter((p) => !st.fronts.includes(p)).map((p) => partBox(p).min[0]);
    const slides: Slides = sides.length && Math.min(...sides) - o.box.min[0] >= 10 ? 'metalicas' : 'madera';
    const used = new Set(rest.map((p) => p.component).filter(Boolean));
    project.parts = rest;
    project.joints = project.joints.filter((j) => !ids.has(j.partA) && !ids.has(j.partB));
    project.components = project.components.filter((c) => used.has(c.id));
    const fit = buildDrawers(project, o, { count: st.fronts.length, front, slides, wood: st.fronts[0]!.wood, graded: gradedOn });
    project.parts.push(...fit.parts);
    project.joints.push(...fit.joints);
    project.components.push(...fit.components);
    done++;
  }
  return done;
}

import { axisRelation, centerShift, faceDistance, formatLength, furnitureBox, isCentered, partBox, t, tk, type Axis, type AxisRelation } from '@kitc/core';
import { IconCheck } from './icons';
import { useEditor } from './store';
import styles from './Editor.module.css';

const AXIS_LABELS = [tk('Ancho'), tk('Alto'), tk('Fondo')] as const;
const SIDES = [
  [tk('a la izquierda'), tk('a la derecha')],
  [tk('abajo'), tk('arriba')],
  [tk('atrás'), tk('adelante')],
] as const;
const DIM_NAMES = [tk('ancho'), tk('alto'), tk('fondo')] as const;

/**
 * Lo que mide Medir: con una pieza tocada, dónde queda dentro del mueble; con dos, cuánto las separa sobre cada eje,
 * cuánto le sobra a cada lado a la que queda adentro de la otra y Centrar para dejarla al medio.
 */
export function MeasureCard({ docked = false }: { docked?: boolean }) {
  const project = useEditor((s) => s.project);
  const measure = useEditor((s) => s.measure);
  const commit = useEditor((s) => s.commit);
  const tool = useEditor((s) => s.tool);
  if (tool !== 'measure' || !project || !measure.a) return null;
  const a = project.parts.find((p) => p.id === measure.a!.partId);
  const b = measure.b ? project.parts.find((p) => p.id === measure.b!.partId) : null;
  if (!a || a.base.kind !== 'box' || (b && b.base.kind !== 'box')) return null;
  const boxA = partBox(a);
  const target = b ? partBox(b) : furnitureBox(project.parts);
  if (!target) return null;
  const n = (mm: number) => formatLength(Math.abs(mm), project.units);
  const faces = b && measure.b ? faceDistance(boxA, measure.a, target, measure.b) : null;

  const center = (k: Axis, r: AxisRelation) => {
    const shift = centerShift(r);
    if (shift === null) return;
    commit((d) => {
      const q = d.parts.find((x) => x.id === a.id);
      if (q) q.position[k] = q.position[k]! + shift;
    }, t('Centraste {id} a lo {dim}', { id: a.id, dim: t(DIM_NAMES[k]) }));
  };

  const row = (k: Axis) => {
    const r = axisRelation(boxA, target, k);
    let value: string;
    let extra: React.ReactNode = null;
    if (r.kind === 'gap') value = r.gap < 0.5 ? t('Se tocan') : t('Separadas {d}', { d: n(r.gap) });
    else if (r.kind === 'cross') value = t('Se cruzan {d}', { d: n(r.overlap) });
    else if (r.before < 0.5 && r.after < 0.5) value = b ? t('Del mismo largo') : t('De punta a punta');
    else {
      value = `${n(r.before)} ${t(SIDES[k][0])} · ${n(r.after)} ${t(SIDES[k][1])}`;
      if (isCentered(r))
        extra = (
          <span className={styles.measureOk}>
            <IconCheck />
            {t('Centrada')}
          </span>
        );
      // En el mueble, de alto manda el piso: centrar una pieza a lo alto no suele ser lo que se busca.
      else if (b || k !== 1)
        extra = (
          <button type="button" className={styles.measureCenter} onClick={() => center(k, r)}>
            {t('Centrar')}
          </button>
        );
    }
    return (
      <li key={k}>
        <span className={styles.measureAxis}>{t(AXIS_LABELS[k])}</span>
        <span className={styles.measureValue}>{value}</span>
        {extra}
      </li>
    );
  };

  return (
    <section className={styles.measureCard} data-docked={docked || undefined} aria-label={t('Medidas')}>
      <header>
        <strong>{b ? t('{a} y {b}', { a: a.id, b: b.id }) : t('{a} en el mueble', { a: a.id })}</strong>
        <span>{b ? `${a.name} · ${b.name}` : t('Tocá otra pieza para medir entre las dos')}</span>
      </header>
      {faces !== null && faces > 0.5 && <p className={styles.measureFaces}>{t('Entre las caras tocadas: {d}', { d: n(faces) })}</p>}
      <ul>{([0, 1, 2] as Axis[]).map(row)}</ul>
    </section>
  );
}

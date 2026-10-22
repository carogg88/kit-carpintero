import { useId, useMemo } from 'react';
import { formatLength, goldenChecks, regradeDrawers, resizeFurniture, t, tk, type GoldenCheck, type GoldenFix, type GoldenStatus, type Part, type Project } from '@kitc/core';
import { useEditor } from './store';
import { IconCheck } from './icons';
import styles from './Editor.module.css';

/**
 * Proporción áurea: cómo están las medidas del mueble respecto de φ ≈ 1,618, con la medida que la haría seguir.
 * Se recalcula con cada cambio. Es una guía de diseño, no un error: por eso va aparte de la revisión.
 */

const STATUS: Record<GoldenStatus, string> = { aurea: tk('Áurea'), cerca: tk('Cerca'), lejos: tk('No sigue') };

/** El rectángulo como está (lleno) y el áureo más cercano (punteado), apoyados en el mismo lado corto. */
function Shape({ shape }: { shape: NonNullable<GoldenCheck['shape']> }) {
  const W = 64;
  const H = 40;
  const scale = Math.min(W / Math.max(shape.current[0], shape.golden[0]), H / shape.current[1]);
  const [cw, ch] = [shape.current[0] * scale, shape.current[1] * scale];
  const gw = shape.golden[0] * scale;
  const y = (H - ch) / 2;
  return (
    <svg className={styles.goldenShape} viewBox={`-1 -1 ${W + 2} ${H + 2}`} width={W + 2} height={H + 2} aria-hidden="true">
      <rect x={0} y={y} width={cw} height={ch} rx={2} className={styles.goldenNow} />
      <rect x={0} y={y} width={gw} height={ch} rx={2} className={styles.goldenIdeal} />
      {/* El cuadrado del rectángulo áureo: la línea que lo separa del rectángulo chico que queda. */}
      <line x1={ch} y1={y} x2={ch} y2={y + ch} className={styles.goldenIdeal} />
    </svg>
  );
}

/** Cuántas de las proporciones del mueble ya son áureas: "1 de 2". */
export const goldenCount = (checks: GoldenCheck[]) => t('{n} de {total}', { n: checks.filter((c) => c.status === 'aurea').length, total: checks.length });

/** La lista de proporciones. Sin `heading`, va adentro de una sección que ya dice el título y la cuenta. */
export function GoldenList({ checks, onFix, heading = true }: { checks: GoldenCheck[]; onFix: (fix: GoldenFix) => void; heading?: boolean }) {
  const titleId = useId();
  if (!checks.length) return null;
  return (
    <section className={styles.golden} aria-labelledby={heading ? titleId : undefined} aria-label={heading ? undefined : t('Proporción áurea')}>
      {heading && (
        <div className={styles.reviewHead}>
          <span id={titleId} className={styles.legend}>
            {t('Proporción áurea')}
          </span>
          <span className={styles.goldenCount}>{goldenCount(checks)}</span>
        </div>
      )}
      <p className={styles.goldenAbout}>{t('φ ≈ 1,618: la relación entre dos medidas que el ojo encuentra equilibrada. Es una guía, no una regla.')}</p>
      <ul className={styles.goldenList}>
        {checks.map((c) => (
          <li key={c.id} className={styles.goldenRow} data-status={c.status}>
            {c.shape && <Shape shape={c.shape} />}
            <span className={styles.goldenText}>
              <strong>{c.title}</strong>
              <span className={styles.goldenDetail}>{c.detail}</span>
            </span>
            <span className={styles.goldenBadge} data-status={c.status}>
              {c.status === 'aurea' && <IconCheck />}
              {t(STATUS[c.status])}
            </span>
            {c.fixes.length > 0 && (
              <span className={styles.goldenFixes}>
                {c.fixes.map((f) => (
                  <button key={f.label} type="button" className={styles.goldenFix} onClick={() => onFix(f.fix)}>
                    {f.label}
                  </button>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** En el panel del proyecto: las proporciones del mueble, y un toque para llevarlas a la áurea. */
export function GoldenCard({ project }: { project: Project }) {
  const commit = useEditor((s) => s.commit);
  const checks = useMemo(() => goldenChecks(project), [project]);
  const apply = (fix: GoldenFix) => {
    if (fix.kind === 'drawers') {
      commit((d) => void regradeDrawers(d as Project), t('Graduaste los cajones en proporción áurea'));
      return;
    }
    // Se prueba antes en una copia: si no entra, no se toca el proyecto.
    if (!resizeFurniture(structuredClone(project.parts), fix.axis, fix.mm)) {
      useEditor.getState().warn(t('No se puede llevar a esa medida: no queda lugar libre entre las piezas.'));
      return;
    }
    commit((d) => void resizeFurniture(d.parts as Part[], fix.axis, fix.mm), t('Llevaste el mueble a {len} para la proporción áurea', { len: formatLength(fix.mm, project.units) }));
  };
  return <GoldenList checks={checks} onFix={apply} />;
}

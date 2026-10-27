import { t, tk, type Hinge, type Motion, type Project } from '@kitc/core';
import { useMotions } from './Motion3D';
import { IconCut, IconXray } from './icons';
import { useEditor, type Cut } from './store';
import styles from './Editor.module.css';
import own from './Try.module.css';

const KIND_NAMES: Record<Motion['kind'], string> = { cajon: tk('Cajón'), puerta: tk('Puerta'), tapa: tk('Tapa abatible') };
const HINGE_NAMES: Record<Hinge, string> = { izq: tk('bisagra a la izquierda'), der: tk('bisagra a la derecha'), arriba: tk('bisagra arriba'), abajo: tk('se rebate hacia abajo') };
const CUTS: [Cut['axis'] | null, string][] = [
  [null, tk('Ninguno')],
  [2, tk('Frente')],
  [0, tk('Costado')],
  [1, tk('Arriba')],
];

/** Nombre de cada cajón o puerta: su tipo y su número, contando de abajo hacia arriba y de izquierda a derecha. */
function names(motions: Motion[]): string[] {
  const seen: Record<string, number> = {};
  const total = (k: Motion['kind']) => motions.filter((m) => m.kind === k).length;
  return motions.map((m) => {
    const n = (seen[m.kind] = (seen[m.kind] ?? 0) + 1);
    return total(m.kind) > 1 ? `${t(KIND_NAMES[m.kind])} ${n}` : t(KIND_NAMES[m.kind]);
  });
}

/** Ids de las piezas, cortos: "K1 a K5" si van seguidos, o la lista. */
function idsLabel(ids: string[]): string {
  const sorted = [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return sorted.length > 2 ? t('{a} a {b}', { a: sorted[0]!, b: sorted.at(-1)! }) : sorted.join(', ');
}

/** Panel de Probar: qué se abre, todo junto o de a uno, y cómo mirar por adentro. */
export function TryPanel({ project }: { project: Project }) {
  const motions = useMotions(project);
  const opened = useEditor((s) => s.opened);
  const cut = useEditor((s) => s.cut);
  const xray = useEditor((s) => s.xray);
  const { setTrying, toggleOpen, openAll, setCut, setXray } = useEditor.getState();
  const label = names(motions);
  const ids = motions.map((m) => m.id);
  const values = ids.map((id) => opened[id] ?? 0);
  const all = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) : 0;
  return (
    <>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{t('Probar el mueble')}</h2>
      </div>
      <p className={styles.muted}>{t('Tocá un cajón o una puerta en el modelo para abrirlo o cerrarlo. Mientras probás no se cambia nada del proyecto.')}</p>

      <div className={own.block}>
        <h3>{t('Qué se abre')}</h3>
        {motions.length ? (
          <>
            <label className={own.block}>
              <span className={styles.legend}>{t('Abrir todo')}</span>
              <input
                className={own.range}
                type="range"
                min={0}
                max={100}
                step={5}
                value={all}
                onChange={(e) => openAll(ids, Number(e.target.value) / 100)}
                aria-valuetext={t('{n} % abierto', { n: all })}
              />
              <span className={own.ends} aria-hidden="true">
                <span>{t('Cerrado')}</span>
                <span>{t('Abierto')}</span>
              </span>
            </label>
            <ul className={own.list}>
              {motions.map((m, i) => {
                const open = (opened[m.id] ?? 0) > 0.5;
                return (
                  <li key={m.id}>
                    <button type="button" aria-pressed={open} onClick={() => toggleOpen(m.id)}>
                      <span className={own.name}>
                        <strong>{label[i]}</strong>
                        <span className={styles.fieldNote}>
                          {m.kind === 'puerta' && m.hinge ? `${t(HINGE_NAMES[m.hinge])} · ` : ''}
                          {idsLabel(m.parts)}
                        </span>
                      </span>
                      <span className={own.state}>{open ? t('Abierto') : t('Cerrado')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className={own.empty}>{t('Este mueble no tiene cajones, puertas ni tapas que se abran. Para marcar una pieza o un grupo, elegilo y usá Se abre en su panel.')}</p>
        )}
      </div>

      <div className={own.block}>
        <h3>{t('Ver por adentro')}</h3>
        <label className={own.toggle}>
          <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} />
          <IconXray />
          {t('Mueble transparente (los cajones y puertas se ven firmes)')}
        </label>
        <div role="group" aria-label={t('Corte')} className={own.block}>
          <span className={styles.legend}>
            <IconCut /> {t('Corte')}
          </span>
          <div className={`${styles.seg} ${own.cuts}`}>
            {CUTS.map(([axis, name]) => (
              <button
                key={String(axis)}
                type="button"
                aria-pressed={(cut?.axis ?? null) === axis}
                onClick={() => setCut(axis === null ? null : { axis, at: cut?.axis === axis ? cut.at : 0.5 })}
              >
                {t(name)}
              </button>
            ))}
          </div>
          {cut && (
            <label className={own.block}>
              <span className={styles.fieldNote}>{t('Dónde corta: corré la barra para ver otra parte del mueble.')}</span>
              <input
                className={own.range}
                type="range"
                min={2}
                max={98}
                value={Math.round(cut.at * 100)}
                onChange={(e) => setCut({ axis: cut.axis, at: Number(e.target.value) / 100 })}
                aria-label={t('Dónde corta')}
              />
              <span className={own.ends} aria-hidden="true">
                {cut.axis === 2 ? (
                  <>
                    <span>{t('Atrás')}</span>
                    <span>{t('Adelante')}</span>
                  </>
                ) : cut.axis === 0 ? (
                  <>
                    <span>{t('Izquierda')}</span>
                    <span>{t('Derecha')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('Abajo')}</span>
                    <span>{t('Arriba')}</span>
                  </>
                )}
              </span>
            </label>
          )}
        </div>
      </div>

      <button type="button" className={styles.secondaryBtn} onClick={() => setTrying(false)}>
        {t('Terminar de probar')}
      </button>
    </>
  );
}

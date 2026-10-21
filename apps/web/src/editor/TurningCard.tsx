import { useId } from 'react';
import {
  addStation,
  cleanTurning,
  describeTurning,
  formatNumber,
  MEASURED_FROM,
  presetTurning,
  t,
  tk,
  turnBlank,
  turnSegments,
  TURN_PRESETS,
  type Part,
  type Turning,
  type TurnPreset,
  type TurnStation,
  type Units,
} from '@kitc/core';
import { IconPlus, IconTrash } from './icons';
import { LengthField } from './PartPanel';
import styles from './Editor.module.css';

type Shape = 'straight' | 'bead' | 'cove' | 'square';
const SHAPES: [Shape, string][] = [
  ['straight', tk('Recto')],
  ['bead', tk('Curva hacia afuera')],
  ['cove', tk('Curva hacia adentro')],
  ['square', tk('Queda cuadrado')],
];
const shapeOf = (s: TurnStation): Shape => (s.to === 'curve' ? (s.bulge < 0 ? 'cove' : 'bead') : s.to);

/** Silueta del torneado, acostada: la punta de abajo a la izquierda. Las estaciones van numeradas. */
function Profile({ part, turning }: { part: Part; turning: Turning }) {
  const { len, side } = turnBlank(part, turning.axis);
  const W = 300;
  const s = (W - 16) / len;
  const H = Math.max(56, side * s + 30);
  const cy = (H - 12) / 2;
  const x = (at: number) => 8 + at * s;
  const segs = turnSegments(part, turning);
  const half = (sign: 1 | -1) =>
    segs
      .map((g) => {
        const y = (r: number) => cy - sign * r * s;
        if (g.kind === 'square') return `L ${x(g.a[0])} ${y(side / 2)} L ${x(g.b[0])} ${y(side / 2)}`;
        if (g.kind === 'curve' && g.mid) {
          // Curva que pasa por las tres marcas: una cuadrática con el control donde corresponde.
          const cxp = 2 * g.mid[0] - (g.a[0] + g.b[0]) / 2;
          const cr = 2 * g.mid[1] - (g.a[1] + g.b[1]) / 2;
          return `L ${x(g.a[0])} ${y(g.a[1])} Q ${x(cxp)} ${y(cr)} ${x(g.b[0])} ${y(g.b[1])}`;
        }
        return `L ${x(g.a[0])} ${y(g.a[1])} L ${x(g.b[0])} ${y(g.b[1])}`;
      })
      .join(' ');
  const top = `M ${x(0)} ${cy} ${half(1)} L ${x(len)} ${cy}`;
  const bottom = `M ${x(0)} ${cy} ${half(-1)} L ${x(len)} ${cy}`;
  return (
    <svg className={styles.turnProfile} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Perfil del torneado')}>
      <rect x={x(0)} y={cy - (side / 2) * s} width={len * s} height={side * s} className={styles.turnBlank} />
      <path d={`${top} ${bottom}`} className={styles.turnShape} />
      <line x1={x(0) - 4} y1={cy} x2={x(len) + 4} y2={cy} className={styles.turnAxis} />
      {turning.stations.map((st, i) => (
        <g key={i}>
          <line x1={x(st.at)} y1={cy - (side / 2) * s - 2} x2={x(st.at)} y2={cy + (side / 2) * s + 2} className={styles.turnTick} />
          {(i === 0 || i === turning.stations.length - 1 || x(st.at) - x(turning.stations[i - 1]!.at) > 9) && (
            <text x={x(st.at)} y={H - 2} textAnchor="middle" className={styles.turnNum}>
              {i + 1}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Torneado de la pieza: modelo para arrancar, silueta y cada estación con su distancia, diámetro y forma. */
export function TurningCard({ part, units, onChange }: { part: Part; units: Units; onChange: (turning: Turning | undefined) => void }) {
  const presetId = useId();
  const turning = part.turning!;
  const { len, side } = turnBlank(part, turning.axis);
  const n = (mm: number) => `${formatNumber(mm, units)}${units === 'cm' ? ' cm' : '″'}`;
  const st = turning.stations;
  const set = (recipe: (s: TurnStation[]) => void) => {
    const next = st.map((x) => ({ ...x }));
    recipe(next);
    onChange(cleanTurning(part, { axis: turning.axis, stations: next }));
  };
  const setShape = (i: number, shape: Shape) =>
    set((s) => {
      const x = s[i]!;
      const size = Math.max(2, Math.round(Math.min(x.at - s[i - 1]!.at, side) / 6));
      if (shape === 'straight' || shape === 'square') Object.assign(x, { to: shape, bulge: 0 });
      else Object.assign(x, { to: 'curve', bulge: (shape === 'cove' ? -1 : 1) * (Math.abs(x.bulge) || size) });
    });
  return (
    <div className={styles.pocketCard}>
      <div className={styles.pocketHead}>
        <span className={styles.pocketTitle}>{describeTurning(part, turning, n).replace(/^./, (c) => c.toUpperCase())}</span>
        <button type="button" className={styles.iconBtnSmall} aria-label={t('Sacar torneado')} title={t('Sacar torneado')} onClick={() => onChange(undefined)}>
          <IconTrash />
        </button>
      </div>
      <div className={styles.presets} role="group" aria-labelledby={presetId}>
        <span id={presetId} className={styles.muted}>
          {t('Arrancar de un modelo')}
        </span>
        {(Object.keys(TURN_PRESETS) as TurnPreset[]).map((k) => (
          <button key={k} type="button" className={styles.presetBtn} onClick={() => onChange(presetTurning(part, k))}>
            {t(TURN_PRESETS[k].name)}
          </button>
        ))}
      </div>
      <Profile part={part} turning={turning} />
      <p className={styles.muted}>{t('Taco de {side} × {side} × {len}. Ningún diámetro puede pasar el lado del taco.', { side: n(side), len: n(len) })}</p>
      <ol className={styles.stations}>
        {st.map((s, i) => {
          const shape = shapeOf(s);
          const inner = i > 0 && i < st.length - 1;
          return (
            <li key={i} className={styles.station}>
              <span className={styles.stationNum} aria-hidden>
                {i + 1}
              </span>
              <div className={styles.stationFields}>
                {inner ? (
                  <LengthField
                    compact
                    label={t('A')}
                    mm={s.at}
                    units={units}
                    min={0.5}
                    max={len - 0.5}
                    onCommit={(v) => set((x) => void (x[i]!.at = v))}
                  />
                ) : (
                  <span className={styles.stationEnd}>{i === 0 ? t('Punta de {side}', { side: t(MEASURED_FROM[turning.axis]) }) : t('Otra punta, a {n}', { n: n(len) })}</span>
                )}
                <LengthField compact label="Ø" mm={s.d} units={units} min={1} max={side} onCommit={(v) => set((x) => void (x[i]!.d = v))} />
                {i > 0 && (
                  <label className={styles.inlineField}>
                    <span className={styles.srOnly}>{t('Cómo llega desde la estación {n}', { n: i })}</span>
                    <select value={shape} onChange={(e) => setShape(i, e.target.value as Shape)}>
                      {SHAPES.map(([k, label]) => (
                        <option key={k} value={k}>
                          {t(label)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {s.to === 'curve' && (
                  <LengthField
                    compact
                    label={t('Curva')}
                    mm={Math.abs(s.bulge)}
                    units={units}
                    min={0.5}
                    onCommit={(v) => set((x) => void (x[i]!.bulge = Math.sign(x[i]!.bulge || 1) * v))}
                  />
                )}
              </div>
              {inner && (
                <button
                  type="button"
                  className={styles.iconBtnSmall}
                  aria-label={t('Borrar la estación {n}', { n: i + 1 })}
                  title={t('Borrar')}
                  onClick={() => set((x) => void x.splice(i, 1))}
                >
                  <IconTrash />
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" className={`${styles.btn} ${styles.addStation}`} onClick={() => onChange(addStation(part, turning))}>
        <IconPlus />
        {t('Agregar estación')}
      </button>
      <p className={styles.muted}>
        {t('La distancia se mide desde {side}. Entre una estación y la siguiente, el perfil va recto, en curva o queda cuadrado (para encastrar).', {
          side: t(MEASURED_FROM[turning.axis]),
        })}
      </p>
    </div>
  );
}

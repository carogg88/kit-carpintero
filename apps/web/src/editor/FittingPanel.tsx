import { useEffect, useId, useMemo, useState } from 'react';
import {
  boxSize,
  buildDoors,
  buildDrawers,
  doorProblem,
  drawerProblem,
  findOpenings,
  formatNumber,
  JOINT_NAMES,
  looseOpening,
  partBox,
  t,
  tk,
  type Box,
  type FrontStyle,
  type Opening,
  type Project,
  type Slides,
  type DoorStyle,
  type Units,
  type Vec3,
} from '@kitc/core';
import { LengthField } from './PartPanel';
import { useEditor, type FittingKind } from './store';
import { IconWarn } from './icons';
import styles from './Editor.module.css';
import own from './FittingPanel.module.css';

const FRONTS: [FrontStyle, string, string][] = [
  ['embutido', tk('Embutido'), tk('El frente queda adentro del hueco, al ras del mueble, con 2 mm de luz alrededor.')],
  ['superpuesto', tk('Superpuesto'), tk('El frente tapa los cantos del mueble. Es más fácil de ajustar.')],
];
const SLIDES: [Slides, string, string][] = [
  ['madera', tk('De madera'), tk('El cajón corre sobre el estante, como en los muebles antiguos. No hay que comprar nada.')],
  ['metalicas', tk('Metálicas'), tk('Correderas telescópicas: piden 12,5 mm por costado y vienen de 25 a 60 cm de largo.')],
];
const DOOR_STYLES: [DoorStyle, string, string][] = [
  ['tablero', tk('Tabla entera'), tk('Una sola tabla, o varias encoladas. La más simple.')],
  ['marco', tk('Marco y tablero'), tk('Largueros y peinazos con mortaja, y un tablero de 12 mm que flota en un canal: no se tuerce con la humedad.')],
];

/** Medida de un hueco suelto cuando el mueble no tiene ninguno cerrado. */
const LOOSE: Record<FittingKind, Vec3> = { cajon: [500, 150, 450], puerta: [400, 600, 350] };

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className={own.option}>
      <span className={styles.legend}>{label}</span>
      <div className={styles.seg} role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Frente del mueble, con los huecos numerados para elegir uno. */
function FrontMap({ project, openings, chosen, onChoose }: { project: Project; openings: Opening[]; chosen: number; onChoose: (i: number) => void }) {
  const boxes = project.parts.filter((p) => p.base.kind === 'box').map(partBox);
  const zFront = Math.max(...boxes.map((b) => b.max[2]));
  const front = boxes.filter((b) => b.max[2] >= zFront - 40);
  const x0 = Math.min(...front.map((b) => b.min[0]));
  const x1 = Math.max(...front.map((b) => b.max[0]));
  const y1 = Math.max(...front.map((b) => b.max[1]));
  const w = x1 - x0;
  const pad = Math.max(w, y1) * 0.04;
  // SVG con Y hacia abajo: el piso queda abajo.
  const rect = (b: Box) => ({ x: b.min[0], y: y1 - b.max[1], width: b.max[0] - b.min[0], height: b.max[1] - b.min[1] });
  return (
    <svg className={own.map} viewBox={`${x0 - pad} ${-pad} ${w + 2 * pad} ${y1 + 2 * pad}`} role="img" aria-label={t('Frente del mueble con {n} huecos', { n: openings.length })}>
      {front.map((b, i) => (
        <rect key={i} {...rect(b)} className={own.mapPart} />
      ))}
      {openings.map((o, i) => {
        const r = rect(o.box);
        const size = Math.min(r.width, r.height) * 0.42;
        return (
          <g key={i} className={own.mapHole} data-chosen={i === chosen || undefined} onClick={() => onChoose(i)}>
            <rect {...r} />
            <text x={r.x + r.width / 2} y={r.y + r.height / 2} fontSize={Math.min(size, Math.max(w, y1) * 0.07)} dominantBaseline="central" textAnchor="middle">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const fmt = (mm: number, units: Units) => formatNumber(mm, units);
const unit = (units: Units) => (units === 'cm' ? ' cm' : '″');

export function FittingPanel({ project, kind }: { project: Project; kind: FittingKind }) {
  const commit = useEditor((s) => s.commit);
  const select = useEditor((s) => s.select);
  const setFitting = useEditor((s) => s.setFitting);
  const setPreview = useEditor((s) => s.setFittingPreview);
  const units = project.units;
  const wood = project.parts[0]?.wood ?? 'guatambu';
  const openings = useMemo(() => findOpenings(project.parts), [project.parts]);
  const [chosen, setChosen] = useState(0);
  const [loose, setLoose] = useState<Vec3>(LOOSE[kind]);
  const [count, setCount] = useState(kind === 'cajon' ? 1 : openingWide(openings[0]) ? 2 : 1);
  const [front, setFront] = useState<FrontStyle>('embutido');
  const [slides, setSlides] = useState<Slides>('madera');
  const [doorStyle, setDoorStyle] = useState<DoorStyle>('marco');
  const problemId = useId();

  const opening = openings[Math.min(chosen, openings.length - 1)] ?? looseOpening(project.parts, loose);
  const isLoose = !openings.length;
  const problem = kind === 'cajon' ? drawerProblem(opening, { count, slides, front }) : doorProblem(opening, { count: count as 1 | 2 });
  const fitting = useMemo(() => {
    if (problem) return null;
    return kind === 'cajon'
      ? buildDrawers(project, opening, { count, front, slides, wood })
      : buildDoors(project, opening, { count: count as 1 | 2, front, style: doorStyle, wood });
  }, [problem, kind, project, opening, count, front, slides, doorStyle, wood]);

  useEffect(() => {
    setPreview(isLoose ? null : { opening: opening.box, parts: fitting?.parts.map(partBox) ?? [] });
  }, [isLoose, opening, fitting, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);

  const size = boxSize(opening.box);
  const n = (mm: number) => `${fmt(mm, units)}${unit(units)}`;
  const firstFront = fitting?.parts[0];
  const frontSize = firstFront?.base.kind === 'box' ? firstFront.base.size : null;
  const side = kind === 'cajon' ? fitting?.parts[1] : undefined;
  const drawerDepth = side?.base.kind === 'box' ? side.base.size[2] + 15 : null;
  // La hoja de una puerta: lo que ocupan todas sus piezas, repartido entre las hojas.
  const spans = fitting ? ([0, 1] as const).map((k) => Math.max(...fitting.parts.map((p) => partBox(p).max[k])) - Math.min(...fitting.parts.map((p) => partBox(p).min[k]))) : [0, 0];
  const leaf: [number, number] = [(spans[0]! - 3 * (count - 1)) / count, spans[1]!];
  const jointTypes = [...new Set(fitting?.joints.map((j) => t(JOINT_NAMES[j.type]).toLocaleLowerCase()) ?? [])];

  const add = () => {
    if (!fitting) return;
    const what =
      kind === 'cajon'
        ? count === 1 ? t('un cajón') : t('{n} cajones', { n: count })
        : count === 1 ? t('una puerta') : t('dos puertas');
    commit((d) => {
      d.parts.push(...fitting.parts);
      d.joints.push(...fitting.joints);
      d.components.push(...fitting.components);
    }, isLoose ? t('Agregaste {what} al costado del mueble', { what }) : t('Agregaste {what} en el hueco {n}', { what, n: chosen + 1 }));
    setFitting(null);
    if (fitting.parts[0]) select(fitting.parts[0].id);
  };

  const title = kind === 'cajon' ? t('Agregar cajón') : t('Agregar puerta');
  const addLabel =
    kind === 'cajon' ? (count === 1 ? t('Agregar cajón') : t('Agregar {n} cajones', { n: count })) : count === 1 ? t('Agregar puerta') : t('Agregar dos puertas');

  return (
    <>
      <div>
        <div className={styles.panelHead}>
          <span className={styles.eyebrow}>{kind === 'cajon' ? t('Frente, costados, trasera y fondo, con sus uniones') : t('Una hoja o dos, con sus uniones')}</span>
          <button type="button" className={styles.link} onClick={() => setFitting(null)}>
            {t('Cancelar')}
          </button>
        </div>
        <h2 className={styles.panelTitle}>{title}</h2>
      </div>

      {isLoose ? (
        <div className={styles.stack}>
          <span className={styles.legend}>{t('Medida del hueco')}</span>
          <p className={`${styles.muted} ${own.text}`}>
            {t('El mueble no tiene un hueco cerrado al frente, entre dos laterales y dos estantes. Escribí la medida del hueco y se arma al costado; después lo llevás a su lugar.')}
          </p>
          <div className={styles.dims}>
            {([tk('Ancho'), tk('Alto'), tk('Fondo')] as const).map((label, k) => (
              <LengthField
                key={label}
                label={t(label)}
                mm={loose[k]!}
                units={units}
                min={k === 2 ? 120 : 80}
                max={3000}
                onCommit={(mm) => setLoose((v) => v.map((x, i) => (i === k ? mm : x)) as Vec3)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.stack}>
          <span className={styles.legend}>{t('Elegí el hueco')}</span>
          <FrontMap project={project} openings={openings} chosen={chosen} onChoose={setChosen} />
          <div className={own.holes} role="group" aria-label={t('Huecos')}>
            {openings.map((o, i) => {
              const s = boxSize(o.box);
              return (
                <button key={i} type="button" aria-pressed={i === chosen} onClick={() => setChosen(i)}>
                  <strong>{i + 1}</strong>
                  <span>
                    {fmt(s[0], units)} × {fmt(s[1], units)}
                    {unit(units)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className={`${styles.muted} ${own.text}`}>
            {t('Hueco {n}: {w} de ancho, {h} de alto y {d} de hondo.', { n: chosen + 1, w: n(size[0]), h: n(size[1]), d: n(size[2]) })}
          </p>
        </div>
      )}

      <div className={own.options}>
        {kind === 'cajon' ? (
          <div className={own.option}>
            <span className={styles.legend} id={`${problemId}-n`}>
              {t('Cantidad')}
            </span>
            <div className={own.stepper} role="group" aria-labelledby={`${problemId}-n`}>
              <button type="button" aria-label={t('Uno menos')} disabled={count <= 1} onClick={() => setCount(count - 1)}>
                −
              </button>
              <output aria-live="polite">{count === 1 ? t('1 cajón') : t('{n} cajones', { n: count })}</output>
              <button type="button" aria-label={t('Uno más')} disabled={count >= 8} onClick={() => setCount(count + 1)}>
                +
              </button>
            </div>
          </div>
        ) : (
          <Seg label={t('Cantidad')} value={count} options={[[1, t('Una')], [2, t('Dos')]]} onChange={setCount} />
        )}
        <Seg label={t('Frente')} value={front} options={FRONTS.map(([v, l]) => [v, t(l)])} onChange={setFront} />
        <p className={`${styles.muted} ${own.text}`}>{t(FRONTS.find(([v]) => v === front)![2])}</p>
        {kind === 'cajon' ? (
          <>
            <Seg label={t('Correderas')} value={slides} options={SLIDES.map(([v, l]) => [v, t(l)])} onChange={setSlides} />
            <p className={`${styles.muted} ${own.text}`}>{t(SLIDES.find(([v]) => v === slides)![2])}</p>
          </>
        ) : (
          <>
            <Seg label={t('Tipo')} value={doorStyle} options={DOOR_STYLES.map(([v, l]) => [v, t(l)])} onChange={setDoorStyle} />
            <p className={`${styles.muted} ${own.text}`}>{t(DOOR_STYLES.find(([v]) => v === doorStyle)![2])}</p>
          </>
        )}
      </div>

      <div className={own.summary} aria-live="polite">
        {problem ? (
          <span className={styles.error} id={problemId}>
            <IconWarn />
            {problem}
          </span>
        ) : fitting && frontSize ? (
          <>
            <strong>
              {t('Suma {parts} piezas y {joints} uniones', { parts: fitting.parts.length, joints: fitting.joints.length })}
            </strong>
            <span>
              {kind === 'cajon'
                ? t('Cada frente mide {w} × {h}; el cajón tiene {d} de hondo.', { w: n(frontSize[0]), h: n(frontSize[1]), d: n(drawerDepth ?? 0) })
                : t('Cada hoja mide {w} × {h}.', { w: n(leaf[0]), h: n(leaf[1]) })}
              {jointTypes.length > 0 && ` ${t('Uniones: {list}.', { list: jointTypes.join(', ') })}`}
            </span>
          </>
        ) : null}
      </div>

      <div className={styles.panelActions}>
        <button type="button" className={own.primary} disabled={!fitting} aria-describedby={problem ? problemId : undefined} onClick={add}>
          {addLabel}
        </button>
      </div>
    </>
  );
}

/** Un hueco ancho (más de 60 cm) lleva dos puertas. */
function openingWide(o: Opening | undefined): boolean {
  return !!o && boxSize(o.box)[0] > 600;
}

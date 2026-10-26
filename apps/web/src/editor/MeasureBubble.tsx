import { useLayoutEffect, useRef, useState } from 'react';
import {
  depthUnder,
  faceSize,
  formatLength,
  formatNumber,
  MEASURED_FROM,
  newBevel,
  parseLength,
  partPlace,
  pocketTakesWholePart,
  setPlace,
  t,
  tk,
  type Part,
  type Project,
} from '@kitc/core';
import { IconClose, IconWarn } from './icons';
import { useEditor, type MeasureTarget } from './store';
import styles from './Editor.module.css';

/** Igual que en el panel: la medida se nombra por su dirección. */
const AXIS_LABELS = [tk('Ancho'), tk('Alto'), tk('Fondo')] as const;

/**
 * Burbuja junto a la pieza, donde se soltó el arrastre: muestra la medida que quedó y deja escribir la exacta.
 * Sirve para Estirar (el largo, ancho o espesor de esa cara), para Mover (cuánto se corrió y a qué altura), para Biselar (el bisel o el radio) y para Dibujar:
 * ahí se elige si lo dibujado es un vaciado o un calado y qué tan hondo baja.
 * `docked`: en el celular va dentro de la tarjeta de pasos, donde no tapa la pieza ni el dedo.
 */
export function MeasureBubble({ docked = false }: { docked?: boolean }) {
  const bubble = useEditor((s) => s.bubble);
  const project = useEditor((s) => s.project);
  const { commit, setBubble } = useEditor.getState();
  // Lo que se escribió en cada campo; sin tocar, el campo muestra la medida que quedó.
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ field: string; text: string } | null>(null);
  const [shownFor, setShownFor] = useState(bubble);
  const formRef = useRef<HTMLFormElement>(null);
  const [placed, setPlaced] = useState<{ left: number; top: number } | null>(null);
  if (shownFor !== bubble) {
    setShownFor(bubble);
    setTexts({});
    setError(null);
    setPlaced(null);
  }
  // Al lado de lo que se acaba de dibujar, no encima: se mide la burbuja y se busca un costado libre.
  useLayoutEffect(() => {
    const el = formRef.current;
    const stage = el?.offsetParent as HTMLElement | null;
    if (docked || !el || !stage || !bubble?.avoid) return;
    setPlaced(placeBeside(bubble.avoid, { w: el.offsetWidth, h: el.offsetHeight }, { w: stage.clientWidth, h: stage.clientHeight }));
  }, [bubble, docked]);
  if (!bubble || !project) return null;
  const { target } = bubble;
  const part = project.parts.find((p) => p.id === target.id);
  if (!part || part.base.kind !== 'box') return null;
  if (target.kind === 'move') return <MoveBubble key={`${bubble.x},${bubble.y}`} target={target} part={part} project={project} docked={docked} x={bubble.x} y={bubble.y} />;
  const units = project.units;
  const bevel = target.kind === 'bevel' ? part.bevels.find((b) => b.id === target.bevelId) : undefined;
  const pocket = target.kind === 'pocket' ? part.pockets.find((p) => p.id === target.pocketId) : undefined;
  if ((target.kind === 'bevel' && !bevel) || (target.kind === 'pocket' && !pocket)) return null;
  const thick = pocket ? depthUnder(part, pocket.axis) : 0;
  const current = target.kind === 'push' ? part.base.size[target.axis] : bevel ? bevel.da : pocket!.depth;
  const label =
    target.kind === 'push' ? t(AXIS_LABELS[target.axis]) : bevel ? (bevel.round ? t('Radio') : t('Bisel')) : t('Profundidad');
  // Rectángulos y círculos: la distancia a dos bordes de la cara, para ubicarlos justo (o centrarlos).
  const shape = pocket?.shape.kind === 'arc' || pocket?.shape.kind === 'path' ? undefined : pocket?.shape;
  const face = pocket ? faceSize(part, pocket.axis) : undefined;
  const extent = (i: 0 | 1) => (!shape ? 0 : shape.kind === 'rect' ? (i === 0 ? shape.w : shape.h) : 0);
  // El tamaño de lo dibujado, para dejarlo justo: el diámetro del círculo, o el ancho y el alto del rectángulo.
  const sizes: { key: 'd' | 'w' | 'h'; mm: number; label: string }[] = !shape
    ? []
    : shape.kind === 'circle'
      ? [{ key: 'd', mm: shape.d, label: t('Diámetro') }]
      : ([0, 1] as const).map((i) => ({ key: i === 0 ? 'w' : 'h', mm: extent(i), label: t(AXIS_LABELS[face!.axes[i]]) }));
  const at = (i: 0 | 1) => (!shape ? 0 : i === 0 ? shape.u : shape.v);
  const centered = (i: 0 | 1) => (face!.size[i] - extent(i)) / 2;
  const isCentered = !!shape && [0, 1].every((i) => Math.abs(at(i as 0 | 1) - centered(i as 0 | 1)) < 0.5);
  const fromLabel = (i: 0 | 1) => (shape?.kind === 'circle' ? t('Centro desde {side}', { side: t(MEASURED_FROM[face!.axes[i]]) }) : t('Desde {side}', { side: t(MEASURED_FROM[face!.axes[i]]) }));

  const shown = (key: string, mm: number) => texts[key] ?? formatNumber(mm, units);
  const edited = (key: string, mm: number) => texts[key] !== undefined && texts[key].trim() !== formatNumber(mm, units);
  const dirty = edited('main', current) || (!!shape && (edited('u', at(0)) || edited('v', at(1)) || sizes.some((f) => edited(f.key, f.mm))));
  const type = (key: string, value: string) => {
    setTexts((x) => ({ ...x, [key]: value }));
    setError(null);
  };

  const setThrough = (through: boolean) =>
    commit(
      (d) => {
        const q = d.parts.find((p) => p.id === target.id)?.pockets.find((p) => target.kind === 'pocket' && p.id === target.pocketId);
        if (q) q.through = through;
      },
      through ? t('{id} ahora es un calado', { id: pocket?.id ?? '' }) : t('{id} ahora es un vaciado', { id: pocket?.id ?? '' }),
    );

  const center = () => {
    setTexts((x) => ({ ...x, u: formatNumber(centered(0), units), v: formatNumber(centered(1), units) }));
    setError(null);
  };

  const apply = () => {
    // Sin cambios, el botón dice Listo y solo cierra.
    if (!dirty) return setBubble(null);
    const read = (key: string, mm: number, min: number, max: number) => {
      if (!edited(key, mm)) return mm;
      const v = parseLength(texts[key]!, units);
      if (v === null || v < min || v > max + 0.01) {
        setError({ field: key, text: v !== null && v > max ? t('Tiene que ser de {n} o menos', { n: formatNumber(max, units) }) : t('Medida no válida') });
        return null;
      }
      return v;
    };
    const minMain = target.kind === 'push' ? 3 : target.kind === 'bevel' ? 1 : 0.5;
    const v = read('main', current, minMain, Infinity);
    if (v === null) return;
    if (target.kind === 'push') {
      const dim = t(AXIS_LABELS[target.axis]).toLowerCase();
      commit((d) => {
        const q = d.parts.find((p) => p.id === target.id);
        if (!q || q.base.kind !== 'box') return;
        const max = q.position[target.axis] + q.base.size[target.axis];
        if (target.sign < 0) q.position[target.axis] = max - v;
        q.base.size[target.axis] = v;
      }, t('{id} ahora mide {size} de {dim}', { id: part.id, size: formatLength(v, units), dim }));
    } else if (target.kind === 'bevel') {
      commit((d) => {
        const q = d.parts.find((p) => p.id === target.id);
        const i = q?.bevels.findIndex((b) => b.id === target.bevelId) ?? -1;
        if (!q || i < 0) return;
        const old = q.bevels[i]!;
        q.bevels[i] = { ...newBevel(q as Part, old.a, old.b, v, old.round), id: old.id };
      });
    } else {
      if (!pocket!.through && v >= thick) return setError({ field: 'main', text: t('Tiene que ser menos que el espesor ({size})', { size: formatLength(thick, units) }) });
      // Primero el tamaño: de él depende hasta dónde se puede correr la figura.
      const next: Partial<Record<'d' | 'w' | 'h', number>> = {};
      for (const f of sizes) {
        const max = f.key === 'd' ? Math.min(...face!.size) : face!.size[f.key === 'w' ? 0 : 1];
        const mm = read(f.key, f.mm, 3, max);
        if (mm === null) return;
        next[f.key] = mm;
      }
      const room = (i: 0 | 1) => face!.size[i] - (shape?.kind === 'rect' ? (next[i === 0 ? 'w' : 'h'] ?? extent(i)) : 0);
      // Un círculo más grande corre el centro hacia adentro si hace falta, para que no se salga de la cara.
      const keep = (i: 0 | 1, mm: number) => (shape?.kind === 'circle' && next.d !== undefined ? Math.min(Math.max(mm, next.d / 2), face!.size[i] - next.d / 2) : mm);
      const u = shape ? read('u', at(0), 0, room(0)) : 0;
      if (u === null) return;
      const w = shape ? read('v', at(1), 0, room(1)) : 0;
      if (w === null) return;
      commit((d) => {
        const q = d.parts.find((p) => p.id === target.id)?.pockets.find((p) => p.id === target.pocketId);
        if (!q) return;
        q.depth = v;
        if (q.shape.kind === 'circle' && next.d !== undefined) q.shape.d = next.d;
        if (q.shape.kind === 'rect') [q.shape.w, q.shape.h] = [next.w ?? q.shape.w, next.h ?? q.shape.h];
        if (shape && (q.shape.kind === 'rect' || q.shape.kind === 'circle')) [q.shape.u, q.shape.v] = [keep(0, u), keep(1, w)];
      });
    }
    setBubble(null);
  };

  const id = docked ? 'medida-celu' : 'medida';
  const unit = <span className={styles.bubbleId}>{units === 'cm' ? 'cm' : t('pulg.')}</span>;
  const field = (key: string, mm: number, inputId: string, extra?: { className?: string; label?: string }) => (
    <input
      id={inputId}
      className={extra?.className}
      inputMode="decimal"
      autoComplete="off"
      value={shown(key, mm)}
      onFocus={(e) => e.currentTarget.select()}
      aria-label={extra?.label}
      aria-invalid={error?.field === key}
      aria-describedby={error?.field === key ? `${id}-error` : undefined}
      onChange={(e) => type(key, e.target.value)}
    />
  );
  const errorLine = error && (
    <span id={`${id}-error`} className={styles.error} role="alert">
      {error.text}
    </span>
  );
  const okButton = (
    <button type="submit" className={styles.bubbleOk}>
      {dirty ? t('Aplicar') : t('Listo')}
    </button>
  );
  const closeButton = (
    <button type="button" className={styles.bubbleClose} aria-label={t('Cerrar')} onClick={() => setBubble(null)}>
      <IconClose />
    </button>
  );
  const centerButton = (
    <button type="button" className={styles.bubbleCenter} aria-pressed={isCentered && !texts.u && !texts.v} onClick={center}>
      {t('Centrar')}
    </button>
  );
  const fallback = { left: `clamp(8px, ${bubble.x - 110}px, calc(100% - 228px))`, top: `clamp(56px, ${bubble.y - 76}px, calc(100% - 136px))` };
  return (
    <form
      ref={formRef}
      className={docked ? styles.bubbleDocked : styles.bubble}
      data-wide={(!docked && !!shape) || undefined}
      style={docked ? undefined : placed ? { left: placed.left, top: placed.top } : bubble.avoid ? { ...fallback, visibility: 'hidden' } : fallback}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onKeyDown={(e) => e.key === 'Escape' && setBubble(null)}
    >
      {pocket && (
        <div className={styles.bubbleHead}>
          <div className={styles.segmented} role="group" aria-label={t('Qué se saca')}>
            <button type="button" aria-pressed={!pocket.through} onClick={() => setThrough(false)}>
              {t('Vaciado')}
            </button>
            <button type="button" aria-pressed={pocket.through} onClick={() => setThrough(true)}>
              {t('Calado')}
            </button>
          </div>
          <span className={styles.bubbleId}>{pocket.id}</span>
          {(pocket.through || shape) && closeButton}
        </div>
      )}
      {pocket && pocketTakesWholePart(part, pocket) && (
        <span className={styles.error} role="alert">
          <IconWarn />
          {t('Este calado se lleva toda la pieza: achicalo o cambialo a vaciado.')}
        </span>
      )}
      {docked && shape ? (
        // En el celular, todo junto en poco alto: la profundidad y las dos distancias en una fila, y abajo Centrar y Listo.
        <>
          {pocket?.through && <span className={styles.bubbleHint}>{t('Atraviesa los {size} de la pieza', { size: formatLength(thick, units) })}</span>}
          <div className={styles.bubbleFields} data-count={sizes.length}>
            {sizes.map((f) => (
              <label key={f.key} className={styles.bubbleSmall}>
                <span>
                  {f.label} {unit}
                </span>
                {field(f.key, f.mm, `${id}-${f.key}`)}
              </label>
            ))}
          </div>
          <div className={styles.bubbleFields} data-count={pocket?.through ? 2 : 3}>
            {!pocket?.through && (
              <label className={styles.bubbleSmall}>
                <span>
                  {label} {unit}
                </span>
                {field('main', current, id)}
              </label>
            )}
            {([0, 1] as const).map((i) => (
              <label key={i} className={styles.bubbleSmall}>
                <span>{fromLabel(i)}</span>
                {field(i === 0 ? 'u' : 'v', at(i), `${id}-${i ? 'v' : 'u'}`)}
              </label>
            ))}
          </div>
          {errorLine}
          <div className={styles.bubbleFoot}>
            {centerButton}
            {/* Sin cambios no hace falta: la tarjeta ya tiene Listo para terminar de dibujar. */}
            {dirty && okButton}
          </div>
        </>
      ) : (
        <>
          {pocket?.through ? (
            <span className={styles.bubbleHint}>{t('Atraviesa los {size} de la pieza', { size: formatLength(thick, units) })}</span>
          ) : (
            <>
              <label htmlFor={id}>
                {label} {!pocket && <span className={styles.bubbleId}>{part.id}</span>} {unit}
              </label>
              <div className={styles.bubbleRow}>
                {field('main', current, id)}
                {!shape && okButton}
                {!shape && closeButton}
              </div>
            </>
          )}
          {shape && (
            <div className={styles.bubblePlace} role="group" aria-labelledby={`${id}-size`}>
              <span id={`${id}-size`} className={styles.bubblePlaceTitle}>
                {t('Tamaño')} {unit}
              </span>
              {sizes.map((f) => (
                <label key={f.key} className={styles.bubbleSmall}>
                  <span>{f.label}</span>
                  {field(f.key, f.mm, `${id}-${f.key}`)}
                </label>
              ))}
            </div>
          )}
          {shape && (
            <div className={styles.bubblePlace} role="group" aria-labelledby={`${id}-place`}>
              <span id={`${id}-place`} className={styles.bubblePlaceTitle}>
                {t('Distancia a los bordes')}
              </span>
              {centerButton}
              {([0, 1] as const).map((i) => (
                <label key={i} className={styles.bubbleSmall}>
                  <span>{fromLabel(i)}</span>
                  {field(i === 0 ? 'u' : 'v', at(i), `${id}-${i ? 'v' : 'u'}`)}
                </label>
              ))}
            </div>
          )}
          {errorLine}
          {shape && dirty && <div className={styles.bubbleFoot}>{okButton}</div>}
        </>
      )}
    </form>
  );
}

/**
 * Burbuja de Mover: cuánto se corrió la pieza a lo ancho y a lo fondo (hacia donde se la arrastró) y a qué
 * altura del piso queda.
 */
function MoveBubble({ target, part, project, docked, x, y }: { target: Extract<MeasureTarget, { kind: 'move' }>; part: Part; project: Project; docked: boolean; x: number; y: number }) {
  const { commit, setBubble } = useEditor.getState();
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ field: string; text: string } | null>(null);
  const units = project.units;
  const sign = (k: 0 | 2) => (part.position[k] - target.from[k] < 0 ? -1 : 1);
  const values = { x: Math.abs(part.position[0] - target.from[0]), z: Math.abs(part.position[2] - target.from[2]), y: partPlace(project.parts, part)[1] };
  const labels = {
    x: sign(0) < 0 ? t('A la izquierda') : t('A la derecha'),
    z: sign(2) < 0 ? t('Hacia atrás') : t('Hacia adelante'),
    y: t('Del piso'),
  };
  const keys = ['x', 'z', 'y'] as const;
  const edited = (k: (typeof keys)[number]) => texts[k] !== undefined && texts[k].trim() !== formatNumber(values[k], units);
  const dirty = keys.some(edited);
  const id = docked ? 'medida-celu' : 'medida';

  const apply = () => {
    if (!dirty) return setBubble(null);
    const read: Partial<Record<(typeof keys)[number], number>> = {};
    for (const k of keys) {
      if (!edited(k)) continue;
      const v = parseLength(texts[k]!, units);
      if (v === null || v < 0) return setError({ field: k, text: t('Medida no válida') });
      read[k] = v;
    }
    commit((d) => {
      const q = d.parts.find((p) => p.id === part.id);
      if (!q) return;
      if (read.x !== undefined) q.position[0] = target.from[0] + sign(0) * read.x;
      if (read.z !== undefined) q.position[2] = target.from[2] + sign(2) * read.z;
      if (read.y !== undefined) setPlace(d.parts as Part[], part.id, 1, read.y);
    }, t('Moviste {id}', { id: part.id }));
    setBubble(null);
  };

  return (
    <form
      className={docked ? styles.bubbleDocked : styles.bubble}
      data-wide={!docked || undefined}
      // Arriba de donde se soltó: abajo quedan el aviso de lo que se hizo y la tarjeta de pasos.
      style={docked ? undefined : { left: `clamp(8px, ${x - 134}px, calc(100% - 276px))`, top: `clamp(56px, ${y - 220}px, calc(100% - 330px))` }}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onKeyDown={(e) => e.key === 'Escape' && setBubble(null)}
    >
      <div className={styles.bubbleHead}>
        <span className={styles.bubbleId}>
          {t('Mover {id}', { id: part.id })} · {units === 'cm' ? 'cm' : t('pulg.')}
        </span>
        <button type="button" className={styles.bubbleClose} aria-label={t('Cerrar')} onClick={() => setBubble(null)}>
          <IconClose />
        </button>
      </div>
      <div className={styles.bubbleFields}>
        {keys.map((k, i) => (
          <label key={k} className={styles.bubbleSmall}>
            <span>{labels[k]}</span>
            <input
              id={i === 0 ? id : `${id}-${k}`}
              inputMode="decimal"
              autoComplete="off"
              value={texts[k] ?? formatNumber(values[k], units)}
              onFocus={(e) => e.currentTarget.select()}
              aria-invalid={error?.field === k}
              aria-describedby={error?.field === k ? `${id}-error` : undefined}
              onChange={(e) => {
                setTexts((s) => ({ ...s, [k]: e.target.value }));
                setError(null);
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {error.text}
        </span>
      )}
      <div className={styles.bubbleFoot}>
        <button type="submit" className={styles.bubbleOk}>
          {dirty ? t('Aplicar') : t('Listo')}
        </button>
      </div>
    </form>
  );
}

/** Lugar para una caja de `size` junto a `box` sin taparla: a la derecha, a la izquierda, abajo o arriba. */
export function placeBeside(
  box: { x0: number; y0: number; x1: number; y1: number },
  size: { w: number; h: number },
  stage: { w: number; h: number },
): { left: number; top: number } {
  const gap = 16;
  // Lo que ocupan las herramientas a la izquierda, las vistas arriba y la tarjeta de pasos abajo.
  const [minX, minY, maxX, maxY] = [88, 64, stage.w - 8, stage.h - 72];
  const fitX = (x: number) => Math.min(Math.max(x, minX), Math.max(minX, maxX - size.w));
  const fitY = (y: number) => Math.min(Math.max(y, minY), Math.max(minY, maxY - size.h));
  const midY = (box.y0 + box.y1) / 2 - size.h / 2;
  const midX = (box.x0 + box.x1) / 2 - size.w / 2;
  const candidates = [
    { left: box.x1 + gap, top: fitY(midY) },
    { left: box.x0 - gap - size.w, top: fitY(midY) },
    { left: fitX(midX), top: box.y1 + gap },
    { left: fitX(midX), top: box.y0 - gap - size.h },
  ];
  const inside = (c: { left: number; top: number }) => c.left >= minX && c.top >= minY && c.left + size.w <= maxX && c.top + size.h <= maxY;
  const found = candidates.find(inside);
  if (found) return found;
  // Si la figura ocupa casi todo, la esquina que menos la tapa.
  const corners = [
    { left: minX, top: minY },
    { left: maxX - size.w, top: minY },
    { left: minX, top: maxY - size.h },
    { left: maxX - size.w, top: maxY - size.h },
  ];
  const overlap = (c: { left: number; top: number }) =>
    Math.max(0, Math.min(c.left + size.w, box.x1) - Math.max(c.left, box.x0)) * Math.max(0, Math.min(c.top + size.h, box.y1) - Math.max(c.top, box.y0));
  return corners.reduce((a, b) => (overlap(b) < overlap(a) ? b : a));
}

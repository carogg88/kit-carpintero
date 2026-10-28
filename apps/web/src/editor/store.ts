import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { applyReviewFix, formatLength, groupOf, nearMisses, type NearMiss, isWholeGroup, partsBox, syncComponents, syncGroups, syncJoints, t, type Bevel, type Box, type CornerKind, type FaceCorner, type PathPoint, type PocketShape, type Project, type Section, type Units } from '@kitc/core';

/** Corte para ver por adentro: de frente (Z), de costado (X) o de arriba (Y), y dónde. */
export interface Cut {
  axis: 0 | 1 | 2;
  at: number;
}

export type Tool = 'select' | 'push' | 'move' | 'draw' | 'bevel' | 'section' | 'turn' | 'measure';
export type View = 'iso' | 'front' | 'side' | 'top';

/** Última cara empujada: la medida que se escribe abajo se aplica a ella. */
export interface LastPush {
  id: string;
  axis: 0 | 1 | 2;
  sign: 1 | -1;
}

/** Cara elegida para dibujar: la cámara la mira de frente. */
export interface DrawFace {
  partId: string;
  axis: 0 | 1 | 2;
  side: 1 | -1;
}

/** Lo que se acaba de estirar, mover, biselar o dibujar: la burbuja de medida junto a la pieza lo cambia. */
export type MeasureTarget =
  | ({ kind: 'push' } & LastPush)
  | { kind: 'bevel'; id: string; bevelId: string }
  | { kind: 'pocket'; id: string; pocketId: string }
  /** Lo que se acaba de mover: `from` es dónde estaba antes del arrastre. */
  | { kind: 'move'; id: string; from: [number, number, number] };

/** Burbuja para escribir la medida exacta, donde se soltó el arrastre (en píxeles de la vista 3D). */
export interface Bubble {
  target: MeasureTarget;
  x: number;
  y: number;
  /** Lo que la burbuja no tiene que tapar, en los mismos píxeles: la figura recién dibujada. */
  avoid?: { x0: number; y0: number; x1: number; y1: number };
}

/** `free`: trazo a mano alzada, que queda como perfil a mano. `corner`: forma de esquina lista. */
export type DrawShape = 'rect' | 'circle' | 'arc' | 'path' | 'free' | 'corner';

/** Forma de esquina elegida en una cara: cuál esquina, qué forma y cuánto toma por cada borde (mm). */
export type CornerPick = DrawFace & { corner: FaceCorner; kind: CornerKind; a: number; b: number };

/** Foto o dibujo puesto sobre una cara para calcar encima. Solo mientras dura la sesión: no va al archivo. */
export type TraceImage = DrawFace & { url: string; name: string };

/** Suelta la foto de calcar: la URL del archivo deja de ocupar memoria. */
function dropTrace(img: TraceImage | null): null {
  if (img) URL.revokeObjectURL(img.url);
  return null;
}

/** Cuerda de un arco ya marcada: falta decir cuánto se curva. */
export type ArcChord = DrawFace & { u: number; v: number; u2: number; v2: number };

/** Cara tocada con Medir: la pieza y de qué lado. */
export interface MeasurePick {
  partId: string;
  axis: 0 | 1 | 2;
  side: 1 | -1;
}

/** Panel para agregar un cajón o una puerta en un hueco del mueble. */
export type FittingKind = 'cajon' | 'puerta' | 'estantes';

const HISTORY = 80;

interface EditorState {
  project: Project | null;
  past: Project[];
  future: Project[];
  /** Hay un arrastre en curso: los cambios no pasan por el historial ni recalculan encastres. */
  dragging: boolean;
  selectedId: string | null;
  /** Varias piezas elegidas juntas (un grupo, o Shift + clic): dos o más. Con esto, `selectedId` queda vacío. */
  picked: string[];
  /** Cada toque en el modelo suma o saca piezas de las elegidas, como Shift + clic (para el celular). */
  addMode: boolean;
  tool: Tool;
  xray: boolean;
  /** Probando el mueble: tocar un cajón o una puerta lo abre o lo cierra, y no se edita nada. */
  trying: boolean;
  /** Cuánto está abierto cada cajón, puerta o tapa (por el id del movimiento), de 0 a 1. Solo probando. */
  opened: Record<string, number>;
  /** Corte para ver por adentro: de qué lado y dónde, de 0 (un extremo del mueble) a 1 (el otro). Solo probando. */
  cut: Cut | null;
  /** Separar piezas: el mueble abierto en despiece, de 0 (armado) a 1 (todo separado). Solo probando. */
  apart: number;
  /** Mover deja una copia en lugar de mover la pieza (botón del celular; en la compu, Ctrl u Opción). */
  copyMove: boolean;
  view: View;
  /** Se incrementa para pedir que la cámara vuelva a encuadrar. */
  viewNonce: number;
  lastPush: LastPush | null;
  /** Cartel junto al dedo o al puntero mientras se arrastra. */
  hint: DragHint | null;
  drawFace: DrawFace | null;
  /** La cámara se puso de frente a la cara (se eligió con un toque); si se dibujó de entrada, la vista no se movió. */
  drawFramed: boolean;
  drawShape: DrawShape;
  /** La herramienta de biselar redondea en vez de cortar recto. */
  bevelRound: boolean;
  /** Figura que se está dibujando, para verla antes de soltar. */
  draft: (DrawFace & { shape: PocketShape }) | null;
  /** Bisel que se está marcando, para verlo antes de soltar. */
  bevelDraft: { partId: string; bevel: Bevel } | null;
  /** Tramo que se está marcando con el dedo o el mouse. */
  sectionDraft: { partId: string; section: Section } | null;
  arcChord: ArcChord | null;
  /** Perfil a mano: los puntos ya marcados sobre la cara elegida, y si el próximo va en curva o en esquina. */
  pathPoints: PathPoint[];
  pathCorner: boolean;
  /** Perfil a mano abierto: saca el otro lado (el más grande) en vez del más chico. */
  pathFlip: boolean;
  /**
   * Qué se saca con lo que se dibuja, elegido antes de dibujar: calado (atraviesa) o vaciado, y qué tan hondo en mm.
   * `null`: según la figura (el rectángulo, vaciado hasta la mitad; lo demás, calado).
   */
  drawThrough: boolean | null;
  drawDepth: number | null;
  /** Forma de esquina: la esquina tocada, mientras se eligen la forma y las medidas. */
  cornerPick: CornerPick | null;
  /** La última forma de esquina usada: la próxima esquina arranca con esa. */
  cornerKind: CornerKind;
  traceImage: TraceImage | null;
  /** Aviso de lo que acaba de cambiar, con la opción de deshacerlo. `key` cambia con cada aviso nuevo. */
  notice: Notice | null;
  bubble: Bubble | null;
  /** Se está agregando un cajón o una puerta: el panel muestra las opciones. */
  fitting: FittingKind | null;
  /** El hueco elegido y las piezas que se van a sumar, marcados en la vista 3D. */
  fittingPreview: { opening: Box; parts: Box[] } | null;
  /**
   * Cómo quedaría el mueble: las piezas que cambian, aparecen o se van se dibujan encima del modelo. Sale de un
   * cambio grande por confirmar (`pending`) o de una medida que se está escribiendo.
   */
  ghost: Project | null;
  /** Cambio grande que espera Aplicar o Cancelar. `select`: la pieza que queda elegida al aplicar. */
  pending: Pending | null;
  /** Piezas ocultas en la vista 3D, para trabajar con las demás. Es solo de la vista: el proyecto no cambia. */
  hidden: string[];
  /** Unión que se pidió ver de cerca desde el Modelo: Uniones la abre al entrar. */
  jointFocus: string | null;
  /** Con qué se llegó a esa unión desde un aviso: la medida a marcar y qué dice la revisión. */
  jointHint: { field: string; text: string } | null;
  /** Las dos piezas que se están midiendo: la segunda falta hasta el segundo toque. */
  measure: { a: MeasurePick | null; b: MeasurePick | null };

  open: (p: Project) => void;
  close: () => void;
  /** Cambio con historial: una acción, un paso de deshacer. */
  commit: (recipe: (p: Draft<Project>) => void, label?: string) => void;
  beginDrag: () => void;
  /** Cambio en vivo durante el arrastre. */
  dragUpdate: (recipe: (p: Draft<Project>) => void) => void;
  endDrag: (lastPush?: LastPush, label?: string) => void;
  /** Termina el arrastre sin cambios: vuelve a como estaba antes de empezar. */
  cancelDrag: () => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  /** Elige estas piezas juntas; con una sola, es como `select`. */
  pick: (ids: string[]) => void;
  /**
   * Un toque en una pieza con Elegir. Si es de un grupo, elige el grupo entero; otro toque con el grupo ya elegido
   * entra a esa pieza. `add` (Shift o Elegir varias) suma o saca la pieza, o el grupo, de las elegidas.
   */
  tapPart: (id: string, add: boolean) => void;
  setAddMode: (on: boolean) => void;
  setJointFocus: (id: string | null, hint?: { field: string; text: string }) => void;
  setTool: (t: Tool) => void;
  setXray: (on: boolean) => void;
  setTrying: (on: boolean) => void;
  /** Abre lo cerrado y cierra lo abierto. */
  toggleOpen: (id: string) => void;
  /** Todos a la vez, a la misma apertura (la barra Abrir todo). */
  openAll: (ids: readonly string[], open: number) => void;
  setCut: (cut: Cut | null) => void;
  /** Separar piezas: con el mueble abierto, los cajones y puertas se cierran. */
  setApart: (apart: number) => void;
  setCopyMove: (on: boolean) => void;
  setView: (v: View) => void;
  setUnits: (u: Units) => void;
  setHint: (h: DragHint | null) => void;
  setDrawFace: (f: DrawFace | null, frame?: boolean) => void;
  setDrawShape: (s: DrawShape) => void;
  setDrawCut: (through: boolean, depth?: number | null) => void;
  setPathFlip: (flip: boolean) => void;
  setCornerPick: (c: CornerPick | null) => void;
  setTraceImage: (img: TraceImage | null) => void;
  setBevelRound: (round: boolean) => void;
  setDraft: (d: EditorState['draft']) => void;
  setBevelDraft: (d: EditorState['bevelDraft']) => void;
  setSectionDraft: (d: EditorState['sectionDraft']) => void;
  setArcChord: (c: ArcChord | null) => void;
  setPathPoints: (points: PathPoint[]) => void;
  setPathCorner: (corner: boolean) => void;
  dismissNotice: () => void;
  /** Aviso sin cambio que deshacer: algo no se pudo hacer y por qué. */
  warn: (text: string) => void;
  setBubble: (b: Bubble | null) => void;
  setFitting: (f: FittingKind | null) => void;
  setFittingPreview: (p: EditorState['fittingPreview']) => void;
  /** Muestra el cambio en fantasma y espera Aplicar o Cancelar. */
  propose: (recipe: (p: Draft<Project>) => void, label: string, opts?: { title?: string; select?: string | string[] }) => void;
  applyPending: () => void;
  cancelPending: () => void;
  /** Fantasma mientras se escribe una medida; null lo borra. */
  setGhost: (recipe: ((p: Draft<Project>) => void) | null) => void;
  /** Oculta estas piezas (y muestra las demás). */
  setHidden: (ids: string[]) => void;
  /** Un toque con Medir: el primero elige A, el segundo B; uno más empieza de nuevo. null borra todo. */
  pickMeasure: (pick: MeasurePick | null) => void;
  /** Corre las piezas unos milímetros (flechas del teclado). Los toques seguidos son un solo paso de deshacer. */
  nudge: (ids: string[], axis: 0 | 1 | 2, mm: number, arrow: string) => void;
}

export interface Pending {
  recipe: (p: Draft<Project>) => void;
  /** Lo que dice el aviso al aplicar. */
  label: string;
  /** Lo que dice la barra de vista previa; si falta, el aviso. */
  title: string;
  select?: string | string[];
}

export interface Notice {
  text: string;
  key: number;
  /** false: no hubo cambio, el aviso no lleva Deshacer. */
  undo?: boolean;
  /** Un arreglo que se ofrece ahí mismo, como cerrar una luz que quedó al soltar. */
  action?: { label: string; run: () => void };
}

export interface DragHint {
  x: number;
  y: number;
  text: string;
  snap: string | null;
  /** Al mover: a cuánto quedan las piezas vecinas de cada lado. */
  dims?: string;
  /** Así no vale: se dice en lugar del imán. */
  warn?: string;
  /** Al mover: la unión que sale con la vecina que toca. */
  joint?: string;
  /** Al mover: dónde se mete en otra pieza, se pinta. */
  clash?: Box[];
}

const touch = (p: Draft<Project>) => {
  p.updatedAt = new Date().toISOString();
};

/** Aplica el cambio, iguala las copias de cada componente y deja los encastres al día con las piezas. */
const apply = (p: Project, recipe: (p: Draft<Project>) => void, sync: boolean) =>
  produce(p, (d) => {
    recipe(d);
    syncComponents(p, d as Project);
    syncGroups(d as Project);
    if (sync) d.joints = syncJoints(d.parts as Project['parts'], d.joints as Project['joints'], p.parts);
    touch(d);
  });

/**
 * Lo que se dice después de un cambio: qué se hizo (si se dijo), qué uniones se soltaron y qué espigas se ajustaron
 * solas al espesor nuevo de su pieza. Una unión se suelta
 * cuando dos piezas que siguen en el proyecto dejan de tocarse; si se borró una pieza, el aviso ya lo dice.
 */
export function changeNotice(before: Project, after: Project, label?: string): string | null {
  const pair = (a: string, b: string) => [a, b].sort().join('|');
  const kept = new Set(after.joints.map((j) => pair(j.partA, j.partB)));
  const ids = new Set(after.parts.map((p) => p.id));
  const lost = [...new Set(before.joints.filter((j) => ids.has(j.partA) && ids.has(j.partB) && !kept.has(pair(j.partA, j.partB))).map((j) => pair(j.partA, j.partB)))];
  const loose: string | null =
    lost.length === 1 ? t('se soltó la unión de {a} con {b}', { a: lost[0]!.split('|')[0]!, b: lost[0]!.split('|')[1]! }) : lost.length ? t('se soltaron {n} uniones', { n: lost.length }) : null;
  // Espigas que cambiaron solas porque su pieza cambió de espesor (no las que se editaron en Uniones).
  const boxOf = (p: Project, id: string) => {
    const q = p.parts.find((x) => x.id === id);
    return q?.base.kind === 'box' ? `${q.base.size.join()}` : '';
  };
  const refit = after.joints.filter((j) => {
    const old = before.joints.find((x) => x.id === j.id);
    return j.type === 'mortaja' && old?.type === 'mortaja' && old.params.thickness !== j.params.thickness && boxOf(before, j.partB) !== boxOf(after, j.partB);
  });
  const fitted =
    refit.length === 1
      ? t('ajusté la espiga de {a} con {b} al espesor nuevo', { a: refit[0]!.partA, b: refit[0]!.partB })
      : refit.length
        ? t('ajusté la espiga de {n} uniones al espesor nuevo', { n: refit.length })
        : null;
  const extra = [loose, fitted].filter(Boolean).join(' · ');
  if (!extra) return label ?? null;
  return label ? `${label} · ${extra}` : extra.replace(/^./, (c) => c.toUpperCase());
}

let noticeKey = 0;

/** Lo elegido, con lo que quedó después de un cambio: se va lo que se borró, y con una sola pieza deja de ser varias. */
const keepSelection = (s: { selectedId: string | null; picked: string[] }, p: Project) => {
  const ids = new Set(p.parts.map((x) => x.id));
  const out: { selectedId?: null | string; picked?: string[] } = {};
  if (s.selectedId && !ids.has(s.selectedId)) out.selectedId = null;
  const picked = s.picked.filter((id) => ids.has(id));
  if (picked.length !== s.picked.length) {
    out.picked = picked.length > 1 ? picked : [];
    if (picked.length === 1) out.selectedId = picked[0]!;
  }
  return out;
};

/** Cómo se nombran varias piezas en un aviso: el grupo, si son justo un grupo; si no, cuántas son. */
export function partsLabel(p: Project, ids: readonly string[]): string {
  if (ids.length === 1) return ids[0]!;
  const g = groupOf(p, ids[0] ?? '');
  return isWholeGroup(g, ids) ? g.name : t('{n} piezas', { n: ids.length });
}

/** Toques de flecha seguidos sobre la misma pieza y el mismo eje: se juntan en un paso. */
const NUDGE_MS = 1500;
let lastNudge: { id: string; axis: number; at: number; before: Project; after: Project } | null = null;
const OPPOSITE: Record<string, string> = { '→': '←', '←': '→', '↑': '↓', '↓': '↑' };
const noticeFor = (before: Project, after: Project, label?: string) => {
  const text = changeNotice(before, after, label);
  const gap = newGap(before, after);
  if (gap) return { notice: { text: text ? `${text}. ${gap.text}` : gap.text, key: ++noticeKey, action: gap.action } };
  return text ? { notice: { text, key: ++noticeKey } } : {};
};

/** Una luz chica entre dos piezas que el cambio dejó (antes no estaba): el aviso ofrece cerrarla. */
function newGap(before: Project, after: Project): Pick<Notice, 'text' | 'action'> | null {
  if (before.parts === after.parts) return null;
  const n = (mm: number) => formatLength(mm, after.units);
  const pair = (m: NearMiss) => `${m.a}|${m.b}`;
  const old = new Set(nearMisses(before, n).map(pair));
  const miss = nearMisses(after, n).find((m) => !old.has(pair(m)));
  if (!miss) return null;
  return {
    text: t('{b} quedó a {mm} de {a}: sin unión', { a: miss.a, b: miss.b, mm: n(miss.gap) }),
    action: { label: t('Cerrar la luz'), run: () => useEditor.getState().commit((d) => applyReviewFix(d, miss.fix), miss.fix.label) },
  };
}

export const useEditor = create<EditorState>()((set, get) => ({
  project: null,
  past: [],
  future: [],
  dragging: false,
  selectedId: null,
  picked: [],
  addMode: false,
  jointFocus: null,
  jointHint: null,
  tool: 'select',
  xray: false,
  trying: false,
  opened: {},
  cut: null,
  apart: 0,
  copyMove: false,
  view: 'iso',
  viewNonce: 0,
  lastPush: null,
  hint: null,
  drawFace: null,
  drawFramed: false,
  drawShape: 'rect',
  bevelRound: false,
  draft: null,
  bevelDraft: null,
  sectionDraft: null,
  arcChord: null,
  pathPoints: [],
  pathCorner: false,
  pathFlip: false,
  drawThrough: null,
  drawDepth: null,
  cornerPick: null,
  cornerKind: 'redondeo',
  traceImage: null,
  notice: null,
  bubble: null,
  fitting: null,
  fittingPreview: null,
  ghost: null,
  pending: null,
  hidden: [],
  measure: { a: null, b: null },

  open: (project) =>
    set({ jointFocus: null, jointHint: null, picked: [], addMode: false, measure: { a: null, b: null }, hidden: [], fitting: null, fittingPreview: null, ghost: null, pending: null, project, past: [], future: [], selectedId: null, lastPush: null, dragging: false, view: 'iso', drawFace: null, draft: null, arcChord: null, pathPoints: [], pathFlip: false, cornerPick: null, traceImage: dropTrace(get().traceImage), notice: null, bubble: null, trying: false, opened: {}, cut: null, apart: 0 }),
  close: () => set({ project: null, past: [], future: [], selectedId: null, picked: [], addMode: false, notice: null, bubble: null, trying: false, opened: {}, cut: null, apart: 0 }),

  commit: (recipe, label) => {
    const { project, past } = get();
    if (!project) return;
    const next = apply(project, recipe, true);
    set({ project: next, past: [...past, project].slice(-HISTORY), future: [], ghost: null, pending: null, ...noticeFor(project, next, label) });
    set(keepSelection(get(), next));
  },

  beginDrag: () => {
    const { project, past } = get();
    if (!project) return;
    set({ dragging: true, past: [...past, project].slice(-HISTORY), future: [], bubble: null, ghost: null, pending: null });
  },
  dragUpdate: (recipe) => {
    const { project } = get();
    if (project) set({ project: apply(project, recipe, false) });
  },
  endDrag: (lastPush, label) => {
    const { project, past } = get();
    if (!project) return;
    const next = apply(project, () => {}, true);
    const before = past.at(-1);
    set({ dragging: false, project: next, ...(lastPush ? { lastPush } : {}), ...(before ? noticeFor(before, next, label) : {}) });
  },

  cancelDrag: () => {
    const { past } = get();
    const prev = past.at(-1);
    if (!prev) return;
    set({ dragging: false, project: prev, past: past.slice(0, -1) });
    set(keepSelection(get(), prev));
  },

  undo: () => {
    const { project, past, future } = get();
    const prev = past.at(-1);
    if (!project || !prev) return;
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], notice: null, bubble: null, ghost: null, pending: null });
    set(keepSelection(get(), prev));
  },
  redo: () => {
    const { project, past, future } = get();
    const next = future[0];
    if (!project || !next) return;
    set({ project: next, past: [...past, project], future: future.slice(1), notice: null, bubble: null, ghost: null, pending: null });
    set(keepSelection(get(), next));
  },

  select: (selectedId) =>
    set((s) => ({
      // Elegir una pieza oculta (en la lista) la vuelve a mostrar.
      ...(selectedId && s.hidden.includes(selectedId) ? { hidden: s.hidden.filter((h) => h !== selectedId) } : {}),
      selectedId,
      picked: [],
      ...(selectedId ? { fitting: null, fittingPreview: null } : { addMode: false }),
      ...(s.drawFace && s.drawFace.partId !== selectedId ? { drawFace: null } : {}),
      ...(s.bubble && s.bubble.target.id !== selectedId ? { bubble: null } : {}),
    })),
  pick: (ids) => {
    const list = [...new Set(ids)];
    if (list.length < 2) return get().select(list[0] ?? null);
    set((s) => ({
      selectedId: null,
      picked: list,
      hidden: s.hidden.filter((h) => !list.includes(h)),
      fitting: null,
      fittingPreview: null,
      drawFace: null,
      bubble: null,
    }));
  },
  tapPart: (id, add) => {
    const { project, selectedId, picked, pick, select } = get();
    if (!project) return;
    const g = groupOf(project, id);
    // Adentro del grupo (se está editando una de sus piezas): los toques eligen piezas sueltas.
    const inside = !!g && !!selectedId && g.parts.includes(selectedId);
    const unit = g && !inside ? g.parts : [id];
    if (add) {
      const base = picked.length ? picked : selectedId ? [selectedId] : [];
      const has = unit.every((x) => base.includes(x));
      return pick(has ? base.filter((x) => !unit.includes(x)) : [...base, ...unit]);
    }
    if (g && !inside && isWholeGroup(g, picked)) return select(id);
    pick(unit);
  },
  setAddMode: (addMode) => set({ addMode }),
  setJointFocus: (jointFocus, hint) => set({ jointFocus, jointHint: hint ?? null }),
  setTool: (tool) =>
    set((s) => ({
      // Elegir otra herramienta termina la prueba: con un cajón abierto no se edita.
      ...(s.trying ? { trying: false, opened: {}, cut: null, apart: 0 } : {}),
      ...(tool === 'draw' ? { tool, arcChord: null, pathPoints: [], pathFlip: false, cornerPick: null, bubble: null } : { tool, drawFace: null, draft: null, arcChord: null, pathPoints: [], pathFlip: false, cornerPick: null, bubble: null }),
      ...(tool !== 'measure' && (s.measure.a || s.measure.b) ? { measure: { a: null, b: null } } : {}),
    })),
  pickMeasure: (pick) =>
    set((s) => {
      if (!pick) return { measure: { a: null, b: null } };
      const { a, b } = s.measure;
      if (a && !b && a.partId !== pick.partId) return { measure: { a, b: pick } };
      return { measure: { a: pick, b: null } };
    }),
  setXray: (xray) => set({ xray }),
  setTrying: (trying) =>
    set(
      trying
        ? { trying, opened: {}, cut: null, apart: 0, tool: 'select', drawFace: null, draft: null, arcChord: null, pathPoints: [], cornerPick: null, bubble: null, measure: { a: null, b: null } }
        : { trying, opened: {}, cut: null, apart: 0 },
    ),
  // Abrir un cajón cierra el despiece: las dos cosas juntas no se ven bien.
  toggleOpen: (id) => set((s) => ({ apart: 0, opened: { ...s.opened, [id]: (s.opened[id] ?? 0) > 0.5 ? 0 : 1 } })),
  openAll: (ids, open) => set({ apart: 0, opened: Object.fromEntries(ids.map((id) => [id, open])) }),
  setApart: (apart) => set((s) => ({ apart, opened: apart > 0 ? {} : s.opened })),
  setCut: (cut) => set({ cut }),
  setCopyMove: (copyMove) => set({ copyMove }),
  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1, drawFace: null, cornerPick: null, bubble: null })),
  setHint: (hint) => set({ hint }),
  setDrawFace: (drawFace, frame = true) =>
    set((s) => ({
      drawFace,
      drawFramed: !!drawFace && frame,
      arcChord: null,
      pathPoints: [],
      pathFlip: false,
      cornerPick: null,
      draft: null,
      // Al terminar, la vista vuelve a como estaba si se había puesto de frente.
      ...(!drawFace && s.drawFramed ? { viewNonce: s.viewNonce + 1 } : {}),
    })),
  setDrawShape: (drawShape) => set({ drawShape, arcChord: null, pathPoints: [], pathFlip: false, cornerPick: null, draft: null }),
  setDrawCut: (drawThrough, drawDepth) => set((s) => ({ drawThrough, drawDepth: drawDepth === undefined ? s.drawDepth : drawDepth })),
  setPathFlip: (pathFlip) => set({ pathFlip }),
  setCornerPick: (cornerPick) => set(cornerPick ? { cornerPick, cornerKind: cornerPick.kind } : { cornerPick }),
  setTraceImage: (traceImage) => set((s) => ({ traceImage: traceImage ?? dropTrace(s.traceImage) })),
  setBevelRound: (bevelRound) => set({ bevelRound }),
  setDraft: (draft) => set({ draft }),
  setBevelDraft: (bevelDraft) => set({ bevelDraft }),
  setSectionDraft: (sectionDraft) => set({ sectionDraft }),
  setArcChord: (arcChord) => set({ arcChord }),
  setPathPoints: (pathPoints) => set(pathPoints.length ? { pathPoints } : { pathPoints, pathFlip: false }),
  setPathCorner: (pathCorner) => set({ pathCorner }),
  dismissNotice: () => set({ notice: null }),
  warn: (text) => set({ notice: { text, key: ++noticeKey, undo: false } }),
  setBubble: (bubble) => set({ bubble }),
  setFitting: (fitting) => set(fitting ? { fitting, selectedId: null, tool: 'select', drawFace: null, bubble: null } : { fitting, fittingPreview: null }),
  setFittingPreview: (fittingPreview) => set({ fittingPreview }),
  propose: (recipe, label, opts) => {
    const { project } = get();
    if (!project) return;
    set({ pending: { recipe, label, title: opts?.title ?? label, select: opts?.select }, ghost: apply(project, recipe, true), bubble: null });
  },
  applyPending: () => {
    const { pending, commit, select } = get();
    if (!pending) return;
    commit(pending.recipe, pending.label);
    if (Array.isArray(pending.select)) get().pick(pending.select);
    else if (pending.select) select(pending.select);
  },
  cancelPending: () => set({ pending: null, ghost: null }),
  setGhost: (recipe) => {
    const { project, pending } = get();
    // Con un cambio grande esperando, el fantasma es el de ese cambio.
    if (!project || pending) return;
    set({ ghost: recipe ? apply(project, recipe, false) : null });
  },
  setHidden: (ids) => {
    const { selectedId, picked } = get();
    const shown = picked.filter((id) => !ids.includes(id));
    set({
      hidden: [...new Set(ids)],
      ...(selectedId && ids.includes(selectedId) ? { selectedId: null, bubble: null } : {}),
      ...(shown.length !== picked.length ? (shown.length > 1 ? { picked: shown } : { picked: [], selectedId: shown[0] ?? null }) : {}),
    });
  },
  nudge: (ids, axis, mm, arrow) => {
    const { project, past } = get();
    const box = project && partsBox(project.parts, ids);
    if (!project || !box) return;
    const key = ids.join('|');
    const now = Date.now();
    const chain = lastNudge && lastNudge.id === key && lastNudge.axis === axis && lastNudge.after === project && now - lastNudge.at < NUDGE_MS;
    const before = chain ? lastNudge!.before : project;
    // No se mete debajo del piso: un grupo baja hasta que la más baja apoya.
    const d = axis === 1 ? Math.max(mm, -box.min[1]) : mm;
    const next = apply(project, (p) => {
      for (const q of p.parts) if (ids.includes(q.id)) q.position[axis] += d;
    }, true);
    const at = (p: Project) => partsBox(p.parts, ids)?.min[axis] ?? 0;
    const net = at(next) - at(before);
    if (Math.abs(d) < 0.01 && !chain) return;
    const label = t('Corriste {id} {d} {arrow}', {
      id: partsLabel(project, ids),
      d: formatLength(Math.abs(net), project.units),
      arrow: Math.sign(net) === Math.sign(mm) ? arrow : (OPPOSITE[arrow] ?? arrow),
    });
    lastNudge = { id: key, axis, at: now, before, after: next };
    set({
      project: next,
      past: chain ? past : [...past, project].slice(-HISTORY),
      future: [],
      bubble: null,
      ghost: null,
      // De vuelta donde estaba: el aviso de antes ya no dice la verdad.
      notice: null,
      ...noticeFor(before, next, Math.abs(net) < 0.01 ? undefined : label),
    });
  },
  setUnits: (units) => {
    const { project } = get();
    if (project) set({ project: produce(project, (d) => void (d.units = units)) });
  },
}));

/** Pieza seleccionada, si existe. */
export const useSelectedPart = () =>
  useEditor((s) => (s.selectedId ? (s.project?.parts.find((p) => p.id === s.selectedId) ?? null) : null));

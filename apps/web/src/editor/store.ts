import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { formatLength, syncComponents, syncJoints, t, type Bevel, type Box, type PocketShape, type Project, type Section, type Units } from '@kitc/core';

export type Tool = 'select' | 'push' | 'move' | 'draw' | 'bevel' | 'section' | 'turn';
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

export type DrawShape = 'rect' | 'circle' | 'arc';

/** Cuerda de un arco ya marcada: falta decir cuánto se curva. */
export type ArcChord = DrawFace & { u: number; v: number; u2: number; v2: number };

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
  tool: Tool;
  xray: boolean;
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
  setTool: (t: Tool) => void;
  setXray: (on: boolean) => void;
  setCopyMove: (on: boolean) => void;
  setView: (v: View) => void;
  setUnits: (u: Units) => void;
  setHint: (h: DragHint | null) => void;
  setDrawFace: (f: DrawFace | null, frame?: boolean) => void;
  setDrawShape: (s: DrawShape) => void;
  setBevelRound: (round: boolean) => void;
  setDraft: (d: EditorState['draft']) => void;
  setBevelDraft: (d: EditorState['bevelDraft']) => void;
  setSectionDraft: (d: EditorState['sectionDraft']) => void;
  setArcChord: (c: ArcChord | null) => void;
  dismissNotice: () => void;
  /** Aviso sin cambio que deshacer: algo no se pudo hacer y por qué. */
  warn: (text: string) => void;
  setBubble: (b: Bubble | null) => void;
  setFitting: (f: FittingKind | null) => void;
  setFittingPreview: (p: EditorState['fittingPreview']) => void;
  /** Muestra el cambio en fantasma y espera Aplicar o Cancelar. */
  propose: (recipe: (p: Draft<Project>) => void, label: string, opts?: { title?: string; select?: string }) => void;
  applyPending: () => void;
  cancelPending: () => void;
  /** Fantasma mientras se escribe una medida; null lo borra. */
  setGhost: (recipe: ((p: Draft<Project>) => void) | null) => void;
  /** Oculta estas piezas (y muestra las demás). */
  setHidden: (ids: string[]) => void;
  /** Corre la pieza unos milímetros (flechas del teclado). Los toques seguidos son un solo paso de deshacer. */
  nudge: (id: string, axis: 0 | 1 | 2, mm: number, arrow: string) => void;
}

export interface Pending {
  recipe: (p: Draft<Project>) => void;
  /** Lo que dice el aviso al aplicar. */
  label: string;
  /** Lo que dice la barra de vista previa; si falta, el aviso. */
  title: string;
  select?: string;
}

export interface Notice {
  text: string;
  key: number;
  /** false: no hubo cambio, el aviso no lleva Deshacer. */
  undo?: boolean;
}

export interface DragHint {
  x: number;
  y: number;
  text: string;
  snap: string | null;
  /** Así no vale: se dice en lugar del imán. */
  warn?: string;
}

const touch = (p: Draft<Project>) => {
  p.updatedAt = new Date().toISOString();
};

/** Aplica el cambio, iguala las copias de cada componente y deja los encastres al día con las piezas. */
const apply = (p: Project, recipe: (p: Draft<Project>) => void, sync: boolean) =>
  produce(p, (d) => {
    recipe(d);
    syncComponents(p, d as Project);
    if (sync) d.joints = syncJoints(d.parts as Project['parts'], d.joints as Project['joints']);
    touch(d);
  });

/**
 * Lo que se dice después de un cambio: qué se hizo (si se dijo) y qué uniones se soltaron. Una unión se suelta
 * cuando dos piezas que siguen en el proyecto dejan de tocarse; si se borró una pieza, el aviso ya lo dice.
 */
export function changeNotice(before: Project, after: Project, label?: string): string | null {
  const pair = (a: string, b: string) => [a, b].sort().join('|');
  const kept = new Set(after.joints.map((j) => pair(j.partA, j.partB)));
  const ids = new Set(after.parts.map((p) => p.id));
  const lost = [...new Set(before.joints.filter((j) => ids.has(j.partA) && ids.has(j.partB) && !kept.has(pair(j.partA, j.partB))).map((j) => pair(j.partA, j.partB)))];
  const loose =
    lost.length === 1 ? t('se soltó la unión de {a} con {b}', { a: lost[0]!.split('|')[0]!, b: lost[0]!.split('|')[1]! }) : lost.length ? t('se soltaron {n} uniones', { n: lost.length }) : null;
  if (!loose) return label ?? null;
  return label ? `${label} · ${loose}` : loose.replace(/^./, (c) => c.toUpperCase());
}

let noticeKey = 0;

/** Toques de flecha seguidos sobre la misma pieza y el mismo eje: se juntan en un paso. */
const NUDGE_MS = 1500;
let lastNudge: { id: string; axis: number; at: number; before: Project; after: Project } | null = null;
const OPPOSITE: Record<string, string> = { '→': '←', '←': '→', '↑': '↓', '↓': '↑' };
const noticeFor = (before: Project, after: Project, label?: string) => {
  const text = changeNotice(before, after, label);
  return text ? { notice: { text, key: ++noticeKey } } : {};
};

export const useEditor = create<EditorState>()((set, get) => ({
  project: null,
  past: [],
  future: [],
  dragging: false,
  selectedId: null,
  tool: 'select',
  xray: false,
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
  notice: null,
  bubble: null,
  fitting: null,
  fittingPreview: null,
  ghost: null,
  pending: null,
  hidden: [],

  open: (project) =>
    set({ hidden: [], fitting: null, fittingPreview: null, ghost: null, pending: null, project, past: [], future: [], selectedId: null, lastPush: null, dragging: false, view: 'iso', drawFace: null, draft: null, arcChord: null, notice: null, bubble: null }),
  close: () => set({ project: null, past: [], future: [], selectedId: null, notice: null, bubble: null }),

  commit: (recipe, label) => {
    const { project, past } = get();
    if (!project) return;
    const next = apply(project, recipe, true);
    set({ project: next, past: [...past, project].slice(-HISTORY), future: [], ghost: null, pending: null, ...noticeFor(project, next, label) });
    if (get().selectedId && !next.parts.some((p) => p.id === get().selectedId)) set({ selectedId: null });
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
    if (get().selectedId && !prev.parts.some((p) => p.id === get().selectedId)) set({ selectedId: null });
  },

  undo: () => {
    const { project, past, future } = get();
    const prev = past.at(-1);
    if (!project || !prev) return;
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], notice: null, bubble: null, ghost: null, pending: null });
    if (get().selectedId && !prev.parts.some((p) => p.id === get().selectedId)) set({ selectedId: null });
  },
  redo: () => {
    const { project, past, future } = get();
    const next = future[0];
    if (!project || !next) return;
    set({ project: next, past: [...past, project], future: future.slice(1), notice: null, bubble: null, ghost: null, pending: null });
    if (get().selectedId && !next.parts.some((p) => p.id === get().selectedId)) set({ selectedId: null });
  },

  select: (selectedId) =>
    set((s) => ({
      // Elegir una pieza oculta (en la lista) la vuelve a mostrar.
      ...(selectedId && s.hidden.includes(selectedId) ? { hidden: s.hidden.filter((h) => h !== selectedId) } : {}),
      selectedId,
      ...(selectedId ? { fitting: null, fittingPreview: null } : {}),
      ...(s.drawFace && s.drawFace.partId !== selectedId ? { drawFace: null } : {}),
      ...(s.bubble && s.bubble.target.id !== selectedId ? { bubble: null } : {}),
    })),
  setTool: (tool) => set(tool === 'draw' ? { tool, arcChord: null, bubble: null } : { tool, drawFace: null, draft: null, arcChord: null, bubble: null }),
  setXray: (xray) => set({ xray }),
  setCopyMove: (copyMove) => set({ copyMove }),
  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1, drawFace: null, bubble: null })),
  setHint: (hint) => set({ hint }),
  setDrawFace: (drawFace, frame = true) =>
    set((s) => ({
      drawFace,
      drawFramed: !!drawFace && frame,
      arcChord: null,
      draft: null,
      // Al terminar, la vista vuelve a como estaba si se había puesto de frente.
      ...(!drawFace && s.drawFramed ? { viewNonce: s.viewNonce + 1 } : {}),
    })),
  setDrawShape: (drawShape) => set({ drawShape, arcChord: null, draft: null }),
  setBevelRound: (bevelRound) => set({ bevelRound }),
  setDraft: (draft) => set({ draft }),
  setBevelDraft: (bevelDraft) => set({ bevelDraft }),
  setSectionDraft: (sectionDraft) => set({ sectionDraft }),
  setArcChord: (arcChord) => set({ arcChord }),
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
    if (pending.select) select(pending.select);
  },
  cancelPending: () => set({ pending: null, ghost: null }),
  setGhost: (recipe) => {
    const { project, pending } = get();
    // Con un cambio grande esperando, el fantasma es el de ese cambio.
    if (!project || pending) return;
    set({ ghost: recipe ? apply(project, recipe, false) : null });
  },
  setHidden: (ids) => {
    const { selectedId } = get();
    set({ hidden: [...new Set(ids)], ...(selectedId && ids.includes(selectedId) ? { selectedId: null, bubble: null } : {}) });
  },
  nudge: (id, axis, mm, arrow) => {
    const { project, past } = get();
    const part = project?.parts.find((p) => p.id === id);
    if (!project || !part) return;
    const now = Date.now();
    const chain = lastNudge && lastNudge.id === id && lastNudge.axis === axis && lastNudge.after === project && now - lastNudge.at < NUDGE_MS;
    const before = chain ? lastNudge!.before : project;
    // No se mete debajo del piso.
    const next = apply(project, (d) => {
      const q = d.parts.find((x) => x.id === id);
      if (q) q.position[axis] = axis === 1 ? Math.max(0, q.position[axis] + mm) : q.position[axis] + mm;
    }, true);
    const from = before.parts.find((p) => p.id === id)?.position[axis] ?? 0;
    const to = next.parts.find((p) => p.id === id)?.position[axis] ?? 0;
    if (Math.abs(to - from) < 0.01 && !chain) return;
    const net = to - from;
    const label = t('Corriste {id} {d} {arrow}', {
      id,
      d: formatLength(Math.abs(net), project.units),
      arrow: Math.sign(net) === Math.sign(mm) ? arrow : (OPPOSITE[arrow] ?? arrow),
    });
    lastNudge = { id, axis, at: now, before, after: next };
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

import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { syncComponents, syncJoints, type Project, type Units } from '@kitc/core';

export type Tool = 'select' | 'push' | 'move';
export type View = 'iso' | 'front' | 'side' | 'top';

/** Última cara empujada: la medida que se escribe abajo se aplica a ella. */
export interface LastPush {
  id: string;
  axis: 0 | 1 | 2;
  sign: 1 | -1;
}

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

  open: (p: Project) => void;
  close: () => void;
  /** Cambio con historial: una acción, un paso de deshacer. */
  commit: (recipe: (p: Draft<Project>) => void) => void;
  beginDrag: () => void;
  /** Cambio en vivo durante el arrastre. */
  dragUpdate: (recipe: (p: Draft<Project>) => void) => void;
  endDrag: (lastPush?: LastPush) => void;
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
}

export interface DragHint {
  x: number;
  y: number;
  text: string;
  snap: string | null;
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

  open: (project) => set({ project, past: [], future: [], selectedId: null, lastPush: null, dragging: false, view: 'iso' }),
  close: () => set({ project: null, past: [], future: [], selectedId: null }),

  commit: (recipe) => {
    const { project, past } = get();
    if (!project) return;
    const next = apply(project, recipe, true);
    set({ project: next, past: [...past, project].slice(-HISTORY), future: [] });
    if (get().selectedId && !next.parts.some((p) => p.id === get().selectedId)) set({ selectedId: null });
  },

  beginDrag: () => {
    const { project, past } = get();
    if (!project) return;
    set({ dragging: true, past: [...past, project].slice(-HISTORY), future: [] });
  },
  dragUpdate: (recipe) => {
    const { project } = get();
    if (project) set({ project: apply(project, recipe, false) });
  },
  endDrag: (lastPush) => {
    const { project } = get();
    if (!project) return;
    set({ dragging: false, project: apply(project, () => {}, true), ...(lastPush ? { lastPush } : {}) });
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
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future] });
    if (get().selectedId && !prev.parts.some((p) => p.id === get().selectedId)) set({ selectedId: null });
  },
  redo: () => {
    const { project, past, future } = get();
    const next = future[0];
    if (!project || !next) return;
    set({ project: next, past: [...past, project], future: future.slice(1) });
    if (get().selectedId && !next.parts.some((p) => p.id === get().selectedId)) set({ selectedId: null });
  },

  select: (selectedId) => set({ selectedId }),
  setTool: (tool) => set({ tool }),
  setXray: (xray) => set({ xray }),
  setCopyMove: (copyMove) => set({ copyMove }),
  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1 })),
  setHint: (hint) => set({ hint }),
  setUnits: (units) => {
    const { project } = get();
    if (project) set({ project: produce(project, (d) => void (d.units = units)) });
  },
}));

/** Pieza seleccionada, si existe. */
export const useSelectedPart = () =>
  useEditor((s) => (s.selectedId ? (s.project?.parts.find((p) => p.id === s.selectedId) ?? null) : null));

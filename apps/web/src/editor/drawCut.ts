import { cornerPath, depthUnder, newPocket, nextPocketId, otherAxes, partBox, t, type Part, type Pocket, type PocketShape } from '@kitc/core';
import { useEditor, type CornerPick, type DrawFace, type DrawShape } from './store';

/** Lo que se saca si no se eligió nada: el rectángulo, vaciado hasta la mitad; lo demás (círculo, arco, perfil), calado. */
export const throughByShape = (shape: DrawShape | PocketShape['kind']) => shape !== 'rect';

/** Con qué figura guardada queda cada herramienta de figura: la mano alzada y las esquinas quedan como perfil a mano. */
export const savedKind = (shape: DrawShape): PocketShape['kind'] => (shape === 'free' || shape === 'corner' ? 'path' : shape);

/** El vaciado o calado de una figura recién dibujada, con lo que se eligió antes de dibujar (si se eligió). */
export function drawnPocket(part: Part, face: DrawFace, shape: PocketShape, through: boolean | null, depth: number | null): Pocket {
  const pocket = newPocket(part, face.axis, face.side, shape);
  if (through !== null) pocket.through = through;
  // El hondo elegido, sin pasar el espesor: un vaciado que atraviesa es un calado.
  if (!pocket.through && depth) pocket.depth = Math.max(0.5, Math.min(depth, depthUnder(part, face.axis) - 0.5));
  return pocket;
}

/** Ancho y alto de la cara, en mm (u y v). */
export function faceSize(part: Part, face: DrawFace): [number, number] {
  const box = partBox(part);
  const [ua, va] = otherAxes(face.axis);
  return [box.max[ua] - box.min[ua], box.max[va] - box.min[va]];
}

/** La forma de esquina elegida, a la vista sobre la cara mientras se eligen la forma y las medidas. */
export function showCorner(pick: CornerPick) {
  const { project, setCornerPick, setDraft } = useEditor.getState();
  const part = project?.parts.find((p) => p.id === pick.partId);
  if (!part) return;
  const [w, h] = faceSize(part, pick);
  setCornerPick(pick);
  setDraft({ partId: pick.partId, axis: pick.axis, side: pick.side, shape: cornerPath(pick.kind, pick.corner, pick.a, pick.b, w, h) });
}

/** Hace el corte de la esquina elegida y deja su tarjeta a la vista para ajustar los puntos. */
export function placeCorner() {
  const { project, cornerPick: pick, drawThrough, drawDepth, commit, setCornerPick, setDraft, setBubble } = useEditor.getState();
  const part = project?.parts.find((p) => p.id === pick?.partId);
  if (!pick || !part) return;
  const [w, h] = faceSize(part, pick);
  const pocketId = nextPocketId(part);
  commit((d) => {
    const q = d.parts.find((x) => x.id === part.id);
    if (q) q.pockets.push(drawnPocket(q as Part, pick, cornerPath(pick.kind, pick.corner, pick.a, pick.b, w, h), drawThrough, drawDepth));
  }, t('Le diste forma a una esquina de {id}', { id: part.id }));
  setCornerPick(null);
  setDraft(null);
  setBubble({ target: { kind: 'pocket', id: part.id, pocketId }, x: 0, y: 0 });
}

import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { produce } from 'immer';
import * as THREE from 'three';
import { partBox, partKey, pathCrosses, pocketRegion, t, woodById, type Part, type Project } from '@kitc/core';
import { drawnPocket } from './drawCut';
import { Piece, Rig } from './JointDetail3D';
import { useEditor } from './store';
import { useDraftMeshes, type ExactMesh } from './useGeometry';
import { cssColor } from './Viewport';
import styles from './Editor.module.css';

/** Cuánto espera la vista chica a que el dibujo se quede quieto antes de pedirle la pieza al motor. */
const SETTLE_MS = 220;

/** El proyecto con la figura que se está dibujando ya sacada de la pieza, o null si todavía no tiene forma. */
function withDraft(project: Project | null, part: Part | undefined): Project | null {
  const { draft, drawThrough, drawDepth } = useEditor.getState();
  if (!project || !part || !draft || draft.partId !== part.id || part.base.kind !== 'box') return null;
  const s = draft.shape;
  if (s.kind === 'path' && pathCrosses(s)) return null;
  if (s.kind === 'arc' && s.bulge === 0) return null;
  if (s.kind === 'rect' && (s.w < 1 || s.h < 1)) return null;
  if (pocketRegion(part, draft.axis, s).length < 3) return null;
  return produce(project, (d) => {
    const q = d.parts.find((x) => x.id === part.id);
    if (q) q.pockets.push(drawnPocket(q as Part, draft, s, drawThrough, drawDepth));
  });
}

/**
 * Dibujar, en la compu, arriba del panel: la pieza sola y en diagonal, con lo que se está dibujando ya sacado. Mientras
 * se dibuja de frente a la cara no se ve si atraviesa o hasta dónde baja: acá sí. Se puede girar con el mouse.
 */
export function DrawPreview({ meshes }: { meshes: ReadonlyMap<string, ExactMesh> }) {
  const tool = useEditor((s) => s.tool);
  const project = useEditor((s) => s.project);
  const partId = useEditor((s) => s.drawFace?.partId ?? (s.bubble?.target.kind === 'pocket' ? s.bubble.target.id : null));
  // Lo que cambia la vista previa: la figura y qué se saca.
  const draft = useEditor((s) => s.draft);
  const through = useEditor((s) => s.drawThrough);
  const depth = useEditor((s) => s.drawDepth);
  const part = project?.parts.find((p) => p.id === partId);
  const live = useMemo(() => withDraft(project, part), [project, part, draft, through, depth]); // eslint-disable-line react-hooks/exhaustive-deps
  // Con el mouse en movimiento la figura cambia a cada rato: se espera a que se quede quieta.
  const [settled, setSettled] = useState<Project | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(live), live ? SETTLE_MS : 0);
    return () => clearTimeout(timer);
  }, [live]);
  const drafts = useDraftMeshes(settled, partId ? [partId] : []);
  const colors = useMemo(() => ({ ink: cssColor('--ink', '#2B3628') }), []);
  const focus = useMemo(() => {
    if (!part || part.base.kind !== 'box') return null;
    const b = partBox(part);
    const box = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
    return box.expandByScalar(box.getSize(new THREE.Vector3()).length() * 0.04);
  }, [part]);
  if (tool !== 'draw' || !part || !focus || !project) return null;
  const shown = settled ?? project;
  const key = partKey(shown, part.id);
  const exact = (settled ? drafts.get(part.id) : undefined) ?? meshes.get(part.id);
  const waiting = !!live && exact?.key !== key;
  return (
    <figure className={styles.drawPreview} aria-label={t('Así queda {id}', { id: part.id })}>
      <figcaption>
        {t('Así queda')}
        {waiting && <span className={styles.drawPreviewBusy}>{t('calculando…')}</span>}
      </figcaption>
      <Canvas frameloop="demand" dpr={[1, 2]} camera={{ fov: 30, near: 1, far: 30000, position: [1000, 800, 1000] }} gl={{ antialias: true, alpha: true }} style={{ touchAction: 'none' }}>
        <Rig focus={focus} frameKey={part.id} reach={0.62} />
        <hemisphereLight args={['#ffffff', '#b9ad98', 1.7]} />
        <directionalLight position={[1500, 2500, 1800]} intensity={1.3} />
        <Piece part={part} exact={exact} look={{ fill: woodById(part.wood)?.color ?? '#D9BC8C', edge: colors.ink, xray: false }} />
      </Canvas>
    </figure>
  );
}

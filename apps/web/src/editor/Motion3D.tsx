import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { buildOffsets, buildSteps, findMotions, motionMatrix, partBox, type Motion, type Project, type Vec3 } from '@kitc/core';
import { setGrainMotion } from './woodMaterial';
import { useEditor, type Cut } from './store';

/**
 * Probar el mueble en el 3D: los cajones, puertas y tapas se abren y se cierran solos, suave, hacia lo que diga el
 * panel; y un corte deja ver el adentro. Las piezas no cambian en el proyecto: solo se dibujan corridas.
 */

/** Lo que se abre en el proyecto. Se recalcula cuando cambia el proyecto. */
export function useMotions(project: Project | null): Motion[] {
  return useMemo(() => (project ? findMotions(project) : []), [project]);
}

/** Qué tan rápido llega a lo pedido: casi todo el camino en medio segundo, más lento al final. */
const SPEED = 7;

/** Las piezas de un cajón o una puerta: se corren juntas hasta la apertura que se pidió. */
export function Moving({ motion, children }: { motion: Motion; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const target = useEditor((s) => (s.trying ? (s.opened[motion.id] ?? 0) : 0));
  const now = useRef(0);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const invalidate = useThree((s) => s.invalidate);

  const apply = () => {
    const g = group.current;
    if (!g) return;
    matrix.fromArray(motionMatrix(motion, now.current));
    g.matrix.copy(matrix);
    g.matrixWorldNeedsUpdate = true;
    // La veta va con la pieza.
    const moved = now.current > 0 ? matrix : null;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m && !Array.isArray(m)) setGrainMotion(m, moved);
    });
  };
  // Al rearmarse el movimiento (otra medida, otra bisagra), la pieza va derecho a donde corresponde.
  useEffect(() => {
    apply();
    invalidate();
  });
  useFrame((_, dt) => {
    const d = target - now.current;
    if (d === 0) return;
    now.current = Math.abs(d) < 0.002 ? target : now.current + d * (1 - Math.exp(-Math.min(dt, 0.05) * SPEED));
    apply();
    invalidate();
  });
  return (
    <group ref={group} matrixAutoUpdate={false}>
      {children}
    </group>
  );
}

/** El plano del corte: uno solo, compartido por todos los materiales. Se mueve y se dibuja otro cuadro. */
export const CUT_PLANE = new THREE.Plane();
export const CUT_PLANES = [CUT_PLANE];

/**
 * Pone el plano del corte: saca la parte del mueble que queda del lado de la cámara (adelante, a la derecha o arriba),
 * así se ve el adentro desde la vista de siempre.
 * `at` va de 0 a 1 por todo el mueble, y deja siempre un poco a cada lado.
 */
export function placeCut(project: Project, cut: Cut): void {
  const boxes = project.parts.map(partBox);
  if (!boxes.length) return;
  const k = cut.axis;
  const lo = Math.min(...boxes.map((b) => b.min[k]));
  const hi = Math.max(...boxes.map((b) => b.max[k]));
  const at = lo + (hi - lo) * Math.min(0.98, Math.max(0.02, cut.at));
  // three se queda con lo que está del lado de la normal.
  if (k === 0) CUT_PLANE.set(new THREE.Vector3(-1, 0, 0), at);
  else if (k === 1) CUT_PLANE.set(new THREE.Vector3(0, -1, 0), at);
  else CUT_PLANE.set(new THREE.Vector3(0, 0, -1), at);
}

/** Mueve el plano del corte cuando cambia, y pide otro cuadro. */
export function CutRig({ project }: { project: Project }) {
  const cut = useEditor((s) => (s.trying ? s.cut : null));
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (cut) placeCut(project, cut);
    invalidate();
  }, [cut, project, invalidate]);
  return null;
}

/** Separar piezas: cuánto corre cada pieza en el despiece, por su camino de entrada. Solo probando. */
export function useApartOffsets(project: Project | null, on: boolean): ReadonlyMap<string, Vec3> | null {
  return useMemo(() => (project && on ? buildOffsets(buildSteps(project), 0) : null), [project, on]);
}

/** Una pieza en el despiece: se aleja de su lugar lo que diga la barra Separar piezas, suave, con la veta encima. */
export function Apart({ offset, children }: { offset: Vec3; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const target = useEditor((s) => (s.trying ? s.apart : 0));
  const now = useRef(0);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const invalidate = useThree((s) => s.invalidate);
  const apply = () => {
    const g = group.current;
    if (!g) return;
    const k = now.current;
    g.position.set(offset[0] * k, offset[1] * k, offset[2] * k);
    g.updateMatrix();
    const moved = k > 0 ? matrix.makeTranslation(g.position.x, g.position.y, g.position.z) : null;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m && !Array.isArray(m)) setGrainMotion(m, moved);
    });
  };
  useEffect(() => {
    apply();
    invalidate();
  });
  useFrame((_, dt) => {
    const d = target - now.current;
    if (d === 0) return;
    now.current = Math.abs(d) < 0.002 ? target : now.current + d * (1 - Math.exp(-Math.min(dt, 0.05) * SPEED));
    apply();
    invalidate();
  });
  return <group ref={group}>{children}</group>;
}

import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  acrossFace,
  arcInfo,
  arcPoints,
  bevelSolid,
  boxSize,
  copyPart,
  cornerNear,
  formatLength,
  edgeNear,
  isAngleCut,
  newBevel,
  newPocket,
  otherAxes,
  partBox,
  partKey,
  snapCoord,
  snapMove,
  snapOnFace,
  woodById,
  type Axis,
  type Bevel,
  type Box,
  type Part,
  type PocketShape,
  type Project,
} from '@kitc/core';
import { useEditor, type DrawFace, type View } from './store';
import type { ExactMesh } from './useGeometry';

const VIEW_DIRS: Record<View, [number, number, number]> = {
  iso: [1, 0.72, 1.15],
  front: [0, 0.04, 1],
  side: [1, 0.04, 0],
  top: [0, 1, 0.0001],
};
const AXIS_NAMES = ['ancho', 'alto', 'fondo'] as const;

function bounds(project: Project): THREE.Box3 {
  const b = new THREE.Box3();
  for (const p of project.parts) {
    if (p.base.kind !== 'box') continue;
    const { min, max } = partBox(p);
    b.union(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)));
  }
  if (b.isEmpty()) b.set(new THREE.Vector3(-300, 0, -300), new THREE.Vector3(300, 600, 300));
  return b;
}

export function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Órbita, encuadre de las vistas (Iso, Frente, Lateral, Planta) y reencuadre al cambiar el tamaño. */
function CameraRig({ controlsRef }: { controlsRef: React.RefObject<OrbitControls | null> }) {
  const { camera, gl, invalidate, size } = useThree();
  const project = useEditor((s) => s.project);
  const view = useEditor((s) => s.view);
  const viewNonce = useEditor((s) => s.viewNonce);
  const drawFace = useEditor((s) => s.drawFace);
  const anim = useRef<((now: number) => void) | null>(null);
  const userOrbited = useRef(false);

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = false;
    c.maxPolarAngle = Math.PI * 0.495;
    const onChange = () => invalidate();
    const onStart = () => {
      userOrbited.current = true;
      anim.current = null;
    };
    c.addEventListener('change', onChange);
    c.addEventListener('start', onStart);
    controlsRef.current = c;
    return () => {
      c.removeEventListener('change', onChange);
      c.removeEventListener('start', onStart);
      c.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, invalidate, controlsRef]);

  // Lleva la cámara a mirar `center` desde `dir`. Animado, salvo al abrir o si la persona prefiere menos movimiento.
  const flyTo = useEffectEvent((center: THREE.Vector3, dir: THREE.Vector3, dist: number, instant: boolean) => {
    const c = controlsRef.current;
    if (!c) return;
    const to = center.clone().add(dir.clone().normalize().multiplyScalar(dist));
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduce) {
      camera.position.copy(to);
      c.target.copy(center);
      c.update();
      invalidate();
      return;
    }
    const from = camera.position.clone();
    const fromTarget = c.target.clone();
    const t0 = performance.now();
    anim.current = (now) => {
      const k = Math.min(1, (now - t0) / 320);
      const e = 1 - Math.pow(1 - k, 3);
      camera.position.lerpVectors(from, to, e);
      c.target.lerpVectors(fromTarget, center, e);
      c.update();
      if (k >= 1) anim.current = null;
    };
    invalidate();
  });

  // Encuadra la vista pedida (Iso, Frente, Lateral, Planta) con todo el mueble adentro.
  const frame = useEffectEvent((instant: boolean) => {
    const p = useEditor.getState().project;
    if (!p || !(camera instanceof THREE.PerspectiveCamera)) return;
    const b = bounds(p);
    const r = b.getSize(new THREE.Vector3()).length() / 2;
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const dist = (r / Math.sin(Math.min(hHalf, vHalf))) * 0.98;
    flyTo(b.getCenter(new THREE.Vector3()), new THREE.Vector3(...VIEW_DIRS[useEditor.getState().view]), dist, instant);
  });

  // Mira de frente la cara elegida para dibujar, con un margen alrededor.
  const frameFace = useEffectEvent((f: DrawFace) => {
    const part = useEditor.getState().project?.parts.find((q) => q.id === f.partId);
    if (!part || !(camera instanceof THREE.PerspectiveCamera)) return;
    const box = partBox(part);
    const center = new THREE.Vector3(...box.min).add(new THREE.Vector3(...box.max)).multiplyScalar(0.5);
    center.setComponent(f.axis, f.side > 0 ? box.max[f.axis] : box.min[f.axis]);
    const dir = new THREE.Vector3();
    dir.setComponent(f.axis, f.side);
    // De arriba o de abajo, un pelo inclinada para que la cámara sepa dónde queda el fondo.
    if (f.axis === 1) dir.z = 0.0001;
    const across = f.axis === 0 ? 2 : 0;
    const up = f.axis === 1 ? 2 : 1;
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const w = box.max[across] - box.min[across];
    const h = box.max[up] - box.min[up];
    const dist = Math.max(w / 2 / Math.tan(hHalf), h / 2 / Math.tan(vHalf)) * 1.25;
    flyTo(center, dir, dist, false);
  });

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    // Dibujando, la vista queda de frente: se puede acercar y correr, pero no girar.
    c.enableRotate = !drawFace;
    c.maxPolarAngle = drawFace ? Math.PI : Math.PI * 0.495;
    if (drawFace) frameFace(drawFace);
  }, [drawFace, controlsRef]);

  const projectId = project?.id;
  useEffect(() => {
    userOrbited.current = false;
    frame(true);
  }, [projectId]);
  useEffect(() => {
    if (viewNonce === 0) return;
    userOrbited.current = false;
    frame(false);
  }, [view, viewNonce]);
  useEffect(() => {
    if (!userOrbited.current) frame(true);
  }, [size.width, size.height]);

  useFrame(() => {
    if (!anim.current) return;
    anim.current(performance.now());
    invalidate();
  });
  return null;
}

interface PartViewProps {
  part: Part;
  exact: ExactMesh | undefined;
  selected: boolean;
  xray: boolean;
  edgeColor: string;
  accent: string;
  onPointerDown: (e: ThreeEvent<PointerEvent>, part: Part) => void;
  onClick: (e: ThreeEvent<MouseEvent>, part: Part) => void;
}

/** Una pieza: la malla exacta del motor si está al día, o su caja mientras tanto. */
function PartView({ part, exact, selected, xray, edgeColor, accent, onPointerDown, onClick }: PartViewProps) {
  const box = partBox(part);
  const size = box.max.map((v, i) => v - (box.min[i] ?? 0)) as [number, number, number];
  const center = box.min.map((v, i) => v + size[i]! / 2) as [number, number, number];
  const boxGeo = useMemo(() => new THREE.BoxGeometry(...size), [size[0], size[1], size[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const boxEdges = useMemo(() => new THREE.EdgesGeometry(boxGeo), [boxGeo]);
  useEffect(() => () => {
    boxGeo.dispose();
    boxEdges.dispose();
  }, [boxGeo, boxEdges]);

  const color = woodById(part.wood)?.color ?? '#D9BC8C';
  const material = (
    <meshStandardMaterial
      color={color}
      roughness={0.85}
      emissive={selected ? accent : '#000000'}
      emissiveIntensity={selected ? 0.35 : 0}
      transparent={xray}
      opacity={xray ? 0.32 : 1}
      depthWrite={!xray}
      polygonOffset
      polygonOffsetFactor={1}
      polygonOffsetUnits={1}
    />
  );
  const lines = <lineBasicMaterial color={selected ? accent : edgeColor} transparent opacity={selected ? 1 : 0.55} />;
  const handlers = {
    userData: { id: part.id },
    onPointerDown: (e: ThreeEvent<PointerEvent>) => onPointerDown(e, part),
    onClick: (e: ThreeEvent<MouseEvent>) => onClick(e, part),
  };

  if (exact) {
    return (
      <group>
        <mesh geometry={exact.geometry} {...handlers}>
          {material}
        </mesh>
        <lineSegments geometry={exact.edges}>{lines}</lineSegments>
      </group>
    );
  }
  return (
    <group position={center}>
      <mesh geometry={boxGeo} {...handlers}>
        {material}
      </mesh>
      <lineSegments geometry={boxEdges}>{lines}</lineSegments>
    </group>
  );
}

/** Esquinas de un rectángulo de la cara, apenas por fuera de la pieza para que se vea encima. */
function facePoint(box: Box, f: DrawFace, u: number, v: number, lift = 0.4): THREE.Vector3 {
  const [ua, va] = otherAxes(f.axis);
  const p = new THREE.Vector3();
  p.setComponent(f.axis, (f.side > 0 ? box.max[f.axis] : box.min[f.axis]) + f.side * lift);
  p.setComponent(ua, box.min[ua] + u);
  p.setComponent(va, box.min[va] + v);
  return p;
}

function outline(box: Box, f: DrawFace, shape: PocketShape): THREE.Vector3[] {
  if (shape.kind === 'arc') {
    const a: [number, number] = [shape.u, shape.v];
    const b: [number, number] = [shape.u2, shape.v2];
    // Mientras se marca la cuerda todavía no hay flecha: se ve la recta.
    const pts = shape.bulge === 0 ? [a, b] : arcPoints(a, arcInfo(shape).mid, b, 48);
    return pts.map(([u, v]) => facePoint(box, f, u, v, 0.6));
  }
  if (shape.kind === 'circle') {
    const r = shape.d / 2;
    return Array.from({ length: 72 }, (_, i) => {
      const a = (i / 72) * Math.PI * 2;
      return facePoint(box, f, shape.u + r * Math.cos(a), shape.v + r * Math.sin(a), 0.6);
    });
  }
  const { u, v, w, h } = shape;
  return [facePoint(box, f, u, v, 0.6), facePoint(box, f, u + w, v, 0.6), facePoint(box, f, u + w, v + h, 0.6), facePoint(box, f, u, v + h, 0.6)];
}

/** Lazo cerrado de puntos: borde de la cara elegida o figura que se está dibujando. */
function Loop({ points, color, opacity = 1 }: { points: THREE.Vector3[]; color: string; opacity?: number }) {
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
  }, [points, color, opacity]);
  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }, [line]);
  return <primitive object={line} renderOrder={2} />;
}

interface FaceOverlayProps {
  part: Part;
  face: DrawFace;
  accent: string;
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
}

/** Cara elegida para dibujar: un velo del color de acento que recibe el dedo o el puntero. */
function FaceOverlay({ part, face, accent, onPointerDown }: FaceOverlayProps) {
  const box = partBox(part);
  const [ua, va] = otherAxes(face.axis);
  const w = box.max[ua] - box.min[ua];
  const h = box.max[va] - box.min[va];
  const key = `${box.min.join()}|${box.max.join()}|${face.axis}|${face.side}`;
  const corners = useMemo(() => [facePoint(box, face, 0, 0), facePoint(box, face, w, 0), facePoint(box, face, w, h), facePoint(box, face, 0, h)], [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(corners);
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }, [corners]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo} onPointerDown={onPointerDown}>
        <meshBasicMaterial color={accent} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Loop points={corners} color={accent} />
    </group>
  );
}

/** Plano del bisel que se está marcando: el rectángulo por donde pasa el corte. */
function BevelDraft({ accent }: { accent: string }) {
  const draft = useEditor((s) => s.bevelDraft);
  const part = useEditor((s) => s.project?.parts.find((p) => p.id === s.bevelDraft?.partId));
  const points = useMemo(() => {
    if (!draft || !part) return null;
    const s = bevelSolid(part, draft.bevel);
    const box = partBox(part);
    if (s.kind === 'arc') {
      // Redondeo: el cuarto de círculo en las dos puntas de la arista.
      const arc = arcPoints(s.a, s.mid, s.b, 24);
      const at3 = (p: [number, number], t: number) => {
        const v = new THREE.Vector3();
        v.setComponent(s.u, p[0]);
        v.setComponent(s.v, p[1]);
        v.setComponent(s.axis, t);
        return v;
      };
      return [...arc.map((p) => at3(p, box.min[s.axis])), ...arc.reverse().map((p) => at3(p, box.max[s.axis]))];
    }
    if (s.kind !== 'prism') return null;
    const { a, b, da, db } = draft.bevel;
    const eu = (a.side > 0 ? box.max[a.axis] : box.min[a.axis])!;
    const ev = (b.side > 0 ? box.max[b.axis] : box.min[b.axis])!;
    const at = (u: number, v: number, t: number) => {
      const p = new THREE.Vector3();
      p.setComponent(a.axis, u);
      p.setComponent(b.axis, v);
      p.setComponent(s.axis, t);
      return p;
    };
    const [t0, t1] = [box.min[s.axis], box.max[s.axis]];
    const p1 = [eu, ev - b.side * da] as const;
    const p2 = [eu - a.side * db, ev] as const;
    return [at(...p1, t0), at(...p1, t1), at(...p2, t1), at(...p2, t0)];
  }, [draft, part]);
  return points ? <Loop points={points} color={accent} /> : null;
}

function Draft({ part, accent }: { part: Part; accent: string }) {
  const draft = useEditor((s) => s.draft);
  const points = useMemo(() => (draft ? outline(partBox(part), draft, draft.shape) : null), [draft, part]);
  return points ? <Loop points={points} color={accent} /> : null;
}

interface Drag {
  kind: 'push' | 'move';
  part: Part;
  start: Box;
  axis: Axis;
  sign: 1 | -1;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  plane: THREE.Plane;
}

/** Parámetro sobre la recta (origin + t·dir) del punto más cercano al rayo. */
function closestT(origin: THREE.Vector3, dir: THREE.Vector3, ray: THREE.Ray): number {
  const w0 = origin.clone().sub(ray.origin);
  const b = dir.dot(ray.direction);
  const c = ray.direction.dot(ray.direction);
  const d = dir.dot(w0);
  const e = ray.direction.dot(w0);
  const den = dir.dot(dir) * c - b * b;
  return Math.abs(den) < 1e-9 ? 0 : (b * e - c * d) / den;
}

function Scene({ meshes }: { meshes: ReadonlyMap<string, ExactMesh> }) {
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const xray = useEditor((s) => s.xray);
  const dragging = useEditor((s) => s.dragging);
  const drawFace = useEditor((s) => s.drawFace);
  const { camera, gl, invalidate } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const colors = useMemo(
    () => ({ edge: cssColor('--ink', '#2B3628'), accent: cssColor('--accent', '#9E6027'), line: cssColor('--line-strong', '#C9C6BB') }),
    [],
  );

  const units = project?.units ?? 'cm';

  const startDrag = (e: ThreeEvent<PointerEvent>, original: Part) => {
    const { tool, select, beginDrag, copyMove, project: current } = useEditor.getState();
    if (tool === 'select' || !e.face || !current) return;
    e.stopPropagation();
    if (tool === 'draw') return pickFace(e, original);
    if (tool === 'bevel') return startBevel(e, original);
    // Copiar al mover: se arrastra una copia y la pieza original queda en su lugar.
    const copying = tool === 'move' && (copyMove || e.nativeEvent.ctrlKey || e.nativeEvent.altKey);
    const part = copying ? copyPart(current.parts, original) : original;
    const start = partBox(part);
    const n = e.face.normal;
    const abs = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const axis = abs.indexOf(Math.max(...abs)) as Axis;
    const sign = ([n.x, n.y, n.z][axis] ?? 0) > 0 ? 1 : -1;
    const dir = new THREE.Vector3();
    dir.setComponent(axis, sign);
    const drag: Drag = {
      kind: tool,
      part,
      start,
      axis,
      sign,
      origin: e.point.clone(),
      dir,
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -e.point.y),
    };
    beginDrag();
    if (copying) useEditor.getState().dragUpdate((d) => void d.parts.push(structuredClone(part)));
    select(part.id);
    let moved = false;
    if (controlsRef.current) controlsRef.current.enabled = false;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const onMove = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const { project: p, dragUpdate, setHint } = useEditor.getState();
      if (!p) return;
      const hintAt = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      if (drag.kind === 'push') {
        const t = closestT(drag.origin, drag.dir, raycaster.ray);
        const face = drag.sign > 0 ? drag.start.max[drag.axis] : drag.start.min[drag.axis];
        const snap = snapCoord(p.parts, face + drag.sign * t, drag.axis, part.id);
        let min = drag.start.min[drag.axis];
        let max = drag.start.max[drag.axis];
        if (drag.sign > 0) max = Math.max(snap.value, min + 3);
        else min = Math.min(snap.value, max - 3);
        dragUpdate((d) => {
          const q = d.parts.find((x) => x.id === part.id);
          if (!q || q.base.kind !== 'box') return;
          q.position[drag.axis] = min;
          q.base.size[drag.axis] = max - min;
        });
        setHint({
          ...hintAt,
          text: `${part.id} · ${AXIS_NAMES[drag.axis]} ${formatLength(max - min, units)}`,
          snap: snap.to === 'piso' ? 'piso' : snap.to ? `cara de ${snap.to}` : null,
        });
      } else {
        const pt = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(drag.plane, pt)) return;
        const snaps: string[] = [];
        const shifts = ([0, 2] as const).map((k) => {
          const s = snapMove(p.parts, drag.start, k, pt.getComponent(k) - drag.origin.getComponent(k), part.id);
          if (s.to) snaps.push(s.to);
          return s.value;
        });
        if (shifts[0] || shifts[1]) moved = true;
        dragUpdate((d) => {
          const q = d.parts.find((x) => x.id === part.id);
          if (!q) return;
          q.position[0] = drag.start.min[0] + shifts[0]!;
          q.position[2] = drag.start.min[2] + shifts[1]!;
        });
        setHint({
          ...hintAt,
          text: `${copying ? `Copia ${part.id}` : part.id} · ${formatLength(Math.abs(shifts[0]!), units)} ↔ · ${formatLength(Math.abs(shifts[1]!), units)} ↕`,
          snap: snaps.length ? `cara de ${[...new Set(snaps)].join(', ')}` : null,
        });
      }
      invalidate();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (controlsRef.current) controlsRef.current.enabled = true;
      const { endDrag, cancelDrag, setHint } = useEditor.getState();
      setHint(null);
      // Una copia que no se movió quedaría encima de la original: se descarta.
      if (copying && !moved) {
        cancelDrag();
        select(original.id);
        return;
      }
      endDrag(drag.kind === 'push' ? { id: part.id, axis: drag.axis, sign: drag.sign } : undefined);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Dibujar, primer paso: tocar una cara la elige y la cámara la pone de frente.
  const pickFace = (e: ThreeEvent<PointerEvent>, part: Part) => {
    if (!e.face) return;
    const n = e.face.normal;
    const abs = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const axis = abs.indexOf(Math.max(...abs)) as Axis;
    const side = ([n.x, n.y, n.z][axis] ?? 0) > 0 ? 1 : -1;
    const box = partBox(part);
    // Solo las caras de afuera: las paredes de un vaciado o de un encastre no se eligen.
    const at = side > 0 ? box.max[axis] : box.min[axis];
    if (Math.abs(e.point.getComponent(axis) - at) > 0.6) return;
    const { select, setDrawFace } = useEditor.getState();
    select(part.id);
    setDrawFace({ partId: part.id, axis, side });
  };

  // Dibujar, segundo paso: arrastrar sobre la cara elegida. Rectángulo de esquina a esquina; círculo desde el centro.
  const startSketch = (e: ThreeEvent<PointerEvent>) => {
    const { drawFace: face, drawShape, project: current } = useEditor.getState();
    const part = current?.parts.find((q) => q.id === face?.partId);
    if (!face || !part) return;
    e.stopPropagation();
    if (controlsRef.current) controlsRef.current.enabled = false;
    const box = partBox(part);
    const [ua, va] = otherAxes(face.axis);
    const size = [box.max[ua] - box.min[ua], box.max[va] - box.min[va]] as const;
    const tol = Math.max(3, Math.max(...size) * 0.02);
    const normal = new THREE.Vector3();
    normal.setComponent(face.axis, 1);
    const plane = new THREE.Plane(normal, -(face.side > 0 ? box.max[face.axis] : box.min[face.axis]));
    const local = (pt: THREE.Vector3) => {
      const u = snapOnFace(pt.getComponent(ua) - box.min[ua], size[0], tol);
      const v = snapOnFace(pt.getComponent(va) - box.min[va], size[1], tol);
      return { u: u.value, v: v.value, snaps: [u.to, v.to] };
    };
    const start = local(e.point);
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let shape: PocketShape | null = null;
    // Arco, segundo paso: la cuerda ya está; ahora el dedo dice cuánto se curva.
    const chord = useEditor.getState().arcChord;
    const bending = drawShape === 'arc' && chord && chord.partId === face.partId && chord.axis === face.axis && chord.side === face.side ? chord : null;

    const onMove = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const pt = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, pt)) return;
      const end = local(pt);
      const units = useEditor.getState().project?.units ?? 'cm';
      let text: string;
      let snaps: (string | null)[];
      if (bending) {
        const len = Math.hypot(bending.u2 - bending.u, bending.v2 - bending.v);
        const nu = -(bending.v2 - bending.v) / len;
        const nv = (bending.u2 - bending.u) / len;
        const raw = (pt.getComponent(ua) - box.min[ua] - bending.u) * nu + (pt.getComponent(va) - box.min[va] - bending.v) * nv;
        const max = len / 2;
        let bulge = Math.max(-max, Math.min(max, Math.round(raw)));
        snaps = [];
        if (max - Math.abs(raw) <= tol) [bulge, snaps] = [Math.sign(raw) * max, ['semicírculo']];
        const arc = { kind: 'arc', u: bending.u, v: bending.v, u2: bending.u2, v2: bending.v2, bulge, outside: false } as const;
        shape = bulge === 0 ? null : arc;
        text = bulge === 0 ? 'Recta' : `Flecha ${formatLength(Math.abs(bulge), units)} · R ${formatLength(arcInfo(arc).radius, units)}`;
        if (!shape) useEditor.getState().setDraft({ ...face, shape: { ...arc, bulge: 0 } });
      } else if (drawShape === 'arc') {
        const len = Math.hypot(end.u - start.u, end.v - start.v);
        shape = { kind: 'arc', u: start.u, v: start.v, u2: end.u, v2: end.v, bulge: 0, outside: false };
        text = `Cuerda ${formatLength(len, units)}`;
        snaps = end.snaps;
      } else if (drawShape === 'circle') {
        const d = Math.max(1, Math.round(Math.hypot(pt.getComponent(ua) - box.min[ua] - start.u, pt.getComponent(va) - box.min[va] - start.v) * 2));
        shape = { kind: 'circle', u: start.u, v: start.v, d };
        text = `Ø ${formatLength(d, units)}`;
        snaps = start.snaps;
      } else {
        const w = Math.abs(end.u - start.u);
        const h = Math.abs(end.v - start.v);
        shape = w > 0 && h > 0 ? { kind: 'rect', u: Math.min(start.u, end.u), v: Math.min(start.v, end.v), w, h } : null;
        text = `${formatLength(w, units)} × ${formatLength(h, units)}`;
        snaps = end.snaps;
      }
      const named = [...new Set(snaps.filter(Boolean))];
      if (shape || !bending) useEditor.getState().setDraft(shape ? { ...face, shape } : null);
      useEditor.getState().setHint({ x: ev.clientX - rect.left, y: ev.clientY - rect.top, text, snap: named.length ? named.join(' y ') : null });
      invalidate();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (controlsRef.current) controlsRef.current.enabled = true;
      const { setDraft, setHint, commit, setArcChord } = useEditor.getState();
      setHint(null);
      const s = shape as PocketShape | null;
      if (s?.kind === 'arc' && !bending) {
        // Cuerda marcada: queda a la vista hasta que se elija la flecha.
        if (Math.hypot(s.u2 - s.u, s.v2 - s.v) >= 3) return setArcChord({ ...face, u: s.u, v: s.v, u2: s.u2, v2: s.v2 });
        return setDraft(null);
      }
      if (bending && !s) return;
      setDraft(null);
      setArcChord(null);
      // Un toque sin arrastrar, o una figura de menos de 3 mm, no deja nada.
      if (!s || (s.kind === 'circle' ? s.d < 3 : s.kind === 'rect' ? s.w < 3 || s.h < 3 : false)) return;
      commit((d) => {
        const q = d.parts.find((x) => x.id === part.id);
        if (q) q.pockets.push(newPocket(q as Part, face.axis, face.side, s));
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // Con la cuerda puesta alcanza con tocar: la flecha sale de donde se tocó.
    if (bending) onMove(e.nativeEvent);
  };

  // Biselar: tocar una cara cerca de una arista y arrastrar hacia adentro marca hasta dónde llega el bisel.
  const startBevel = (e: ThreeEvent<PointerEvent>, part: Part) => {
    if (!e.face) return;
    const n = e.face.normal;
    const abs = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const axis = abs.indexOf(Math.max(...abs)) as Axis;
    const side = ([n.x, n.y, n.z][axis] ?? 0) > 0 ? 1 : -1;
    const box = partBox(part);
    if (Math.abs(e.point.getComponent(axis) - (side > 0 ? box.max[axis] : box.min[axis])) > 0.6) return;
    const a = { axis, side } as const;
    const touched = [e.point.x, e.point.y, e.point.z] as const;
    const size = boxSize(box);
    const round = useEditor.getState().bevelRound;
    // Cerca de dos aristas a la vez se toma la esquina: la arista que corre perpendicular a la cara tocada.
    const others = otherAxes(axis);
    const corner = cornerNear(part, a, touched, Math.max(12, 0.06 * Math.min(size[others[0]], size[others[1]])));
    const { b } = edgeNear(part, a, touched);
    const { select, setBevelDraft, setHint, commit } = useEditor.getState();
    select(part.id);
    if (controlsRef.current) controlsRef.current.enabled = false;
    const across = acrossFace(part, b);
    const edgeAt = (b.side > 0 ? box.max[b.axis] : box.min[b.axis])!;
    const tol = Math.max(3, across * 0.04);
    const normal = new THREE.Vector3();
    normal.setComponent(axis, 1);
    const plane = new THREE.Plane(normal, -(side > 0 ? box.max[axis] : box.min[axis]));
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let bevel: Bevel | null = null;
    const faceAt = (f: { axis: Axis; side: 1 | -1 }) => (f.side > 0 ? box.max[f.axis] : box.min[f.axis])!;

    const onMove = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const pt = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, pt)) return;
      let snap: string | null = null;
      if (corner) {
        // En la esquina manda lo que más se alejó de cualquiera de las dos caras.
        const raw = Math.max(Math.abs(faceAt(corner.b) - pt.getComponent(corner.b.axis)), Math.abs(faceAt(corner.a) - pt.getComponent(corner.a.axis)));
        // Cada 5 mm, o igual que otra esquina de la pieza: así las cuatro puntas de una tapa salen iguales.
        let r = raw < 5 ? Math.round(raw) : Math.round(raw / 5) * 5;
        const twin = part.bevels.find((x) => x.round === round && Math.abs(x.da - raw) <= Math.max(3, raw * 0.08));
        if (twin) [r, snap] = [twin.da, `igual que ${twin.id}`];
        bevel = r >= 1 ? newBevel(part, corner.a, corner.b, r, round) : null;
      } else {
        const raw = Math.min(across, Math.abs(edgeAt - pt.getComponent(b.axis)));
        let da = Math.round(raw);
        if (!round && across - raw <= tol) [da, snap] = [across, 'todo el ancho'];
        else if (Math.abs(raw - across / 2) <= tol) [da, snap] = [across / 2, 'centro'];
        bevel = da >= 1 ? newBevel(part, a, b, da, round) : null;
      }
      setBevelDraft(bevel ? { partId: part.id, bevel } : null);
      const units = useEditor.getState().project?.units ?? 'cm';
      const what = (bv: Bevel) =>
        bv.round
          ? `Redondeo R ${formatLength(bv.da, units)}`
          : `${isAngleCut(part, bv) ? 'Corte en ángulo' : 'Bisel'} ${formatLength(bv.da, units)} × ${formatLength(bv.db, units)}`;
      setHint({
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
        text: bevel ? `${corner ? 'Esquina · ' : ''}${what(bevel)}` : 'Arrastrá hacia adentro',
        snap,
      });
      invalidate();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (controlsRef.current) controlsRef.current.enabled = true;
      setBevelDraft(null);
      setHint(null);
      const done = bevel as Bevel | null;
      if (!done) return;
      commit((d) => {
        const q = d.parts.find((x) => x.id === part.id);
        if (q) q.bevels.push({ ...done, id: newBevel(q as Part, done.a, done.b, 1).id });
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const click = (e: ThreeEvent<MouseEvent>, part: Part) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    useEditor.getState().select(part.id);
  };

  if (!project) return null;
  const b = bounds(project);
  const span = Math.max(2000, Math.ceil(Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 1000) * 1000 + 1000);
  return (
    <>
      <CameraRig controlsRef={controlsRef} />
      <hemisphereLight args={['#ffffff', '#b9ad98', 1.6]} />
      <directionalLight position={[1500, 2500, 1800]} intensity={1.4} />
      <gridHelper args={[span, span / 100, colors.line, colors.line]} position={[b.getCenter(new THREE.Vector3()).x, -0.5, b.getCenter(new THREE.Vector3()).z]} />
      {project.parts.map((p) => {
        const m = meshes.get(p.id);
        const exact = m && m.key === partKey(project, p.id) ? m : undefined;
        return (
          <PartView
            key={p.id}
            part={p}
            exact={dragging ? undefined : exact}
            selected={p.id === selectedId}
            xray={xray}
            edgeColor={colors.edge}
            accent={colors.accent}
            onPointerDown={startDrag}
            onClick={click}
          />
        );
      })}
      <BevelDraft accent={colors.accent} />
      {drawFace &&
        (() => {
          const part = project.parts.find((p) => p.id === drawFace.partId);
          return part ? (
            <>
              <FaceOverlay part={part} face={drawFace} accent={colors.accent} onPointerDown={startSketch} />
              <Draft part={part} accent={colors.accent} />
            </>
          ) : null;
        })()}
    </>
  );
}

export function Viewport({ meshes, label }: { meshes: ReadonlyMap<string, ExactMesh>; label: string }) {
  const select = useEditor((s) => s.select);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 35, near: 10, far: 60000, position: [3000, 2000, 3000] }}
      gl={{ antialias: true, alpha: true }}
      aria-label={label}
      role="img"
      onPointerMissed={(e) => {
        if (e.type === 'click' && useEditor.getState().tool === 'select') select(null);
      }}
      style={{ touchAction: 'none' }}
    >
      <Scene meshes={meshes} />
    </Canvas>
  );
}

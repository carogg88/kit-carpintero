import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { formatLength, partBox, snapCoord, snapMove, woodById, type Axis, type Box, type Part, type Project } from '@kitc/core';
import { useEditor, type View } from './store';
import { partKey, type ExactMesh } from './useGeometry';

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

function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Órbita, encuadre de las vistas (Iso, Frente, Lateral, Planta) y reencuadre al cambiar el tamaño. */
function CameraRig({ controlsRef }: { controlsRef: React.RefObject<OrbitControls | null> }) {
  const { camera, gl, invalidate, size } = useThree();
  const project = useEditor((s) => s.project);
  const view = useEditor((s) => s.view);
  const viewNonce = useEditor((s) => s.viewNonce);
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

  // Encuadra la vista pedida. Animado, salvo al abrir o si la persona prefiere menos movimiento.
  const frame = useEffectEvent((instant: boolean) => {
    const c = controlsRef.current;
    const p = useEditor.getState().project;
    if (!c || !p || !(camera instanceof THREE.PerspectiveCamera)) return;
    const b = bounds(p);
    const center = b.getCenter(new THREE.Vector3());
    const r = b.getSize(new THREE.Vector3()).length() / 2;
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const dist = (r / Math.sin(Math.min(hHalf, vHalf))) * 0.98;
    const to = center.clone().add(new THREE.Vector3(...VIEW_DIRS[useEditor.getState().view]).normalize().multiplyScalar(dist));
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
  const { camera, gl, invalidate } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const colors = useMemo(
    () => ({ edge: cssColor('--ink', '#1C2320'), accent: cssColor('--accent', '#1E5A7A'), line: cssColor('--line-strong', '#C9C6BB') }),
    [],
  );

  const units = project?.units ?? 'cm';

  const startDrag = (e: ThreeEvent<PointerEvent>, part: Part) => {
    const { tool, select, beginDrag } = useEditor.getState();
    if (tool === 'select' || !e.face) return;
    e.stopPropagation();
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
    select(part.id);
    beginDrag();
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
        dragUpdate((d) => {
          const q = d.parts.find((x) => x.id === part.id);
          if (!q) return;
          q.position[0] = drag.start.min[0] + shifts[0]!;
          q.position[2] = drag.start.min[2] + shifts[1]!;
        });
        setHint({
          ...hintAt,
          text: `${part.id} · ${formatLength(Math.abs(shifts[0]!), units)} ↔ · ${formatLength(Math.abs(shifts[1]!), units)} ↕`,
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
      const { endDrag, setHint } = useEditor.getState();
      setHint(null);
      endDrag(drag.kind === 'push' ? { id: part.id, axis: drag.axis, sign: drag.sign } : undefined);
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

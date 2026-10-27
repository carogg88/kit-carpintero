import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { partBox, partKey, placedJoint, woodById, type Box, type Joint, type Part, type Project } from '@kitc/core';
import { useDraftMeshes, type ExactMesh } from './useGeometry';
import { cssColor } from './Viewport';

const DIR = new THREE.Vector3(1, 0.72, 1.15).normalize();


/** Zona a encuadrar: donde se tocan las dos piezas, con aire alrededor. */
function focusBox(a: Box, b: Box): THREE.Box3 {
  const min = a.min.map((v, i) => Math.max(v - 1, b.min[i]!));
  const max = a.max.map((v, i) => Math.min(v + 1, b.max[i]!));
  const contact = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
  if (contact.isEmpty()) {
    contact.set(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
  }
  const size = contact.getSize(new THREE.Vector3());
  return contact.expandByScalar(Math.max(70, 0.45 * Math.max(size.x, size.y, size.z)));
}

function Rig({ focus, frameKey }: { focus: THREE.Box3; frameKey: string }) {
  const { camera, gl, invalidate, size } = useThree();
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = false;
    const onChange = () => invalidate();
    c.addEventListener('change', onChange);
    controls.current = c;
    return () => {
      c.removeEventListener('change', onChange);
      c.dispose();
      controls.current = null;
    };
  }, [camera, gl, invalidate]);

  const frame = useEffectEvent(() => {
    const c = controls.current;
    if (!c || !(camera instanceof THREE.PerspectiveCamera)) return;
    const center = focus.getCenter(new THREE.Vector3());
    const r = focus.getSize(new THREE.Vector3()).length() / 2;
    const vHalf = (camera.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    camera.position.copy(center.clone().add(DIR.clone().multiplyScalar(r / Math.sin(Math.min(hHalf, vHalf)))));
    c.target.copy(center);
    c.update();
    invalidate();
  });
  useEffect(() => frame(), [frameKey, size.width, size.height]);
  return null;
}

interface Look {
  fill: string;
  edge: string;
  xray: boolean;
}

function Piece({ part, exact, look }: { part: Part; exact: ExactMesh | undefined; look: Look }) {
  const box = partBox(part);
  const size = box.max.map((v, i) => v - box.min[i]!) as [number, number, number];
  const center = box.min.map((v, i) => v + size[i]! / 2) as [number, number, number];
  const boxGeo = useMemo(() => new THREE.BoxGeometry(...size), [size[0], size[1], size[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const geometry = exact?.geometry ?? boxGeo;
  const edges = useMemo(() => exact?.edges ?? new THREE.EdgesGeometry(boxGeo), [exact, boxGeo]);
  useEffect(() => () => boxGeo.dispose(), [boxGeo]);
  useEffect(() => () => void (edges !== exact?.edges && edges.dispose()), [edges, exact]);
  return (
    <group position={exact ? [0, 0, 0] : center}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={look.fill}
          roughness={0.85}
          transparent={look.xray}
          opacity={look.xray ? 0.2 : 1}
          depthWrite={!look.xray}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments geometry={edges} onUpdate={(l) => look.xray && l.computeLineDistances()}>
        {look.xray ? (
          <lineDashedMaterial color={look.edge} dashSize={6} gapSize={4} />
        ) : (
          <lineBasicMaterial color={look.edge} transparent opacity={0.7} />
        )}
      </lineSegments>
    </group>
  );
}

/** Corre la pieza que entra hasta `to`, de a poco: se ve cómo sale la espiga de la caja. */
function Slide({ to, children }: { to: [number, number, number]; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  const target = useMemo(() => new THREE.Vector3(...to), [to[0], to[1], to[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => invalidate(), [target, invalidate]);
  useFrame(() => {
    const g = ref.current;
    if (!g || g.position.distanceTo(target) < 0.05) return;
    // Con movimiento reducido, salta de una.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) g.position.copy(target);
    else g.position.lerp(target, 0.22);
    if (g.position.distanceTo(target) < 0.5) g.position.copy(target);
    invalidate();
  });
  return <group ref={ref}>{children}</group>;
}

interface Props {
  project: Project;
  joint: Joint;
  meshes: ReadonlyMap<string, ExactMesh>;
  label: string;
  /** Cómo quedaría con una medida a medio escribir (o un cambio esperando Aplicar): el detalle la muestra ya. */
  draft?: Project | null;
  /** Las dos piezas separadas, para ver la espiga afuera y la caja vacía. */
  apart?: boolean;
}

/** Detalle 3D de una unión: la pieza que recibe en rayos X y la que entra, sólida, encuadradas en el encastre. */
export function JointDetail3D({ project, joint, meshes, label, draft = null, apart = false }: Props) {
  const shown = draft ?? project;
  const a = shown.parts.find((p) => p.id === joint.partA);
  const b = shown.parts.find((p) => p.id === joint.partB);
  const drafts = useDraftMeshes(draft, [joint.partA, joint.partB]);
  /**
   * La malla al día con lo que se muestra; si el motor todavía la está haciendo, mientras se escribe sigue la
   * anterior (con la espiga de antes, mejor que una caja lisa).
   */
  const exact = (id: string) => {
    const key = partKey(shown, id);
    const m = meshes.get(id);
    if (m?.key === key) return m;
    const d = drafts.get(id);
    if (d?.key === key) return d;
    return draft ? (d ?? m) : undefined;
  };
  const colors = useMemo(() => ({ ink: cssColor('--ink', '#2B3628'), signal: cssColor('--signal', '#C98A4E'), xray: cssColor('--xray-edge', '#6B4A2B') }), []);
  const placed = placedJoint(shown, joint);
  if (!a || !b || !placed) return null;
  // Donde quedan de verdad: una pata inclinada, o un travesaño que la sigue, no están donde su caja derecha.
  const ex = placed.explode;
  const offset: [number, number, number] = apart ? ex.offset : [0, 0, 0];
  // Separadas, el encuadre abarca las dos: la caja y la espiga que salió.
  const focus = focusBox(placed.a, placed.b);
  if (apart) focus.union(focus.clone().translate(new THREE.Vector3(...ex.offset)));
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 5, far: 30000, position: [1000, 800, 1000] }}
      gl={{ antialias: true, alpha: true }}
      role="img"
      aria-label={label}
      style={{ touchAction: 'none' }}
    >
      <Rig focus={focus} frameKey={`${joint.id}-${apart}`} />
      <hemisphereLight args={['#ffffff', '#b9ad98', 1.7]} />
      <directionalLight position={[1500, 2500, 1800]} intensity={1.3} />
      <Slide to={offset}>
        <Piece part={b} exact={exact(b.id)} look={{ fill: colors.signal, edge: colors.ink, xray: false }} />
      </Slide>
      {/* Separadas, la que recibe va sólida: la caja vacía se ve mejor que en rayos X. */}
      <Piece part={a} exact={exact(a.id)} look={{ fill: woodById(a.wood)?.color ?? '#D9BC8C', edge: apart ? colors.ink : colors.xray, xray: !apart }} />
    </Canvas>
  );
}

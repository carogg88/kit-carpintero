import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { partBox, woodById, type Box, type Joint, type Part, type Project } from '@kitc/core';
import { partKey, type ExactMesh } from './useGeometry';
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

interface Props {
  project: Project;
  joint: Joint;
  meshes: ReadonlyMap<string, ExactMesh>;
  label: string;
}

/** Detalle 3D de una unión: la pieza que recibe en rayos X y la que entra, sólida, encuadradas en el encastre. */
export function JointDetail3D({ project, joint, meshes, label }: Props) {
  const a = project.parts.find((p) => p.id === joint.partA);
  const b = project.parts.find((p) => p.id === joint.partB);
  const exact = (id: string) => {
    const m = meshes.get(id);
    return m && m.key === partKey(project, id) ? m : undefined;
  };
  const colors = useMemo(() => ({ ink: cssColor('--ink', '#1C2320'), signal: cssColor('--signal', '#F2B544'), xray: cssColor('--xray-edge', '#6B4A2B') }), []);
  if (!a || !b) return null;
  const focus = focusBox(partBox(a), partBox(b));
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
      <Rig focus={focus} frameKey={joint.id} />
      <hemisphereLight args={['#ffffff', '#b9ad98', 1.7]} />
      <directionalLight position={[1500, 2500, 1800]} intensity={1.3} />
      <Piece part={b} exact={exact(b.id)} look={{ fill: colors.signal, edge: colors.ink, xray: false }} />
      <Piece part={a} exact={exact(a.id)} look={{ fill: woodById(a.wood)?.color ?? '#D9BC8C', edge: colors.xray, xray: true }} />
    </Canvas>
  );
}

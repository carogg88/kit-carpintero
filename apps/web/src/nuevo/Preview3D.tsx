import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { formatLength, partBox, woodById, type Project, type TemplateField, type Units } from '@kitc/core';
import { cssColor } from '../editor/Viewport';
import styles from './Nuevo.module.css';

/** Desde adelante, a la derecha y arriba, como la vista 3D del editor. */
const DIR = new THREE.Vector3(1, 0.72, 1.15).normalize();

type Vec = [number, number, number];

/** Caja que encierra un grupo de piezas. */
function boundsOf(project: Project, ids?: (id: string) => boolean): THREE.Box3 {
  const b = new THREE.Box3();
  for (const p of project.parts) {
    if (ids && !ids(p.id)) continue;
    const { min, max } = partBox(p);
    b.expandByPoint(new THREE.Vector3(...min)).expandByPoint(new THREE.Vector3(...max));
  }
  return b;
}

export interface Dimension {
  a: Vec;
  b: Vec;
  /** Hacia dónde salen las líneas de referencia, desde la pieza hasta la cota. */
  out: Vec;
  mm: number;
}

/**
 * La cota de un campo: corre al lado de lo que mide, del lado que mira a la cámara (adelante, a la
 * derecha y abajo), separada un poco para no tapar la pieza.
 */
export function fieldDimension(project: Project, field: TemplateField): Dimension | null {
  const { measure, axis, fromFloor } = field.shows;
  if (!measure || axis === undefined) return null;
  const all = boundsOf(project);
  const box = measure === 'all' ? all : boundsOf(project, (id) => id === measure);
  if (box.isEmpty()) return null;
  const size = all.getSize(new THREE.Vector3());
  const off = Math.max(size.x, size.y, size.z) * 0.07;
  const lo = box.min.toArray() as Vec;
  const hi = box.max.toArray() as Vec;
  const a: Vec = [hi[0], lo[1], hi[2]];
  const out: Vec = [0, 0, 0];
  // La cota a lo largo de x va adelante; la de y y la de z, a la derecha.
  if (axis === 0) out[2] = off;
  else out[0] = off;
  if (axis === 0) a[0] = lo[0];
  if (axis === 1) a[1] = fromFloor ? 0 : lo[1];
  if (axis === 2) a[2] = lo[2];
  const b: Vec = [...a];
  b[axis] = fromFloor ? lo[1] : hi[axis];
  return { a, b, out, mm: b[axis] - a[axis] };
}

function Camera({ bounds }: { bounds: THREE.Box3 }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const r = bounds.getSize(new THREE.Vector3()).length() / 2;
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) => new THREE.Vector3(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z),
    );
    // La esfera que encierra el mueble deja mucho aire: se acerca hasta que las esquinas casi tocan el borde.
    let dist = r / Math.sin((camera.fov * Math.PI) / 360);
    for (let i = 0; i < 3; i++) {
      camera.position.copy(center.clone().add(DIR.clone().multiplyScalar(dist)));
      camera.lookAt(center);
      camera.updateMatrixWorld();
      const reach = Math.max(...corners.map((c) => {
        const p = c.clone().project(camera);
        return Math.max(Math.abs(p.x), Math.abs(p.y));
      }));
      dist *= reach / 0.86;
    }
    camera.position.copy(center.clone().add(DIR.clone().multiplyScalar(dist)));
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, bounds, size.width, size.height, invalidate]);
  return null;
}

function Piece({ min, max, fill, edge, dim }: { min: Vec; max: Vec; fill: string; edge: string; dim: boolean }) {
  const size = max.map((v, i) => v - min[i]!) as Vec;
  const geo = useMemo(() => new THREE.BoxGeometry(...size), [size[0], size[1], size[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  useEffect(() => () => (geo.dispose(), edges.dispose()), [geo, edges]);
  return (
    <group position={min.map((v, i) => v + size[i]! / 2) as Vec}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={fill} roughness={0.85} transparent={dim} opacity={dim ? 0.35 : 1} depthWrite={!dim} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={edge} transparent={dim} opacity={dim ? 0.4 : 1} />
      </lineSegments>
    </group>
  );
}

/** La cota: línea con topes en las puntas y líneas de referencia hasta la pieza. */
function DimensionLine({ d, color }: { d: Dimension; color: string }) {
  const geo = useMemo(() => {
    const v = (p: Vec, k = 1) => new THREE.Vector3(p[0] + d.out[0] * k, p[1] + d.out[1] * k, p[2] + d.out[2] * k);
    const tick = new THREE.Vector3(...d.out).multiplyScalar(0.25);
    const pts = [
      v(d.a, 0.15), v(d.a, 1.2), // referencia
      v(d.b, 0.15), v(d.b, 1.2),
      v(d.a), v(d.b), // cota
      v(d.a).sub(tick), v(d.a).add(tick),
      v(d.b).sub(tick), v(d.b).add(tick),
    ];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [d]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <lineSegments geometry={geo} renderOrder={10}>
      <lineBasicMaterial color={color} depthTest={false} transparent />
    </lineSegments>
  );
}

/** Ubica la etiqueta de la cota sobre la imagen, en el medio de la línea. */
function LabelAnchor({ d, onPlace }: { d: Dimension | null; onPlace: (p: { x: number; y: number } | null) => void }) {
  const { camera, size } = useThree();
  // Por valor y no por objeto: el mueble se vuelve a armar en cada render de quien lo muestra.
  const key = JSON.stringify(d);
  useEffect(() => {
    const d = JSON.parse(key) as Dimension | null;
    if (!d) return onPlace(null);
    // Un poco más afuera que la línea, para no tapar la cota ni la pieza cuando la medida es chica.
    const mid = new THREE.Vector3(...d.a).add(new THREE.Vector3(...d.b)).multiplyScalar(0.5).add(new THREE.Vector3(...d.out).multiplyScalar(1.9));
    // La cámara ya quedó encuadrada en este mismo render (Camera va antes en el árbol).
    camera.updateMatrixWorld();
    const p = mid.project(camera);
    onPlace({ x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height });
  }, [key, camera, size.width, size.height, onPlace]);
  return null;
}

interface Props {
  project: Project;
  /** Campo elegido: resalta sus piezas y muestra su cota. */
  field?: TemplateField;
  onLabel: (p: { x: number; y: number } | null) => void;
}

/** El mueble en 3D, visto en diagonal. Con un campo elegido, lo demás queda transparente. */
export function Preview3D({ project, field, onLabel }: Props) {
  const colors = useMemo(
    () => ({ edge: cssColor('--piece-line', '#6b4a2b'), hi: cssColor('--measure', '#e0a42b'), dim: cssColor('--accent', '#9e6027') }),
    [],
  );
  const dim = useMemo(() => (field ? fieldDimension(project, field) : null), [project, field]);
  const all = boundsOf(project);
  // El encuadre deja lugar para la cota más alejada que puede aparecer (adelante y a la derecha).
  const frame = useMemo(() => {
    const s = all.getSize(new THREE.Vector3());
    const off = Math.max(s.x, s.y, s.z) * 0.1;
    return all.clone().expandByPoint(all.max.clone().add(new THREE.Vector3(off, 0, off)));
  }, [all.min.x, all.min.y, all.min.z, all.max.x, all.max.y, all.max.z]); // eslint-disable-line react-hooks/exhaustive-deps
  const lit = (id: string) => !field || id.startsWith(field.shows.parts);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 10, far: 60000, position: [3000, 2000, 3000] }}
      gl={{ antialias: true, alpha: true }}
      aria-hidden="true"
      className={styles.canvas}
    >
      <Camera bounds={frame} />
      <hemisphereLight args={['#ffffff', '#b9ad98', 1.6]} />
      <directionalLight position={[1500, 2500, 1800]} intensity={1.4} />
      {project.parts.map((p) => {
        const { min, max } = partBox(p);
        const on = lit(p.id);
        return (
          <Piece
            key={p.id}
            min={min}
            max={max}
            fill={field && on ? colors.hi : (woodById(p.wood)?.color ?? '#D9BC8C')}
            edge={colors.edge}
            dim={!on}
          />
        );
      })}
      {dim && <DimensionLine d={dim} color={colors.dim} />}
      <LabelAnchor d={dim} onPlace={onLabel} />
    </Canvas>
  );
}

/** Texto de la cota: la medida actual en las unidades elegidas. */
export const dimensionText = (field: TemplateField, project: Project, units: Units) => {
  const d = fieldDimension(project, field);
  return d ? formatLength(d.mm, units) : '';
};

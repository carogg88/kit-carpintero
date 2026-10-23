import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  acrossFace,
  arcInfo,
  arcPoints,
  arcTouchesEdge,
  nextPocketId,
  pocketRegion,
  bevelSolid,
  boxSize,
  copyPart,
  cornerNear,
  formatLength,
  edgeNear,
  isAngleCut,
  MEASURED_FROM,
  newBevel,
  newSection,
  nextSectionId,
  partAxesBySize,
  presetTurning,
  sectionBox,
  newPocket,
  otherAxes,
  partBox,
  partKey,
  snapCoord,
  snapMove,
  snapOnFace,
  t,
  tk,
  woodById,
  type Axis,
  type Bevel,
  type Box,
  type Part,
  type PocketShape,
  type Project,
  type Section,
} from '@kitc/core';
import { DEAD_PX, gentle, roundMeasure } from './gesture';
import { ghostDiff } from './ghost';
import { useEditor, type DrawFace, type View } from './store';
import type { ExactMesh } from './useGeometry';

const VIEW_DIRS: Record<View, [number, number, number]> = {
  iso: [1, 0.72, 1.15],
  front: [0, 0.04, 1],
  side: [1, 0.04, 0],
  top: [0, 1, 0.0001],
};
const AXIS_NAMES = [tk('ancho'), tk('alto'), tk('fondo')] as const;
const snapName = (to: 'borde' | 'centro' | null) => (to === 'borde' ? t('borde') : to === 'centro' ? t('centro') : null);

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

/** Órbita, encuadre de las vistas (3D, Frente, Costado, Arriba) y reencuadre al cambiar el tamaño. */
function CameraRig({ controlsRef }: { controlsRef: React.RefObject<OrbitControls | null> }) {
  const { camera, gl, invalidate, size } = useThree();
  const project = useEditor((s) => s.project);
  const view = useEditor((s) => s.view);
  const viewNonce = useEditor((s) => s.viewNonce);
  const drawFace = useEditor((s) => s.drawFace);
  const drawFramed = useEditor((s) => s.drawFramed);
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
      // Girando la vista, la burbuja de medida ya no queda junto a su pieza.
      useEditor.getState().setBubble(null);
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

  // Encuadra la vista pedida (3D, Frente, Costado, Arriba) con todo el mueble adentro.
  const frame = useEffectEvent((instant: boolean, with_?: Project) => {
    const p = with_ ?? useEditor.getState().project;
    if (!p || !(camera instanceof THREE.PerspectiveCamera)) return;
    const b = bounds(p);
    const center = b.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(...VIEW_DIRS[useEditor.getState().view]).normalize();
    // Prueba con una cámara igual: acerca o aleja hasta que las 8 esquinas entran con un margen (las patas
    // de abajo quedaban cortadas con la esfera que envuelve al mueble en pantallas apaisadas).
    const probe = camera.clone();
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z),
    );
    let dist = b.getSize(new THREE.Vector3()).length();
    for (let i = 0; i < 6; i++) {
      probe.position.copy(center).addScaledVector(dir, dist);
      probe.lookAt(center);
      probe.updateMatrixWorld();
      const ndc = corners.map((c) => c.clone().project(probe));
      const reach = Math.max(...ndc.map((q) => Math.max(Math.abs(q.x), Math.abs(q.y))));
      dist *= reach / 0.86;
    }
    flyTo(center, dir, dist, instant);
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
    c.enableRotate = !(drawFace && drawFramed);
    c.maxPolarAngle = drawFace && drawFramed ? Math.PI : Math.PI * 0.495;
    if (drawFace && drawFramed) frameFace(drawFace);
  }, [drawFace, drawFramed, controlsRef]);

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
  // Una pieza nueva que cae fuera de la vista (una copia al costado, la gemela del otro lado), o la vista previa de
  // un cambio que se sale de la pantalla: se encuadra todo, con el fantasma adentro.
  const outOfView = (p: Project) => {
    const b = bounds(p);
    camera.updateMatrixWorld();
    return [0, 1, 2, 3, 4, 5, 6, 7].some((i) => {
      const q = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
      return Math.abs(q.x) > 0.98 || Math.abs(q.y) > 0.98;
    });
  };
  const partCount = project?.parts.length ?? 0;
  const lastCount = useRef(partCount);
  useEffect(() => {
    const grew = partCount > lastCount.current;
    lastCount.current = partCount;
    const p = useEditor.getState().project;
    if (grew && p && outOfView(p)) frame(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partCount, camera]);
  const pendingGhost = useEditor((s) => (s.pending ? s.ghost : null));
  useEffect(() => {
    if (pendingGhost && outOfView(pendingGhost)) frame(false, pendingGhost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGhost]);

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

/** Tramo que se está marcando: la caja que va a ocupar. */
function SectionDraft({ accent }: { accent: string }) {
  const draft = useEditor((s) => s.sectionDraft);
  const part = useEditor((s) => s.project?.parts.find((p) => p.id === s.sectionDraft?.partId));
  const lines = useMemo(() => {
    if (!draft || !part) return null;
    const b = sectionBox(part, draft.section);
    const size = new THREE.Vector3(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
    geo.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: accent, depthTest: false }));
  }, [draft, part, accent]);
  useEffect(
    () => () => {
      lines?.geometry.dispose();
      (lines?.material as THREE.Material | undefined)?.dispose();
    },
    [lines],
  );
  return lines ? <primitive object={lines} renderOrder={2} /> : null;
}

/** El fantasma: lo nuevo o cambiado, en el color de acento; lo que se borraría, en rojo. */
function ChangeGhost({ accent, danger }: { accent: string; danger: string }) {
  const project = useEditor((s) => s.project);
  const ghost = useEditor((s) => s.ghost);
  const invalidate = useThree((s) => s.invalidate);
  const objects = useMemo(() => {
    if (!project || !ghost) return [];
    const { changed, removed } = ghostDiff(project, ghost);
    const make = (b: Box, color: string, opacity: number) => {
      const geo = new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
      geo.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
      const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color, depthTest: false }));
      return [fill, edges];
    };
    return [...changed.flatMap((b) => make(b, accent, 0.22)), ...removed.flatMap((b) => make(b, danger, 0.3))];
  }, [project, ghost, accent, danger]);
  useEffect(
    () => () => {
      for (const o of objects) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    },
    [objects],
  );
  useEffect(() => invalidate(), [objects, invalidate]);
  return (
    <>
      {objects.map((o) => (
        <primitive key={o.uuid} object={o} renderOrder={3} />
      ))}
    </>
  );
}

/** Cajón o puerta por agregar: el hueco elegido, sombreado, y las piezas que van a ir, en líneas. */
function FittingPreview({ accent }: { accent: string }) {
  const preview = useEditor((s) => s.fittingPreview);
  const invalidate = useThree((s) => s.invalidate);
  const objects = useMemo(() => {
    if (!preview) return null;
    const boxGeo = (b: Box) => {
      const geo = new THREE.BoxGeometry(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
      geo.translate((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
      return geo;
    };
    const hole = new THREE.Mesh(boxGeo(preview.opening), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.14, depthWrite: false }));
    const lines = preview.parts.map((b) => {
      const g = boxGeo(b);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: accent, depthTest: false }));
      g.dispose();
      return edges;
    });
    return { hole, lines };
  }, [preview, accent]);
  useEffect(
    () => () => {
      if (!objects) return;
      for (const o of [objects.hole, ...objects.lines]) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    },
    [objects],
  );
  useEffect(() => invalidate(), [objects, invalidate]);
  if (!objects) return null;
  return (
    <>
      <primitive object={objects.hole} renderOrder={1} />
      {objects.lines.map((l, i) => (
        <primitive key={i} object={l} renderOrder={2} />
      ))}
    </>
  );
}

/**
 * Una raya en vez de un rectángulo: sin ancho, o, con la vista en diagonal, tan finita que seguro fue sin querer
 * (el arrastre siguió un solo borde de la cara).
 */
function isSliver(w: number, h: number, framed: boolean): boolean {
  return Math.max(w, h) >= 10 && Math.min(w, h) < (framed ? 3 : Math.max(3, 0.03 * Math.max(w, h)));
}

/**
 * Figura que se está dibujando: su borde y, sombreado, lo que se va a sacar de la pieza. Un arco que no toca
 * ningún borde de la cara se ve en rojo: así no vale.
 */
function Draft({ part, accent, danger }: { part: Part; accent: string; danger: string }) {
  const draft = useEditor((s) => s.draft);
  const points = useMemo(() => (draft ? outline(partBox(part), draft, draft.shape) : null), [draft, part]);
  const framed = useEditor((s) => s.drawFramed);
  const invalid =
    (draft?.shape.kind === 'arc' && !arcTouchesEdge(part, draft.axis, draft.shape, 1)) || (draft?.shape.kind === 'rect' && isSliver(draft.shape.w, draft.shape.h, framed));
  const fill = useMemo(() => {
    if (!draft) return null;
    const region = pocketRegion(part, draft.axis, draft.shape);
    if (region.length < 3 || (draft.shape.kind === 'rect' && (draft.shape.w < 1 || draft.shape.h < 1))) return null;
    const box = partBox(part);
    const tris = THREE.ShapeUtils.triangulateShape(region.map(([u, v]) => new THREE.Vector2(u, v)), []);
    const geo = new THREE.BufferGeometry().setFromPoints(region.map(([u, v]) => facePoint(box, draft, u, v, 0.5)));
    geo.setIndex(tris.flat());
    return geo;
  }, [draft, part]);
  useEffect(() => () => fill?.dispose(), [fill]);
  // Rectángulo: líneas guía de borde a borde por sus lados, para ver hacia dónde corre cada borde de la cara
  // aunque la vista esté en diagonal.
  const guides = useMemo(() => {
    if (draft?.shape.kind !== 'rect') return null;
    const box = partBox(part);
    const [ua, va] = otherAxes(draft.axis);
    const [W, H] = [box.max[ua] - box.min[ua], box.max[va] - box.min[va]];
    const { u, v, w, h } = draft.shape;
    const pts = [u, u + w].flatMap((x) => [facePoint(box, draft, x, 0, 0.5), facePoint(box, draft, x, H, 0.5)]);
    pts.push(...[v, v + h].flatMap((y) => [facePoint(box, draft, 0, y, 0.5), facePoint(box, draft, W, y, 0.5)]));
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: accent, dashSize: Math.max(W, H) / 60, gapSize: Math.max(W, H) / 90, transparent: true, opacity: 0.7, depthTest: false }),
    );
    lines.computeLineDistances();
    return lines;
  }, [draft, part, accent]);
  useEffect(
    () => () => {
      guides?.geometry.dispose();
      (guides?.material as THREE.Material | undefined)?.dispose();
    },
    [guides],
  );
  return (
    <>
      {guides && <primitive object={guides} renderOrder={2} />}
      {fill && !invalid && (
        <mesh geometry={fill} renderOrder={2}>
          <meshBasicMaterial color={accent} transparent opacity={0.38} side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
        </mesh>
      )}
      {points && <Loop points={points} color={invalid ? danger : accent} />}
    </>
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
  /** Mover: los dos ejes que sigue el arrastre, el de la pantalla a lo ancho y el de la pantalla a lo alto. */
  axes: [Axis, Axis];
}

/**
 * Mover arrastra sobre el plano que mira la vista: de frente, a lo ancho y de alto; de costado, a lo fondo y
 * de alto; desde arriba (y en 3D), por el piso. En 3D, con Mayús sube o baja. Así ningún lado queda trabado.
 */
function movePlane(view: View, point: THREE.Vector3, camera: THREE.Camera, vertical: boolean): { plane: THREE.Plane; axes: [Axis, Axis] } {
  if (view === 'front') return { plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -point.z), axes: [0, 1] };
  if (view === 'side') return { plane: new THREE.Plane(new THREE.Vector3(1, 0, 0), -point.x), axes: [2, 1] };
  if (view === 'iso' && vertical) {
    // De pie, de cara a la cámara: sólo se usa el alto.
    const look = new THREE.Vector3();
    camera.getWorldDirection(look);
    const along: Axis = Math.abs(look.x) > Math.abs(look.z) ? 0 : 2;
    const n = new THREE.Vector3();
    n.setComponent(along, 1);
    return { plane: new THREE.Plane(n, -point.getComponent(along)), axes: [1, 1] };
  }
  return { plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -point.y), axes: [0, 2] };
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

/** Dónde el rayo toca la cara elegida para dibujar, si cae adentro de ella. */
function pointOnDrawFace(ray: THREE.Ray, part: Part, face: DrawFace): THREE.Vector3 | null {
  // Solo si se la mira desde afuera: de atrás, la cara no se ve.
  if (ray.direction.getComponent(face.axis) * face.side >= 0) return null;
  const box = partBox(part);
  const normal = new THREE.Vector3();
  normal.setComponent(face.axis, 1);
  const plane = new THREE.Plane(normal, -(face.side > 0 ? box.max[face.axis] : box.min[face.axis]));
  const pt = ray.intersectPlane(plane, new THREE.Vector3());
  if (!pt) return null;
  const inside = otherAxes(face.axis).every((a) => pt.getComponent(a) >= box.min[a] && pt.getComponent(a) <= box.max[a]);
  return inside ? pt : null;
}

function Scene({ meshes }: { meshes: ReadonlyMap<string, ExactMesh> }) {
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const xray = useEditor((s) => s.xray);
  const ghost = useEditor((s) => s.ghost);
  const dragging = useEditor((s) => s.dragging);
  const drawFace = useEditor((s) => s.drawFace);
  const { camera, gl, invalidate } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const colors = useMemo(
    () => ({ edge: cssColor('--ink', '#2B3628'), accent: cssColor('--accent', '#9E6027'), line: cssColor('--line-strong', '#C9C6BB'), danger: cssColor('--danger', '#B3261E') }),
    [],
  );

  const units = project?.units ?? 'cm';

  const startDrag = (e: ThreeEvent<PointerEvent>, original: Part) => {
    const { tool, select, beginDrag, copyMove, commit, project: current } = useEditor.getState();
    if (tool === 'select' || !e.face || !current) return;
    e.stopPropagation();
    if (tool === 'draw') {
      // Con una cara ya elegida, el trazo va a esa cara aunque otra pieza la tape (un listón que pasa por delante).
      const chosen = current.parts.find((q) => q.id === useEditor.getState().drawFace?.partId);
      const onFace = chosen && chosen.id !== original.id ? pointOnDrawFace(e.ray, chosen, useEditor.getState().drawFace!) : null;
      return onFace ? beginSketch(onFace, e.nativeEvent) : pickFace(e, original);
    }
    if (tool === 'bevel') return startBevel(e, original);
    if (tool === 'section') return startSection(e, original);
    if (tool === 'turn') {
      // Tornear: la pieza pasa a ser su taco girado, como un cilindro; el perfil se arma en el panel.
      if (!original.turning) {
        commit((d) => {
          const q = d.parts.find((x) => x.id === original.id);
          if (q) q.turning = presetTurning(q as Part, 'cilindro');
        }, t('Torneaste {id}', { id: original.id }));
      }
      return select(original.id);
    }
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
    const vertical = e.nativeEvent.shiftKey;
    const drag: Drag = {
      kind: tool,
      part,
      start,
      axis,
      sign,
      origin: e.point.clone(),
      dir,
      ...movePlane(useEditor.getState().view, e.point, camera, vertical),
    };
    const [x0, y0] = [e.nativeEvent.clientX, e.nativeEvent.clientY];
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
        // Suave: un arrastre corto cambia unos milímetros; la medida queda redonda.
        const pull = gentle(Math.hypot(ev.clientX - x0, ev.clientY - y0), closestT(drag.origin, drag.dir, raycaster.ray));
        const opposite = drag.sign > 0 ? drag.start.min[drag.axis] : drag.start.max[drag.axis];
        const startSize = drag.start.max[drag.axis] - drag.start.min[drag.axis];
        const size = Math.abs(pull) < 20 ? Math.round(startSize + pull) : Math.round((startSize + pull) / 5) * 5;
        const snap = snapCoord(p.parts, opposite + drag.sign * size, drag.axis, part.id);
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
          text: `${part.id} · ${t(AXIS_NAMES[drag.axis])} ${formatLength(max - min, units)}`,
          snap: snap.to === 'piso' ? t('piso') : snap.to ? t('cara de {id}', { id: snap.to }) : null,
        });
      } else {
        const pt = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(drag.plane, pt)) return;
        // Un toque o un temblor no corre la pieza.
        if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) <= DEAD_PX) return;
        const snaps: string[] = [];
        const [ax, ay] = drag.axes;
        const shift = (k: Axis) => {
          let delta = pt.getComponent(k) - drag.origin.getComponent(k);
          // No se mete debajo del piso.
          if (k === 1) delta = Math.max(delta, -drag.start.min[1]);
          const s = snapMove(p.parts, drag.start, k, delta, part.id);
          if (s.to) snaps.push(s.mirror ? t('mismo retiro que {id}', { id: s.to }) : t('cara de {id}', { id: s.to }));
          return k === 1 ? Math.max(s.value, -drag.start.min[1]) : s.value;
        };
        const sx = shift(ax);
        const sy = ay === ax ? 0 : shift(ay);
        if (sx || sy) moved = true;
        dragUpdate((d) => {
          const q = d.parts.find((x) => x.id === part.id);
          if (!q) return;
          q.position[ax] = drag.start.min[ax] + sx;
          if (ay !== ax) q.position[ay] = drag.start.min[ay] + sy;
        });
        const who = copying ? t('Copia {id}', { id: part.id }) : part.id;
        setHint({
          ...hintAt,
          text:
            ay === ax
              ? `${who} · ${formatLength(Math.abs(sx), units)} ${sx < 0 ? '↓' : '↑'}`
              : `${who} · ${formatLength(Math.abs(sx), units)} ↔ · ${formatLength(Math.abs(sy), units)} ↕`,
          snap: snaps.length ? [...new Set(snaps)].join(' · ') : null,
        });
      }
      invalidate();
    };
    const onUp = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const last = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (controlsRef.current) controlsRef.current.enabled = true;
      const { endDrag, cancelDrag, setHint, setBubble } = useEditor.getState();
      setHint(null);
      // Una copia que no se movió quedaría encima de la original: se descarta.
      if (copying && !moved) {
        cancelDrag();
        select(original.id);
        return;
      }
      if (drag.kind === 'push') {
        const q = useEditor.getState().project?.parts.find((x) => x.id === part.id);
        const size = q?.base.kind === 'box' ? q.base.size[drag.axis] : 0;
        const changed = Math.abs(size - (drag.start.max[drag.axis] - drag.start.min[drag.axis])) > 0.05;
        const label = t('{id} ahora mide {size} de {dim}', { id: part.id, size: formatLength(size, units), dim: t(AXIS_NAMES[drag.axis]) });
        const pushed = { id: part.id, axis: drag.axis, sign: drag.sign };
        endDrag(pushed, changed ? label : undefined);
        // Al soltar, la medida exacta se escribe ahí mismo.
        setBubble({ target: { kind: 'push', ...pushed }, ...last });
      } else {
        endDrag(undefined, moved ? (copying ? t('Hiciste la copia {id}', { id: part.id }) : t('Moviste {id}', { id: part.id })) : undefined);
        // Como en Estirar: al soltar se escribe cuánto se corrió y a qué altura queda. Un toque sin arrastrar
        // también la abre, para subir o bajar la pieza escribiendo.
        setBubble({ target: { kind: 'move', id: part.id, from: [...drag.start.min] }, ...last });
      }
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
    const face = { partId: part.id, axis, side } as const;
    // Un toque elige la cara y la pone de frente. Si en cambio se arrastra de entrada, se dibuja ahí mismo
    // sobre esa cara, sin mover la vista.
    const point = e.point.clone();
    const [x0, y0] = [e.nativeEvent.clientX, e.nativeEvent.clientY];
    if (controlsRef.current) controlsRef.current.enabled = false;
    const done = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    const onMove = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) <= DEAD_PX) return;
      done();
      const { select, setDrawFace } = useEditor.getState();
      select(part.id);
      setDrawFace(face, false);
      beginSketch(point, ev, true);
    };
    const onUp = () => {
      done();
      if (controlsRef.current) controlsRef.current.enabled = true;
      const { select, setDrawFace } = useEditor.getState();
      select(part.id);
      setDrawFace(face);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Dibujar, segundo paso: arrastrar sobre la cara elegida. Rectángulo de esquina a esquina; círculo desde el centro.
  const startSketch = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    beginSketch(e.point, e.nativeEvent);
  };
  /** Arranca el trazo en `point` (sobre la cara elegida). `moving`: el dedo ya se está moviendo. */
  const beginSketch = (point: THREE.Vector3, nativeEvent: PointerEvent, moving = false) => {
    const { drawFace: face, drawShape, project: current } = useEditor.getState();
    const part = current?.parts.find((q) => q.id === face?.partId);
    if (!face || !part) return;
    if (controlsRef.current) controlsRef.current.enabled = false;
    // Una figura nueva: la burbuja de la anterior ya quedó.
    useEditor.getState().setBubble(null);
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
      return { u: u.value, v: v.value, snaps: [snapName(u.to), snapName(v.to)] };
    };
    const start = local(point);
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let shape: PocketShape | null = null;
    // Rectángulo al que todavía le falta un lado.
    let flat: PocketShape | null = null;
    const framed = useEditor.getState().drawFramed;
    const sliver = (w: number, h: number) => isSliver(w, h, framed);
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
      let warning: string | undefined;
      if (bending) {
        const len = Math.hypot(bending.u2 - bending.u, bending.v2 - bending.v);
        const nu = -(bending.v2 - bending.v) / len;
        const nv = (bending.u2 - bending.u) / len;
        const raw = (pt.getComponent(ua) - box.min[ua] - bending.u) * nu + (pt.getComponent(va) - box.min[va] - bending.v) * nv;
        const max = len / 2;
        let bulge = Math.max(-max, Math.min(max, Math.round(raw)));
        snaps = [];
        if (max - Math.abs(raw) <= tol) [bulge, snaps] = [Math.sign(raw) * max, [t('semicírculo')]];
        const arc = { kind: 'arc', u: bending.u, v: bending.v, u2: bending.u2, v2: bending.v2, bulge, outside: false } as const;
        shape = bulge === 0 ? null : arc;
        text = bulge === 0 ? t('Recta') : t('Flecha {f} · R {r}', { f: formatLength(Math.abs(bulge), units), r: formatLength(arcInfo(arc).radius, units) });
        if (!shape) useEditor.getState().setDraft({ ...face, shape: { ...arc, bulge: 0 } });
      } else if (drawShape === 'arc') {
        const len = Math.hypot(end.u - start.u, end.v - start.v);
        shape = { kind: 'arc', u: start.u, v: start.v, u2: end.u, v2: end.v, bulge: 0, outside: false };
        text = t('Cuerda {len}', { len: formatLength(len, units) });
        snaps = end.snaps;
        if (!arcTouchesEdge(part, face.axis, shape, 1)) warning = t('Empezá o terminá en un borde');
      } else if (drawShape === 'circle') {
        const d = Math.max(1, Math.round(Math.hypot(pt.getComponent(ua) - box.min[ua] - start.u, pt.getComponent(va) - box.min[va] - start.v) * 2));
        shape = { kind: 'circle', u: start.u, v: start.v, d };
        text = `Ø ${formatLength(d, units)}`;
        snaps = start.snaps;
      } else {
        const w = Math.abs(end.u - start.u);
        const h = Math.abs(end.v - start.v);
        // Aunque le falte un lado se muestra, como una raya, con las guías de los bordes: así se ve hacia dónde seguir.
        flat = { kind: 'rect', u: Math.min(start.u, end.u), v: Math.min(start.v, end.v), w, h };
        shape = w > 0 && h > 0 ? flat : null;
        text = `${formatLength(w, units)} × ${formatLength(h, units)}`;
        snaps = end.snaps;
        if (sliver(w, h)) warning = t('Le falta ancho: seguí la otra línea guía');
      }
      const named = [...new Set(snaps.filter(Boolean))];
      if (shape || !bending) useEditor.getState().setDraft(shape || flat ? { ...face, shape: (shape ?? flat)! } : null);
      useEditor.getState().setHint({ x: ev.clientX - rect.left, y: ev.clientY - rect.top, text, snap: named.length === 2 ? t('{a} y {b}', { a: named[0]!, b: named[1]! }) : (named[0] ?? null), warn: warning });
      invalidate();
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (controlsRef.current) controlsRef.current.enabled = true;
      const { setDraft, setHint, commit, setArcChord, warn, setBubble } = useEditor.getState();
      setHint(null);
      const s = shape as PocketShape | null;
      if (s?.kind === 'arc' && !bending) {
        if (Math.hypot(s.u2 - s.u, s.v2 - s.v) < 3) return setDraft(null);
        // El arco le da forma a un borde o redondea una esquina: en el medio de la cara se llevaría un pedazo enorme.
        if (!arcTouchesEdge(part, face.axis, s, 1)) {
          setDraft(null);
          return warn(t('El arco tiene que empezar o terminar en un borde de la cara'));
        }
        // Cuerda marcada: queda a la vista hasta que se elija la flecha.
        return setArcChord({ ...face, u: s.u, v: s.v, u2: s.u2, v2: s.v2 });
      }
      if (bending && !s) return;
      setDraft(null);
      setArcChord(null);
      // Rectángulo sin ancho: pasa cuando la vista está en diagonal y el arrastre sigue un solo borde. Se avisa y la
      // cara se pone de frente para probar de nuevo.
      const f = (flat ?? s) as PocketShape | null;
      if (f?.kind === 'rect' && sliver(f.w, f.h)) {
        const { drawFramed, setDrawFace } = useEditor.getState();
        if (!drawFramed) setDrawFace(face);
        return warn(drawFramed ? t('Al rectángulo le faltó ancho: arrastrá en diagonal, de esquina a esquina') : t('Al rectángulo le faltó ancho. Puse la cara de frente: arrastrá de nuevo, de esquina a esquina'));
      }
      // Un toque sin arrastrar, o una figura de menos de 3 mm, no deja nada.
      if (!s || (s.kind === 'circle' ? s.d < 3 : s.kind === 'rect' ? s.w < 3 || s.h < 3 : false)) return;
      const pocketId = nextPocketId(part);
      commit((d) => {
        const q = d.parts.find((x) => x.id === part.id);
        if (q) q.pockets.push(newPocket(q as Part, face.axis, face.side, s));
      }, s.kind === 'arc' ? t('Hiciste un corte en arco en {id}', { id: part.id }) : s.kind === 'rect' ? t('Hiciste un vaciado en {id}', { id: part.id }) : t('Hiciste un calado en {id}', { id: part.id }));
      // Al soltar: vaciado o calado, y cuánto de hondo, ahí mismo. Al costado de la figura, para no taparla.
      const rect = gl.domElement.getBoundingClientRect();
      const around = outline(box, face, s).map((p) => {
        const q = p.clone().project(camera);
        return { x: ((q.x + 1) / 2) * rect.width, y: ((1 - q.y) / 2) * rect.height };
      });
      setBubble({
        target: { kind: 'pocket', id: part.id, pocketId },
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
        avoid: {
          x0: Math.min(...around.map((p) => p.x)),
          y0: Math.min(...around.map((p) => p.y)),
          x1: Math.max(...around.map((p) => p.x)),
          y1: Math.max(...around.map((p) => p.y)),
        },
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    // Con la cuerda puesta alcanza con tocar: la flecha sale de donde se tocó.
    if (bending || moving) onMove(nativeEvent);
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
    // Hasta dónde llega el dedo desde la arista (o, en una esquina, desde la cara más lejana).
    const reach = (pt: THREE.Vector3) =>
      corner
        ? Math.max(Math.abs(faceAt(corner.b) - pt.getComponent(corner.b.axis)), Math.abs(faceAt(corner.a) - pt.getComponent(corner.a.axis)))
        : Math.min(across, Math.abs(edgeAt - pt.getComponent(b.axis)));
    const reach0 = reach(e.point);
    const [x0, y0] = [e.nativeEvent.clientX, e.nativeEvent.clientY];
    // Suave: arranca en 3 mm y crece de a poco; recién con un arrastre largo sigue al dedo.
    const amount = (pt: THREE.Vector3, ev: PointerEvent) => {
      const grow = gentle(Math.hypot(ev.clientX - x0, ev.clientY - y0), reach(pt) - reach0);
      return grow > 0 ? roundMeasure(3 + grow) : 0;
    };

    const onMove = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const pt = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, pt)) return;
      let snap: string | null = null;
      if (corner) {
        // En la esquina manda lo que más se alejó de cualquiera de las dos caras.
        const raw = amount(pt, ev);
        // Igual que otra esquina de la pieza, si se acerca: así las cuatro puntas de una tapa salen iguales.
        let r = raw;
        const twin = raw > 0 && part.bevels.find((x) => x.round === round && Math.abs(x.da - raw) <= Math.max(3, raw * 0.08));
        if (twin) [r, snap] = [twin.da, t('igual que {id}', { id: twin.id })];
        bevel = r >= 1 ? newBevel(part, corner.a, corner.b, r, round) : null;
      } else {
        const raw = Math.min(across, amount(pt, ev));
        let da = raw;
        if (!round && across - raw <= tol) [da, snap] = [across, t('todo el ancho')];
        else if (Math.abs(raw - across / 2) <= tol) [da, snap] = [across / 2, t('centro')];
        bevel = da >= 1 ? newBevel(part, a, b, da, round) : null;
      }
      setBevelDraft(bevel ? { partId: part.id, bevel } : null);
      const units = useEditor.getState().project?.units ?? 'cm';
      const what = (bv: Bevel) =>
        bv.round
          ? t('Redondeo R {r}', { r: formatLength(bv.da, units) })
          : isAngleCut(part, bv)
            ? t('Corte en ángulo {a} × {b}', { a: formatLength(bv.da, units), b: formatLength(bv.db, units) })
            : t('Bisel {a} × {b}', { a: formatLength(bv.da, units), b: formatLength(bv.db, units) });
      setHint({
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
        text: bevel ? (corner ? t('Esquina · {what}', { what: what(bevel) }) : what(bevel)) : t('Arrastrá hacia adentro'),
        snap,
      });
      invalidate();
    };
    const onUp = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const last = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
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
      }, round ? t('Hiciste un redondeo en {id}', { id: part.id }) : t('Hiciste un bisel en {id}', { id: part.id }));
      useEditor.getState().setBubble({ target: { kind: 'bevel', id: part.id, bevelId: done.id }, ...last });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Tramo: tocar la pieza a lo largo y arrastrar marca de dónde a dónde va la sección nueva.
  const startSection = (e: ThreeEvent<PointerEvent>, part: Part) => {
    if (!e.face) return;
    const [axis] = partAxesBySize(part);
    const n = e.face.normal;
    const abs = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
    const faceAxis = abs.indexOf(Math.max(...abs)) as Axis;
    // En la punta no hay largo que recorrer.
    if (faceAxis === axis) return;
    const box = partBox(part);
    const len = box.max[axis] - box.min[axis];
    const tol = Math.max(5, len * 0.03);
    const along = (pt: THREE.Vector3) => Math.min(len, Math.max(0, pt.getComponent(axis) - box.min[axis]));
    const snapTo = (t: number) => (t <= tol ? 0 : len - t <= tol ? len : Math.round(t / 5) * 5);
    const t0 = snapTo(along(e.point));
    const { select, setSectionDraft, setHint, commit } = useEditor.getState();
    select(part.id);
    if (controlsRef.current) controlsRef.current.enabled = false;
    const normal = new THREE.Vector3();
    normal.setComponent(faceAxis, 1);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, e.point.clone());
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let section: Section | null = null;

    const onMove = (ev: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const pt = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, pt)) return;
      const at = snapTo(along(pt));
      section = Math.abs(at - t0) >= 5 ? newSection(part, axis, t0, at) : null;
      setSectionDraft(section ? { partId: part.id, section } : null);
      const units = useEditor.getState().project?.units ?? 'cm';
      setHint({
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
        text: section
          ? t('Tramo de {from} a {to} desde {side}', { from: formatLength(section.from, units), to: formatLength(section.to, units), side: t(MEASURED_FROM[axis]) })
          : t('Arrastrá a lo largo de la pieza'),
        snap: at === 0 || at === len ? t('punta') : null,
      });
      invalidate();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (controlsRef.current) controlsRef.current.enabled = true;
      setSectionDraft(null);
      setHint(null);
      const done = section as Section | null;
      if (!done) return;
      commit((d) => {
        const q = d.parts.find((x) => x.id === part.id);
        if (q) q.sections.push({ ...done, id: nextSectionId(q as Part) });
      }, t('Hiciste un tramo en {id}', { id: part.id }));
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
  // Lo que cambiaría queda en rayos X, para ver el fantasma de cómo queda.
  const faded = ghostDiff(project, ghost).faded;
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
            xray={xray || faded.has(p.id)}
            edgeColor={colors.edge}
            accent={colors.accent}
            onPointerDown={startDrag}
            onClick={click}
          />
        );
      })}
      <BevelDraft accent={colors.accent} />
      <SectionDraft accent={colors.accent} />
      <FittingPreview accent={colors.accent} />
      <ChangeGhost accent={colors.accent} danger={colors.danger} />
      {drawFace &&
        (() => {
          const part = project.parts.find((p) => p.id === drawFace.partId);
          return part ? (
            <>
              <FaceOverlay part={part} face={drawFace} accent={colors.accent} onPointerDown={startSketch} />
              <Draft part={part} accent={colors.accent} danger={colors.danger} />
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

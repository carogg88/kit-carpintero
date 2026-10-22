import * as THREE from 'three';
import { partBox, partKey, type Project } from '@kitc/core';
import type { ExactMesh } from './useGeometry';

/**
 * Fotos en 3D para el plano: el mueble armado y cada pieza sola, vistos en diagonal como en el editor.
 * Se dibujan una vez con WebGL fuera de la pantalla y quedan como imagen dentro de la hoja, así salen igual
 * en la pantalla y en el PDF. Para ubicar los códigos, una segunda pasada pinta cada pieza de un color
 * plano y se busca el punto de cada una que queda más lejos de sus bordes.
 */

/** Desde adelante, a la derecha y arriba, como la vista 3D del editor. */
const DIR = new THREE.Vector3(1, 0.72, 1.15).normalize();
const INK = '#2b2622';

export interface ShotLabel {
  id: string;
  /** Dónde poner el código, de 0 a 1 sobre el ancho y el alto de la imagen. */
  x: number;
  y: number;
}

export interface Shot {
  url: string;
  labels: ShotLabel[];
  /** Piezas que no se ven desde este lado: quedan tapadas por otras. */
  hidden: string[];
}

interface Request {
  project: Project;
  meshes: ReadonlyMap<string, ExactMesh>;
  /** Piezas a mostrar; sin esto, todas. */
  parts?: string[];
  /** Color de cada pieza. */
  colors: ReadonlyMap<string, string>;
  /** Tamaño de la imagen en píxeles. */
  width: number;
  height: number;
  /** Si hay que buscar dónde va el código de cada pieza. */
  labels?: boolean;
  /** Desde dónde se mira: sin esto, adelante a la derecha y arriba, como en el editor. */
  dir?: [number, number, number];
  /** Piezas que se ven como un velo, para que las otras se vean a través: no tapan ni llevan código. */
  ghosts?: ReadonlySet<string>;
}

let renderer: THREE.WebGLRenderer | null = null;
let failed = false;

function getRenderer(): THREE.WebGLRenderer | null {
  if (renderer || failed) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
  } catch {
    failed = true;
  }
  return renderer;
}

const cache = new Map<string, Shot | null>();
const MAX_CACHE = 80;

/** La foto pedida, o null si este navegador no puede dibujar en 3D. Las mismas piezas y colores reusan la foto. */
export function shoot(req: Request): Shot | null {
  const ids = req.parts ?? req.project.parts.map((p) => p.id);
  const key = JSON.stringify([
    ids.map((id) => [partKey(req.project, id), req.meshes.get(id)?.key ?? '', req.colors.get(id) ?? '']),
    req.width,
    req.height,
    !!req.labels,
    [...(req.ghosts ?? [])],
    req.dir ?? null,
  ]);
  if (cache.has(key)) return cache.get(key)!;
  const shot = render(req, ids);
  cache.set(key, shot);
  for (const k of cache.keys()) {
    if (cache.size <= MAX_CACHE) break;
    cache.delete(k);
  }
  return shot;
}

function render({ project, meshes, colors, width, height, labels, ghosts, dir }: Request, ids: string[]): Shot | null {
  const gl = getRenderer();
  if (!gl) return null;
  const parts = ids.map((id) => project.parts.find((p) => p.id === id)).filter((p) => p !== undefined);
  if (!parts.length) return null;

  const scene = new THREE.Scene();
  const owned: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(x: T) => (owned.push(x), x);
  const bounds = new THREE.Box3();
  const pieces = parts.map((part) => {
    const exact = meshes.get(part.id);
    // Sin la forma exacta todavía, la caja de la pieza.
    const box = partBox(part);
    const size = box.max.map((v, i) => v - box.min[i]!) as [number, number, number];
    const geometry = exact?.geometry ?? own(new THREE.BoxGeometry(...size).translate(...(box.min.map((v, i) => v + size[i]! / 2) as [number, number, number])));
    const edges = exact?.edges ?? own(new THREE.EdgesGeometry(geometry));
    geometry.computeBoundingBox();
    bounds.union(geometry.boundingBox!);
    const ghost = !!ghosts?.has(part.id);
    const fill = own(
      new THREE.MeshStandardMaterial({
        color: colors.get(part.id) ?? '#d9bc8c',
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        ...(ghost ? { transparent: true, opacity: 0.28, depthWrite: false } : {}),
      }),
    );
    const mesh = new THREE.Mesh(geometry, fill);
    const line = new THREE.LineSegments(edges, own(new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: ghost ? 0.3 : 0.85, depthWrite: !ghost })));
    // Los velos se dibujan después de lo macizo, para que se vea a través.
    if (ghost) mesh.renderOrder = line.renderOrder = 1;
    scene.add(mesh, line);
    return { id: part.id, geometry, mesh, ghost };
  });
  scene.add(new THREE.HemisphereLight('#ffffff', '#a89c88', 1.9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.5);
  sun.position.set(0.6, 1, 0.8);
  scene.add(sun);

  // Cámara ortogonal en diagonal: encuadra las esquinas de todo lo que se ve, con un poco de aire.
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, radius * 4 + 10);
  camera.position.copy(center).addScaledVector(dir ? new THREE.Vector3(...dir).normalize() : DIR, radius * 2 + 5);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const inv = camera.matrixWorldInverse;
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Vector3(i & 1 ? bounds.max.x : bounds.min.x, i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z).applyMatrix4(inv);
    [x0, x1, y0, y1] = [Math.min(x0, c.x), Math.max(x1, c.x), Math.min(y0, c.y), Math.max(y1, c.y)];
  }
  const pad = 1.06;
  const aspect = width / height;
  let halfW = ((x1 - x0) / 2) * pad;
  let halfH = ((y1 - y0) / 2) * pad;
  if (halfW / halfH > aspect) halfH = halfW / aspect;
  else halfW = halfH * aspect;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  Object.assign(camera, { left: mx - halfW, right: mx + halfW, top: my + halfH, bottom: my - halfH });
  camera.updateProjectionMatrix();

  gl.setPixelRatio(1);
  gl.setSize(width, height, false);
  gl.setRenderTarget(null);
  gl.clear();
  gl.render(scene, camera);
  const url = gl.domElement.toDataURL('image/png');

  let shotLabels: ShotLabel[] = [];
  let hidden: string[] = [];
  if (labels) ({ labels: shotLabels, hidden } = findLabels(gl, scene, camera, pieces, width, height));
  // Los velos no tienen código.
  shotLabels = shotLabels.filter((l) => !ghosts?.has(l.id));

  for (const x of owned) x.dispose();
  return { url, labels: shotLabels, hidden };
}

/**
 * Pinta cada pieza de un color plano, sin luces ni bordes, y para cada una busca el punto visible más lejos
 * de sus bordes (distancia de tablero de ajedrez, en dos pasadas): ahí el código se lee y no pisa la pieza de al lado.
 */
function findLabels(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  pieces: { id: string; mesh: THREE.Mesh; ghost?: boolean }[],
  width: number,
  height: number,
): { labels: ShotLabel[]; hidden: string[] } {
  const w = Math.max(1, Math.round(width / 3));
  const h = Math.max(1, Math.round(height / 3));
  const target = new THREE.WebGLRenderTarget(w, h);
  const saved = pieces.map((p) => p.mesh.material);
  const flat = pieces.map((_, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB((i + 1) / 255, 0, 0, THREE.LinearSRGBColorSpace), toneMapped: false }));
  pieces.forEach((p, i) => (p.mesh.material = flat[i]!));
  const ghostMeshes = new Set(pieces.filter((p) => p.ghost).map((p) => p.mesh));
  const hiddenObjects = scene.children.filter((o) => !(o instanceof THREE.Mesh) || ghostMeshes.has(o));
  for (const o of hiddenObjects) o.visible = false;
  gl.setRenderTarget(target);
  gl.setClearColor(0x000000, 0);
  gl.clear();
  gl.render(scene, camera);
  const px = new Uint8Array(w * h * 4);
  gl.readRenderTargetPixels(target, 0, 0, w, h, px);
  gl.setRenderTarget(null);
  for (const o of hiddenObjects) o.visible = true;
  pieces.forEach((p, i) => (p.mesh.material = saved[i]!));
  flat.forEach((m) => m.dispose());
  target.dispose();

  // Las filas vienen de abajo hacia arriba.
  const id = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) id[(h - 1 - y) * w + x] = px[(y * w + x) * 4 + 3]! > 0 ? px[(y * w + x) * 4]! : 0;
  const dist = new Int32Array(w * h);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : id[y * w + x]!);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (!id[k]) continue;
      const same = (dx: number, dy: number) => at(x + dx, y + dy) === id[k];
      dist[k] = same(-1, 0) && same(0, -1) && same(-1, -1) && same(1, -1) ? 1 + Math.min(dist[k - 1]!, dist[k - w]!, dist[k - w - 1]!, dist[k - w + 1]!) : 1;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const k = y * w + x;
      if (!id[k]) continue;
      const same = (dx: number, dy: number) => at(x + dx, y + dy) === id[k];
      const next = same(1, 0) && same(0, 1) && same(1, 1) && same(-1, 1) ? 1 + Math.min(dist[k + 1]!, dist[k + w]!, dist[k + w + 1]!, dist[k + w - 1]!) : 1;
      dist[k] = Math.min(dist[k]!, next);
    }
  const best = new Map<number, { d: number; k: number }>();
  for (let k = 0; k < w * h; k++) {
    if (!id[k]) continue;
    const b = best.get(id[k]!);
    if (!b || dist[k]! > b.d) best.set(id[k]!, { d: dist[k]!, k });
  }
  const labels: ShotLabel[] = [];
  const hidden: string[] = [];
  pieces.forEach((p, i) => {
    const b = best.get(i + 1);
    // Menos de un par de píxeles a la vista: se nombra en la tabla, no en el dibujo.
    if (!b || b.d < 2) hidden.push(p.id);
    else labels.push({ id: p.id, x: ((b.k % w) + 0.5) / w, y: (Math.floor(b.k / w) + 0.5) / h });
  });
  return { labels, hidden };
}

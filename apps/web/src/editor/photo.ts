import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { formatLength, furnitureBox, partBox, t, type Project } from '@kitc/core';
import type { PartMesh } from '../geometry/protocol';
import { makeWoodMaterial, setGrainUniforms } from './woodMaterial';

/**
 * La foto del mueble: las piezas con su veta, una luz de estudio armada por código (el cuarto con ventanas que trae
 * three, sin descargar nada), una luz principal con sombra suave y el mueble apoyado en un piso que solo muestra la
 * sombra. Se dibuja en el equipo, cuando se pide.
 */

export type PhotoAngle = 'der' | 'izq' | 'frente' | 'costado' | 'arriba';
export type PhotoBackground = 'blanco' | 'claro' | 'estudio' | 'transparente';

/** Desde dónde se mira: adelante a la derecha (como el editor), adelante a la izquierda, de frente, de costado o de arriba. */
const ANGLES: Record<PhotoAngle, THREE.Vector3> = {
  der: new THREE.Vector3(1, 0.62, 1.25),
  izq: new THREE.Vector3(-1, 0.62, 1.25),
  frente: new THREE.Vector3(0, 0.16, 1),
  costado: new THREE.Vector3(1, 0.16, 0),
  arriba: new THREE.Vector3(0.35, 1.6, 0.9),
};

export const BACKGROUNDS: Record<Exclude<PhotoBackground, 'transparente'>, [string, string]> = {
  blanco: ['#ffffff', '#ffffff'],
  claro: ['#f7f5ef', '#ebe6da'],
  estudio: ['#eceae6', '#c9c6bf'],
};

/** Una pieza como la manda el motor: la malla exacta en su lugar del mueble. */
export type PhotoMesh = Pick<PartMesh, 'id' | 'vertices' | 'normals' | 'triangles'>;

export interface PhotoOptions {
  angle: PhotoAngle;
  /** De dónde viene la luz, en grados: 0 desde adelante a la izquierda, positivo hacia la derecha. */
  light: number;
  background: PhotoBackground;
}

export const DEFAULT_PHOTO: PhotoOptions = { angle: 'der', light: 0, background: 'claro' };

/** El estudio armado: se le cambia la vista, la luz y el fondo sin volver a armarlo. */
export interface PhotoStudio {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** El mueble: centro y radio, para encuadrar. */
  center: THREE.Vector3;
  radius: number;
  set(options: PhotoOptions, aspect: number): void;
  /** Encuadra de nuevo con la cámara donde está (después de girarla con el mouse). */
  aim(aspect: number): void;
  dispose(): void;
}

function gradient(top: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const fill = g.createLinearGradient(0, 0, 0, 256);
  fill.addColorStop(0, top);
  fill.addColorStop(1, bottom);
  g.fillStyle = fill;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Una mancha de sombra suave bajo el mueble: lo asienta en el piso aunque la luz venga de costado. */
function contactShadow(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const fill = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  fill.addColorStop(0, 'rgba(0,0,0,0.55)');
  fill.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  fill.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fill;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Arma el estudio con las piezas que se ven. Las que no tienen malla del motor van como su caja. */
export function buildStudio(renderer: THREE.WebGLRenderer, project: Project, meshes: readonly PhotoMesh[], hidden: ReadonlySet<string> = new Set()): PhotoStudio {
  const scene = new THREE.Scene();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => (owned.push(x), x);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = keep(pmrem.fromScene(room, 0.04).texture);
  scene.environmentIntensity = 0.42;
  room.dispose();
  pmrem.dispose();

  const byId = new Map(meshes.map((m) => [m.id, m]));
  const box = new THREE.Box3();
  for (const part of project.parts) {
    if (hidden.has(part.id)) continue;
    const m = byId.get(part.id);
    let geometry: THREE.BufferGeometry;
    let at = new THREE.Vector3();
    if (m) {
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(m.vertices, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(m.triangles, 1));
    } else if (part.base.kind === 'box') {
      const b = partBox(part);
      const size = b.max.map((v, i) => v - b.min[i]!) as [number, number, number];
      geometry = new THREE.BoxGeometry(...size);
      at = new THREE.Vector3(...b.min.map((v, i) => v + size[i]! / 2));
    } else continue;
    keep(geometry);
    const material = keep(makeWoodMaterial({ roughness: 0.58, metalness: 0 }));
    setGrainUniforms(material, part);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(at);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    mesh.updateMatrixWorld();
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
  }
  if (box.isEmpty()) {
    const f = furnitureBox(project.parts);
    if (f) box.set(new THREE.Vector3(...f.min), new THREE.Vector3(...f.max));
    else box.set(new THREE.Vector3(-300, 0, -300), new THREE.Vector3(300, 600, 300));
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = size.length() / 2;
  const floorY = box.min.y;

  // Luz de relleno del cielo y el piso, y la principal, con sombra.
  scene.add(new THREE.HemisphereLight('#fffaf0', '#b7aa94', 0.5));
  const sun = new THREE.DirectionalLight('#fff4e2', 1.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  sun.shadow.radius = 14;
  sun.shadow.blurSamples = 16;
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -radius * 1.6;
  sc.right = sc.top = radius * 1.6;
  sc.near = radius * 0.5;
  sc.far = radius * 8;
  sun.target.position.copy(center);
  scene.add(sun, sun.target);

  // El piso: solo la sombra, para que se vea el fondo elegido.
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(radius * 30, radius * 30)), keep(new THREE.ShadowMaterial({ opacity: 0.22 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center.x, floorY, center.z);
  floor.receiveShadow = true;
  scene.add(floor);
  const blob = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(size.x * 1.35 + 120, size.z * 1.35 + 120)),
    keep(new THREE.MeshBasicMaterial({ map: keep(contactShadow()), transparent: true, depthWrite: false, opacity: 0.55 })),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(center.x, floorY + 0.3, center.z);
  scene.add(blob);

  const camera = new THREE.PerspectiveCamera(28, 1, Math.max(1, radius / 50), radius * 40);
  let backgroundTex: THREE.Texture | null = null;

  const aim = (aspect: number) => {
    camera.aspect = aspect;
    const dir = camera.position.clone().sub(center).normalize();
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const dist = (radius * 1.08) / Math.sin(Math.min(vHalf, hHalf));
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  };

  return {
    scene,
    camera,
    center,
    radius,
    set(o, aspect) {
      camera.position.copy(center).add(ANGLES[o.angle].clone().normalize());
      aim(aspect);
      // La luz principal: arriba, adelante, y girada según `light` alrededor del mueble.
      const a = THREE.MathUtils.degToRad(o.light);
      const from = new THREE.Vector3(-0.7, 2.1, 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), -a).normalize();
      sun.position.copy(center).addScaledVector(from, radius * 4);
      backgroundTex?.dispose();
      backgroundTex = o.background === 'transparente' ? null : gradient(...BACKGROUNDS[o.background]);
      scene.background = backgroundTex;
    },
    aim,
    dispose() {
      backgroundTex?.dispose();
      owned.forEach((x) => x.dispose());
    },
  };
}

/** Prepara el dibujante para fotos: colores fieles, sombras suaves. */
export function setupRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.setClearColor(0xffffff, 0);
}

/** "Ancho 180 cm · Alto 75 cm · Fondo 90 cm": lo que ocupa el mueble. */
export function sizeCaption(project: Project): string {
  const b = furnitureBox(project.parts);
  if (!b) return '';
  const f = (i: number) => formatLength(b.max[i]! - b.min[i]!, project.units);
  return t('Ancho {w} · Alto {h} · Fondo {d}', { w: f(0), h: f(1), d: f(2) });
}

export interface PhotoFile {
  width: number;
  height: number;
  /** Medidas generales escritas abajo, o nada. */
  caption?: string;
  type: 'image/jpeg' | 'image/png';
}

/** Lado más largo de cada tamaño. */
export const PHOTO_SIZES = { pantalla: 1600, alta: 2800, muy: 4096 } as const;
export type PhotoSize = keyof typeof PHOTO_SIZES;

/**
 * Dibuja la foto en grande y la devuelve como archivo. El dibujante cambia de tamaño un momento y vuelve al de antes.
 * La leyenda va en una franja abajo, en letra del sistema.
 */
export async function takePhoto(renderer: THREE.WebGLRenderer, studio: PhotoStudio, file: PhotoFile): Promise<Blob> {
  const max = Math.min(renderer.capabilities.maxTextureSize, 4096);
  const k = Math.min(1, max / Math.max(file.width, file.height));
  const w = Math.round(file.width * k);
  const h = Math.round(file.height * k);
  const before = renderer.getSize(new THREE.Vector2());
  const ratio = renderer.getPixelRatio();
  const aspect = studio.camera.aspect;
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  studio.aim(w / h);
  renderer.render(studio.scene, studio.camera);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d')!;
  // Un JPG no tiene transparencia: sin fondo, va blanco.
  if (file.type === 'image/jpeg' && !studio.scene.background) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
  }
  g.drawImage(renderer.domElement, 0, 0);
  if (file.caption) {
    const size = Math.round(h * 0.026);
    g.font = `500 ${size}px Inter, system-ui, -apple-system, 'Segoe UI', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#2b3628';
    g.fillText(file.caption, w / 2, h - size * 1.6);
  }

  renderer.setPixelRatio(ratio);
  renderer.setSize(before.x, before.y, false);
  studio.aim(aspect);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('foto'))), file.type, 0.92));
}

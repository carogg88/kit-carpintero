import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTable, parseLength, TABLE_DEFAULTS, woodById, type Project } from '@kitc/core';
import type { FromWorker, PartMesh } from '../geometry/protocol';
import '../styles/tokens.css';
import '../styles/base.css';
import './style.css';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = document.querySelector<HTMLElement>('.stage')!;
const loading = $('loading');
const results = $('results');
const buttons = ['rebuild', 'one', 'xray', 'copy'].map((id) => $<HTMLButtonElement>(id));
const [rebuildBtn, oneBtn, xrayBtn, copyBtn] = buttons as [HTMLButtonElement, HTMLButtonElement, HTMLButtonElement, HTMLButtonElement];

// ---------- Escena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0xb9ad98, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(1500, 2500, 1800);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(35, 1, 10, 40000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const group = new THREE.Group();
scene.add(group);

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);

function frame(project: Project) {
  const b = new THREE.Box3();
  for (const p of project.parts) {
    if (p.base.kind !== 'box') continue;
    const min = new THREE.Vector3(...p.position);
    b.union(new THREE.Box3(min, min.clone().add(new THREE.Vector3(...p.base.size))));
  }
  const c = b.getCenter(new THREE.Vector3());
  const r = b.getSize(new THREE.Vector3()).length() / 2;
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const dist = (r / Math.sin(Math.min(vHalf, hHalf))) * 1.05;
  camera.position.copy(c).add(new THREE.Vector3(1, 0.72, 1.15).normalize().multiplyScalar(dist));
  controls.target.copy(c);
  controls.update();
}

(function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})();

// ---------- Piezas ----------
let xray = false;
const meshes = new Map<string, THREE.Object3D>();
function show(parts: PartMesh[], project: Project) {
  for (const pm of parts) {
    const old = meshes.get(pm.id);
    if (old) {
      group.remove(old);
      old.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    const part = project.parts.find((p) => p.id === pm.id)!;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pm.vertices, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(pm.normals, 3));
    geo.setIndex(new THREE.BufferAttribute(pm.triangles, 1));
    const mat = new THREE.MeshStandardMaterial({
      color: woodById(part.wood)?.color ?? '#D9BC8C',
      roughness: 0.75,
      transparent: true,
      opacity: xray ? 0.25 : 1,
      depthWrite: !xray,
    });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(pm.edges, 3));
    g.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x6b4a2b, transparent: true, opacity: 0.55 })));
    group.add(g);
    meshes.set(pm.id, g);
  }
}

function setXray(on: boolean) {
  xray = on;
  xrayBtn.setAttribute('aria-pressed', String(on));
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const m = o.material as THREE.MeshStandardMaterial;
      m.opacity = on ? 0.25 : 1;
      m.depthWrite = !on;
    }
  });
}

// ---------- Resultados ----------
const stats: Record<string, string> = {};
const warnings = new Set<string>();
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s` : `${Math.round(ms)} ms`);
function render() {
  results.replaceChildren();
  for (const [k, v] of Object.entries(stats)) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    results.append(dt, dd);
  }
  for (const w of warnings) {
    const p = document.createElement('dd');
    p.className = 'warn';
    p.textContent = w;
    results.append(p);
  }
}
const nav = navigator as Navigator & { deviceMemory?: number };
stats['Procesadores'] = String(navigator.hardwareConcurrency ?? '?');
if (nav.deviceMemory) stats['Memoria'] = `${nav.deviceMemory} GB`;
render();

// ---------- Motor ----------
let project = createTable();
const worker = new Worker(new URL('../geometry/worker.ts', import.meta.url), { type: 'module' });
let pending: { label: string; only?: string[] } | null = null;

function build(label: string, only?: string[]) {
  pending = { label, ...(only ? { only } : {}) };
  buttons.forEach((b) => (b.disabled = true));
  worker.postMessage({ type: 'build', project, ...(only ? { only } : {}) });
}

worker.onmessage = (e: MessageEvent<FromWorker>) => {
  const msg = e.data;
  if (msg.type === 'ready') {
    stats['Abrir el motor'] = fmtMs(msg.ms);
    render();
    loading.textContent = 'Calculando la mesa…';
    resize();
    frame(project);
    build('Calcular 9 piezas');
  } else if (msg.type === 'parts') {
    loading.hidden = true;
    show(msg.parts, project);
    stats[pending?.label ?? 'Calcular'] = fmtMs(msg.ms);
    if (msg.parts.length > 1) {
      const slow = msg.parts.reduce((a, b) => (b.ms > a.ms ? b : a));
      stats['Pieza más lenta'] = `${slow.id} · ${fmtMs(slow.ms)}`;
    }
    msg.parts.forEach((p) => p.warning && warnings.add(`${p.id}: ${p.warning}`));
    render();
    buttons.forEach((b) => (b.disabled = false));
  } else {
    loading.hidden = false;
    loading.textContent = `No se pudo calcular: ${msg.message}`;
    buttons.forEach((b) => (b.disabled = false));
  }
};
worker.postMessage({ type: 'init' });

rebuildBtn.onclick = () => {
  const r = parseLength($<HTMLInputElement>('radius').value, 'cm');
  const radius = r === null ? TABLE_DEFAULTS.edgeRadius : r / 10;
  project = createTable({ ...TABLE_DEFAULTS, edgeRadius: radius });
  warnings.clear();
  build('Recalcular todo');
};
oneBtn.onclick = () => build('Recalcular una pata', ['P3']);
xrayBtn.onclick = () => setXray(!xray);
copyBtn.onclick = async () => {
  const text = [`Prueba de geometría · ${navigator.userAgent}`, ...Object.entries(stats).map(([k, v]) => `${k}: ${v}`), ...warnings].join('\n');
  try {
    await navigator.clipboard.writeText(text);
    $('copied').textContent = 'Copiado. Pegalo en el chat del proyecto.';
  } catch {
    $('copied').textContent = text;
  }
};

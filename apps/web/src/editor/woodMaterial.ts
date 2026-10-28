import { useEffect, useMemo, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { finishLook, grainFrame, woodById, type Finish, type FinishLook, type Part } from '@kitc/core';

/**
 * La veta en 3D, calculada en la placa de video: cada punto de la pieza sabe a qué distancia está de la médula de un
 * tronco imaginario (ver `grainFrame`), y eso da los anillos. En la cara se ven rayas y arcos; en la punta, anillos.
 * No hay imágenes: cada madera es un puñado de números.
 */

/** Cómo es cada madera: ancho de anillo (mm), cuánto se nota el leño de verano, cuánto ondula y el poro. */
interface Look {
  kind: 'solid' | 'plies' | 'mdf' | 'plain';
  ring: number;
  contrast: number;
  wobble: number;
  pores: number;
  /** Espesor de cada capa, en las placas de chapas. */
  ply?: number;
}

const LOOKS: Record<string, Look> = {
  guatambu: { kind: 'solid', ring: 5, contrast: 0.32, wobble: 0.5, pores: 0.22 },
  paraiso: { kind: 'solid', ring: 8, contrast: 0.7, wobble: 0.9, pores: 0.4 },
  cedro: { kind: 'solid', ring: 7, contrast: 0.6, wobble: 0.8, pores: 0.35 },
  lapacho: { kind: 'solid', ring: 4, contrast: 0.55, wobble: 1.6, pores: 0.55 },
  algarrobo: { kind: 'solid', ring: 6, contrast: 0.55, wobble: 1.3, pores: 0.4 },
  pino: { kind: 'solid', ring: 10, contrast: 0.9, wobble: 0.7, pores: 0.08 },
  terciado: { kind: 'plies', ring: 9, contrast: 0.55, wobble: 0.9, pores: 0.15, ply: 3 },
  multilaminado: { kind: 'plies', ring: 8, contrast: 0.45, wobble: 0.7, pores: 0.12, ply: 1.5 },
  mdf: { kind: 'mdf', ring: 1, contrast: 0, wobble: 0, pores: 0.25 },
  melamina: { kind: 'plain', ring: 1, contrast: 0, wobble: 0, pores: 0 },
};
const DEFAULT_LOOK: Look = { kind: 'solid', ring: 7, contrast: 0.55, wobble: 0.9, pores: 0.3 };
const KIND = { solid: 0, plies: 1, mdf: 2, plain: 3 } as const;

export const woodLook = (wood: string): Look => LOOKS[wood] ?? DEFAULT_LOOK;

// ── Veta sí o no ────────────────────────────────────────────────────────────

/** En este navegador: si se dibuja la veta o el color liso (para equipos lentos o para trabajar sin distracción). */
const GRAIN_KEY = 'kitc:veta';
const listeners = new Set<() => void>();
function readGrain(): boolean {
  try {
    return localStorage.getItem(GRAIN_KEY) !== 'no';
  } catch {
    return true;
  }
}
let grainOn = readGrain();
export function setGrainOn(on: boolean): void {
  grainOn = on;
  try {
    localStorage.setItem(GRAIN_KEY, on ? 'si' : 'no');
  } catch {
    // Sin almacenamiento: vale mientras la página esté abierta.
  }
  listeners.forEach((l) => l());
}
export function useGrainOn(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => grainOn,
    () => true,
  );
}

// ── El sombreador ───────────────────────────────────────────────────────────

const VERT_HEAD = /* glsl */ `
varying vec3 vGPos;
varying vec3 vGNrm;
uniform mat4 uRest;
`;

const FRAG_HEAD = /* glsl */ `
varying vec3 vGPos;
varying vec3 vGNrm;
uniform vec3 uOrigin;
uniform vec3 uAlong;
uniform vec3 uAcross;
uniform vec3 uUp;
uniform vec3 uLight;
uniform vec3 uDark;
uniform float uRing;
uniform float uContrast;
uniform float uWobble;
uniform float uPores;
uniform float uSeed;
uniform float uKind;
uniform float uPly;
uniform float uBack;
uniform vec3 uCut;
uniform vec3 uFinTint;
uniform float uFinAmt;
uniform float uFinDarken;
uniform float uFinWarm;
uniform float uFinOpaque;

/** Lo oscuro del leño de verano en este punto: el tinte se mete más ahí y en los poros. */
float gLate = 0.0;

float gHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float gNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

vec3 woodColor() {
  vec3 d = vGPos - uOrigin;
  float a = dot(d, uAlong);
  float b = dot(d, uAcross);
  float c = dot(d, uUp);
  vec3 n = normalize(vGNrm);
  float endGrain = smoothstep(0.6, 0.9, abs(dot(n, uAlong)));
  vec3 s = vec3(uSeed * 37.0, uSeed * 11.0, uSeed * 23.0);

  if (uKind > 2.5) return uLight;
  if (uKind > 1.5) {
    // MDF: fibra pareja, apenas moteada; el canto se ve más poroso y oscuro.
    float m = gNoise(vGPos * 0.35 + s) * 0.6 + gNoise(vGPos * 1.3 + s) * 0.4;
    vec3 col = mix(uLight, uDark, m * uPores);
    float edge = 1.0 - smoothstep(0.6, 0.9, abs(dot(n, uUp)));
    return col * (1.0 - edge * 0.12);
  }

  // Los anillos: distancia a la médula, ondulada lento a lo largo y un poco a lo ancho.
  vec3 q = vec3(a * 0.0022, b * 0.012, c * 0.012) + s;
  float warp = (gNoise(q) - 0.5) * 2.0 * uWobble * uRing * 2.2 + (gNoise(q * 3.1) - 0.5) * uWobble * uRing * 0.7;
  float r = length(vec2(b, c)) + warp + sin(a * 0.0032 + uSeed * 6.2832) * uRing * 1.2;
  float ring = r / uRing;
  float t = fract(ring);
  // Leño de verano: una banda más oscura y dura al final de cada anillo.
  float late = smoothstep(0.5, 0.86, t) * (1.0 - smoothstep(0.9, 1.0, t));
  // Poros: rayitas finas a lo largo de la veta.
  float pores = gNoise(vec3(a * 0.04, b * 0.9, c * 0.9) + s * 2.0);
  float k = clamp(late * uContrast + (pores - 0.5) * uPores, 0.0, 1.0);
  gLate = k;
  vec3 col = mix(uLight, uDark, k);
  // Cada anillo con su tono: la madera no es pareja.
  col *= 0.95 + 0.1 * gHash(vec3(floor(ring), uSeed * 13.0, 1.0));
  // La testa absorbe la luz: más oscura.
  col *= 1.0 - endGrain * 0.16;

  if (uKind > 0.5) {
    // Terciado y multilaminado: en el canto se ven las capas, una a lo largo y otra cruzada, con la cola entre medio.
    float face = smoothstep(0.6, 0.9, abs(dot(n, uUp)));
    float layer = (c + uBack) / uPly;
    float cross = mod(floor(layer), 2.0);
    float glue = smoothstep(0.08, 0.0, fract(layer)) + smoothstep(0.92, 1.0, fract(layer));
    vec3 edgeCol = mix(col, mix(uLight, uDark, 0.35 + pores * 0.3), cross * 0.8);
    edgeCol *= 1.0 - glue * 0.25;
    col = mix(edgeCol, col, face);
  }
  return col;
}

/** La terminación sobre la madera: la pintura tapa todo; el aceite oscurece y entibia; el tinte tiñe más la veta. */
vec3 finishColor(vec3 col) {
  if (uFinOpaque > 0.5) return uFinTint * (0.97 + gNoise(vGPos * 0.8) * 0.05);
  col *= 1.0 - uFinDarken;
  col = mix(col, col * vec3(1.08, 0.93, 0.76), uFinWarm);
  if (uFinAmt > 0.0) {
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float amt = clamp(uFinAmt * (0.8 + 0.5 * gLate), 0.0, 1.0);
    col = mix(col, uFinTint * (0.55 + 0.9 * lum), amt);
  }
  return col;
}
`;

/** Los números de una pieza que cambian al moverla o cambiarle la madera. */
type Uniforms = Record<string, THREE.IUniform>;

function makeUniforms(): Uniforms {
  return {
    uOrigin: { value: new THREE.Vector3() },
    uAlong: { value: new THREE.Vector3(0, 1, 0) },
    uAcross: { value: new THREE.Vector3(1, 0, 0) },
    uUp: { value: new THREE.Vector3(0, 0, 1) },
    uLight: { value: new THREE.Color() },
    uDark: { value: new THREE.Color() },
    uRing: { value: 7 },
    uContrast: { value: 0.5 },
    uWobble: { value: 1 },
    uPores: { value: 0.3 },
    uSeed: { value: 0 },
    uKind: { value: 0 },
    uPly: { value: 3 },
    uBack: { value: 0 },
    uRest: { value: new THREE.Matrix4() },
    uCut: { value: new THREE.Color() },
    uFinTint: { value: new THREE.Color() },
    uFinAmt: { value: 0 },
    uFinDarken: { value: 0 },
    uFinWarm: { value: 0 },
    uFinOpaque: { value: 0 },
  };
}

/**
 * Un material con veta: el físico de three (por la capa de laca que refleja), con el color de cada punto calculado
 * por la veta y la terminación.
 */
export function makeWoodMaterial(params: THREE.MeshPhysicalMaterialParameters = {}): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.75, metalness: 0, ...params });
  const uniforms = makeUniforms();
  m.userData.grain = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = VERT_HEAD + shader.vertexShader
      // La veta se calcula con la pieza cerrada: un cajón abierto lleva su veta, no la deja en el lugar.
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vGPos = (uRest * modelMatrix * vec4(transformed, 1.0)).xyz;')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n  vGNrm = mat3(uRest) * mat3(modelMatrix) * objectNormal;');
    // Con un corte se ve el adentro de la pieza (sus caras de atrás): va de un color parejo, como madera cortada.
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = gl_FrontFacing ? finishColor(woodColor()) : uCut;');
  };
  // Un solo programa para todas las piezas: cambian los números, no el código.
  m.customProgramCacheKey = () => 'kitc-veta';
  return m;
}

/** Tono más claro y más oscuro de la madera, a partir de su color de muestra. */
function tones(hex: string, look: Look): [THREE.Color, THREE.Color] {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(hsl);
  const light = new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(0.95, hsl.l + 0.03));
  if (look.kind === 'mdf') return [light, new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l * 0.8)];
  // El leño de verano: más oscuro, más cálido y más saturado (en el pino, casi ámbar).
  const dark = new THREE.Color().setHSL(hsl.h - 0.02, Math.min(1, hsl.s * 1.1 + 0.04), hsl.l * (1 - 0.42 * Math.max(look.contrast, 0.4)));
  return [light, dark];
}

/** Pone en el material la veta de la pieza: dónde está su tronco y de qué madera es. */
export function setGrainUniforms(m: THREE.Material, part: Part, color?: string): void {
  const u = m.userData.grain as Uniforms | undefined;
  if (!u) return;
  const look = woodLook(part.wood);
  const [light, dark] = tones(color ?? woodById(part.wood)?.color ?? '#D9BC8C', look);
  (u.uLight!.value as THREE.Color).copy(light);
  (u.uDark!.value as THREE.Color).copy(dark);
  u.uRing!.value = look.ring;
  u.uContrast!.value = look.contrast;
  u.uWobble!.value = look.wobble;
  u.uPores!.value = look.pores;
  u.uKind!.value = KIND[look.kind];
  u.uPly!.value = look.ply ?? 3;
  const f = grainFrame(part);
  (u.uOrigin!.value as THREE.Vector3).set(...(f?.origin ?? [0, -500, 0]));
  (u.uAlong!.value as THREE.Vector3).set(...(f?.along ?? [0, 1, 0]));
  (u.uAcross!.value as THREE.Vector3).set(...(f?.across ?? [1, 0, 0]));
  (u.uUp!.value as THREE.Vector3).set(...(f?.up ?? [0, 0, 1]));
  u.uSeed!.value = f?.seed ?? 0;
  u.uBack!.value = f?.back ?? 0;
  (u.uCut!.value as THREE.Color).copy(light).lerp(dark, 0.55);
}

/** Pone la terminación: el color que cambia en el sombreador, y el brillo y la capa de laca en el material. */
export function setFinish(m: THREE.MeshPhysicalMaterial, finish: Finish | undefined | FinishLook): void {
  const look = finish && 'roughness' in finish ? finish : finishLook(finish);
  const u = m.userData.grain as Uniforms | undefined;
  if (u) {
    (u.uFinTint!.value as THREE.Color).set(look.color ?? '#000000');
    u.uFinAmt!.value = look.color ? look.amount : 0;
    u.uFinDarken!.value = look.darken;
    u.uFinWarm!.value = look.warm;
    u.uFinOpaque!.value = look.opaque ? 1 : 0;
  }
  m.roughness = look.roughness;
  // Con capa o sin capa son dos programas distintos: al cambiar, se arma el que corresponde.
  if (m.clearcoat > 0 !== look.clearcoat > 0) m.needsUpdate = true;
  m.clearcoat = look.clearcoat;
  m.clearcoatRoughness = look.clearcoatRoughness;
}

/** Color liso, sin veta (con la veta apagada, o una pieza de señal en el detalle de la unión). */
function setPlainUniforms(m: THREE.Material, part: Part, color: string): void {
  setGrainUniforms(m, part, color);
  const u = m.userData.grain as Uniforms;
  u.uKind!.value = KIND.plain;
  (u.uLight!.value as THREE.Color).set(color);
  (u.uCut!.value as THREE.Color).set(color).multiplyScalar(0.72);
}

/**
 * La pieza corrida (un cajón abierto, una puerta girada): la veta se sigue calculando donde estaba cerrada.
 * `matrix` es la que la corre; sin ella, la pieza está en su lugar.
 */
export function setGrainMotion(m: THREE.Material, matrix: THREE.Matrix4 | null): void {
  const u = m.userData.grain as Uniforms | undefined;
  if (!u) return;
  const rest = u.uRest!.value as THREE.Matrix4;
  if (matrix) rest.copy(matrix).invert();
  else rest.identity();
}

/** Corta el material con estos planos (o ninguno), y muestra sus caras de atrás, que son el adentro de la pieza. */
function setClip(m: THREE.Material, clip: THREE.Plane[] | null): void {
  m.clippingPlanes = clip;
  m.side = clip ? THREE.DoubleSide : THREE.FrontSide;
  m.needsUpdate = true;
}

/**
 * El material de una pieza: con veta si está prendida, o del color liso de la madera. Los demás detalles (elegida,
 * rayos X) los pone quien la dibuja, sobre este material.
 */
export function usePartMaterial(part: Part, color?: string, grain = true, clip: THREE.Plane[] | null = null, finish?: Finish): THREE.MeshPhysicalMaterial {
  const on = useGrainOn() && grain;
  // Siempre el mismo sombreador: con la veta apagada pinta liso, y así el corte y el movimiento andan igual.
  const material = useMemo(() => makeWoodMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  // Con un corte se dibujan también las caras de atrás: son el adentro de la pieza.
  useEffect(() => setClip(material, clip), [material, clip]);
  // Los números cambian sin que React lo vea: se pide otro cuadro.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate());
  if (on) setGrainUniforms(material, part, color);
  else setPlainUniforms(material, part, color ?? woodById(part.wood)?.color ?? '#D9BC8C');
  setFinish(material, finish);
  return material;
}

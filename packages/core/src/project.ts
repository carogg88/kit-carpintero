import { z } from 'zod';

/**
 * Archivo de proyecto. Es la única fuente de verdad: el 3D, el plano y la lista de cortes
 * se calculan a partir de acá. Cada cambio de forma sube SCHEMA_VERSION y suma una migración.
 */
export const SCHEMA_VERSION = 4;

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

/** Forma base de la pieza, antes de cortes y redondeos. Medidas en mm. */
export const BaseShape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('box'), size: Vec3 }),
  z.object({ kind: z.literal('cylinder'), diameter: z.number().positive(), length: z.number().positive() }),
]);
export type BaseShape = z.infer<typeof BaseShape>;

/** Operaciones sobre la pieza, en orden. Los cortes de encastres salen de `joints`, no de acá. */
export const Operation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('round'), edges: z.union([z.literal('all'), z.array(z.string())]), radius: z.number().positive() }),
  z.object({ kind: z.literal('chamfer'), edges: z.union([z.literal('all'), z.array(z.string())]), size: z.number().positive() }),
]);
export type Operation = z.infer<typeof Operation>;

/** Figura dibujada en una cara. u, v: medidas desde la esquina mínima de la pieza sobre los otros dos ejes. */
export const PocketShape = z.discriminatedUnion('kind', [
  /** Rectángulo: (u, v) es la esquina más cercana al origen. */
  z.object({ kind: z.literal('rect'), u: z.number(), v: z.number(), w: z.number().positive(), h: z.number().positive() }),
  /** Círculo: (u, v) es el centro. */
  z.object({ kind: z.literal('circle'), u: z.number(), v: z.number(), d: z.number().positive() }),
]);
export type PocketShape = z.infer<typeof PocketShape>;

/** Vaciado o calado: una figura dibujada en una cara que se saca de la pieza. */
export const Pocket = z.object({
  id: z.string(),
  /** Eje perpendicular a la cara y de qué lado está (1 la del máximo, -1 la del mínimo). */
  axis: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  side: z.union([z.literal(1), z.literal(-1)]),
  shape: PocketShape,
  depth: z.number().positive(),
  /** Calado: atraviesa la pieza y la profundidad no cuenta. */
  through: z.boolean().default(false),
});
export type Pocket = z.infer<typeof Pocket>;

const Face = z.object({ axis: z.union([z.literal(0), z.literal(1), z.literal(2)]), side: z.union([z.literal(1), z.literal(-1)]) });

/**
 * Bisel o corte en ángulo sobre una arista: la que forman la cara `a` (donde se marcó) y la cara vecina `b`.
 * Saca la cuña que va de `da` mm adentro de la cara a hasta `db` mm adentro de la cara b, a todo lo largo.
 * Si `da` cruza toda la cara, es un corte en ángulo de la punta o del canto.
 */
export const Bevel = z.object({
  id: z.string(),
  a: Face,
  b: Face,
  da: z.number().positive(),
  db: z.number().positive(),
});
export type Bevel = z.infer<typeof Bevel>;

export const Part = z.object({
  id: z.string(),
  name: z.string(),
  wood: z.string(),
  base: BaseShape,
  /** Esquina mínima de la forma base sin rotar, en mm (X ancho, Y alto, Z fondo). */
  position: Vec3,
  /** Rotación en grados alrededor de X, Y, Z. */
  rotation: Vec3.default([0, 0, 0]),
  ops: z.array(Operation).default([]),
  /** Vaciados y calados dibujados en las caras, en orden. */
  pockets: z.array(Pocket).default([]),
  /** Biseles y cortes en ángulo sobre las aristas. */
  bevels: z.array(Bevel).default([]),
  /** Componente al que pertenece: todas sus copias comparten forma, madera y operaciones. */
  component: z.string().optional(),
});
export type Part = z.infer<typeof Part>;

/** Componente: piezas iguales vinculadas. La forma vive en cada copia y se mantiene igual en todas. */
export const Component = z.object({ id: z.string(), name: z.string() });
export type Component = z.infer<typeof Component>;

export const JOINT_TYPES = [
  // P1
  'tope', 'mortaja', 'media-madera', 'canal', 'rebaje', 'clavija',
  // P2
  'cola-milano', 'dedos', 'brida', 'inglete', 'galleta', 'machiembrado', 'bolsillo',
] as const;
export const JointType = z.enum(JOINT_TYPES);
export type JointType = z.infer<typeof JointType>;

export const Joint = z.object({
  id: z.string(),
  type: JointType,
  /** Pieza que recibe (la mortaja). */
  partA: z.string(),
  /** Pieza que entra (la espiga). */
  partB: z.string(),
  params: z.record(z.string(), z.number()).default({}),
});
export type Joint = z.infer<typeof Joint>;

export const Project = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  units: z.enum(['cm', 'in']),
  template: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  parts: z.array(Part),
  joints: z.array(Joint),
  components: z.array(Component).default([]),
});
export type Project = z.infer<typeof Project>;

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] lleva un proyecto de la versión n a la n + 1. */
const migrations: Record<number, Migration> = {
  // v2 suma los componentes; los proyectos anteriores no tienen ninguno.
  1: (d) => ({ ...d, components: [] }),
  // v3 suma los vaciados de cada pieza; el esquema los completa vacíos.
  2: (d) => d,
  3: (d) => d,
};

export type LoadResult = { ok: true; project: Project } | { ok: false; error: string };

/** Abre un proyecto guardado: lo migra a la versión actual y lo valida. */
export function loadProject(raw: unknown): LoadResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'El archivo no es un proyecto.' };
  let data = raw as Record<string, unknown>;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    return { ok: false, error: 'El proyecto es de una versión más nueva de la app.' };
  }
  while (version < SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) return { ok: false, error: `No se puede abrir un proyecto de la versión ${version}.` };
    data = { ...migrate(data), schemaVersion: version + 1 };
    version += 1;
  }
  const parsed = Project.safeParse(data);
  return parsed.success ? { ok: true, project: parsed.data } : { ok: false, error: z.prettifyError(parsed.error) };
}

import { t, tk } from './i18n';
import type { Finish, Part, Project } from './project';
import { isSheet } from './woods';

/**
 * Terminaciones: lo que se le pasa a la madera al final. Una para todo el mueble y, si hace falta, otra por pieza
 * (tapa laqueada y patas con aceite). Dicen cómo se ve en 3D, qué comprar y cómo se aplica. Los colores son
 * orientativos: el resultado real depende de la madera y de la marca.
 */

export const FINISH_IDS = [
  'natural',
  'aceite',
  'cera',
  'lustre',
  'laca-mate',
  'laca-satinada',
  'laca-brillante',
  'tinte-roble',
  'tinte-nogal',
  'tinte-caoba',
  'tinte-wengue',
  'ebonizado',
  'pintura',
] as const;
export type FinishId = (typeof FINISH_IDS)[number];

/** Cómo cambia el render: lo que se oscurece y entibia la madera, el tinte, el brillo y la capa que refleja. */
export interface FinishLook {
  /** 0 a 1: cuánto se oscurece (el aceite "moja" la madera). */
  darken: number;
  /** 0 a 1: cuánto se entibia hacia el ámbar (aceite, lustre). */
  warm: number;
  /** Color del tinte o de la pintura. */
  color?: string;
  /** 0 a 1: cuánto tapa el tinte; la pintura tapa todo. */
  amount: number;
  /** Si tapa la veta (pintura). */
  opaque: boolean;
  roughness: number;
  /** Capa transparente que refleja la luz (lacas, lustre). */
  clearcoat: number;
  clearcoatRoughness: number;
}

export interface FinishDef {
  id: FinishId;
  name: string;
  /** Una frase: para qué sirve. */
  about: string;
  look: FinishLook;
  /** Manos, horas entre manos y con qué se pule entre manos. */
  coats: number;
  dry: number;
  between: string;
  /** Cómo se aplica, en una frase. */
  how: string;
  /** Aguante al agua y al calor, de 1 a 3: para avisar si una tapa de mesa queda desprotegida. */
  resists: 1 | 2 | 3;
}

const LACQUER_HOW = tk('Pasala con pincel o rodillo de espuma, finita y a favor de la veta.');
const STAIN_HOW = tk('Pasá el tinte con un trapo, dejalo unos minutos y sacá el sobrante; cuando seque, dos manos de laca satinada.');

export const FINISHES: readonly FinishDef[] = [
  {
    id: 'natural',
    name: tk('Natural, sin terminación'),
    about: tk('La madera como queda lijada. Se mancha y se ensucia: solo para piezas que no se tocan.'),
    look: { darken: 0, warm: 0, amount: 0, opaque: false, roughness: 0.75, clearcoat: 0, clearcoatRoughness: 0 },
    coats: 0,
    dry: 0,
    between: '',
    how: '',
    resists: 1,
  },
  {
    id: 'aceite',
    name: tk('Aceite'),
    about: tk('Resalta la veta y la deja al tacto. Se repara fácil: otra mano y listo.'),
    look: { darken: 0.16, warm: 0.22, amount: 0, opaque: false, roughness: 0.55, clearcoat: 0, clearcoatRoughness: 0 },
    coats: 3,
    dry: 24,
    between: tk('lana de acero 000'),
    how: tk('Pasalo con un trapo, dejalo 15 minutos y sacá todo el sobrante.'),
    resists: 2,
  },
  {
    id: 'cera',
    name: tk('Cera'),
    about: tk('Suave y con poco brillo. Protege poco: para piezas que no reciben agua.'),
    look: { darken: 0.08, warm: 0.1, amount: 0, opaque: false, roughness: 0.42, clearcoat: 0, clearcoatRoughness: 0 },
    coats: 2,
    dry: 1,
    between: tk('un paño de lana'),
    how: tk('Pasala con un trapo en círculos y, cuando opaque, lustrá con un paño.'),
    resists: 1,
  },
  {
    id: 'lustre',
    name: tk('Lustre a muñeca'),
    about: tk('Goma laca: el brillo profundo de los muebles antiguos. Se marca con agua y calor.'),
    look: { darken: 0.12, warm: 0.4, amount: 0, opaque: false, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12 },
    coats: 6,
    dry: 2,
    between: tk('lija al agua grano 600'),
    how: tk('Con la muñeca (algodón envuelto en un trapo) cargada de goma laca, en pasadas largas y sin parar.'),
    resists: 1,
  },
  {
    id: 'laca-mate',
    name: tk('Laca mate'),
    about: tk('Protege y casi no se ve: la madera parece natural.'),
    look: { darken: 0.06, warm: 0.04, amount: 0, opaque: false, roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.6 },
    coats: 3,
    dry: 4,
    between: tk('lija grano 320'),
    how: LACQUER_HOW,
    resists: 3,
  },
  {
    id: 'laca-satinada',
    name: tk('Laca satinada'),
    about: tk('Un brillo suave que protege bien: la más usada en tapas y frentes.'),
    look: { darken: 0.07, warm: 0.05, amount: 0, opaque: false, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.35 },
    coats: 3,
    dry: 4,
    between: tk('lija grano 320'),
    how: LACQUER_HOW,
    resists: 3,
  },
  {
    id: 'laca-brillante',
    name: tk('Laca brillante'),
    about: tk('Brillo de espejo. Muestra cada polvito y cada raya: hay que lijar muy bien antes.'),
    look: { darken: 0.08, warm: 0.06, amount: 0, opaque: false, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 },
    coats: 3,
    dry: 4,
    between: tk('lija grano 400'),
    how: LACQUER_HOW,
    resists: 3,
  },
  ...(
    [
      ['tinte-roble', tk('Tinte roble y laca'), '#b5844b', 0.45],
      ['tinte-nogal', tk('Tinte nogal y laca'), '#5e3b22', 0.62],
      ['tinte-caoba', tk('Tinte caoba y laca'), '#7c2f1d', 0.6],
      ['tinte-wengue', tk('Tinte wengué y laca'), '#3a2a20', 0.75],
      ['ebonizado', tk('Ebonizado y laca'), '#1f1b19', 0.88],
    ] as const
  ).map(
    ([id, name, color, amount]): FinishDef => ({
      id,
      name,
      about: tk('Cambia el color de la madera y deja ver la veta; encima, laca satinada.'),
      look: { darken: 0.05, warm: 0, color, amount, opaque: false, roughness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.35 },
      coats: 3,
      dry: 4,
      between: tk('lija grano 320'),
      how: STAIN_HOW,
      resists: 3,
    }),
  ),
  {
    id: 'pintura',
    name: tk('Pintura'),
    about: tk('Del color que quieras. Tapa la veta: ideal para MDF y pino.'),
    look: { darken: 0, warm: 0, color: '#e8e3d6', amount: 1, opaque: true, roughness: 0.5, clearcoat: 0, clearcoatRoughness: 0 },
    coats: 2,
    dry: 6,
    between: tk('lija grano 240'),
    how: tk('Primero una mano de fondo; después la pintura con rodillo de espuma, finita.'),
    resists: 3,
  },
];

const BY_ID = new Map(FINISHES.map((f) => [f.id, f]));
export const finishById = (id: string): FinishDef | undefined => BY_ID.get(id as FinishId);

/** Colores para la pintura, para elegir con un toque. */
export const PAINT_COLORS = ['#e8e3d6', '#ffffff', '#2f3b32', '#56707a', '#b9775a', '#d9b25f', '#262626'] as const;

/** Lo que va en una pieza: la suya, o la del mueble. La melamina ya viene terminada: nunca lleva otra. */
export function partFinish(project: Pick<Project, 'finish'>, part: Part): Finish | undefined {
  if (part.wood === 'melamina') return undefined;
  return part.finish ?? project.finish;
}

/** Si se eligió alguna terminación en el proyecto (si no, la lista de compras dice "aceite, cera o lustre"). */
export const hasFinishes = (project: Pick<Project, 'finish' | 'parts'>) => !!project.finish || project.parts.some((p) => p.finish);

/** El render de una terminación; la pintura con su color. */
export function finishLook(f: Finish | undefined): FinishLook {
  const def = (f && finishById(f.id)) ?? FINISHES[0]!;
  return f?.id === 'pintura' && f.color ? { ...def.look, color: f.color } : def.look;
}

/** "Laca satinada", "Pintura #56707a": el nombre, ya traducido. */
export function finishName(f: Finish | undefined): string {
  const def = f && finishById(f.id);
  return def ? t(def.name) : t('Sin elegir');
}

/**
 * Qué hacer en el último paso del armado con esta terminación, en una línea: cuántas manos, cuánto secado y con qué
 * se pule entre manos.
 */
export function finishSteps(f: Finish): string {
  const def = finishById(f.id);
  if (!def || def.id === 'natural') return t('Sin terminación: solo lijá con grano 220.');
  return t('{how} {coats} manos, {dry} h entre una y otra; entre manos, {between}.', { how: t(def.how), coats: def.coats, dry: def.dry, between: t(def.between) });
}

/** Superficies a terminar por terminación, en m²: las mismas piezas que se lijan (sin traseras ni fondos finos). */
export function finishAreas(project: Project, surface: (p: Part) => number, visible: (p: Part) => boolean): Map<string, { finish: Finish; m2: number; mdf: number }> {
  const out = new Map<string, { finish: Finish; m2: number; mdf: number }>();
  for (const p of project.parts) {
    const f = partFinish(project, p);
    if (!f || f.id === 'natural' || !visible(p) || (isSheet(p.wood) && p.wood !== 'mdf' && p.wood !== 'terciado' && p.wood !== 'multilaminado')) continue;
    const key = f.id === 'pintura' ? `pintura|${f.color ?? ''}` : f.id;
    const row = out.get(key) ?? { finish: f, m2: 0, mdf: 0 };
    const a = surface(p) / 1e6;
    row.m2 += a;
    if (p.wood === 'mdf') row.mdf += a;
    out.set(key, row);
  }
  return out;
}

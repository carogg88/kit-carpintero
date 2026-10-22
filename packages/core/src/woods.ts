import { tk } from './i18n';

/** Maderas habituales en madereras de Buenos Aires. */
export type Hardness = 'dura' | 'semidura' | 'blanda';

export interface Wood {
  id: string;
  name: string;
  hardness: Hardness;
  /** Color base para el render y las muestras. */
  color: string;
  /** Cómo es y cómo se trabaja, en una o dos oraciones. En español: se traduce al mostrarlo, con `t`. */
  about: string;
}

export const WOODS = [
  { id: 'guatambu', name: 'Guatambú', hardness: 'semidura', color: '#D9BC8C', about: tk('Semidura, clara y de veta fina. Se trabaja bien a máquina y toma bien el lustre.') },
  { id: 'paraiso', name: 'Paraíso', hardness: 'semidura', color: '#B9804F', about: tk('Semidura, liviana y de veta marcada, entre rosada y castaña. Fácil de trabajar; muy usada en muebles de interior.') },
  { id: 'cedro', name: 'Cedro', hardness: 'semidura', color: '#A8653E', about: tk('Semidura, aromática y estable. Se trabaja muy bien y aguanta la humedad; ideal para cajones y cajas.') },
  { id: 'lapacho', name: 'Lapacho', hardness: 'dura', color: '#7C4D2C', about: tk('Dura, pesada y muy resistente, de color castaño verdoso. Pide herramientas bien afiladas y dura años al exterior.') },
  { id: 'algarrobo', name: 'Algarrobo', hardness: 'dura', color: '#8C5836', about: tk('Dura y estable, de color castaño rojizo. Clásica en mesas macizas; se trabaja bien con buen filo.') },
  { id: 'pino', name: 'Pino paraná', hardness: 'blanda', color: '#E8D1A6', about: tk('Blanda, clara y económica. Fácil de trabajar pero se marca con los golpes; buena para prototipos y muebles livianos.') },
] as const satisfies readonly Wood[];

export type WoodId = (typeof WOODS)[number]['id'];

/**
 * Placas que venden los corralones y las casas de placas de Buenos Aires. Se compran enteras (o se piden
 * cortadas a medida) y no se cepillan: el espesor es el de la placa.
 */
export interface Sheet {
  id: string;
  name: string;
  color: string;
  about: string;
  /** Largo y ancho de la placa entera, en mm. */
  size: [number, number];
  /** Espesores que se consiguen, en mm. */
  thicknesses: number[];
  /** Tiene veta: las piezas van con el largo a lo largo de la placa. */
  grain: boolean;
  /** Los cantos a la vista se tapan con tapacanto. */
  banding: boolean;
}

export const SHEETS = [
  {
    id: 'mdf',
    name: 'MDF',
    color: '#C4A27A',
    size: [2600, 1830],
    thicknesses: [3, 5.5, 9, 12, 15, 18, 25, 30],
    grain: false,
    banding: false,
    about: tk('Placa de fibra, lisa y pareja, sin veta. Se pinta o se laquea muy bien; no le gusta la humedad y los tornillos en el canto se aflojan.'),
  },
  {
    id: 'melamina',
    name: tk('Melamina blanca'),
    color: '#ECEAE4',
    size: [2600, 1830],
    thicknesses: [15, 18, 25],
    grain: false,
    banding: true,
    about: tk('Aglomerado con cara plástica, lista para usar: no se pinta ni se lustra. Los cantos a la vista llevan tapacanto y se arma con tarugos o tornillos.'),
  },
  {
    id: 'terciado',
    name: tk('Terciado'),
    color: '#D9BB86',
    size: [2440, 1220],
    thicknesses: [4, 5.5, 9, 12, 15, 18],
    grain: true,
    banding: false,
    about: tk('Chapas de madera encoladas cruzadas: liviano, firme y económico. Ideal para traseras y fondos de cajón.'),
  },
  {
    id: 'multilaminado',
    name: tk('Multilaminado'),
    color: '#E3C795',
    size: [2200, 1600],
    thicknesses: [9, 12, 15, 18, 25],
    grain: true,
    banding: false,
    about: tk('Terciado de muchas capas finas y sin huecos: muy estable y con el canto prolijo para dejarlo a la vista. Para cuerpos de muebles y cajones.'),
  },
] as const satisfies readonly Sheet[];

/** Una madera maciza o una placa. */
export type Material = Wood | Sheet;

export function sheetById(id: string): Sheet | undefined {
  return (SHEETS as readonly Sheet[]).find((s) => s.id === id);
}

export const isSheet = (id: string) => sheetById(id) !== undefined;

export function woodById(id: string): Material | undefined {
  return (WOODS as readonly Wood[]).find((w) => w.id === id) ?? sheetById(id);
}

/** Otras maderas para sugerir: primero las de la misma dureza. Para una placa, las otras placas. */
export function woodAlternatives(id: string): Material[] {
  if (isSheet(id)) return (SHEETS as readonly Sheet[]).filter((x) => x.id !== id);
  const w = (WOODS as readonly Wood[]).find((x) => x.id === id);
  const rest: Wood[] = WOODS.filter((x) => x.id !== id);
  return w ? [...rest.filter((x) => x.hardness === w.hardness), ...rest.filter((x) => x.hardness !== w.hardness)] : rest;
}

/** Espesor de placa más cercano a `mm` (para ajustar una pieza al pasarla a placa). */
export function nearestSheetThickness(sheet: Sheet, mm: number): number {
  return sheet.thicknesses.reduce((best, v) => (Math.abs(v - mm) < Math.abs(best - mm) ? v : best), sheet.thicknesses[0]!);
}

/**
 * Material de una trasera o un fondo de cajón fino: la misma placa si viene en ese espesor, si no terciado.
 * En macizo, una tabla de 9 mm hay que sacarla rebajando una de 1/2″; el terciado es lo que se usa.
 */
export function thinPanelMaterial(wood: string, mm: number): string {
  const s = sheetById(wood);
  return s && sheetThicknessOk(s, mm) ? wood : 'terciado';
}

const sheetThicknessOk = (s: Sheet, mm: number) => s.thicknesses.some((v) => Math.abs(v - mm) < 0.5);

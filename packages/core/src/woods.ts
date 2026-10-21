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

export function woodById(id: string): Wood | undefined {
  return WOODS.find((w) => w.id === id);
}

/** Otras maderas para sugerir: primero las de la misma dureza. */
export function woodAlternatives(id: string): Wood[] {
  const w = woodById(id);
  const rest: Wood[] = WOODS.filter((x) => x.id !== id);
  return w ? [...rest.filter((x) => x.hardness === w.hardness), ...rest.filter((x) => x.hardness !== w.hardness)] : rest;
}

/** Maderas habituales en madereras de Buenos Aires. */
export type Hardness = 'dura' | 'semidura' | 'blanda';

export interface Wood {
  id: string;
  name: string;
  hardness: Hardness;
  /** Color base para el render y las muestras. */
  color: string;
}

export const WOODS = [
  { id: 'guatambu', name: 'Guatambú', hardness: 'semidura', color: '#D9BC8C' },
  { id: 'paraiso', name: 'Paraíso', hardness: 'semidura', color: '#B9804F' },
  { id: 'cedro', name: 'Cedro', hardness: 'semidura', color: '#A8653E' },
  { id: 'lapacho', name: 'Lapacho', hardness: 'dura', color: '#7C4D2C' },
  { id: 'algarrobo', name: 'Algarrobo', hardness: 'dura', color: '#8C5836' },
  { id: 'pino', name: 'Pino paraná', hardness: 'blanda', color: '#E8D1A6' },
] as const satisfies readonly Wood[];

export type WoodId = (typeof WOODS)[number]['id'];

export function woodById(id: string): Wood | undefined {
  return WOODS.find((w) => w.id === id);
}

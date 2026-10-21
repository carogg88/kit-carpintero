/** Medidas sacadas de la foto que esperan en el formulario de la plantilla. Viven solo en memoria. */
import type { Units } from '@kitc/core';

export interface Draft {
  template: string;
  values: Record<string, number>;
  units: Units;
}

let draft: Draft | null = null;

export const setDraft = (d: Draft) => {
  draft = d;
};

/** Las medidas de la foto para esa plantilla, si hay. */
export const peekDraft = (template: string): Draft | null => (draft?.template === template ? draft : null);

export const clearDraft = () => {
  draft = null;
};

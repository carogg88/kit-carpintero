import { buildTemplate, t, templateById, templateDefaults } from '@kitc/core';
import { saveProject } from '../storage/db';
import { EDITOR_TOUR, useTour } from './Tour';

/** Para quien entra por primera vez: guarda un taburete armado y deja pedido el recorrido por el editor. Devuelve su id. */
export async function startPracticeStool(): Promise<string | null> {
  const def = templateById('taburete');
  if (!def) return null;
  const p = { ...buildTemplate(def, templateDefaults(def), 'guatambu', def.joints?.default), name: t('Taburete de práctica') };
  await saveProject(p);
  useTour.getState().queue(EDITOR_TOUR);
  return p.id;
}

import { t, type Project } from '@kitc/core';

/** Cuándo se exportó cada proyecto por última vez, en este navegador. */
const exportKey = (id: string) => `kitc:exportado:${id}`;
export function readExported(id: string): string | null {
  try {
    return localStorage.getItem(exportKey(id));
  } catch {
    return null;
  }
}

/** Nombre del proyecto que sirve como nombre de archivo. */
export const fileName = (p: Project) => p.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || t('proyecto');

/** Baja un texto (o unos bytes) como archivo. */
export function saveFile(name: string, text: string | Uint8Array<ArrayBuffer>, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Baja el proyecto como archivo .kitc.json y anota cuándo. Devuelve esa fecha. */
export function download(p: Project) {
  saveFile(`${fileName(p)}.kitc.json`, JSON.stringify(p, null, 2), 'application/json');
  const at = new Date().toISOString();
  try {
    localStorage.setItem(exportKey(p.id), at);
  } catch {
    // Sin almacenamiento: el recordatorio vuelve a aparecer.
  }
  return at;
}
